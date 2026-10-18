import {
  Incident,
  Service,
  Deployment,
  Evidence,
  Team,
  GraphNode,
  GraphEdge,
  SubgraphData,
  InvestigationResult,
  InvestigationHistoryItem,
} from '@neutrino/contracts';
import { FalkorDBManager, graphManager } from './client.js';
import { config } from '../config/config.js';

export interface RepositoryOptions {
  customManager?: FalkorDBManager;
  graphName?: string;
}

export class GraphRepository {
  private manager: FalkorDBManager;
  private graphName?: string;

  constructor(options?: RepositoryOptions) {
    this.manager = options?.customManager || graphManager;
    this.graphName = options?.graphName;
  }

  private async getGraph() {
    return this.manager.getGraph(this.graphName);
  }

  /**
   * Helper that returns a parameterized Cypher boolean expression enforcing tenant boundaries.
   * If tenantId is 'tenant-default', allows records with 'tenant-default', 'shared', or null tenantId.
   * If tenantId is a specific tenant, strictly allows only that tenant or explicitly 'shared' records.
   */
  private tenantFilter(alias: string, tenantId = 'tenant-default'): string {
    if (tenantId === 'tenant-default') {
      return `(${alias}.tenantId = 'tenant-default' OR ${alias}.tenantId = 'shared' OR ${alias}.tenantId IS NULL)`;
    }
    return `(${alias}.tenantId = '${tenantId}' OR ${alias}.tenantId = 'shared')`;
  }

  // ==========================================
  // Schema Indexes & Constraints
  // ==========================================
  public async setupIndexes(): Promise<void> {
    const graph = await this.getGraph();
    const indexLabels = [
      'Service',
      'Deployment',
      'Incident',
      'Evidence',
      'Team',
      'Hypothesis',
      'Investigation',
      'SourceRecord',
      'MemoryEpisode',
      'KnowledgeClaim',
      'DiagnosticProcedure',
      'ActionProposal',
      'AuditRecord',
    ];

    for (const label of indexLabels) {
      try {
        await graph.query(`CREATE INDEX FOR (n:${label}) ON (n.id)`);
      } catch (err: any) {
        // Index might already exist
        const msg = String(err?.message || '');
        if (!msg.includes('already exists') && !msg.includes('Index already exists')) {
          console.warn(`[GraphRepository] Index notice for ${label}.id:`, msg);
        }
      }

      try {
        await graph.query(`CREATE INDEX FOR (n:${label}) ON (n.tenantId)`);
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (!msg.includes('already exists') && !msg.includes('Index already exists')) {
          console.warn(`[GraphRepository] Index notice for ${label}.tenantId:`, msg);
        }
      }
    }
  }

  // ==========================================
  // Graph Metadata & Health
  // ==========================================
  public async getGraphCounts(): Promise<{
    nodeCount: number;
    relationshipCount: number;
    labels: string[];
    relationshipTypes: string[];
  }> {
    const graph = await this.getGraph();

    const nodeRes = await graph.query('MATCH (n) RETURN count(n) AS cnt');
    const nodeCount = Number(nodeRes.data?.[0]?.cnt || 0);

    const relRes = await graph.query('MATCH ()-[r]->() RETURN count(r) AS cnt');
    const relationshipCount = Number(relRes.data?.[0]?.cnt || 0);

    let labels: string[] = [];
    try {
      const labelRes = await graph.query('MATCH (n) RETURN DISTINCT labels(n) AS lbls LIMIT 50');
      const set = new Set<string>();
      for (const row of labelRes.data || []) {
        if (Array.isArray(row.lbls)) {
          row.lbls.forEach((l: string) => set.add(l));
        }
      }
      labels = Array.from(set);
    } catch {
      labels = ['Service', 'Incident', 'Deployment', 'Evidence', 'Team', 'Hypothesis', 'Investigation'];
    }

    let relationshipTypes: string[] = [];
    try {
      const typeRes = await graph.query('MATCH ()-[r]->() RETURN DISTINCT type(r) AS t LIMIT 50');
      const set = new Set<string>();
      for (const row of typeRes.data || []) {
        if (row.t) set.add(row.t);
      }
      relationshipTypes = Array.from(set);
    } catch {
      relationshipTypes = ['DEPENDS_ON', 'AFFECTS', 'HAS_DEPLOYMENT', 'OWNED_BY', 'OBSERVED_IN', 'SUPPORTED_BY'];
    }

    return { nodeCount, relationshipCount, labels, relationshipTypes };
  }

  // ==========================================
  // Incidents
  // ==========================================
  public async listIncidents(limit = 20, tenantId = 'tenant-default'): Promise<Incident[]> {
    const graph = await this.getGraph();
    const safeLimit = Math.min(Math.max(1, limit), config.MAX_GRAPH_RESULTS_BOUND);
    const filter = this.tenantFilter('i', tenantId);

    const res = await graph.query(
      `MATCH (i:Incident)
       WHERE ${filter}
       RETURN i
       ORDER BY i.startedAt DESC
       LIMIT $limit`,
      { params: { limit: safeLimit } }
    );

    return (res.data || []).map((row: any) => this.extractProperties(row.i));
  }

  public async getIncidentById(incidentId: string, tenantId = 'tenant-default'): Promise<Incident | null> {
    const graph = await this.getGraph();
    const filter = this.tenantFilter('i', tenantId);

    const res = await graph.query(
      `MATCH (i:Incident {id: $id})
       WHERE ${filter}
       RETURN i LIMIT 1`,
      { params: { id: incidentId } }
    );

    if (!res.data || res.data.length === 0) return null;
    return this.extractProperties(res.data[0].i);
  }

  // ==========================================
  // Operation A — Incident Context
  // ==========================================
  public async getIncidentContext(
    incidentId: string,
    tenantId = 'tenant-default'
  ): Promise<{
    incident: Incident | null;
    affectedService: Service | null;
    owningTeam: Team | null;
    deployments: Deployment[];
    evidence: Evidence[];
    relatedIncidents: Incident[];
  }> {
    const graph = await this.getGraph();
    const iFilter = this.tenantFilter('i', tenantId);
    const sFilter = this.tenantFilter('s', tenantId);

    // 1. Incident & affected service with tenant boundary enforcement
    const primaryRes = await graph.query(
      `MATCH (i:Incident {id: $id})
       WHERE ${iFilter}
       OPTIONAL MATCH (i)-[:AFFECTS]->(s:Service)
       WHERE ${sFilter}
       OPTIONAL MATCH (s)-[:OWNED_BY]->(t:Team)
       RETURN i, s, t LIMIT 1`,
      { params: { id: incidentId } }
    );

    if (!primaryRes.data || primaryRes.data.length === 0) {
      return {
        incident: null,
        affectedService: null,
        owningTeam: null,
        deployments: [],
        evidence: [],
        relatedIncidents: [],
      };
    }

    const row = primaryRes.data[0];
    const incident: Incident = this.extractProperties(row.i);
    const affectedService: Service | null = row.s ? this.extractProperties(row.s) : null;
    const owningTeam: Team | null = row.t ? this.extractProperties(row.t) : null;

    // 2. Evidence connected to incident isolated by tenant
    const evidence = await this.getIncidentEvidence(incidentId, tenantId);

    // 3. Deployments on affected service and its upstream dependencies
    let deployments: Deployment[] = [];
    if (affectedService) {
      const dFilter = this.tenantFilter('d', tenantId);
      const targetFilter = this.tenantFilter('target', tenantId);
      const depRes = await graph.query(
        `MATCH (s:Service {id: $svcId})-[:DEPENDS_ON*0..2]->(target:Service)-[:HAS_DEPLOYMENT]->(d:Deployment)
         WHERE ${targetFilter} AND ${dFilter}
         RETURN DISTINCT d
         ORDER BY d.deployedAt DESC
         LIMIT 10`,
        { params: { svcId: affectedService.id } }
      );
      deployments = (depRes.data || []).map((r: any) => this.extractProperties(r.d));
    }

    // 4. Related incidents isolated by tenant
    const relatedIncidents = await this.getRelatedIncidents(incidentId, tenantId);

    return {
      incident,
      affectedService,
      owningTeam,
      deployments,
      evidence,
      relatedIncidents,
    };
  }

  // ==========================================
  // Operation B — Dependency Traversal
  // (Service A depends on Service B: (s)-[:DEPENDS_ON]->(dep))
  // Traversal cannot jump across tenant boundaries into another tenant's private services
  // ==========================================
  public async getServiceDependencies(
    serviceId: string,
    maxDepth = 3,
    tenantId = 'tenant-default'
  ): Promise<{ service: Service; depth: number; path: string[] }[]> {
    const graph = await this.getGraph();
    const safeDepth = Math.min(Math.max(1, maxDepth), config.MAX_GRAPH_TRAVERSAL_DEPTH);
    const nFilter = this.tenantFilter('n', tenantId);

    const cypher = `
      MATCH p = (start:Service {id: $svcId})-[:DEPENDS_ON*1..${safeDepth}]->(dep:Service)
      WHERE ALL(n IN nodes(p) WHERE ${nFilter})
      RETURN dep, length(p) AS depth, [n IN nodes(p) | n.id] AS pathNodes
      ORDER BY depth ASC
      LIMIT 50
    `;

    const res = await graph.query(cypher, { params: { svcId: serviceId } });

    const results: { service: Service; depth: number; path: string[] }[] = [];
    for (const row of res.data || []) {
      results.push({
        service: this.extractProperties(row.dep),
        depth: Number(row.depth),
        path: row.pathNodes || [],
      });
    }
    return results;
  }

  // ==========================================
  // Operation C — Downstream Impact
  // (Find services that depend on this service: (consumer)-[:DEPENDS_ON*1..depth]->(s))
  // ==========================================
  public async getAffectedServices(
    serviceId: string,
    maxDepth = 3,
    tenantId = 'tenant-default'
  ): Promise<{ service: Service; depth: number; path: string[] }[]> {
    const graph = await this.getGraph();
    const safeDepth = Math.min(Math.max(1, maxDepth), config.MAX_GRAPH_TRAVERSAL_DEPTH);
    const nFilter = this.tenantFilter('n', tenantId);

    const cypher = `
      MATCH p = (consumer:Service)-[:DEPENDS_ON*1..${safeDepth}]->(target:Service {id: $svcId})
      WHERE ALL(n IN nodes(p) WHERE ${nFilter})
      RETURN consumer, length(p) AS depth, [n IN nodes(p) | n.id] AS pathNodes
      ORDER BY depth ASC
      LIMIT 50
    `;

    const res = await graph.query(cypher, { params: { svcId: serviceId } });

    const results: { service: Service; depth: number; path: string[] }[] = [];
    for (const row of res.data || []) {
      results.push({
        service: this.extractProperties(row.consumer),
        depth: Number(row.depth),
        path: row.pathNodes || [],
      });
    }
    return results;
  }

  // ==========================================
  // Operation D — Recent Changes / Deployments
  // ==========================================
  public async getRecentDeployments(serviceIds: string[], limit = 15, tenantId = 'tenant-default'): Promise<Deployment[]> {
    if (!serviceIds.length) return [];
    const graph = await this.getGraph();
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const dFilter = this.tenantFilter('d', tenantId);
    const sFilter = this.tenantFilter('s', tenantId);

    const res = await graph.query(
      `MATCH (s:Service)-[:HAS_DEPLOYMENT]->(d:Deployment)
       WHERE s.id IN $serviceIds AND ${sFilter} AND ${dFilter}
       RETURN d, s.id AS serviceId
       ORDER BY d.deployedAt DESC
       LIMIT $limit`,
      { params: { serviceIds, limit: safeLimit } }
    );

    return (res.data || []).map((row: any) => this.extractProperties(row.d));
  }

  // ==========================================
  // Operation: Service Owners
  // ==========================================
  public async getServiceOwners(serviceId: string, tenantId = 'tenant-default'): Promise<Team | null> {
    const graph = await this.getGraph();
    const sFilter = this.tenantFilter('s', tenantId);
    const res = await graph.query(
      `MATCH (s:Service {id: $id})-[:OWNED_BY]->(t:Team)
       WHERE ${sFilter}
       RETURN t LIMIT 1`,
      { params: { id: serviceId } }
    );
    if (!res.data || res.data.length === 0) return null;
    return this.extractProperties(res.data[0].t);
  }

  // ==========================================
  // Operation E — Incident Evidence Retrieval
  // ==========================================
  public async getIncidentEvidence(incidentId: string, tenantId = 'tenant-default'): Promise<Evidence[]> {
    const graph = await this.getGraph();
    const eFilter = this.tenantFilter('e', tenantId);
    const res = await graph.query(
      `MATCH (e:Evidence)-[:OBSERVED_IN]->(i:Incident {id: $id})
       WHERE ${eFilter}
       RETURN e
       ORDER BY e.observedAt ASC
       LIMIT 50`,
      { params: { id: incidentId } }
    );

    return (res.data || []).map((row: any) => this.extractProperties(row.e));
  }

  // ==========================================
  // Operation F — Historical Comparison
  // ==========================================
  public async getRelatedIncidents(incidentId: string, tenantId = 'tenant-default'): Promise<Incident[]> {
    const graph = await this.getGraph();
    const histFilter = this.tenantFilter('hist', tenantId);
    const res = await graph.query(
      `MATCH (i:Incident {id: $id})-[:RELATED_TO]-(hist:Incident)
       WHERE ${histFilter}
       RETURN DISTINCT hist
       LIMIT 10`,
      { params: { id: incidentId } }
    );

    return (res.data || []).map((row: any) => this.extractProperties(row.hist));
  }

  // ==========================================
  // Operation G — Explanation Paths
  // ==========================================
  public async getInvestigationPaths(
    startId: string,
    endId: string,
    maxDepth = 4,
    tenantId = 'tenant-default'
  ): Promise<{ nodes: string[]; relationships: string[]; description: string }[]> {
    const graph = await this.getGraph();
    const safeDepth = Math.min(Math.max(1, maxDepth), config.MAX_GRAPH_TRAVERSAL_DEPTH);
    const nFilter = this.tenantFilter('n', tenantId);

    const cypher = `
      MATCH p = (start {id: $startId})-[r*1..${safeDepth}]-(target {id: $endId})
      WHERE ALL(rel IN relationships(p) WHERE type(rel) IN ['AFFECTS', 'DEPENDS_ON', 'HAS_DEPLOYMENT', 'RELATED_TO'])
        AND ALL(n IN nodes(p) WHERE ${nFilter})
      RETURN p,
             [n IN nodes(p) | coalesce(n.id, id(n))] AS nodeIds,
             [rel IN relationships(p) | type(rel)] AS relTypes
      ORDER BY length(p) ASC
      LIMIT 5
    `;

    try {
      const res = await graph.query(cypher, { params: { startId, endId } });
      const paths: { nodes: string[]; relationships: string[]; description: string }[] = [];

      for (const row of res.data || []) {
        const nodeIds: string[] = row.nodeIds || [];
        const relTypes: string[] = row.relTypes || [];
        let desc = '';
        for (let i = 0; i < nodeIds.length; i++) {
          desc += nodeIds[i];
          if (i < relTypes.length) {
            desc += ` -[${relTypes[i]}]-> `;
          }
        }
        paths.push({
          nodes: nodeIds,
          relationships: relTypes,
          description: desc,
        });
      }
      return paths;
    } catch (err) {
      console.error('[GraphRepository] Path query failed:', err);
      return [];
    }
  }

  // ==========================================
  // Subgraph for Visualization
  // ==========================================
  public async getSubgraph(incidentId: string, tenantId = 'tenant-default'): Promise<SubgraphData> {
    const graph = await this.getGraph();
    const iFilter = this.tenantFilter('i', tenantId);
    const cypher = `
      MATCH (i:Incident {id: $id})
      WHERE ${iFilter}
      OPTIONAL MATCH (i)-[r1:AFFECTS]->(s:Service)
      OPTIONAL MATCH (s)-[r2:DEPENDS_ON*1..2]->(dep:Service)
      OPTIONAL MATCH (s)-[r3:OWNED_BY]->(t1:Team)
      OPTIONAL MATCH (dep)-[r4:OWNED_BY]->(t2:Team)
      OPTIONAL MATCH (s)-[r5:HAS_DEPLOYMENT]->(d1:Deployment)
      OPTIONAL MATCH (dep)-[r6:HAS_DEPLOYMENT]->(d2:Deployment)
      OPTIONAL MATCH (e:Evidence)-[r7:OBSERVED_IN]->(i)
      OPTIONAL MATCH (e)-[r9:REFERENCES]->(src:SourceRecord)
      OPTIONAL MATCH (i)-[r8:RELATED_TO]-(hist:Incident)
      RETURN i, s, dep, t1, t2, d1, d2, e, src, hist
      LIMIT 100
    `;

    const res = await graph.query(cypher, { params: { id: incidentId } });

    const nodesMap = new Map<string, GraphNode>();
    const edgesMap = new Map<string, GraphEdge>();
    const serviceIds = new Set<string>();

    const addNode = (n: any) => {
      if (!n || !n.properties) return;
      const id = String(n.properties.id || n.id);
      const label = Array.isArray(n.labels) && n.labels.length > 0 ? n.labels[0] : 'Node';
      if (!nodesMap.has(id)) {
        nodesMap.set(id, {
          id,
          label,
          properties: n.properties,
        });
      }
    };

    const addEdge = (srcId: string, tgtId: string, type: string) => {
      if (!srcId || !tgtId || !type) return;
      const key = `${srcId}-${type}->${tgtId}`;
      if (!edgesMap.has(key)) {
        edgesMap.set(key, {
          source: srcId,
          target: tgtId,
          type,
        });
      }
    };

    for (const row of res.data || []) {
      addNode(row.i);
      addNode(row.s);
      addNode(row.dep);
      addNode(row.t1);
      addNode(row.t2);
      addNode(row.d1);
      addNode(row.d2);
      addNode(row.e);
      addNode(row.src);
      addNode(row.hist);

      if (row.s?.properties?.id) serviceIds.add(row.s.properties.id);
      if (row.dep?.properties?.id) serviceIds.add(row.dep.properties.id);

      if (row.i?.properties?.id && row.s?.properties?.id) {
        addEdge(row.i.properties.id, row.s.properties.id, 'AFFECTS');
      }
      if (row.s?.properties?.id && row.t1?.properties?.id) {
        addEdge(row.s.properties.id, row.t1.properties.id, 'OWNED_BY');
      }
      if (row.dep?.properties?.id && row.t2?.properties?.id) {
        addEdge(row.dep.properties.id, row.t2.properties.id, 'OWNED_BY');
      }
      if (row.s?.properties?.id && row.d1?.properties?.id) {
        addEdge(row.s.properties.id, row.d1.properties.id, 'HAS_DEPLOYMENT');
      }
      if (row.dep?.properties?.id && row.d2?.properties?.id) {
        addEdge(row.dep.properties.id, row.d2.properties.id, 'HAS_DEPLOYMENT');
      }
      if (row.e?.properties?.id && row.i?.properties?.id) {
        addEdge(row.e.properties.id, row.i.properties.id, 'OBSERVED_IN');
      }
      if (row.e?.properties?.id && row.src?.properties?.id) {
        addEdge(row.e.properties.id, row.src.properties.id, 'REFERENCES');
      }
      if (row.i?.properties?.id && row.hist?.properties?.id) {
        addEdge(row.i.properties.id, row.hist.properties.id, 'RELATED_TO');
      }
    }

    // Connect service dependencies explicitly between known services in subgraph
    if (serviceIds.size > 0) {
      const depRelsRes = await graph.query(
        `MATCH (s1:Service)-[r:DEPENDS_ON]->(s2:Service)
         WHERE s1.id IN $svcIds AND s2.id IN $svcIds
         RETURN s1.id AS src, s2.id AS tgt`,
        { params: { svcIds: Array.from(serviceIds) } }
      );
      for (const row of depRelsRes.data || []) {
        if (nodesMap.has(row.src) && nodesMap.has(row.tgt)) {
          addEdge(row.src, row.tgt, 'DEPENDS_ON');
        }
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    };
  }

  // ==========================================
  // Step 8: Persist Investigation to FalkorDB
  // ==========================================
  public async persistInvestigation(result: InvestigationResult, callerTenantId?: string): Promise<void> {
    const graph = await this.getGraph();
    const tenantId = callerTenantId || result.tenantId || 'tenant-default';

    // 1. Create or update Investigation node
    await graph.query(
      `MERGE (inv:Investigation {id: $id})
       SET inv.tenantId = $tenantId,
           inv.question = $question,
           inv.status = $status,
           inv.startedAt = $startedAt,
           inv.completedAt = $completedAt,
           inv.executionMode = $executionMode,
           inv.summary = $summary,
           inv.resultSummary = $summary,
           inv.recommendedNextStep = $recommendedNextStep,
           inv.incidentId = $incidentId,
           inv.rawResult = $rawResult`,
      {
        params: {
          id: result.investigationId,
          tenantId,
          question: result.question,
          status: result.status,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          executionMode: result.executionMode,
          summary: result.summary,
          recommendedNextStep: result.recommendedNextStep,
          incidentId: result.incidentId || '',
          rawResult: JSON.stringify(result),
        },
      }
    );

    // 2. Connect to Incident if present
    if (result.incidentId) {
      await graph.query(
        `MATCH (inv:Investigation {id: $invId}), (i:Incident {id: $incId})
         MERGE (i)-[:INVESTIGATED_IN]->(inv)`,
        { params: { invId: result.investigationId, incId: result.incidentId } }
      );
    }

    // 3. Persist Candidate Explanations / Hypotheses
    for (const exp of result.candidateExplanations) {
      await graph.query(
        `MERGE (h:Hypothesis {id: $hypId})
         SET h.tenantId = $tenantId,
             h.statement = $statement,
             h.status = $status,
             h.explanation = $explanation,
             h.incidentId = $incId,
             h.updatedAt = $now
         WITH h
         MATCH (inv:Investigation {id: $invId})
         MERGE (inv)-[:EVALUATED_HYPOTHESIS]->(h)`,
        {
          params: {
            hypId: exp.id,
            tenantId,
            statement: exp.statement,
            status: exp.status,
            explanation: exp.explanation,
            incId: result.incidentId || '',
            now: new Date().toISOString(),
            invId: result.investigationId,
          },
        }
      );

      // Connect supporting evidence
      for (const evId of exp.supportingEvidenceIds) {
        await graph.query(
          `MATCH (h:Hypothesis {id: $hypId}), (e:Evidence {id: $evId})
           MERGE (h)-[:SUPPORTED_BY]->(e)`,
          { params: { hypId: exp.id, evId } }
        );
      }

      // Connect contradictory evidence
      for (const evId of exp.contradictoryEvidenceIds) {
        await graph.query(
          `MATCH (h:Hypothesis {id: $hypId}), (e:Evidence {id: $evId})
           MERGE (h)-[:CONTRADICTED_BY]->(e)`,
          { params: { hypId: exp.id, evId } }
        );
      }
    }
  }

  // ==========================================
  // Retrieve Stored Investigation isolated by tenant
  // ==========================================
  public async getPersistedInvestigation(
    investigationId: string,
    tenantId = 'tenant-default'
  ): Promise<InvestigationResult | null> {
    const graph = await this.getGraph();
    const filter = this.tenantFilter('inv', tenantId);

    const res = await graph.query(
      `MATCH (inv:Investigation {id: $id})
       WHERE ${filter}
       RETURN inv.rawResult AS rawResult LIMIT 1`,
      { params: { id: investigationId } }
    );

    if (!res.data || res.data.length === 0 || !res.data[0].rawResult) {
      return null;
    }

    try {
      return JSON.parse(res.data[0].rawResult);
    } catch {
      return null;
    }
  }

  public async listPersistedInvestigations(
    limit = 20,
    tenantId = 'tenant-default'
  ): Promise<InvestigationHistoryItem[]> {
    const graph = await this.getGraph();
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const filter = this.tenantFilter('inv', tenantId);

    const res = await graph.query(
      `MATCH (inv:Investigation)
       WHERE ${filter}
       RETURN inv.id AS id,
              inv.incidentId AS incidentId,
              inv.question AS question,
              inv.status AS status,
              inv.startedAt AS startedAt,
              inv.completedAt AS completedAt,
              inv.executionMode AS executionMode,
              inv.summary AS summary
       ORDER BY inv.startedAt DESC
       LIMIT $limit`,
      { params: { limit: safeLimit } }
    );

    return (res.data || []).map((row: any) => ({
      id: row.id,
      tenantId,
      incidentId: row.incidentId || null,
      question: row.question,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      executionMode: row.executionMode,
      summary: row.summary,
    }));
  }

  // ==========================================
  // Helper to extract properties from node or object
  // ==========================================
  private extractProperties(nodeOrObj: any): any {
    if (!nodeOrObj) return null;
    if (nodeOrObj.properties) {
      return { ...nodeOrObj.properties };
    }
    return nodeOrObj;
  }
}

export const graphRepository = new GraphRepository();
