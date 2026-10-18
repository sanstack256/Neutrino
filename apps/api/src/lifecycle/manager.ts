import { FalkorDBManager, graphManager } from '../graph/client.js';
import {
  LifecyclePruneRequest,
  LifecyclePruneResult,
  LifecycleRetentionPolicy,
} from '@neutrino/contracts';
import { auditRepository } from '../audit/repository.js';

export interface LifecycleManagerOptions {
  customManager?: FalkorDBManager;
  graphName?: string;
}

export class GraphLifecycleManager {
  private manager: FalkorDBManager;
  private graphName: string;

  constructor(options?: LifecycleManagerOptions) {
    this.manager = options?.customManager || graphManager;
    this.graphName = options?.graphName || process.env.FALKORDB_GRAPH_NAME || 'neutrino_graph';
  }

  private async getGraph() {
    return this.manager.getGraph(this.graphName);
  }

  /**
   * Safe, tenant-isolated lifecycle prune operation with dry-run support,
   * active incident protection, investigation reference protection, and memory provenance preservation.
   */
  public async prune(request: LifecyclePruneRequest, tenantId = 'tenant-default', principalId = 'system'): Promise<LifecyclePruneResult> {
    const graph = await this.getGraph();
    const dryRun = request.dryRun !== false;
    const batchSize = Math.min(Math.max(1, request.batchSize || 100), 500);
    const olderThanDays = Math.max(1, request.olderThanDays || 30);
    const cutoffDate = new Date(Date.now() - olderThanDays * 86400 * 1000).toISOString();

    let candidatesIdentified = 0;
    let recordsPruned = 0;
    let recordsPreserved = 0;
    const preservedReasons: Record<string, number> = {
      active_incident: 0,
      investigation_reference: 0,
      memory_provenance: 0,
      action_proposal_reference: 0,
    };

    // 1. Process Telemetry / Evidence
    if (request.category === 'telemetry' || request.category === 'evidence' || request.category === 'all') {
      const candidatesRes = await graph.query(
        `MATCH (e:Evidence)
         WHERE e.observedAt < $cutoff
           AND (e.tenantId = $tenantId OR e.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND e.tenantId IS NULL))
         RETURN e.id AS id, e.observedAt AS observedAt
         LIMIT $limit`,
        { params: { cutoff: cutoffDate, tenantId, limit: batchSize } }
      );

      const candidateIds: string[] = (candidatesRes.data || []).map((r: any) => r.id);
      candidatesIdentified += candidateIds.length;

      for (const evId of candidateIds) {
        // Check active incident protection
        const incRes = await graph.query(
          `MATCH (e:Evidence {id: $id})-[:OBSERVED_IN]->(i:Incident)
           WHERE i.status IN ['investigating', 'identified', 'monitoring']
           RETURN i.id LIMIT 1`,
          { params: { id: evId } }
        );
        if (incRes.data && incRes.data.length > 0) {
          preservedReasons.active_incident = (preservedReasons.active_incident || 0) + 1;
          recordsPreserved++;
          continue;
        }

        // Check investigation / hypothesis reference protection
        const hypRes = await graph.query(
          `MATCH (h:Hypothesis)-[:SUPPORTED_BY|CONTRADICTED_BY]->(e:Evidence {id: $id})
           RETURN h.id LIMIT 1`,
          { params: { id: evId } }
        );
        if (hypRes.data && hypRes.data.length > 0) {
          preservedReasons.investigation_reference = (preservedReasons.investigation_reference || 0) + 1;
          recordsPreserved++;
          continue;
        }

        // Check memory provenance protection
        const memRes = await graph.query(
          `MATCH (m)-[:GROUNDED_IN]->(e:Evidence {id: $id})
           RETURN m.id LIMIT 1`,
          { params: { id: evId } }
        );
        if (memRes.data && memRes.data.length > 0) {
          preservedReasons.memory_provenance = (preservedReasons.memory_provenance || 0) + 1;
          recordsPreserved++;
          continue;
        }

        // Check action proposal reference protection
        const actRes = await graph.query(
          `MATCH (a:ActionProposal)-[:GROUNDED_IN|VERIFIED_BY]->(e:Evidence {id: $id})
           RETURN a.id LIMIT 1`,
          { params: { id: evId } }
        );
        if (actRes.data && actRes.data.length > 0) {
          preservedReasons.action_proposal_reference = (preservedReasons.action_proposal_reference || 0) + 1;
          recordsPreserved++;
          continue;
        }

        // Safe to prune
        if (!dryRun) {
          await graph.query(
            `MATCH (e:Evidence {id: $id})
             DETACH DELETE e`,
            { params: { id: evId } }
          );
          recordsPruned++;
        }
      }
    }

    // 2. Process Superseded Knowledge Claims (archive rather than destructively delete)
    if (request.category === 'all') {
      const claimCandidates = await graph.query(
        `MATCH (c:KnowledgeClaim {status: 'superseded'})
         WHERE c.lastVerifiedAt < $cutoff
           AND (c.tenantId = $tenantId OR c.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND c.tenantId IS NULL))
         RETURN c.id AS id
         LIMIT 50`,
        { params: { cutoff: cutoffDate, tenantId } }
      );

      const claimIds: string[] = (claimCandidates.data || []).map((r: any) => r.id);
      candidatesIdentified += claimIds.length;

      for (const cId of claimIds) {
        if (!dryRun) {
          await graph.query(
            `MATCH (c:KnowledgeClaim {id: $id})
             SET c.status = 'archived'`,
            { params: { id: cId } }
          );
          recordsPruned++;
        }
      }
    }

    const result: LifecyclePruneResult = {
      dryRun,
      tenantId,
      category: request.category,
      candidatesIdentified,
      recordsPruned,
      recordsPreserved,
      preservedReasons,
      timestamp: new Date().toISOString(),
    };

    // Log maintenance audit record
    await auditRepository.log({
      tenantId,
      principalId,
      action: 'lifecycle_pruned',
      resourceType: 'graph_lifecycle',
      resourceId: `prune-${Date.now()}`,
      status: 'success',
      details: {
        dryRun,
        category: request.category,
        candidatesIdentified,
        recordsPruned,
        recordsPreserved,
        preservedReasons,
      },
    });

    return result;
  }

  /**
   * Summarizes lifecycle statistics by data category for a tenant
   */
  public async getLifecycleStats(tenantId = 'tenant-default') {
    const graph = await this.getGraph();

    const evRes = await graph.query(
      `MATCH (e:Evidence)
       WHERE e.tenantId = $tenantId OR e.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND e.tenantId IS NULL)
       RETURN count(e) AS cnt`,
      { params: { tenantId } }
    );

    const activeIncRes = await graph.query(
      `MATCH (i:Incident)
       WHERE i.status IN ['investigating', 'identified', 'monitoring']
         AND (i.tenantId = $tenantId OR i.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND i.tenantId IS NULL))
       RETURN count(i) AS cnt`,
      { params: { tenantId } }
    );

    const memRes = await graph.query(
      `MATCH (m:KnowledgeClaim)
       WHERE m.tenantId = $tenantId OR m.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND m.tenantId IS NULL)
       RETURN m.status AS status, count(m) AS cnt`,
      { params: { tenantId } }
    );

    const claimCounts: Record<string, number> = {};
    for (const row of memRes.data || []) {
      if (row.status) claimCounts[row.status] = Number(row.cnt || 0);
    }

    return {
      tenantId,
      evidenceCount: Number(evRes.data?.[0]?.cnt || 0),
      activeIncidentsCount: Number(activeIncRes.data?.[0]?.cnt || 0),
      knowledgeClaimCounts: claimCounts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Safely archives superseded knowledge claims for a tenant without deleting provenance
   */
  public async archiveSupersededClaims(tenantId = 'tenant-default'): Promise<{ archivedCount: number }> {
    const graph = await this.getGraph();
    const res = await graph.query(
      `MATCH (c:KnowledgeClaim {status: 'superseded'})
       WHERE c.tenantId = $tenantId OR c.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND c.tenantId IS NULL)
       SET c.status = 'archived'
       RETURN count(c) AS cnt`,
      { params: { tenantId } }
    );
    return {
      archivedCount: Number(res.data?.[0]?.cnt || 0),
    };
  }
}

export const graphLifecycleManager = new GraphLifecycleManager();
