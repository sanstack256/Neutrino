import {
  Incident,
  Service,
  Deployment,
  Evidence,
  Team,
  RecalledMemoryRecord,
  InvestigationEvent,
  ServiceFailureDomain,
} from '@neutrino/contracts';
import { GraphRepository } from '../graph/repository.js';
import { MemoryRetrievalEngine } from '../memory/retrieval.js';
import { EvidenceUtils } from '../domain/evidence-utils.js';
import { HypothesisEngine } from '../domain/hypothesis-rules.js';
import { telemetryRepository } from '../telemetry/repository.js';
import { graphIntelligenceService } from '../intelligence/failure-domains.js';

export interface ToolExecutionContext {
  repository: GraphRepository;
  memoryRetrieval: MemoryRetrievalEngine;
  incidentId?: string;
  tenantId?: string;
  cache: Map<string, any>;
  events: InvestigationEvent[];
  recordEvent: (phase: string, action: string, details?: any, durationMs?: number) => void;
}

export interface InvestigationTool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  cost: number;
  execute: (input: TInput, ctx: ToolExecutionContext) => Promise<TOutput>;
}

// ==========================================
// Tool 1: get_incident_context
// ==========================================
export const getIncidentContextTool: InvestigationTool<
  { incidentId: string },
  {
    incident: Incident | null;
    affectedService: Service | null;
    owningTeam: Team | null;
    deployments: Deployment[];
    evidence: Evidence[];
    relatedIncidents: Incident[];
  }
> = {
  name: 'get_incident_context',
  description:
    'Retrieves primary incident entity, affected service, owning team, and connected observations from FalkorDB',
  cost: 1,
  execute: async ({ incidentId }, ctx) => {
    const cacheKey = `incident_context:${incidentId}:${ctx.tenantId || 'default'}`;
    if (ctx.cache.has(cacheKey)) {
      return ctx.cache.get(cacheKey);
    }
    const t0 = performance.now();
    const result = await ctx.repository.getIncidentContext(incidentId, ctx.tenantId);
    const durationMs = performance.now() - t0;
    ctx.recordEvent(
      'CONTEXT_LOADED',
      `Loaded incident context for ${incidentId}`,
      {
        affectedService: result.affectedService?.id,
        evidenceCount: result.evidence.length,
      },
      durationMs
    );
    ctx.cache.set(cacheKey, result);
    return result;
  },
};

// ==========================================
// Tool 2: traverse_service_dependencies
// ==========================================
export const traverseServiceDependenciesTool: InvestigationTool<
  { serviceId: string; maxDepth?: number },
  { upstream: { service: Service; depth: number; path: string[] }[]; downstream: { service: Service; depth: number }[] }
> = {
  name: 'traverse_service_dependencies',
  description:
    'Explores multi-hop upstream and downstream topological service dependencies in FalkorDB',
  cost: 2,
  execute: async ({ serviceId, maxDepth = 3 }, ctx) => {
    const cacheKey = `dependencies:${serviceId}:${maxDepth}:${ctx.tenantId || 'default'}`;
    if (ctx.cache.has(cacheKey)) {
      return ctx.cache.get(cacheKey);
    }
    const t0 = performance.now();
    const [upstream, downstream] = await Promise.all([
      ctx.repository.getServiceDependencies(serviceId, maxDepth, ctx.tenantId),
      ctx.repository.getAffectedServices(serviceId, maxDepth, ctx.tenantId),
    ]);
    const durationMs = performance.now() - t0;
    ctx.recordEvent(
      'TOPOLOGY_EXPLORED',
      `Traversed dependencies for ${serviceId}`,
      {
        upstreamCount: upstream.length,
        downstreamCount: downstream.length,
      },
      durationMs
    );
    const result = { upstream, downstream };
    ctx.cache.set(cacheKey, result);
    return result;
  },
};

// ==========================================
// Tool 3: get_recent_deployments
// ==========================================
export const getRecentDeploymentsTool: InvestigationTool<
  { serviceIds: string[]; limit?: number },
  Deployment[]
> = {
  name: 'get_recent_deployments',
  description:
    'Retrieves software releases and deployments across targeted services',
  cost: 1,
  execute: async ({ serviceIds, limit = 15 }, ctx) => {
    const sortedKey = [...serviceIds].sort().join(',');
    const cacheKey = `deployments:${sortedKey}:${limit}:${ctx.tenantId || 'default'}`;
    if (ctx.cache.has(cacheKey)) {
      return ctx.cache.get(cacheKey);
    }
    const t0 = performance.now();
    const deployments = await ctx.repository.getRecentDeployments(serviceIds, limit, ctx.tenantId);
    const durationMs = performance.now() - t0;
    ctx.recordEvent(
      'DEPLOYMENTS_FETCHED',
      `Retrieved ${deployments.length} deployments for services [${serviceIds.join(', ')}]`,
      { count: deployments.length },
      durationMs
    );
    ctx.cache.set(cacheKey, deployments);
    return deployments;
  },
};

// ==========================================
// Tool 4: retrieve_relevant_memory
// ==========================================
export const retrieveRelevantMemoryTool: InvestigationTool<
  {
    incident?: Incident | null;
    affectedService?: Service | null;
    upstreamDependencies?: { service: Service; depth: number }[];
    currentEvidence?: Evidence[];
    limit?: number;
  },
  RecalledMemoryRecord[]
> = {
  name: 'retrieve_relevant_memory',
  description:
    'Performs multi-signal graph memory recall from FalkorDB combining entity overlap, graph proximity, and recency',
  cost: 2,
  execute: async (input, ctx) => {
    const t0 = performance.now();
    const memories = await ctx.memoryRetrieval.retrieveRelevantMemories({
      incident: input.incident,
      affectedService: input.affectedService,
      upstreamDependencies: input.upstreamDependencies,
      currentEvidence: input.currentEvidence,
      limit: input.limit || 5,
      tenantId: ctx.tenantId,
    });
    const durationMs = performance.now() - t0;
    ctx.recordEvent(
      'MEMORY_RECALLED',
      `Recalled ${memories.length} relevant memories from FalkorDB`,
      {
        recalledIds: memories.map((m) => m.memoryId),
        influences: memories.map((m) => `${m.memoryId}:${m.influence}`),
      },
      durationMs
    );
    return memories;
  },
};

// ==========================================
// Tool 5: explore_causal_paths
// ==========================================
export const exploreCausalPathsTool: InvestigationTool<
  { startId: string; endId: string; maxDepth?: number },
  { nodes: string[]; relationships: string[]; description: string }[]
> = {
  name: 'explore_causal_paths',
  description:
    'Discovers bounded graph paths between incident / affected service and candidate root causes in FalkorDB',
  cost: 2,
  execute: async ({ startId, endId, maxDepth = 3 }, ctx) => {
    const cacheKey = `paths:${startId}:${endId}:${maxDepth}:${ctx.tenantId || 'default'}`;
    if (ctx.cache.has(cacheKey)) {
      return ctx.cache.get(cacheKey);
    }
    const t0 = performance.now();
    const paths = await ctx.repository.getInvestigationPaths(startId, endId, maxDepth, ctx.tenantId);
    const durationMs = performance.now() - t0;
    ctx.recordEvent(
      'PATHS_EXPLORED',
      `Found ${paths.length} graph paths between ${startId} and ${endId}`,
      { pathDescriptions: paths.map((p) => p.description) },
      durationMs
    );
    ctx.cache.set(cacheKey, paths);
    return paths;
  },
};

// ==========================================
// Tool 6: evaluate_hypotheses
// ==========================================
export const evaluateHypothesesTool: InvestigationTool<
  {
    incident: Incident;
    affectedService: Service | null;
    upstreamDependencies: { service: Service; depth: number; path?: string[] }[];
    deployments: Deployment[];
    evidence: Evidence[];
    relatedIncidents: Incident[];
    investigationPaths: { nodes?: string[]; relationships?: string[]; description: string }[];
  },
  ReturnType<typeof HypothesisEngine.evaluate>
> = {
  name: 'evaluate_hypotheses',
  description:
    'Dynamically evaluates candidate hypotheses against live evidence, preceding deployments, and graph topology',
  cost: 1,
  execute: async (input, ctx) => {
    const t0 = performance.now();
    const evaluation = HypothesisEngine.evaluate(input);
    const durationMs = performance.now() - t0;
    ctx.recordEvent(
      'HYPOTHESES_EVALUATED',
      `Evaluated ${evaluation.explanations.length} candidate hypotheses`,
      {
        supported: evaluation.explanations
          .filter((e) => e.status === 'supported')
          .map((e) => e.id),
        contradicted: evaluation.explanations
          .filter((e) => e.status === 'contradicted')
          .map((e) => e.id),
      },
      durationMs
    );
    return evaluation;
  },
};

// ==========================================
// Tool 7: retrieve_live_telemetry
// ==========================================
export const retrieveLiveTelemetryTool: InvestigationTool<
  { serviceId: string; limit?: number },
  Evidence[]
> = {
  name: 'retrieve_live_telemetry',
  description:
    'Retrieves live ingested telemetry evidence linked to a service from FalkorDB',
  cost: 1,
  execute: async ({ serviceId, limit = 20 }, ctx) => {
    const cacheKey = `telemetry:${serviceId}:${limit}:${ctx.tenantId || 'default'}`;
    if (ctx.cache.has(cacheKey)) {
      return ctx.cache.get(cacheKey);
    }
    const t0 = performance.now();
    const evidence = await telemetryRepository.getEvidenceForService(serviceId, limit, ctx.tenantId);
    const durationMs = performance.now() - t0;
    ctx.recordEvent(
      'TELEMETRY_RETRIEVED',
      `Retrieved ${evidence.length} live telemetry records for ${serviceId}`,
      { count: evidence.length, serviceId },
      durationMs
    );
    ctx.cache.set(cacheKey, evidence);
    return evidence;
  },
};

// ==========================================
// Tool 8: detect_failure_domains
// ==========================================
export const detectFailureDomainsTool: InvestigationTool<
  { serviceId: string },
  ServiceFailureDomain | null
> = {
  name: 'detect_failure_domains',
  description:
    'Performs dynamic graph community clustering to discover failure domains and blast radius in FalkorDB',
  cost: 2,
  execute: async ({ serviceId }, ctx) => {
    const cacheKey = `failure_domain:${serviceId}`;
    if (ctx.cache.has(cacheKey)) {
      return ctx.cache.get(cacheKey);
    }
    const t0 = performance.now();
    const domain = await graphIntelligenceService.getFailureDomainForService(serviceId);
    const durationMs = performance.now() - t0;
    ctx.recordEvent(
      'FAILURE_DOMAIN_DETECTED',
      domain
        ? `Service ${serviceId} belongs to domain '${domain.name}' (blast radius: ${domain.blastRadiusScore})`
        : `No failure domain found for ${serviceId}`,
      {
        communityId: domain?.communityId,
        blastRadiusScore: domain?.blastRadiusScore,
        sharedInfraCount: domain?.sharedInfrastructure?.length || 0,
      },
      durationMs
    );
    ctx.cache.set(cacheKey, domain);
    return domain;
  },
};

// Registry of all allowlisted tools
export const toolRegistry = {
  get_incident_context: getIncidentContextTool,
  traverse_service_dependencies: traverseServiceDependenciesTool,
  get_recent_deployments: getRecentDeploymentsTool,
  retrieve_relevant_memory: retrieveRelevantMemoryTool,
  explore_causal_paths: exploreCausalPathsTool,
  evaluate_hypotheses: evaluateHypothesesTool,
  retrieve_live_telemetry: retrieveLiveTelemetryTool,
  detect_failure_domains: detectFailureDomainsTool,
};
