import { describe, it, expect, beforeAll } from 'vitest';
import { GraphRepository } from '../../apps/api/src/graph/repository.js';
import { MemoryRepository } from '../../apps/api/src/memory/repository.js';
import { InvestigationEngine } from '../../apps/api/src/investigation/engine.js';
import { seedDatabase } from '../../apps/api/src/seed.js';
import { KnowledgeClaim, DiagnosticProcedure } from '@neutrino/contracts';

describe('Mandatory Evaluation: Memory Utility Comparison (Run A vs Run B)', () => {
  const utilGraphName = 'neutrino_util_comparison_graph';
  let repo: GraphRepository;
  let memoryRepo: MemoryRepository;

  beforeAll(async () => {
    await seedDatabase(undefined, utilGraphName);
    repo = new GraphRepository({ graphName: utilGraphName });
    memoryRepo = new MemoryRepository({ graphName: utilGraphName });

    // Clean prior memory nodes from previous runs on this test graph
    const g = await repo.getGraph();
    await g.query('MATCH (m) WHERE m:MemoryEpisode OR m:KnowledgeClaim OR m:DiagnosticProcedure DETACH DELETE m');

    // Seed prior memory:
    // 1. Validated procedural memory for auth-service desync
    const proc: DiagnosticProcedure = {
      id: 'proc-util-jwks',
      name: 'Verify JWKS signing key cache alignment',
      purpose: 'Diagnose token verification signature failure following auth release',
      serviceId: 'checkout-service',
      preconditions: ['Active 500 spike', 'Preceding auth deployment'],
      requiredEvidenceTypes: ['log', 'metric'],
      diagnosticSteps: [
        'Query auth-service JWKS endpoint directly from checkout-service host',
        'Verify public key kid matches incoming token header',
        'Flush signing key cache if kid mismatch detected',
      ],
      expectedObservations: ['Active key ID present in both token and JWKS cache'],
      supportingConditions: ['Signature verification error in client logs'],
      contradictingConditions: ['JWKS responds with matching kid within 5ms'],
      knownFailureModes: ['Cache TTL rotation desync'],
      status: 'active',
      validationCriteria: 'Non-destructive HTTP GET on JWKS health route',
      version: 1,
      lastValidatedAt: '2026-10-15T14:20:00Z',
      synthetic: true,
    };
    await memoryRepo.saveDiagnosticProcedure(proc);

    // 2. High-confidence semantic claim
    const claim: KnowledgeClaim = {
      id: 'claim-util-auth-desync',
      subject: 'checkout-service',
      predicate: 'caused_by_condition',
      object: 'auth-service',
      statement: 'Auth-service key rotation cache TTL reduction causes signature verification timeouts in checkout-service',
      claimType: 'verified',
      status: 'active',
      confidence: 0.98,
      supportingEvidenceIds: ['EV-101-01', 'EV-101-09'],
      contradictoryEvidenceIds: [],
      sourceProvenance: 'Prior Investigation inv-prior',
      firstObservedAt: '2026-10-15T14:02:00Z',
      lastVerifiedAt: '2026-10-15T14:05:00Z',
      revision: 1,
      synthetic: true,
    };
    await memoryRepo.saveKnowledgeClaim(claim);

    // 3. Stale / Misleading memory that MUST be rejected by live evidence
    const misleadingClaim: KnowledgeClaim = {
      id: 'claim-util-misleading-db',
      subject: 'checkout-service',
      predicate: 'caused_by_condition',
      object: 'database-failure',
      statement: 'Database connection pool exhaustion caused transaction timeouts in checkout-service',
      claimType: 'inferred',
      status: 'active',
      confidence: 0.8,
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      sourceProvenance: 'ancient-investigation',
      firstObservedAt: '2024-01-01T00:00:00Z',
      lastVerifiedAt: '2024-01-01T00:00:00Z',
      revision: 1,
      synthetic: true,
    };
    await memoryRepo.saveKnowledgeClaim(misleadingClaim);
  });

  it('Executes Run A (Memory Disabled): Relies solely on cold live graph context', async () => {
    const engineNoMem = new InvestigationEngine({
      repository: repo,
      memoryRepo,
      disableMemory: true, // Run A
    });

    const resA = await engineNoMem.execute({
      question: 'Why is checkout-service failing with 500 errors during token validation?',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    expect(resA.status).toBe('completed');
    expect(resA.recalledMemories.length).toBe(0); // Zero memory recalled
    expect(resA.generatedMemories).toBeUndefined(); // Zero memory written
    const upstreamHyp = resA.candidateExplanations.find((h) => h.id === 'hyp-upstream-deployment-desync');
    expect(upstreamHyp?.status).toBe('supported');
  });

  it('Executes Run B (Memory Enabled): Demonstrates measurable memory utility and explainable recall', async () => {
    const engineWithMem = new InvestigationEngine({
      repository: repo,
      memoryRepo,
      disableMemory: false, // Run B
    });

    const resB = await engineWithMem.execute({
      question: 'Why is checkout-service failing with 500 errors during token validation?',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    expect(resB.status).toBe('completed');

    // 1. Recalled memories exist and are bounded
    expect(resB.recalledMemories.length).toBeGreaterThanOrEqual(2);
    expect(resB.recalledMemories.length).toBeLessThanOrEqual(5);

    // 2. Procedural memory suggested the validated JWKS check
    const procMem = resB.recalledMemories.find((m) => m.memoryId === 'proc-util-jwks');
    expect(procMem).toBeDefined();
    expect(procMem?.influence).toBe('suggested_procedure');
    expect(resB.recommendedNextStep).toContain('JWKS');

    // 3. Misleading memory was correctly rejected by live metric evidence (EV-101-04)
    const misleadingMem = resB.recalledMemories.find((m) => m.memoryId === 'claim-util-misleading-db');
    if (misleadingMem) {
      expect(misleadingMem.influence).toBe('rejected_by_evidence');
      expect(misleadingMem.currentEvidenceContradiction).toContain('EV-101-05');
    }

    // 4. Memory extraction generated new episode and claims
    expect(resB.generatedMemories).toBeDefined();
    expect(resB.generatedMemories?.episodeId).toBeDefined();
    expect(resB.generatedMemories?.claimIds.length).toBeGreaterThanOrEqual(1);
  });
});
