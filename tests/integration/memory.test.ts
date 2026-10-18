import { describe, it, expect, beforeAll } from 'vitest';
import { FalkorDBManager } from '../../apps/api/src/graph/client.js';
import { MemoryRepository } from '../../apps/api/src/memory/repository.js';
import { seedDatabase } from '../../apps/api/src/seed.js';
import { KnowledgeClaim, DiagnosticProcedure, MemoryEpisode } from '@neutrino/contracts';

describe('Integration Tests: Real FalkorDB Persistent Memory Repository', () => {
  const testGraphName = 'neutrino_memory_test_graph';
  let repo: MemoryRepository;

  beforeAll(async () => {
    // 1. Seed base graph for test
    await seedDatabase(undefined, testGraphName);
    repo = new MemoryRepository({ graphName: testGraphName });
  });

  it('persists and retrieves an episodic memory in FalkorDB', async () => {
    const episode: MemoryEpisode = {
      id: 'ep-test-int-01',
      investigationId: 'inv-int-001',
      incidentId: 'INC-2026-101',
      summary: 'Auth deployment desync caused checkout 500 spike',
      outcome: 'completed',
      status: 'active',
      serviceIds: ['checkout-service', 'auth-service'],
      deploymentIds: ['dep-auth-2.4.1'],
      evidenceIds: ['EV-101-01', 'EV-101-09'],
      graphPaths: ['checkout-service -[:DEPENDS_ON]-> auth-service'],
      hypothesesEvaluated: ['hyp-upstream-deployment-desync'],
      supportedHypotheses: ['Upstream auth deployment v2.4.1 desync'],
      contradictedHypotheses: ['Database exhaustion'],
      unresolvedQuestions: [],
      createdAt: '2026-10-15T14:05:00Z',
      updatedAt: '2026-10-15T14:05:00Z',
      synthetic: true,
    };

    await repo.saveEpisode(episode);
    const retrieved = await repo.getEpisode('ep-test-int-01');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('ep-test-int-01');
    expect(retrieved?.outcome).toBe('completed');
    expect(retrieved?.serviceIds).toContain('checkout-service');
  });

  it('persists a KnowledgeClaim with grounded evidence edges', async () => {
    const claim: KnowledgeClaim = {
      id: 'claim-test-int-01',
      subject: 'auth-service',
      predicate: 'introduced_key_desync',
      object: 'v2.4.1',
      statement: 'Deployment v2.4.1 introduced signing key rotation cache TTL desync',
      claimType: 'verified',
      status: 'active',
      confidence: 0.95,
      supportingEvidenceIds: ['EV-101-01', 'EV-101-09'],
      contradictoryEvidenceIds: [],
      sourceProvenance: 'Investigation inv-int-001',
      firstObservedAt: '2026-10-15T14:02:00Z',
      lastVerifiedAt: '2026-10-15T14:05:00Z',
      revision: 1,
      synthetic: true,
    };

    await repo.saveKnowledgeClaim(claim, 'ep-test-int-01');
    const retrieved = await repo.getKnowledgeClaim('claim-test-int-01');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('claim-test-int-01');
    expect(retrieved?.confidence).toBe(0.95);

    // Verify detailed inspection endpoint queries FalkorDB grounded evidence
    const detail = await repo.getMemoryDetail('claim-test-int-01');
    expect(detail).toBeDefined();
    expect(detail?.memoryType).toBe('semantic');
    expect(detail?.connectedEntities.groundedEvidence.length).toBeGreaterThanOrEqual(1);
    expect(
      detail?.connectedEntities.groundedEvidence.some((e) => e.id === 'EV-101-01')
    ).toBe(true);
  });

  it('handles claim supersession and preserves revision history', async () => {
    // Revised claim with updated findings
    const revisedClaim: KnowledgeClaim = {
      id: 'claim-test-int-02-revised',
      subject: 'auth-service',
      predicate: 'introduced_key_desync',
      object: 'v2.4.1',
      statement:
        'Deployment v2.4.1 reduced key cache TTL to 60s, triggering signature verification failures under rotation',
      claimType: 'verified',
      status: 'active',
      confidence: 0.98,
      supportingEvidenceIds: ['EV-101-01', 'EV-101-09'],
      contradictoryEvidenceIds: [],
      sourceProvenance: 'Investigation inv-int-002',
      firstObservedAt: '2026-10-15T14:02:00Z',
      lastVerifiedAt: '2026-10-15T14:15:00Z',
      revision: 2,
      supersededById: 'claim-test-int-01', // links to original claim
      synthetic: true,
    };

    await repo.saveKnowledgeClaim(revisedClaim, 'ep-test-int-01');

    // Original claim should now be marked superseded in FalkorDB
    const original = await repo.getKnowledgeClaim('claim-test-int-01');
    expect(original?.status).toBe('superseded');
    expect(original?.supersededById).toBe('claim-test-int-02-revised');
  });

  it('handles explicit invalidation with documented reason', async () => {
    const invalidClaim: KnowledgeClaim = {
      id: 'claim-to-invalidate',
      subject: 'redis-cluster',
      predicate: 'caused_outage',
      object: 'memory-exhaustion',
      statement: 'Redis memory exhaustion triggered checkout latency',
      claimType: 'inferred',
      status: 'active',
      confidence: 0.6,
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: ['EV-101-06'],
      sourceProvenance: 'early-guess',
      firstObservedAt: '2026-10-15T14:01:00Z',
      lastVerifiedAt: '2026-10-15T14:01:00Z',
      revision: 1,
      synthetic: true,
    };

    await repo.saveKnowledgeClaim(invalidClaim);
    const updated = await repo.updateClaimStatus(
      'claim-to-invalidate',
      'invalidated',
      'Refuted by metric EV-101-06 showing Redis latency 1.8ms and CPU < 5%'
    );

    expect(updated).toBe(true);
    const retrieved = await repo.getKnowledgeClaim('claim-to-invalidate');
    expect(retrieved?.status).toBe('invalidated');
    expect(retrieved?.invalidationReason).toContain('Refuted by metric EV-101-06');
  });

  it('persists and retrieves a DiagnosticProcedure in FalkorDB', async () => {
    const proc: DiagnosticProcedure = {
      id: 'proc-test-int-01',
      name: 'Verify JWKS endpoint alignment',
      purpose: 'Diagnose token verification signature failure',
      serviceId: 'auth-service',
      preconditions: ['Active 500 error spike', 'Preceding auth-service release'],
      requiredEvidenceTypes: ['log', 'metric'],
      diagnosticSteps: [
        'Query auth-service JWKS endpoint directly from client host',
        'Verify public key kid matches incoming token header',
        'Inspect signing key cache eviction metrics',
      ],
      expectedObservations: ['Active key ID present in both token and JWKS cache'],
      supportingConditions: ['Signature verification error in client logs'],
      contradictingConditions: ['JWKS endpoint responds with matching kid within 5ms'],
      knownFailureModes: ['Cache TTL rotation desync'],
      status: 'active',
      validationCriteria: 'Non-destructive HTTP GET on JWKS health route',
      version: 1,
      lastValidatedAt: '2026-10-15T14:20:00Z',
      synthetic: true,
    };

    await repo.saveDiagnosticProcedure(proc, 'ep-test-int-01');
    const retrieved = await repo.getDiagnosticProcedure('proc-test-int-01');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('proc-test-int-01');
    expect(retrieved?.diagnosticSteps.length).toBe(3);
    expect(retrieved?.serviceId).toBe('auth-service');
  });
});
