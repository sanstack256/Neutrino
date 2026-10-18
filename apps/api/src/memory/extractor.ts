import {
  InvestigationResult,
  MemoryEpisode,
  KnowledgeClaim,
  DiagnosticProcedure,
} from '@neutrino/contracts';
import { MemoryRepository, memoryRepository } from './repository.js';
import crypto from 'node:crypto';

export class MemoryExtractor {
  private repo: MemoryRepository;

  constructor(repo?: MemoryRepository) {
    this.repo = repo || memoryRepository;
  }

  /**
   * Extracts grounded Episodic, Semantic, and Procedural memories from a completed investigation result
   */
  public async extractAndPersist(result: InvestigationResult): Promise<{
    episode: MemoryEpisode;
    claims: KnowledgeClaim[];
    procedures: DiagnosticProcedure[];
  }> {
    const now = new Date().toISOString();
    const validEvidenceIds = new Set(result.evidenceBundle.map((e) => e.id));

    // -------------------------------------------------------------
    // 1. Extract Episodic Memory
    // -------------------------------------------------------------
    const episodeId = `ep-${crypto.randomBytes(4).toString('hex')}`;
    const supportedHypotheses = result.candidateExplanations
      .filter((h) => h.status === 'supported')
      .map((h) => h.statement);

    const contradictedHypotheses = result.candidateExplanations
      .filter((h) => h.status === 'contradicted')
      .map((h) => h.statement);

    const episode: MemoryEpisode = {
      id: episodeId,
      tenantId: result.tenantId || 'tenant-default',
      investigationId: result.investigationId,
      incidentId: result.incidentId || null,
      summary: result.summary,
      outcome: result.status,
      status: 'active',
      serviceIds: result.affectedServices,
      deploymentIds: result.evidenceBundle
        .filter((e) => e.sourceType === 'deployment')
        .map((e) => e.sourceRecordId),
      evidenceIds: result.evidenceBundle.map((e) => e.id),
      graphPaths: result.graphPaths.map((p) => p.description),
      hypothesesEvaluated: result.candidateExplanations.map((h) => h.id),
      supportedHypotheses,
      contradictedHypotheses,
      unresolvedQuestions: result.missingInformation,
      createdAt: result.completedAt || now,
      updatedAt: now,
      synthetic: true,
    };

    await this.repo.saveEpisode(episode);

    // -------------------------------------------------------------
    // 2. Extract Semantic Knowledge Claims
    // -------------------------------------------------------------
    const claims: KnowledgeClaim[] = [];

    for (const exp of result.candidateExplanations) {
      if (exp.status === 'supported' || exp.status === 'contradicted') {
        // Grounding validation: verify evidence IDs exist in bundle
        const groundedSupporting = exp.supportingEvidenceIds.filter((id) =>
          validEvidenceIds.has(id)
        );
        const groundedContradicting = exp.contradictoryEvidenceIds.filter((id) =>
          validEvidenceIds.has(id)
        );

        if (exp.status === 'supported' && groundedSupporting.length === 0) {
          // Reject ungrounded claim extraction
          continue;
        }

        const primaryService = result.affectedServices[0] || 'service';
        const claimId = `claim-${crypto.randomBytes(4).toString('hex')}`;

        const claim: KnowledgeClaim = {
          id: claimId,
          tenantId: result.tenantId || 'tenant-default',
          subject: primaryService,
          predicate:
            exp.status === 'supported'
              ? 'caused_by_condition'
              : 'refuted_by_telemetry',
          object: exp.id,
          statement: exp.statement,
          claimType: exp.status === 'supported' ? 'verified' : 'inferred',
          status: 'active',
          confidence: exp.status === 'supported' ? 0.95 : 0.85,
          supportingEvidenceIds: groundedSupporting,
          contradictoryEvidenceIds: groundedContradicting,
          sourceProvenance: `Investigation ${result.investigationId}`,
          firstObservedAt: result.startedAt,
          lastVerifiedAt: result.completedAt,
          revision: 1,
          synthetic: true,
        };

        await this.repo.saveKnowledgeClaim(claim, episodeId);
        claims.push(claim);
      }
    }

    // -------------------------------------------------------------
    // 3. Extract Procedural Memory
    // -------------------------------------------------------------
    const procedures: DiagnosticProcedure[] = [];

    if (
      result.status === 'completed' &&
      result.recommendedNextStep &&
      result.recommendedNextStep.toLowerCase().includes('diagnostic')
    ) {
      const procId = `proc-${crypto.randomBytes(4).toString('hex')}`;
      const targetService = result.affectedServices[0] || 'unknown-service';

      // Parse recommended actions into distinct steps
      const steps = result.recommendedNextStep
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const procedure: DiagnosticProcedure = {
        id: procId,
        tenantId: result.tenantId || 'tenant-default',
        name: `Diagnostic verification for ${targetService}`,
        purpose: `Validate root cause hypotheses following operational errors on ${targetService}`,
        serviceId: targetService,
        preconditions: [
          `Active or recent incident on ${targetService}`,
          'Telemetry access to APM metrics and pod logs',
        ],
        requiredEvidenceTypes: ['log', 'metric'],
        diagnosticSteps: steps.length > 0 ? steps : [result.recommendedNextStep],
        expectedObservations: [
          'Key rotation cache or connection pool status alignment',
        ],
        supportingConditions: [
          'Preceding deployment on upstream dependency within 180 min',
        ],
        contradictingConditions: [
          'Upstream latency metrics remain normal (< 2ms)',
        ],
        knownFailureModes: ['Cache TTL desync', 'Connection starvation'],
        status: 'active',
        validationCriteria:
          'Diagnostic checks must confirm signature or pool alignment without modifying production state',
        version: 1,
        lastValidatedAt: result.completedAt,
        synthetic: true,
      };

      await this.repo.saveDiagnosticProcedure(procedure, episodeId);
      procedures.push(procedure);
    }

    return { episode, claims, procedures };
  }
}

export const memoryExtractor = new MemoryExtractor();
