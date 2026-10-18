import { FalkorDBManager, graphManager } from '../graph/client.js';
import { ServiceFailureDomain, FailureDomainRole } from '@neutrino/contracts';

export interface GraphIntelligenceOptions {
  customManager?: FalkorDBManager;
  graphName?: string;
}

export class GraphIntelligenceService {
  private manager: FalkorDBManager;
  private graphName: string;
  // Tenant-partitioned cache preventing cross-tenant data leakage
  private cacheByTenant = new Map<string, { domains: ServiceFailureDomain[]; timestamp: number }>();
  private cacheTtlMs = 60000; // 1 minute TTL

  constructor(options?: GraphIntelligenceOptions) {
    this.manager = options?.customManager || graphManager;
    this.graphName = options?.graphName || process.env.FALKORDB_GRAPH_NAME || 'neutrino_graph';
  }

  private async getGraph() {
    return this.manager.getGraph(this.graphName);
  }

  public invalidateCache(tenantId?: string): void {
    if (tenantId) {
      this.cacheByTenant.delete(tenantId);
    } else {
      this.cacheByTenant.clear();
    }
  }

  /**
   * Discovers and computes failure domains from the live FalkorDB topology isolated by tenant
   */
  public async discoverFailureDomains(forceRefresh = false, tenantId = 'tenant-default'): Promise<ServiceFailureDomain[]> {
    const cached = this.cacheByTenant.get(tenantId);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.domains;
    }

    const graph = await this.getGraph();

    // 1. Fetch services for this tenant (or shared)
    const svcRes = await graph.query(
      `MATCH (s:Service)
       WHERE s.tenantId = $tenantId OR s.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND s.tenantId IS NULL)
       RETURN s.id AS id, s.criticality AS criticality`,
      { params: { tenantId } }
    );
    const allServices: Array<{ id: string; criticality: string }> = (svcRes.data || []).map((r: any) => ({
      id: r.id,
      criticality: r.criticality || 'tier-2',
    }));

    if (allServices.length === 0) {
      return [];
    }

    // 2. Fetch structural dependency edges within tenant boundary
    const depRes = await graph.query(
      `MATCH (s:Service)-[:DEPENDS_ON]->(dep:Service)
       WHERE (s.tenantId = $tenantId OR s.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND s.tenantId IS NULL))
         AND (dep.tenantId = $tenantId OR dep.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND dep.tenantId IS NULL))
       RETURN s.id AS source, dep.id AS target`,
      { params: { tenantId } }
    );
    const depEdges: Array<{ source: string; target: string }> = (depRes.data || []).map((r: any) => ({
      source: r.source,
      target: r.target,
    }));

    // 3. Find shared infrastructure datastores (services that multiple services depend on)
    const inDegreeMap = new Map<string, number>();
    for (const edge of depEdges) {
      inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) || 0) + 1);
    }

    const sharedInfra = allServices
      .filter((s) => s.id.includes('redis') || s.id.includes('postgres') || (inDegreeMap.get(s.id) || 0) >= 3)
      .map((s) => s.id);

    // 4. Cluster connected components / failure domains using graph traversal
    const adjacency = new Map<string, Set<string>>();
    for (const s of allServices) {
      adjacency.set(s.id, new Set<string>());
    }
    for (const edge of depEdges) {
      // Connect in undirected adjacency for community reachability (excluding shared infra to prevent single massive mega-cluster)
      if (!sharedInfra.includes(edge.target)) {
        adjacency.get(edge.source)?.add(edge.target);
        adjacency.get(edge.target)?.add(edge.source);
      }
    }

    const visited = new Set<string>();
    const clusters: string[][] = [];

    for (const s of allServices) {
      if (!visited.has(s.id)) {
        const cluster: string[] = [];
        const queue: string[] = [s.id];
        visited.add(s.id);

        while (queue.length > 0) {
          const current = queue.shift()!;
          cluster.push(current);

          for (const neighbor of adjacency.get(current) || []) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
        clusters.push(cluster);
      }
    }

    // 5. Construct ServiceFailureDomain records
    const totalServiceCount = allServices.length;
    const computedAt = new Date().toISOString();

    const failureDomains: ServiceFailureDomain[] = clusters.map((cluster, idx) => {
      // Find downstream consumers and upstream dependencies in this cluster
      const clusterServices = cluster.map((svcId) => {
        const inDeg = inDegreeMap.get(svcId) || 0;
        const outDeg = depEdges.filter((e) => e.source === svcId).length;
        const svcMeta = allServices.find((s) => s.id === svcId);

        let role: FailureDomainRole = 'dependency';
        if (sharedInfra.includes(svcId)) {
          role = 'shared_infra';
        } else if (inDeg > 1 && outDeg > 0) {
          role = 'hub';
        } else if (outDeg > 0 && inDeg === 0) {
          role = 'consumer';
        }

        return {
          serviceId: svcId,
          role,
          criticality: svcMeta?.criticality || 'tier-2',
        };
      });

      // Associated shared infrastructure used by this cluster
      const clusterSharedInfra = sharedInfra.filter((infraId) =>
        depEdges.some((e) => cluster.includes(e.source) && e.target === infraId)
      );

      // Blast radius = proportion of cluster services + shared dependencies over total services
      const blastRadiusScore = Number(
        Math.min(1.0, (cluster.length + clusterSharedInfra.length) / totalServiceCount).toFixed(2)
      );

      // Generate domain name based on primary services
      let domainName = `Failure Domain ${idx + 1}`;
      if (cluster.includes('checkout-service')) {
        domainName = 'Core Commerce & Consumer Checkout Domain';
      } else if (cluster.includes('auth-service')) {
        domainName = 'Identity, Security & Token Lifecycle Domain';
      } else if (cluster.includes('payment-gateway')) {
        domainName = 'Payments & External Clearing Domain';
      } else if (clusterSharedInfra.length > 0) {
        domainName = `Shared Storage & Infrastructure Fabric (${clusterSharedInfra.join(', ')})`;
      }

      return {
        communityId: `fd-comm-${idx + 1}-${cluster[0] || 'domain'}`,
        name: domainName,
        serviceIds: cluster,
        services: clusterServices,
        sharedInfrastructure: clusterSharedInfra,
        blastRadiusScore,
        computedAt,
        rationale: `Graph-derived connected cluster of ${cluster.length} services with ${clusterSharedInfra.length} shared infrastructure dependencies in FalkorDB.`,
      };
    });

    this.cacheByTenant.set(tenantId, { domains: failureDomains, timestamp: Date.now() });

    return failureDomains;
  }

  /**
   * Retrieves failure domain for a specific service
   */
  public async getFailureDomainForService(serviceId: string, tenantId = 'tenant-default'): Promise<ServiceFailureDomain | null> {
    const domains = await this.discoverFailureDomains(false, tenantId);
    return domains.find((d) => d.serviceIds.includes(serviceId) || d.sharedInfrastructure.includes(serviceId)) || null;
  }
}

export const graphIntelligenceService = new GraphIntelligenceService();
