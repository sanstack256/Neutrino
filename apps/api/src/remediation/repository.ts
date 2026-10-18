import { FalkorDBManager, graphManager } from '../graph/client.js';
import { ActionProposal, ActionProposalSchema } from '@neutrino/contracts';

export interface RemediationRepositoryOptions {
  customManager?: FalkorDBManager;
  graphName?: string;
}

export class RemediationRepository {
  private manager: FalkorDBManager;
  private graphName: string;

  constructor(options?: RemediationRepositoryOptions) {
    this.manager = options?.customManager || graphManager;
    this.graphName = options?.graphName || process.env.FALKORDB_GRAPH_NAME || 'neutrino_graph';
  }

  private async getGraph() {
    return this.manager.getGraph(this.graphName);
  }

  /**
   * Persists an ActionProposal in FalkorDB
   */
  public async saveActionProposal(proposal: ActionProposal, callerTenantId?: string): Promise<ActionProposal> {
    const validated = ActionProposalSchema.parse(proposal);
    const tenantId = callerTenantId || validated.tenantId || 'tenant-default';
    validated.tenantId = tenantId;
    const graph = await this.getGraph();

    const cypher = `
      MERGE (a:ActionProposal {id: $id})
      SET a.tenantId = $tenantId,
          a.proposerId = $proposerId,
          a.investigationId = $investigationId,
          a.incidentId = $incidentId,
          a.procedureId = $procedureId,
          a.procedureVersion = $procedureVersion,
          a.actionType = $actionType,
          a.targetServiceId = $targetServiceId,
          a.targetResource = $targetResource,
          a.parameters = $parameters,
          a.riskLevel = $riskLevel,
          a.status = $status,
          a.explanation = $explanation,
          a.supportingEvidenceIds = $supportingEvidenceIds,
          a.preconditions = $preconditions,
          a.expectedPostconditions = $expectedPostconditions,
          a.requiresTwoPersonApproval = $requiresTwoPersonApproval,
          a.approvals = $approvals,
          a.proposedAt = $proposedAt,
          a.expiresAt = $expiresAt,
          a.executedAt = $executedAt,
          a.executionResult = $executionResult,
          a.verificationEvidenceIds = $verificationEvidenceIds,
          a.verificationNotes = $verificationNotes
    `;

    await graph.query(cypher, {
      params: {
        id: validated.id,
        tenantId,
        proposerId: validated.proposerId || null,
        investigationId: validated.investigationId,
        incidentId: validated.incidentId,
        procedureId: validated.procedureId || null,
        procedureVersion: validated.procedureVersion || null,
        actionType: validated.actionType,
        targetServiceId: validated.targetServiceId,
        targetResource: validated.targetResource,
        parameters: JSON.stringify(validated.parameters),
        riskLevel: validated.riskLevel,
        status: validated.status,
        explanation: validated.explanation,
        supportingEvidenceIds: validated.supportingEvidenceIds,
        preconditions: validated.preconditions,
        expectedPostconditions: validated.expectedPostconditions,
        requiresTwoPersonApproval: validated.requiresTwoPersonApproval,
        approvals: JSON.stringify(validated.approvals),
        proposedAt: validated.proposedAt,
        expiresAt: validated.expiresAt,
        executedAt: validated.executedAt || null,
        executionResult: validated.executionResult ? JSON.stringify(validated.executionResult) : null,
        verificationEvidenceIds: validated.verificationEvidenceIds,
        verificationNotes: validated.verificationNotes || null,
      },
    });

    // Link to Investigation via [:PROPOSED_ACTION]
    if (validated.investigationId) {
      await graph.query(
        `MATCH (inv:Investigation {id: $invId}), (a:ActionProposal {id: $actId})
         MERGE (inv)-[:PROPOSED_ACTION]->(a)`,
        { params: { invId: validated.investigationId, actId: validated.id } }
      );
    }

    // Link to target Service via [:TARGETS_SERVICE]
    if (validated.targetServiceId) {
      await graph.query(
        `MATCH (a:ActionProposal {id: $actId}), (s:Service {id: $svcId})
         MERGE (a)-[:TARGETS_SERVICE]->(s)`,
        { params: { actId: validated.id, svcId: validated.targetServiceId } }
      );
    }

    // Link supporting evidence via [:GROUNDED_IN]
    for (const evId of validated.supportingEvidenceIds) {
      await graph.query(
        `MATCH (a:ActionProposal {id: $actId}), (e:Evidence {id: $evId})
         MERGE (a)-[:GROUNDED_IN]->(e)`,
        { params: { actId: validated.id, evId } }
      );
    }

    return validated;
  }

  /**
   * Retrieves an ActionProposal by ID isolated by tenant
   */
  public async getActionProposal(id: string, tenantId = 'tenant-default'): Promise<ActionProposal | null> {
    const graph = await this.getGraph();
    const res = await graph.query(
      `MATCH (a:ActionProposal {id: $id})
       WHERE a.tenantId = $tenantId OR a.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND a.tenantId IS NULL)
       RETURN a LIMIT 1`,
      { params: { id, tenantId } }
    );

    if (!res.data || res.data.length === 0) return null;
    return this.deserializeProposal(res.data[0].a);
  }

  /**
   * Lists ActionProposals (optionally filtered by status or incidentId) isolated by tenant
   */
  public async listActionProposals(
    filter?: {
      status?: string;
      incidentId?: string;
      limit?: number;
    },
    tenantId = 'tenant-default'
  ): Promise<ActionProposal[]> {
    const graph = await this.getGraph();
    const limit = Math.min(Math.max(1, filter?.limit || 50), 100);

    let cypher = `MATCH (a:ActionProposal)`;
    const conditions: string[] = [
      `(a.tenantId = $tenantId OR a.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND a.tenantId IS NULL))`,
    ];
    const params: any = { limit, tenantId };

    if (filter?.status) {
      conditions.push(`a.status = $status`);
      params.status = filter.status;
    }
    if (filter?.incidentId) {
      conditions.push(`a.incidentId = $incidentId`);
      params.incidentId = filter.incidentId;
    }

    cypher += ` WHERE ` + conditions.join(' AND ');
    cypher += ` RETURN a ORDER BY a.proposedAt DESC LIMIT $limit`;

    const res = await graph.query(cypher, { params });
    return (res.data || []).map((r: any) => this.deserializeProposal(r.a));
  }

  private deserializeProposal(node: any): ActionProposal {
    const p = node.properties || node;
    return {
      id: p.id,
      tenantId: p.tenantId || 'tenant-default',
      proposerId: p.proposerId || undefined,
      investigationId: p.investigationId,
      incidentId: p.incidentId,
      procedureId: p.procedureId || undefined,
      procedureVersion: p.procedureVersion ? Number(p.procedureVersion) : undefined,
      actionType: p.actionType,
      targetServiceId: p.targetServiceId,
      targetResource: p.targetResource,
      parameters: typeof p.parameters === 'string' ? JSON.parse(p.parameters) : p.parameters || {},
      riskLevel: p.riskLevel,
      status: p.status,
      explanation: p.explanation,
      supportingEvidenceIds: Array.isArray(p.supportingEvidenceIds) ? p.supportingEvidenceIds : [],
      preconditions: Array.isArray(p.preconditions) ? p.preconditions : [],
      expectedPostconditions: Array.isArray(p.expectedPostconditions) ? p.expectedPostconditions : [],
      requiresTwoPersonApproval: Boolean(p.requiresTwoPersonApproval),
      approvals: typeof p.approvals === 'string' ? JSON.parse(p.approvals) : p.approvals || [],
      rejectedBy: p.rejectedBy
        ? typeof p.rejectedBy === 'string'
          ? JSON.parse(p.rejectedBy)
          : p.rejectedBy
        : undefined,
      proposedAt: p.proposedAt,
      expiresAt: p.expiresAt,
      executedAt: p.executedAt || undefined,
      executionResult: p.executionResult
        ? typeof p.executionResult === 'string'
          ? JSON.parse(p.executionResult)
        : p.executionResult
        : undefined,
      verificationEvidenceIds: Array.isArray(p.verificationEvidenceIds) ? p.verificationEvidenceIds : [],
      verificationNotes: p.verificationNotes || undefined,
    };
  }
}

export const remediationRepository = new RemediationRepository();
