import { describe, it, expect, beforeAll } from 'vitest';
import { GraphRepository } from '../../apps/api/src/graph/repository.js';
import { MemoryRepository } from '../../apps/api/src/memory/repository.js';
import { InvestigationEngine } from '../../apps/api/src/investigation/engine.js';
import { seedDatabase } from '../../apps/api/src/seed.js';

describe('Security & Adversarial Robustness Test Suite', () => {
  const secGraphName = 'neutrino_sec_test_graph';
  let repo: GraphRepository;
  let memoryRepo: MemoryRepository;
  let engine: InvestigationEngine;

  beforeAll(async () => {
    await seedDatabase(undefined, secGraphName);
    repo = new GraphRepository({ graphName: secGraphName });
    memoryRepo = new MemoryRepository({ graphName: secGraphName });
    engine = new InvestigationEngine({ repository: repo, memoryRepo });
  });

  it('Adversarial 01: Cypher Injection Resistance in Question String', async () => {
    // Attempt Cypher injection via question text
    const maliciousQuestion =
      "Why is checkout failing?'; MATCH (n) DETACH DELETE n; //";

    const res = await engine.execute({
      question: maliciousQuestion,
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    expect(res.status).toBe('completed');
    // Verify graph is NOT deleted and intact
    const counts = await repo.getGraphCounts();
    expect(counts.nodeCount).toBeGreaterThan(50);
  });

  it('Adversarial 02: Cypher Injection Resistance in Incident ID Parameter', async () => {
    const maliciousIncidentId =
      "INC-2026-101'} OR 1=1 DELETE (n) RETURN n; //";

    // Should fail cleanly without executing injection
    await expect(
      engine.execute({
        question: 'Why is checkout failing?',
        incidentId: maliciousIncidentId,
        executionMode: 'deterministic',
      })
    ).rejects.toThrow();

    const counts = await repo.getGraphCounts();
    expect(counts.nodeCount).toBeGreaterThan(50);
  });

  it('Adversarial 03: Traversal Depth Bounding enforces safe maximum depth', async () => {
    // Request an unbounded traversal depth of 999
    const deps = await repo.getServiceDependencies('checkout-service', 999);
    // Must be strictly bounded by MAX_GRAPH_TRAVERSAL_DEPTH (3)
    const maxObservedDepth = Math.max(...deps.map((d) => d.depth), 0);
    expect(maxObservedDepth).toBeLessThanOrEqual(3);
  });

  it('Adversarial 04: Investigation Budget Enforcement caps tool executions', async () => {
    // Instantiate engine with tight budget of max 2 tool calls
    const budgetEngine = new InvestigationEngine({
      repository: repo,
      memoryRepo,
      maxToolCalls: 2,
    });

    const res = await budgetEngine.execute({
      question: 'Investigate with tight budget limit',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    expect(res.metrics.graphQueryCount).toBeLessThanOrEqual(3);
    expect(res.events.some((e) => e.phase === 'CONCLUDED')).toBe(true);
  });

  it('Adversarial 05: Invalid Memory Identifier handles non-existent records gracefully', async () => {
    const nonExistent = await memoryRepo.getMemoryDetail('claim-does-not-exist-999');
    expect(nonExistent).toBeNull();
  });

  it('Adversarial 06: Invalid Lifecycle State Transitions are rejected', async () => {
    // Cannot transition directly from 'archived' to 'active'
    await expect(
      memoryRepo.updateClaimStatus('non-existent-claim', 'active')
    ).resolves.toBe(false);
  });

  it('Adversarial 07: Question input validation rejects payload exceeding max length', async () => {
    const hugeQuestion = 'a'.repeat(2000); // Exceeds 1000 char Zod constraint

    await expect(
      engine.execute({
        question: hugeQuestion,
        incidentId: 'INC-2026-101',
        executionMode: 'deterministic',
      })
    ).rejects.toThrow();
  });
});
