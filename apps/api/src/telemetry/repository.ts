import { FalkorDBManager, graphManager } from '../graph/client.js';
import {
  TelemetryEvent,
  IngestionResponse,
  Evidence,
  EventProcessingStatus,
  EventProcessingState,
} from '@neutrino/contracts';
import { TelemetryNormalizer } from './normalizer.js';

export interface TelemetryRepositoryOptions {
  customManager?: FalkorDBManager;
  graphName?: string;
}

export class TelemetryRepository {
  private manager: FalkorDBManager;
  private graphName: string;
  // Concurrency guard: prevents simultaneous duplicate payloads from racing
  private inFlightHashes = new Set<string>();

  constructor(options?: TelemetryRepositoryOptions) {
    this.manager = options?.customManager || graphManager;
    this.graphName = options?.graphName || process.env.FALKORDB_GRAPH_NAME || 'neutrino_graph';
  }

  private async getGraph() {
    return this.manager.getGraph(this.graphName);
  }

  /**
   * Helper to execute database operations with bounded exponential backoff retries
   * Handles transient database errors safely without infinite loops
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 50
  ): Promise<{ result: T; retries: number }> {
    let attempt = 0;
    while (true) {
      try {
        const result = await operation();
        return { result, retries: attempt };
      } catch (err: any) {
        attempt++;
        const msg = String(err?.message || '');
        const isTransient =
          msg.includes('connection') ||
          msg.includes('timeout') ||
          msg.includes('busy') ||
          msg.includes('EAI_AGAIN') ||
          msg.includes('ECONNRESET');

        if (attempt >= maxRetries || !isTransient) {
          throw err;
        }

        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  /**
   * Records or updates the processing state of an ingested event
   */
  public async setEventStatus(status: EventProcessingStatus): Promise<void> {
    try {
      const graph = await this.getGraph();
      await graph.query(
        `MERGE (s:EventProcessingStatus {eventId: $eventId})
         SET s.tenantId = $tenantId,
             s.state = $state,
             s.timestamp = $timestamp,
             s.retryCount = $retryCount,
             s.error = $error,
             s.contentHash = $contentHash`,
        {
          params: {
            eventId: status.eventId,
            tenantId: status.tenantId,
            state: status.state,
            timestamp: status.timestamp,
            retryCount: status.retryCount || 0,
            error: status.error || '',
            contentHash: status.contentHash || '',
          },
        }
      );
    } catch (err) {
      // In-memory or logging fallback if status write fails
      console.warn('[TelemetryRepository] Failed to update event status node:', err);
    }
  }

  /**
   * Retrieves the current processing status of an event
   */
  public async getEventStatus(eventId: string, tenantId = 'tenant-default'): Promise<EventProcessingStatus | null> {
    try {
      const graph = await this.getGraph();
      const res = await graph.query(
        `MATCH (s:EventProcessingStatus {eventId: $id})
         WHERE s.tenantId = $tenantId OR s.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND s.tenantId IS NULL)
         RETURN s LIMIT 1`,
        { params: { id: eventId, tenantId } }
      );

      if (!res.data || res.data.length === 0) return null;
      const p = res.data[0].s.properties || res.data[0].s;
      return {
        eventId: p.eventId,
        tenantId: p.tenantId,
        state: p.state as EventProcessingState,
        timestamp: p.timestamp,
        retryCount: Number(p.retryCount || 0),
        error: p.error || undefined,
        contentHash: p.contentHash || undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Ingests a batch of telemetry events into FalkorDB with idempotent deduplication,
   * concurrency synchronization, and transient error retry.
   */
  public async ingestBatch(events: TelemetryEvent[], callerTenantId?: string): Promise<IngestionResponse> {
    const graph = await this.getGraph();
    let accepted = 0;
    let duplicated = 0;
    let rejected = 0;
    const eventIds: string[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const targetTenantId = callerTenantId || event.tenantId || 'tenant-default';
      event.tenantId = targetTenantId;

      try {
        // Validation & Normalization
        const normalized = TelemetryNormalizer.normalize(event);
        const ev = normalized.evidence;
        const lockKey = `${targetTenantId}::${ev.contentHash}`;

        // Initial received status
        await this.setEventStatus({
          eventId: ev.id,
          tenantId: targetTenantId,
          state: 'validated',
          timestamp: new Date().toISOString(),
          contentHash: ev.contentHash,
        });

        // Concurrency Lock: Check if identical hash is in flight locally or across distributed workers
        const lockAcquired = !this.inFlightHashes.has(lockKey) && (await this.manager.acquireLock(lockKey, 30));
        if (!lockAcquired) {
          duplicated++;
          await this.setEventStatus({
            eventId: ev.id,
            tenantId: targetTenantId,
            state: 'duplicate',
            timestamp: new Date().toISOString(),
            contentHash: ev.contentHash,
          });
          continue;
        }

        this.inFlightHashes.add(lockKey);

        try {
          // 1. Check for duplicate by contentHash or evidence ID in FalkorDB
          const dupCheck = await graph.query(
            `MATCH (e:Evidence)
             WHERE (e.contentHash = $hash OR e.id = $id)
               AND (e.tenantId = $tenantId OR e.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND e.tenantId IS NULL))
             RETURN e.id LIMIT 1`,
            { params: { hash: ev.contentHash, id: ev.id, tenantId: targetTenantId } }
          );

          if (dupCheck.data && dupCheck.data.length > 0) {
            duplicated++;
            await this.setEventStatus({
              eventId: ev.id,
              tenantId: targetTenantId,
              state: 'duplicate',
              timestamp: new Date().toISOString(),
              contentHash: ev.contentHash,
            });
            continue;
          }

          // 2. Persist Evidence node with bounded retry
          const { retries } = await this.executeWithRetry(async () => {
            await graph.query(
              `MERGE (e:Evidence {id: $id})
               SET e.tenantId = $tenantId,
                   e.sourceType = $sourceType,
                   e.sourceRecordId = $sourceRecordId,
                   e.observedAt = $observedAt,
                   e.ingestedAt = $ingestedAt,
                   e.summary = $summary,
                   e.content = $content,
                   e.contentHash = $contentHash,
                   e.synthetic = $synthetic,
                   e.reliabilityClass = $reliabilityClass`,
              {
                params: {
                  id: ev.id,
                  tenantId: targetTenantId,
                  sourceType: ev.sourceType,
                  sourceRecordId: ev.sourceRecordId,
                  observedAt: ev.observedAt,
                  ingestedAt: ev.ingestedAt,
                  summary: ev.summary,
                  content: ev.content,
                  contentHash: ev.contentHash,
                  synthetic: ev.synthetic,
                  reliabilityClass: ev.reliabilityClass,
                },
              }
            );

            // 3. Link to Service via [:OBSERVED_ON] if service exists in FalkorDB
            if (normalized.serviceId) {
              await graph.query(
                `MATCH (e:Evidence {id: $evId}), (s:Service {id: $svcId})
                 WHERE s.tenantId = $tenantId OR s.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND s.tenantId IS NULL)
                 MERGE (e)-[:OBSERVED_ON]->(s)`,
                { params: { evId: ev.id, svcId: normalized.serviceId, tenantId: targetTenantId } }
              );
            }

            // 4. Link to active Incident if service is currently affected
            if (normalized.serviceId) {
              await graph.query(
                `MATCH (e:Evidence {id: $evId}), (i:Incident)-[:AFFECTS]->(s:Service {id: $svcId})
                 WHERE i.status IN ['investigating', 'identified', 'monitoring']
                   AND (i.tenantId = $tenantId OR i.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND i.tenantId IS NULL))
                 MERGE (e)-[:OBSERVED_IN]->(i)`,
                { params: { evId: ev.id, svcId: normalized.serviceId, tenantId: targetTenantId } }
              );
            }
          });

          accepted++;
          eventIds.push(ev.id);

          await this.setEventStatus({
            eventId: ev.id,
            tenantId: targetTenantId,
            state: 'persisted',
            timestamp: new Date().toISOString(),
            retryCount: retries,
            contentHash: ev.contentHash,
          });
        } finally {
          this.inFlightHashes.delete(lockKey);
          await this.manager.releaseLock(lockKey);
        }
      } catch (err: any) {
        rejected++;
        errors.push({ index: i, error: err.message || 'Unknown ingestion error' });

        await this.setEventStatus({
          eventId: event.id || `EV-FAIL-${i}-${Date.now()}`,
          tenantId: targetTenantId,
          state: 'failed',
          timestamp: new Date().toISOString(),
          error: err.message,
        });
      }
    }

    return {
      accepted,
      duplicated,
      rejected,
      eventIds,
      errors,
    };
  }

  /**
   * List recently ingested evidence records isolated by tenant
   */
  public async getRecentEvidence(limit = 25, tenantId = 'tenant-default'): Promise<Evidence[]> {
    const graph = await this.getGraph();
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const res = await graph.query(
      `MATCH (e:Evidence)
       WHERE e.tenantId = $tenantId OR e.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND e.tenantId IS NULL)
       RETURN e
       ORDER BY e.observedAt DESC
       LIMIT $limit`,
      { params: { limit: safeLimit, tenantId } }
    );

    return (res.data || []).map((r: any) => (r.e.properties ? { ...r.e.properties } : r.e));
  }

  /**
   * Retrieve evidence connected to a specific service isolated by tenant
   */
  public async getEvidenceForService(serviceId: string, limit = 20, tenantId = 'tenant-default'): Promise<Evidence[]> {
    const graph = await this.getGraph();
    const res = await graph.query(
      `MATCH (e:Evidence)-[:OBSERVED_ON]->(s:Service {id: $svcId})
       WHERE (s.tenantId = $tenantId OR s.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND s.tenantId IS NULL))
         AND (e.tenantId = $tenantId OR e.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND e.tenantId IS NULL))
       RETURN e
       ORDER BY e.observedAt DESC
       LIMIT $limit`,
      { params: { svcId: serviceId, limit, tenantId } }
    );
    return (res.data || []).map((r: any) => (r.e.properties ? { ...r.e.properties } : r.e));
  }
}

export const telemetryRepository = new TelemetryRepository();
