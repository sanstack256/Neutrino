import { OperationalMetricsResponse } from '@neutrino/contracts';

export class MetricsRegistry {
  private startTime = Date.now();

  private ingestionReceived = 0;
  private ingestionPersisted = 0;
  private ingestionDuplicates = 0;
  private ingestionRejected = 0;
  private ingestionRetryableFailures = 0;
  private ingestionFailed = 0;
  private ingestionLatencyTotalMs = 0;

  private investigationsTotal = 0;
  private investigationsCompleted = 0;
  private investigationsFailed = 0;
  private investigationsDurationTotalMs = 0;

  private actionsProposed = 0;
  private actionsApproved = 0;
  private actionsExecuted = 0;
  private actionsRejected = 0;

  private graphQueriesTotal = 0;
  private graphQueryLatencyTotalMs = 0;

  public recordIngestion(outcome: {
    received: number;
    persisted: number;
    duplicates: number;
    rejected: number;
    retryableFailures?: number;
    failed?: number;
    durationMs: number;
  }) {
    this.ingestionReceived += outcome.received;
    this.ingestionPersisted += outcome.persisted;
    this.ingestionDuplicates += outcome.duplicates;
    this.ingestionRejected += outcome.rejected;
    this.ingestionRetryableFailures += outcome.retryableFailures || 0;
    this.ingestionFailed += outcome.failed || 0;
    this.ingestionLatencyTotalMs += outcome.durationMs;
  }

  public recordInvestigation(outcome: {
    status: 'completed' | 'failed';
    durationMs: number;
  }) {
    this.investigationsTotal++;
    if (outcome.status === 'completed') {
      this.investigationsCompleted++;
    } else {
      this.investigationsFailed++;
    }
    this.investigationsDurationTotalMs += outcome.durationMs;
  }

  public recordAction(type: 'proposed' | 'approved' | 'executed' | 'rejected') {
    if (type === 'proposed') this.actionsProposed++;
    else if (type === 'approved') this.actionsApproved++;
    else if (type === 'executed') this.actionsExecuted++;
    else if (type === 'rejected') this.actionsRejected++;
  }

  public recordGraphQuery(durationMs: number) {
    this.graphQueriesTotal++;
    this.graphQueryLatencyTotalMs += durationMs;
  }

  public getSnapshot(): OperationalMetricsResponse {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    const avgIngestionLatency =
      this.ingestionReceived > 0
        ? Number((this.ingestionLatencyTotalMs / this.ingestionReceived).toFixed(2))
        : 0;

    const avgInvestigationDuration =
      this.investigationsTotal > 0
        ? Number((this.investigationsDurationTotalMs / this.investigationsTotal).toFixed(2))
        : 0;

    const avgQueryLatency =
      this.graphQueriesTotal > 0
        ? Number((this.graphQueryLatencyTotalMs / this.graphQueriesTotal).toFixed(2))
        : 0;

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      ingestion: {
        received: this.ingestionReceived,
        persisted: this.ingestionPersisted,
        duplicates: this.ingestionDuplicates,
        rejected: this.ingestionRejected,
        retryableFailures: this.ingestionRetryableFailures,
        failed: this.ingestionFailed,
        avgLatencyMs: avgIngestionLatency,
      },
      investigations: {
        total: this.investigationsTotal,
        completed: this.investigationsCompleted,
        failed: this.investigationsFailed,
        avgDurationMs: avgInvestigationDuration,
      },
      actions: {
        proposed: this.actionsProposed,
        approved: this.actionsApproved,
        executed: this.actionsExecuted,
        rejected: this.actionsRejected,
      },
      graph: {
        queriesExecuted: this.graphQueriesTotal,
        avgQueryLatencyMs: avgQueryLatency,
      },
    };
  }
}

export const metricsRegistry = new MetricsRegistry();
