import { FalkorDBManager, graphManager } from '../graph/client.js';
import { AuditRecord, AuditRecordSchema, AuditAction } from '@neutrino/contracts';
import crypto from 'node:crypto';

export interface AuditRepositoryOptions {
  customManager?: FalkorDBManager;
  graphName?: string;
}

export class AuditRepository {
  private manager: FalkorDBManager;
  private graphName: string;

  constructor(options?: AuditRepositoryOptions) {
    this.manager = options?.customManager || graphManager;
    this.graphName = options?.graphName || process.env.FALKORDB_GRAPH_NAME || 'neutrino_graph';
  }

  private async getGraph() {
    return this.manager.getGraph(this.graphName);
  }

  /**
   * Persists an AuditRecord into FalkorDB
   */
  public async log(record: Omit<AuditRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<AuditRecord> {
    const fullRecord: AuditRecord = {
      id: record.id || `AUD-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      timestamp: record.timestamp || new Date().toISOString(),
      tenantId: record.tenantId,
      principalId: record.principalId,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      status: record.status,
      correlationId: record.correlationId || '',
      details: record.details || {},
    };

    const validated = AuditRecordSchema.parse(fullRecord);

    try {
      const graph = await this.getGraph();
      const cypher = `
        CREATE (a:AuditRecord {
          id: $id,
          tenantId: $tenantId,
          principalId: $principalId,
          action: $action,
          resourceType: $resourceType,
          resourceId: $resourceId,
          status: $status,
          timestamp: $timestamp,
          correlationId: $correlationId,
          details: $details
        })
      `;

      await graph.query(cypher, {
        params: {
          id: validated.id,
          tenantId: validated.tenantId,
          principalId: validated.principalId,
          action: validated.action,
          resourceType: validated.resourceType,
          resourceId: validated.resourceId,
          status: validated.status,
          timestamp: validated.timestamp,
          correlationId: validated.correlationId,
          details: JSON.stringify(validated.details),
        },
      });
    } catch (err) {
      console.error('[AuditRepository] Failed to write audit log to FalkorDB:', err);
    }

    return validated;
  }

  /**
   * Lists audit records for a given tenant with optional action/status filters
   */
  public async listAuditRecords(options: {
    tenantId: string;
    action?: AuditAction;
    resourceType?: string;
    limit?: number;
  }): Promise<AuditRecord[]> {
    const graph = await this.getGraph();
    const limit = Math.min(Math.max(1, options.limit || 50), 200);

    let cypher = `MATCH (a:AuditRecord) WHERE (a.tenantId = $tenantId OR ($tenantId = 'tenant-default' AND a.tenantId IS NULL))`;
    const params: any = {
      tenantId: options.tenantId,
      limit,
    };

    if (options.action) {
      cypher += ` AND a.action = $action`;
      params.action = options.action;
    }
    if (options.resourceType) {
      cypher += ` AND a.resourceType = $resourceType`;
      params.resourceType = options.resourceType;
    }

    cypher += ` RETURN a ORDER BY a.timestamp DESC LIMIT $limit`;

    const res = await graph.query(cypher, { params });

    return (res.data || []).map((r: any) => {
      const p = r.a.properties || r.a;
      return {
        id: p.id,
        tenantId: p.tenantId,
        principalId: p.principalId,
        action: p.action,
        resourceType: p.resourceType,
        resourceId: p.resourceId,
        status: p.status,
        timestamp: p.timestamp,
        correlationId: p.correlationId,
        details: typeof p.details === 'string' ? JSON.parse(p.details) : p.details || {},
      };
    });
  }
}

export const auditRepository = new AuditRepository();
