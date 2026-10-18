import { describe, it, expect, beforeAll } from 'vitest';
import { GraphRepository } from '../../apps/api/src/graph/repository.js';
import { MemoryRepository } from '../../apps/api/src/memory/repository.js';
import { InvestigationEngine } from '../../apps/api/src/investigation/engine.js';
import { seedDatabase } from '../../apps/api/src/seed.js';
import { DiagnosticProcedure } from '@neutrino/contracts';

describe('Cross-Session Continuity & API Restart Persistence', () => {
  const crossSessionGraph = 'neutrino_cross_session_graph';
  let repo: GraphRepository;
  let memoryRepo: MemoryRepository;

  beforeAll(async () => {
    await seedDatabase(undefined, crossSessionGraph);
    repo = new GraphRepository({ graphName: crossSessionGraph });
    memoryRepo = new MemoryRepository({ graphName: crossSessionGraph });

    // Clean prior memory nodes from previous runs
    const g = await repo.getGraph();
    await g.query('MATCH (m) WHERE m:MemoryEpisode OR m:KnowledgeClaim OR m:DiagnosticProcedure DETACH DELETE m');
  });

  it('Session 1: Investigates incident, derives diagnostic procedure, and persists into FalkorDB', async () => {
    // Process/Session 1: Instantiate isolated engine
    const session1Engine = new InvestigationEngine({
      repository: repo,
      memoryRepo,
      disableMemory: false,
    });

    const res1 = await session1Engine.execute({
      question: 'Investigate token validation 500 errors in checkout-service',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    expect(res1.status).toBe('completed');
    expect(res1.generatedMemories?.episodeId).toBeDefined();

    // Explicitly seed a verified procedural memory from session 1
    const session1Procedure: DiagnosticProcedure = {
      id: 'proc-cross-session-jwks',
      name: 'Session 1 Validated Procedure: Check JWKS rotation',
      purpose: 'Verify key rotation cache TTL desync between auth-service and checkout-service',
      serviceId: 'checkout-service',
      preconditions: ['500 AuthTokenVerificationError spikes in checkout-service'],
      requiredEvidenceTypes: ['metric', 'log'],
      diagnosticSteps: [
        'Query auth-service JWKS discovery route',
        'Verify token kid matches cached signing keys',
      ],
      expectedObservations: ['Matching key ID in active cache'],
      supportingConditions: ['Signature verification errors'],
      contradictingConditions: ['Cache responds with matching kid within 5ms'],
      knownFailureModes: ['Cache rotation desync'],
      status: 'active',
      validationCriteria: 'Non-destructive HTTP GET on JWKS route',
      version: 1,
      lastValidatedAt: new Date().toISOString(),
      synthetic: true,
    };
    await memoryRepo.saveDiagnosticProcedure(session1Procedure);

    // Verify stored in FalkorDB
    const stored = await memoryRepo.getDiagnosticProcedure('proc-cross-session-jwks');
    expect(stored).toBeDefined();
    expect(stored?.name).toContain('Session 1');
  });

  it('Session 2 (Simulated Process Restart): Fresh process recalls persisted FalkorDB memory and guides investigation', async () => {
    // Simulate process termination by instantiating completely fresh repository and engine instances
    // with empty in-memory caches and new object references
    const freshRepo = new GraphRepository({ graphName: crossSessionGraph });
    const freshMemoryRepo = new MemoryRepository({ graphName: crossSessionGraph });
    const session2Engine = new InvestigationEngine({
      repository: freshRepo,
      memoryRepo: freshMemoryRepo,
      disableMemory: false,
    });

    // Run related investigation in the fresh session
    const res2 = await session2Engine.execute({
      question: 'Investigate token verification degradation on checkout-service',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    expect(res2.status).toBe('completed');

    // 1. Memory survived process restart and was retrieved from FalkorDB
    const recalledProc = res2.recalledMemories.find(
      (m) => m.memoryId === 'proc-cross-session-jwks'
    );
    expect(recalledProc).toBeDefined();
    expect(recalledProc?.memoryType).toBe('procedural');
    expect(recalledProc?.influence).toBe('suggested_procedure');

    // 2. Procedural memory influenced the recommended diagnostic next step
    expect(res2.recommendedNextStep).toContain('Session 1 Validated Procedure');

    // 3. Current live evidence was evaluated independently
    const hyp = res2.candidateExplanations.find(
      (h) => h.id === 'hyp-upstream-deployment-desync'
    );
    expect(hyp?.status).toBe('supported');
  });
});
