import crypto from 'crypto';
import {
  InvestigationRequest,
  InvestigationResult,
  InvestigationRequestSchema,
  InvestigationResultSchema,
  Evidence,
  Deployment,
  Service,
} from '@neutrino/contracts';
import { GraphRepository, graphRepository } from '../graph/repository.js';
import { EvidenceUtils } from '../domain/evidence-utils.js';
import { HypothesisEngine } from '../domain/hypothesis-rules.js';

export class InvestigationEngine {
  private repository: GraphRepository;

  constructor(repository?: GraphRepository) {
    this.repository = repository || graphRepository;
  }

  /**
   * Executes the full 9-step investigation lifecycle
   */
  public async execute(rawRequest: InvestigationRequest): Promise<InvestigationResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    let queryCount = 0;
    let nodesEvaluated = 0;
    let relsEvaluated = 0;

    // Step 1: Validate the request
    const request = InvestigationRequestSchema.parse(rawRequest);
    const investigationId = `inv-${crypto.randomUUID().slice(0, 8)}`;

    // Step 2: Establish the investigation context
    let incidentId = request.incidentId;
    if (!incidentId) {
      // Bounded search for an active incident mentioned in the question or highest severity
      const incidents = await this.repository.listIncidents(5);
      queryCount++;
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
        // Default to the most recent incident if question is generic
        incidentId = incidents[0].id;
      }
    }

    if (!incidentId) {
      throw new Error('No incident found in graph to investigate. Please seed the graph or provide a valid incident ID.');
    }

    // Step 3: Retrieve connected context from FalkorDB
    const context = await this.repository.getIncidentContext(incidentId);
    queryCount += 2;

    if (!context.incident) {
      throw new Error(`Incident '${incidentId}' was not found in the graph database.`);
    }

    nodesEvaluated++; // Incident node

    let affectedService: Service | null = context.affectedService;
    let upstreamDeps: { service: Service; depth: number; path: string[] }[] = [];
    let downstreamImpact: { service: Service; depth: number; path: string[] }[] = [];
    let allDeployments: Deployment[] = [...context.deployments];
    let investigationPaths: { nodes: string[]; relationships: string[]; description: string }[] = [];

    if (affectedService) {
      nodesEvaluated++; // Service node
      relsEvaluated++; // AFFECTS rel

      // Operation B: Multi-hop dependency traversal
      upstreamDeps = await this.repository.getServiceDependencies(affectedService.id, 3);
      queryCount++;
      nodesEvaluated += upstreamDeps.length;
      relsEvaluated += upstreamDeps.reduce((acc, curr) => acc + curr.depth, 0);

      // Operation C: Downstream impact traversal
      downstreamImpact = await this.repository.getAffectedServices(affectedService.id, 2);
      queryCount++;
      nodesEvaluated += downstreamImpact.length;

      // Operation D: Fetch deployments for upstream dependencies as well
      const depServiceIds = upstreamDeps.map((d) => d.service.id);
      if (depServiceIds.length > 0) {
        const extraDeployments = await this.repository.getRecentDeployments(depServiceIds, 10);
        queryCount++;
        allDeployments.push(...extraDeployments);
        nodesEvaluated += extraDeployments.length;
      }

      // Operation G: Path exploration between incident and upstream dependencies
      for (const dep of upstreamDeps) {
        const paths = await this.repository.getInvestigationPaths(incidentId, dep.service.id, 3);
        queryCount++;
        if (paths.length > 0) {
          investigationPaths.push(...paths);
        }
      }
    }

    // Step 4: Build and normalize the evidence bundle
    const rawEvidence: Evidence[] = [...context.evidence];
    nodesEvaluated += rawEvidence.length;
    relsEvaluated += rawEvidence.length;

    // Deduplicate and order chronologically
    const evidenceBundle = EvidenceUtils.sortByTimestamp(EvidenceUtils.deduplicate(rawEvidence));

    // Deduplicate deployments
    const seenDepIds = new Set<string>();
    const uniqueDeployments = allDeployments.filter((d) => {
      if (seenDepIds.has(d.id)) return false;
      seenDepIds.add(d.id);
      return true;
    });

    // Step 5 & 6: Form and check candidate explanations
    const evaluation = HypothesisEngine.evaluate({
      incident: context.incident,
      affectedService,
      upstreamDependencies: upstreamDeps,
      deployments: uniqueDeployments,
      evidence: evidenceBundle,
      relatedIncidents: context.relatedIncidents,
      investigationPaths,
    });

    // Step 7: Build structured investigation result
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    // Determine affected services list
    const affectedServicesList: string[] = [];
    if (affectedService) affectedServicesList.push(affectedService.id);
    for (const d of downstreamImpact) {
      if (!affectedServicesList.includes(d.service.id)) {
        affectedServicesList.push(d.service.id);
      }
    }

    // Determine completion status
    let status: 'completed' | 'insufficient-evidence' = 'completed';
    if (evidenceBundle.length === 0 || evaluation.missingInformation.length > 2) {
      status = 'insufficient-evidence';
    }

    const formattedPaths = investigationPaths.map((p) => ({
      description: p.description,
      pathString: p.description,
      nodes: p.nodes,
      relationships: p.relationships,
    }));

    const result: InvestigationResult = {
      investigationId,
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
      recommendedNextStep: evaluation.recommendedNextStep,
      metrics: {
        durationMs,
        graphQueryCount: queryCount,
        nodesEvaluated,
        relationshipsEvaluated: relsEvaluated,
      },
    };

    // Validate against shared contract
    const validatedResult = InvestigationResultSchema.parse(result);

    // Step 8: Persist to FalkorDB
    try {
      await this.repository.persistInvestigation(validatedResult);
    } catch (persistErr) {
      console.error('[InvestigationEngine] Failed to persist investigation to FalkorDB:', persistErr);
      // We still return the validated result, but log the persistence error
    }

    // Step 9: Return result
    return validatedResult;
  }
}

export const investigationEngine = new InvestigationEngine();
