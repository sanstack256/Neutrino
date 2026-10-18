import {
  MemoryEpisode,
  KnowledgeClaim,
  DiagnosticProcedure,
  MemoryStatus,
  MemoryType,
  MemoryDetailResponse,
  Service,
  Incident,
  Evidence,
  MemoryEpisodeSchema,
  KnowledgeClaimSchema,
  DiagnosticProcedureSchema,
} from '@neutrino/contracts';
import { FalkorDBManager, graphManager } from '../graph/client.js';

export interface MemoryRepositoryOptions {
  customManager?: FalkorDBManager;
  graphName?: string;
}

export class MemoryRepository {
  private manager: FalkorDBManager;
  private graphName?: string;

  constructor(options?: MemoryRepositoryOptions) {
    this.manager = options?.customManager || graphManager;
    this.graphName = options?.graphName;
  }

  private async getGraph() {
    return this.manager.getGraph(this.graphName);
  }

  // ==========================================
  // 1. Episodic Memory Operations
  // ==========================================
  public async saveEpisode(episode: MemoryEpisode, callerTenantId?: string): Promise<MemoryEpisode> {
    const validated = MemoryEpisodeSchema.parse(episode);
    const tenantId = callerTenantId || validated.tenantId || 'tenant-default';
    validated.tenantId = tenantId;
    const graph = await this.getGraph();

    const cypher = `
      MERGE (ep:MemoryEpisode {id: $id})
      SET ep.tenantId = $tenantId,
          ep.investigationId = $investigationId,
          ep.incidentId = $incidentId,
          ep.summary = $summary,
          ep.outcome = $outcome,
          ep.status = $status,
          ep.serviceIds = $serviceIds,
          ep.deploymentIds = $deploymentIds,
          ep.evidenceIds = $evidenceIds,
          ep.graphPaths = $graphPaths,
          ep.hypothesesEvaluated = $hypothesesEvaluated,
          ep.supportedHypotheses = $supportedHypotheses,
          ep.contradictedHypotheses = $contradictedHypotheses,
          ep.unresolvedQuestions = $unresolvedQuestions,
          ep.createdAt = $createdAt,
          ep.updatedAt = $updatedAt,
          ep.synthetic = $synthetic
    `;

    await graph.query(cypher, {
      params: {
        id: validated.id,
        tenantId,
        investigationId: validated.investigationId,
        incidentId: validated.incidentId || '',
        summary: validated.summary,
        outcome: validated.outcome,
        status: validated.status,
        serviceIds: validated.serviceIds,
        deploymentIds: validated.deploymentIds,
        evidenceIds: validated.evidenceIds,
        graphPaths: validated.graphPaths,
        hypothesesEvaluated: validated.hypothesesEvaluated,
        supportedHypotheses: validated.supportedHypotheses,
        contradictedHypotheses: validated.contradictedHypotheses,
        unresolvedQuestions: validated.unresolvedQuestions,
        createdAt: validated.createdAt,
        updatedAt: validated.updatedAt,
        synthetic: validated.synthetic,
      },
    });

    // Link to Investigation if exists
    await graph.query(
      `MATCH (inv:Investigation {id: $invId}), (ep:MemoryEpisode {id: $epId})
       MERGE (inv)-[:GENERATED_EPISODE]->(ep)`,
      { params: { invId: validated.investigationId, epId: validated.id } }
    );

    // Link to Incident if exists
    if (validated.incidentId) {
      await graph.query(
        `MATCH (inc:Incident {id: $incId}), (ep:MemoryEpisode {id: $epId})
         MERGE (ep)-[:CONCERNS_INCIDENT]->(inc)`,
        { params: { incId: validated.incidentId, epId: validated.id } }
      );
    }

    // Link to Services
    for (const svcId of validated.serviceIds) {
      await graph.query(
        `MATCH (s:Service {id: $svcId}), (ep:MemoryEpisode {id: $epId})
         MERGE (ep)-[:CONCERNS_SERVICE]->(s)`,
        { params: { svcId, epId: validated.id } }
      );
    }

    return validated;
  }

  public async getEpisode(id: string, tenantId = 'tenant-default'): Promise<MemoryEpisode | null> {
    const graph = await this.getGraph();
    const res = await graph.query(
      `MATCH (ep:MemoryEpisode {id: $id})
       WHERE ep.tenantId = $tenantId OR ep.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND ep.tenantId IS NULL)
       RETURN ep LIMIT 1`,
      { params: { id, tenantId } }
    );

    if (!res.data || res.data.length === 0) return null;
    return this.extractProperties(res.data[0].ep);
  }

  public async listEpisodes(limit = 20, status?: MemoryStatus, tenantId = 'tenant-default'): Promise<MemoryEpisode[]> {
    const graph = await this.getGraph();
    const statusClause = status ? `AND ep.status = $status` : ``;
    const cypher = `
      MATCH (ep:MemoryEpisode)
      WHERE (ep.tenantId = $tenantId OR ep.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND ep.tenantId IS NULL))
        ${statusClause}
      RETURN ep ORDER BY ep.createdAt DESC LIMIT $limit
    `;

    const res = await graph.query(cypher, { params: { status, limit, tenantId } });
    return (res.data || []).map((r: any) => this.extractProperties(r.ep));
  }

  // ==========================================
  // 2. Semantic Memory (KnowledgeClaim) Operations
  // ==========================================
  public async saveKnowledgeClaim(
    claim: KnowledgeClaim,
    episodeId?: string,
    callerTenantId?: string
  ): Promise<KnowledgeClaim> {
    const validated = KnowledgeClaimSchema.parse(claim);
    const tenantId = callerTenantId || validated.tenantId || 'tenant-default';
    validated.tenantId = tenantId;
    const graph = await this.getGraph();

    const cypher = `
      MERGE (c:KnowledgeClaim {id: $id})
      SET c.tenantId = $tenantId,
          c.subject = $subject,
          c.predicate = $predicate,
          c.object = $object,
          c.statement = $statement,
          c.claimType = $claimType,
          c.status = $status,
          c.confidence = $confidence,
          c.supportingEvidenceIds = $supportingEvidenceIds,
          c.contradictoryEvidenceIds = $contradictoryEvidenceIds,
          c.sourceProvenance = $sourceProvenance,
          c.firstObservedAt = $firstObservedAt,
          c.lastVerifiedAt = $lastVerifiedAt,
          c.validFrom = $validFrom,
          c.validUntil = $validUntil,
          c.revision = $revision,
          c.supersededById = $supersededById,
          c.invalidationReason = $invalidationReason,
          c.synthetic = $synthetic
    `;

    await graph.query(cypher, {
      params: {
        id: validated.id,
        tenantId,
        subject: validated.subject,
        predicate: validated.predicate,
        object: validated.object,
        statement: validated.statement,
        claimType: validated.claimType,
        status: validated.status,
        confidence: validated.confidence,
        supportingEvidenceIds: validated.supportingEvidenceIds,
        contradictoryEvidenceIds: validated.contradictoryEvidenceIds,
        sourceProvenance: validated.sourceProvenance,
        firstObservedAt: validated.firstObservedAt,
        lastVerifiedAt: validated.lastVerifiedAt,
        validFrom: validated.validFrom || '',
        validUntil: validated.validUntil || '',
        revision: validated.revision,
        supersededById: validated.supersededById || '',
        invalidationReason: validated.invalidationReason || '',
        synthetic: validated.synthetic,
      },
    });

    // Link to episode if provided
    if (episodeId) {
      await graph.query(
        `MATCH (ep:MemoryEpisode {id: $epId}), (c:KnowledgeClaim {id: $cId})
         MERGE (ep)-[:RECORDED_CLAIM]->(c)`,
        { params: { epId: episodeId, cId: validated.id } }
      );
    }

    // Link supporting evidence via [:GROUNDED_IN]
    for (const evId of validated.supportingEvidenceIds) {
      await graph.query(
        `MATCH (c:KnowledgeClaim {id: $cId}), (e:Evidence {id: $evId})
         MERGE (c)-[:GROUNDED_IN]->(e)`,
        { params: { cId: validated.id, evId } }
      );
    }

    // Link contradictory evidence via [:CONTRADICTED_BY]
    for (const evId of validated.contradictoryEvidenceIds) {
      await graph.query(
        `MATCH (c:KnowledgeClaim {id: $cId}), (e:Evidence {id: $evId})
         MERGE (c)-[:CONTRADICTED_BY]->(e)`,
        { params: { cId: validated.id, evId } }
      );
    }

    // Link supersession relationship if supersededById exists
    if (validated.supersededById) {
      await graph.query(
        `MATCH (c:KnowledgeClaim {id: $cId}), (old:KnowledgeClaim {id: $oldId})
         MERGE (c)-[:SUPERSEDES]->(old)
         SET old.status = 'superseded', old.supersededById = $cId`,
        { params: { cId: validated.id, oldId: validated.supersededById } }
      );
    }

    return validated;
  }

  public async getKnowledgeClaim(id: string, tenantId = 'tenant-default'): Promise<KnowledgeClaim | null> {
    const graph = await this.getGraph();
    const res = await graph.query(
      `MATCH (c:KnowledgeClaim {id: $id})
       WHERE c.tenantId = $tenantId OR c.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND c.tenantId IS NULL)
       RETURN c LIMIT 1`,
      { params: { id, tenantId } }
    );
    if (!res.data || res.data.length === 0) return null;
    return this.extractProperties(res.data[0].c);
  }

  public async listKnowledgeClaims(
    limit = 50,
    status?: MemoryStatus,
    tenantId = 'tenant-default'
  ): Promise<KnowledgeClaim[]> {
    const graph = await this.getGraph();
    const statusClause = status ? `AND c.status = $status` : ``;
    const cypher = `
      MATCH (c:KnowledgeClaim)
      WHERE (c.tenantId = $tenantId OR c.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND c.tenantId IS NULL))
        ${statusClause}
      RETURN c ORDER BY c.lastVerifiedAt DESC LIMIT $limit
    `;

    const res = await graph.query(cypher, { params: { status, limit, tenantId } });
    return (res.data || []).map((r: any) => this.extractProperties(r.c));
  }

  public async updateClaimStatus(
    claimId: string,
    newStatus: MemoryStatus,
    reason?: string,
    tenantId = 'tenant-default'
  ): Promise<boolean> {
    const graph = await this.getGraph();
    const current = await this.getKnowledgeClaim(claimId, tenantId);
    if (!current) return false;

    // Validate lifecycle transitions:
    // candidate -> active, invalidated
    // active -> superseded, invalidated, archived
    // superseded -> archived
    // invalidated -> archived
    const validTransitions: Record<MemoryStatus, MemoryStatus[]> = {
      candidate: ['active', 'invalidated'],
      active: ['superseded', 'invalidated', 'archived'],
      superseded: ['archived'],
      invalidated: ['archived'],
      archived: [],
    };

    if (!validTransitions[current.status].includes(newStatus)) {
      throw new Error(
        `Invalid lifecycle transition from '${current.status}' to '${newStatus}' for claim ${claimId}`
      );
    }

    await graph.query(
      `MATCH (c:KnowledgeClaim {id: $id})
       SET c.status = $status,
           c.invalidationReason = $reason,
           c.lastVerifiedAt = $now`,
      {
        params: {
          id: claimId,
          status: newStatus,
          reason: reason || current.invalidationReason || '',
          now: new Date().toISOString(),
        },
      }
    );

    return true;
  }

  // ==========================================
  // 3. Procedural Memory Operations
  // ==========================================
  public async saveDiagnosticProcedure(
    proc: DiagnosticProcedure,
    episodeId?: string,
    callerTenantId?: string
  ): Promise<DiagnosticProcedure> {
    const validated = DiagnosticProcedureSchema.parse(proc);
    const tenantId = callerTenantId || validated.tenantId || 'tenant-default';
    validated.tenantId = tenantId;
    const graph = await this.getGraph();

    const cypher = `
      MERGE (p:DiagnosticProcedure {id: $id})
      SET p.tenantId = $tenantId,
          p.name = $name,
          p.purpose = $purpose,
          p.serviceId = $serviceId,
          p.preconditions = $preconditions,
          p.requiredEvidenceTypes = $requiredEvidenceTypes,
          p.diagnosticSteps = $diagnosticSteps,
          p.expectedObservations = $expectedObservations,
          p.supportingConditions = $supportingConditions,
          p.contradictingConditions = $contradictingConditions,
          p.knownFailureModes = $knownFailureModes,
          p.status = $status,
          p.validationCriteria = $validationCriteria,
          p.version = $version,
          p.lastValidatedAt = $lastValidatedAt,
          p.synthetic = $synthetic
    `;

    await graph.query(cypher, {
      params: {
        id: validated.id,
        tenantId,
        name: validated.name,
        purpose: validated.purpose,
        serviceId: validated.serviceId,
        preconditions: validated.preconditions,
        requiredEvidenceTypes: validated.requiredEvidenceTypes,
        diagnosticSteps: validated.diagnosticSteps,
        expectedObservations: validated.expectedObservations,
        supportingConditions: validated.supportingConditions,
        contradictingConditions: validated.contradictingConditions,
        knownFailureModes: validated.knownFailureModes,
        status: validated.status,
        validationCriteria: validated.validationCriteria,
        version: validated.version,
        lastValidatedAt: validated.lastValidatedAt,
        synthetic: validated.synthetic,
      },
    });

    // Link to episode if provided
    if (episodeId) {
      await graph.query(
        `MATCH (ep:MemoryEpisode {id: $epId}), (p:DiagnosticProcedure {id: $pId})
         MERGE (ep)-[:RECOMMENDED_PROCEDURE]->(p)`,
        { params: { epId: episodeId, pId: validated.id } }
      );
    }

    // Link to target service
    await graph.query(
      `MATCH (s:Service {id: $svcId}), (p:DiagnosticProcedure {id: $pId})
       MERGE (p)-[:TARGETS_SERVICE]->(s)`,
      { params: { svcId: validated.serviceId, pId: validated.id } }
    );

    return validated;
  }

  public async getDiagnosticProcedure(id: string, tenantId = 'tenant-default'): Promise<DiagnosticProcedure | null> {
    const graph = await this.getGraph();
    const res = await graph.query(
      `MATCH (p:DiagnosticProcedure {id: $id})
       WHERE p.tenantId = $tenantId OR p.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND p.tenantId IS NULL)
       RETURN p LIMIT 1`,
      { params: { id, tenantId } }
    );
    if (!res.data || res.data.length === 0) return null;
    return this.extractProperties(res.data[0].p);
  }

  public async listDiagnosticProcedures(
    limit = 50,
    status?: MemoryStatus,
    tenantId = 'tenant-default'
  ): Promise<DiagnosticProcedure[]> {
    const graph = await this.getGraph();
    const statusClause = status ? `AND p.status = $status` : ``;
    const cypher = `
      MATCH (p:DiagnosticProcedure)
      WHERE (p.tenantId = $tenantId OR p.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND p.tenantId IS NULL))
        ${statusClause}
      RETURN p ORDER BY p.lastValidatedAt DESC LIMIT $limit
    `;

    const res = await graph.query(cypher, { params: { status, limit, tenantId } });
    return (res.data || []).map((r: any) => this.extractProperties(r.p));
  }

  // ==========================================
  // 4. Memory Inspection & Detail
  // ==========================================
  public async getMemoryDetail(id: string, tenantId = 'tenant-default'): Promise<MemoryDetailResponse | null> {
    const graph = await this.getGraph();

    // Try finding Claim
    const claim = await this.getKnowledgeClaim(id, tenantId);
    if (claim) {
      const groundedRes = await graph.query(
        `MATCH (c:KnowledgeClaim {id: $id})-[:GROUNDED_IN]->(e:Evidence) RETURN e`,
        { params: { id } }
      );
      const groundedEvidence = (groundedRes.data || []).map((r: any) => this.extractProperties(r.e));

      const contraRes = await graph.query(
        `MATCH (c:KnowledgeClaim {id: $id})-[:CONTRADICTED_BY]->(e:Evidence) RETURN e`,
        { params: { id } }
      );
      const contradictoryEvidence = (contraRes.data || []).map((r: any) => this.extractProperties(r.e));

      // Revisions
      const revRes = await graph.query(
        `MATCH (c:KnowledgeClaim {id: $id})-[:SUPERSEDES*1..5]->(prev:KnowledgeClaim) RETURN prev`,
        { params: { id } }
      );
      const revisions = (revRes.data || []).map((r: any) => this.extractProperties(r.prev));

      // Services associated via episode
      const svcRes = await graph.query(
        `MATCH (ep:MemoryEpisode)-[:RECORDED_CLAIM]->(c:KnowledgeClaim {id: $id})
         OPTIONAL MATCH (ep)-[:CONCERNS_SERVICE]->(s:Service)
         RETURN DISTINCT s`,
        { params: { id } }
      );
      const services = (svcRes.data || [])
        .filter((r: any) => r.s)
        .map((r: any) => this.extractProperties(r.s));

      const incRes = await graph.query(
        `MATCH (ep:MemoryEpisode)-[:RECORDED_CLAIM]->(c:KnowledgeClaim {id: $id})
         OPTIONAL MATCH (ep)-[:CONCERNS_INCIDENT]->(i:Incident)
         RETURN DISTINCT i`,
        { params: { id } }
      );
      const incidents = (incRes.data || [])
        .filter((r: any) => r.i)
        .map((r: any) => this.extractProperties(r.i));

      return {
        memoryType: 'semantic',
        item: claim,
        connectedEntities: {
          services,
          incidents,
          groundedEvidence,
          contradictoryEvidence,
        },
        revisions,
      };
    }

    // Try finding Procedure
    const proc = await this.getDiagnosticProcedure(id, tenantId);
    if (proc) {
      const svcRes = await graph.query(
        `MATCH (p:DiagnosticProcedure {id: $id})-[:TARGETS_SERVICE]->(s:Service) RETURN s LIMIT 1`,
        { params: { id } }
      );
      const services = (svcRes.data || []).map((r: any) => this.extractProperties(r.s));

      return {
        memoryType: 'procedural',
        item: proc,
        connectedEntities: {
          services,
          incidents: [],
          groundedEvidence: [],
          contradictoryEvidence: [],
        },
      };
    }

    // Try finding Episode
    const episode = await this.getEpisode(id, tenantId);
    if (episode) {
      const svcRes = await graph.query(
        `MATCH (ep:MemoryEpisode {id: $id})-[:CONCERNS_SERVICE]->(s:Service) RETURN s`,
        { params: { id } }
      );
      const services = (svcRes.data || []).map((r: any) => this.extractProperties(r.s));

      const incRes = await graph.query(
        `MATCH (ep:MemoryEpisode {id: $id})-[:CONCERNS_INCIDENT]->(i:Incident) RETURN i`,
        { params: { id } }
      );
      const incidents = (incRes.data || [])
        .filter((r: any) => r.i)
        .map((r: any) => this.extractProperties(r.i));

      return {
        memoryType: 'episodic',
        item: episode,
        connectedEntities: {
          services,
          incidents,
          groundedEvidence: [],
          contradictoryEvidence: [],
        },
      };
    }

    return null;
  }

  // ==========================================
  // 5. Memory Search & Relevance Queries
  // ==========================================
  public async findConnectedMemories(
    params: {
      serviceIds: string[];
      incidentId?: string;
      includeSuperseded?: boolean;
      limit?: number;
    },
    tenantId = 'tenant-default'
  ): Promise<{
    episodes: MemoryEpisode[];
    claims: KnowledgeClaim[];
    procedures: DiagnosticProcedure[];
  }> {
    const graph = await this.getGraph();
    const limit = Math.min(Math.max(1, params.limit || 20), 50);
    const statusFilter = params.includeSuperseded
      ? "status IN ['active', 'superseded']"
      : "status = 'active'";

    // 1. Fetch connected claims isolated by tenant
    const claimRes = await graph.query(
      `MATCH (c:KnowledgeClaim)
       WHERE c.${statusFilter}
         AND (c.tenantId = $tenantId OR c.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND c.tenantId IS NULL))
         AND (c.subject IN $services OR c.object IN $services)
       RETURN c
       ORDER BY c.lastVerifiedAt DESC
       LIMIT $limit`,
      { params: { services: params.serviceIds, limit, tenantId } }
    );
    const claims = (claimRes.data || []).map((r: any) => this.extractProperties(r.c));

    // 2. Fetch connected procedures isolated by tenant
    const procRes = await graph.query(
      `MATCH (p:DiagnosticProcedure)
       WHERE p.${statusFilter}
         AND (p.tenantId = $tenantId OR p.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND p.tenantId IS NULL))
         AND p.serviceId IN $services
       RETURN p
       ORDER BY p.lastValidatedAt DESC
       LIMIT $limit`,
      { params: { services: params.serviceIds, limit, tenantId } }
    );
    const procedures = (procRes.data || []).map((r: any) => this.extractProperties(r.p));

    // 3. Fetch connected episodes isolated by tenant
    const epRes = await graph.query(
      `MATCH (ep:MemoryEpisode)
       WHERE ep.${statusFilter}
         AND (ep.tenantId = $tenantId OR ep.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND ep.tenantId IS NULL))
       RETURN ep
       ORDER BY ep.createdAt DESC
       LIMIT $limit`,
      { params: { limit, tenantId } }
    );
    const rawEpisodes: MemoryEpisode[] = (epRes.data || []).map((r: any) =>
      this.extractProperties(r.ep)
    );

    // Filter episodes that overlap with requested serviceIds or incidentId
    const episodes = rawEpisodes.filter(
      (ep) =>
        (params.incidentId && ep.incidentId === params.incidentId) ||
        ep.serviceIds.some((s) => params.serviceIds.includes(s))
    );

    return { episodes, claims, procedures };
  }

  private extractProperties(nodeOrObj: any): any {
    if (!nodeOrObj) return null;
    if (nodeOrObj.properties) {
      return { ...nodeOrObj.properties };
    }
    return nodeOrObj;
  }
}

export const memoryRepository = new MemoryRepository();
