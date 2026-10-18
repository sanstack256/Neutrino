import crypto from 'node:crypto';
import {
  InvestigationRequest,
  InvestigationResult,
  InvestigationRequestSchema,
  InvestigationResultSchema,
  Evidence,
  Deployment,
  Service,
  InvestigationEvent,
  RecalledMemoryRecord,
  ServiceFailureDomain,
  ActionProposal,
} from '@neutrino/contracts';
import { GraphRepository, graphRepository } from '../graph/repository.js';
import { MemoryRepository, memoryRepository } from '../memory/repository.js';
import { MemoryRetrievalEngine, memoryRetrievalEngine } from '../memory/retrieval.js';
import { MemoryExtractor, memoryExtractor } from '../memory/extractor.js';
import { RemediationEngine, remediationEngine } from '../remediation/engine.js';
import { EvidenceUtils } from '../domain/evidence-utils.js';
import { HypothesisEngine } from '../domain/hypothesis-rules.js';
import { toolRegistry, ToolExecutionContext } from './tools.js';

export interface InvestigationEngineOptions {
  repository?: GraphRepository;
  memoryRepo?: MemoryRepository;
  memoryRetrieval?: MemoryRetrievalEngine;
  memoryExtractor?: MemoryExtractor;
  remediationEngine?: RemediationEngine;
  maxToolCalls?: number;
  maxDurationMs?: number;
  disableMemory?: boolean; // For Run A vs Run B comparison
}

export class InvestigationEngine {
  private repository: GraphRepository;
  private memoryRepo: MemoryRepository;
  private memoryRetrieval: MemoryRetrievalEngine;
  private memoryExtractor: MemoryExtractor;
  private remediation: RemediationEngine;
  private maxToolCalls: number;
  private maxDurationMs: number;
  private disableMemory: boolean;

  constructor(optionsOrRepo?: InvestigationEngineOptions | GraphRepository) {
    if (optionsOrRepo && 'getIncidentContext' in optionsOrRepo) {
      this.repository = optionsOrRepo as GraphRepository;
      this.memoryRepo = memoryRepository;
      this.memoryRetrieval = new MemoryRetrievalEngine(this.memoryRepo);
      this.memoryExtractor = new MemoryExtractor(this.memoryRepo);
      this.remediation = remediationEngine;
      this.maxToolCalls = 12;
      this.maxDurationMs = 5000;
      this.disableMemory = false;
    } else {
      const options = optionsOrRepo as InvestigationEngineOptions | undefined;
      this.repository = options?.repository || graphRepository;
      this.memoryRepo = options?.memoryRepo || memoryRepository;
      this.memoryRetrieval =
        options?.memoryRetrieval || new MemoryRetrievalEngine(this.memoryRepo);
      this.memoryExtractor =
        options?.memoryExtractor || new MemoryExtractor(this.memoryRepo);
      this.remediation = options?.remediationEngine || remediationEngine;
      this.maxToolCalls = options?.maxToolCalls || 12;
      this.maxDurationMs = options?.maxDurationMs || 5000;
      this.disableMemory = options?.disableMemory || false;
    }
  }

  /**
   * Executes the bounded, memory-aware investigation loop with tenant isolation
   */
  public async execute(rawRequest: InvestigationRequest, tenantContext?: any): Promise<InvestigationResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    const events: InvestigationEvent[] = [];
    const requestCache = new Map<string, any>();
    let toolCallCount = 0;
    let nodesEvaluated = 0;
    let relsEvaluated = 0;

    const tenantId = tenantContext?.tenantId || (rawRequest as any).tenantId || 'tenant-default';

    const recordEvent = (
      phase: string,
      action: string,
      details: any = {},
      durationMs?: number
    ) => {
      events.push({
        id: `evt-${crypto.randomBytes(3).toString('hex')}`,
        timestamp: new Date().toISOString(),
        phase,
        action,
        details,
        durationMs,
      });
    };

    recordEvent('INITIALIZING', 'Investigation request received and validated', {
      question: rawRequest.question,
      executionMode: rawRequest.executionMode,
      tenantId,
    });

    // 1. Validate request
    const request = InvestigationRequestSchema.parse(rawRequest);
    const investigationId = `inv-${crypto.randomUUID().slice(0, 8)}`;

    const toolCtx: ToolExecutionContext = {
      repository: this.repository,
      memoryRetrieval: this.memoryRetrieval,
      tenantId,
      cache: requestCache,
      events,
      recordEvent,
    };

    // 2. Resolve Incident Target
    let incidentId = request.incidentId;
    if (!incidentId) {
      const incidents = await this.repository.listIncidents(5, tenantId);
      toolCallCount++;
      const lowerQ = request.question.toLowerCase();
      const matched = incidents.find(
        (i) =>
          lowerQ.includes(i.id.toLowerCase()) ||
          lowerQ.includes(i.title.toLowerCase()) ||
          (i.description && lowerQ.includes(i.description.toLowerCase()))
      );
      if (matched) {
        incidentId = matched.id;
      } else if (incidents.length > 0) {
        incidentId = incidents[0].id;
      }
    }

    if (!incidentId) {
      throw new Error(
        'No incident found in graph to investigate. Please seed the graph or provide a valid incident ID.'
      );
    }

    toolCtx.incidentId = incidentId;

    // 3. Tool: get_incident_context
    if (toolCallCount >= this.maxToolCalls) {
      recordEvent('BUDGET_EXHAUSTED', 'Maximum tool execution budget reached');
    }
    const context = await toolRegistry.get_incident_context.execute(
      { incidentId },
      toolCtx
    );
    toolCallCount++;

    if (!context.incident) {
      throw new Error(`Incident '${incidentId}' was not found in the graph database.`);
    }

    nodesEvaluated++; // Incident node

    let affectedService: Service | null = context.affectedService;
    let upstreamDeps: { service: Service; depth: number; path: string[] }[] = [];
    let downstreamImpact: { service: Service; depth: number }[] = [];
    let allDeployments: Deployment[] = [...context.deployments];
    let investigationPaths: { nodes: string[]; relationships: string[]; description: string }[] = [];

    // 4. Tool: traverse_service_dependencies & bounded exploration
    if (affectedService && toolCallCount < this.maxToolCalls) {
      nodesEvaluated++;
      relsEvaluated++;

      const depResult = await toolRegistry.traverse_service_dependencies.execute(
        { serviceId: affectedService.id, maxDepth: 3 },
        toolCtx
      );
      toolCallCount++;

      upstreamDeps = depResult.upstream;
      downstreamImpact = depResult.downstream;
      nodesEvaluated += upstreamDeps.length + downstreamImpact.length;
      relsEvaluated += upstreamDeps.reduce((acc, curr) => acc + curr.depth, 0);

      // Fetch deployments for upstream dependencies as well
      const depServiceIds = upstreamDeps.map((d) => d.service.id);
      if (depServiceIds.length > 0 && toolCallCount < this.maxToolCalls) {
        const extraDeployments = await toolRegistry.get_recent_deployments.execute(
          { serviceIds: depServiceIds, limit: 10 },
          toolCtx
        );
        toolCallCount++;
        allDeployments.push(...extraDeployments);
        nodesEvaluated += extraDeployments.length;
      }

      // Explore causal paths
      for (const dep of upstreamDeps) {
        if (toolCallCount >= this.maxToolCalls) break;
        const paths = await toolRegistry.explore_causal_paths.execute(
          { startId: incidentId, endId: dep.service.id, maxDepth: 3 },
          toolCtx
        );
        toolCallCount++;
        if (paths.length > 0) {
          investigationPaths.push(...paths);
        }
      }
    }

    // 5. Ingest live telemetry & detect dynamic graph failure domain
    const rawEvidence: Evidence[] = [...context.evidence];
    if (affectedService && toolCallCount < this.maxToolCalls) {
      try {
        const liveTelemetry = await toolRegistry.retrieve_live_telemetry.execute(
          { serviceId: affectedService.id, limit: 15 },
          toolCtx
        );
        toolCallCount++;
        if (liveTelemetry && liveTelemetry.length > 0) {
          rawEvidence.push(...liveTelemetry);
          nodesEvaluated += liveTelemetry.length;
        }
      } catch (e) {
        // Telemetry lookup safe degrade
      }
    }

    let failureDomain: ServiceFailureDomain | null = null;
    if (affectedService && toolCallCount < this.maxToolCalls) {
      try {
        failureDomain = await toolRegistry.detect_failure_domains.execute(
          { serviceId: affectedService.id },
          toolCtx
        );
        toolCallCount++;
      } catch (e) {
        // Intelligence lookup safe degrade
      }
    }

    nodesEvaluated += rawEvidence.length;
    relsEvaluated += rawEvidence.length;
    const evidenceBundle = EvidenceUtils.sortByTimestamp(EvidenceUtils.deduplicate(rawEvidence));

    // Deduplicate deployments
    const seenDepIds = new Set<string>();
    const uniqueDeployments = allDeployments.filter((d) => {
      if (seenDepIds.has(d.id)) return false;
      seenDepIds.add(d.id);
      return true;
    });

    // 6. Memory Recall (Multi-Signal) — only if memory is enabled
    let recalledMemories: RecalledMemoryRecord[] = [];
    if (!this.disableMemory && toolCallCount < this.maxToolCalls) {
      recalledMemories = await toolRegistry.retrieve_relevant_memory.execute(
        {
          incident: context.incident,
          affectedService,
          upstreamDependencies: upstreamDeps,
          currentEvidence: evidenceBundle,
          limit: 5,
        },
        toolCtx
      );
      toolCallCount++;
    }

    // 7. Evaluate Hypotheses
    const evaluation = await toolRegistry.evaluate_hypotheses.execute(
      {
        incident: context.incident,
        affectedService,
        upstreamDependencies: upstreamDeps,
        deployments: uniqueDeployments,
        evidence: evidenceBundle,
        relatedIncidents: context.relatedIncidents,
        investigationPaths,
      },
      toolCtx
    );
    toolCallCount++;

    // Integrate procedural memory into recommendation if available and relevant
    let recommendedNextStep = evaluation.recommendedNextStep;
    const activeProcedure = recalledMemories.find(
      (m) =>
        m.memoryType === 'procedural' &&
        m.influence !== 'rejected_by_evidence' &&
        m.status === 'active'
    );
    if (activeProcedure && !recommendedNextStep.includes('Execute validated procedure')) {
      recommendedNextStep = `Execute validated procedure (${activeProcedure.statement}): ${recommendedNextStep}`;
    }

    // Propose safe diagnostic/remediation action if a verified procedure is recommended
    let actionProposal: ActionProposal | undefined = undefined;
    if (activeProcedure && evaluation.explanations.some((e) => e.status === 'supported')) {
      const statement = activeProcedure.statement.toLowerCase();
      let actionType: 'cache_flush' | 'jwks_sync' | 'pod_restart' | 'diagnostic_probe' | 'config_rollback' = 'diagnostic_probe';
      let riskLevel: 'low' | 'medium' | 'high' = 'low';

      if (statement.includes('jwks') || statement.includes('key') || statement.includes('token')) {
        actionType = 'jwks_sync';
        riskLevel = 'medium';
      } else if (statement.includes('cache') || statement.includes('redis') || statement.includes('flush')) {
        actionType = 'cache_flush';
        riskLevel = 'medium';
      } else if (statement.includes('restart') || statement.includes('pod') || statement.includes('oom')) {
        actionType = 'pod_restart';
        riskLevel = 'high';
      } else if (statement.includes('rollback') || statement.includes('revert')) {
        actionType = 'config_rollback';
        riskLevel = 'high';
      }

      try {
        const targetSvc = affectedService ? affectedService.id : 'unknown';
        actionProposal = await this.remediation.proposeAction({
          incidentId,
          investigationId,
          procedureId: activeProcedure.memoryId,
          actionType,
          targetServiceId: targetSvc,
          targetResource: `${targetSvc}/configuration`,
          parameters: {},
          explanation: `Recommended procedural remediation based on prior verified investigation: ${activeProcedure.statement}`,
          riskLevel,
        });
        recordEvent('ACTION_PROPOSED', `Proposed safe action ${actionType} for ${actionProposal.targetServiceId}`, {
          actionId: actionProposal.id,
          actionType,
          riskLevel,
        });
      } catch (propErr) {
        console.error('[InvestigationEngine] Action proposal creation error:', propErr);
      }
    }

    // Determine completion status & check for grounded abstention
    let status: 'completed' | 'insufficient-evidence' = 'completed';
    if (
      evidenceBundle.length === 0 ||
      evaluation.missingInformation.length > 2 ||
      (upstreamDeps.length > 0 &&
        evaluation.explanations.every(
          (e) => e.status !== 'supported'
        ))
    ) {
      status = 'insufficient-evidence';
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    const affectedServicesList: string[] = [];
    if (affectedService) affectedServicesList.push(affectedService.id);
    for (const d of downstreamImpact) {
      if (!affectedServicesList.includes(d.service.id)) {
        affectedServicesList.push(d.service.id);
      }
    }

    const formattedPaths = investigationPaths.map((p) => ({
      description: p.description,
      pathString: p.description,
      nodes: p.nodes,
      relationships: p.relationships,
    }));

    recordEvent('CONCLUDED', `Investigation completed with status: ${status}`, {
      status,
      durationMs,
      toolCallCount,
      recalledMemoriesCount: recalledMemories.length,
    });

    const result: InvestigationResult = {
      investigationId,
      tenantId,
      incidentId,
      question: request.question,
      status,
      startedAt,
      completedAt,
      executionMode: request.executionMode,
      summary: evaluation.summary,
      affectedServices: affectedServicesList,
      candidateExplanations: evaluation.explanations,
      evidenceBundle,
      graphPaths: formattedPaths,
      missingInformation: evaluation.missingInformation,
      recommendedNextStep,
      failureDomain: failureDomain || undefined,
      actionProposal,
      metrics: {
        durationMs,
        graphQueryCount: toolCallCount,
        nodesEvaluated,
        relationshipsEvaluated: relsEvaluated,
      },
      recalledMemories,
      events,
    };

    const validatedResult = InvestigationResultSchema.parse(result);

    // 8. Persist Investigation & Evaluated Hypotheses to FalkorDB
    try {
      await this.repository.persistInvestigation(validatedResult, tenantId);
    } catch (persistErr) {
      console.error('[InvestigationEngine] Failed to persist investigation to FalkorDB:', persistErr);
    }

    // 9. Extract and Persist Memory (Cross-session learning) — only if memory enabled
    if (!this.disableMemory) {
      try {
        const memoryOutcome = await this.memoryExtractor.extractAndPersist(validatedResult);
        validatedResult.generatedMemories = {
          episodeId: memoryOutcome.episode.id,
          claimIds: memoryOutcome.claims.map((c) => c.id),
          procedureIds: memoryOutcome.procedures.map((p) => p.id),
        };
        recordEvent('MEMORY_EXTRACTED', 'Synthesized and stored new graph memories', {
          episodeId: memoryOutcome.episode.id,
          claimCount: memoryOutcome.claims.length,
          procedureCount: memoryOutcome.procedures.length,
        });
      } catch (memErr) {
        console.error('[InvestigationEngine] Memory extraction failed:', memErr);
      }
    }

    return validatedResult;
  }
}

export const investigationEngine = new InvestigationEngine();
