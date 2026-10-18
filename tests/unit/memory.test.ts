import { describe, it, expect } from 'vitest';
import {
  MemoryEpisode,
  KnowledgeClaim,
  DiagnosticProcedure,
  RecalledMemoryRecord,
  InvestigationResult,
} from '@neutrino/contracts';
import { MemoryExtractor } from '../../apps/api/src/memory/extractor.js';
import { MemoryRetrievalEngine } from '../../apps/api/src/memory/retrieval.js';

describe('Unit Tests: Stage 2 Persistent Graph Memory', () => {
  const sampleResult: InvestigationResult = {
    investigationId: 'inv-test-001',
    incidentId: 'INC-2026-101',
    question: 'Why is checkout-service failing with 500 errors during token validation?',
    status: 'completed',
    startedAt: '2026-10-15T14:02:00Z',
    completedAt: '2026-10-15T14:02:02Z',
    executionMode: 'deterministic',
    summary:
      "Incident INC-2026-101 affecting 'checkout-service' is caused by an upstream failure in 'auth-service' following deployment v2.4.1.",
    affectedServices: ['checkout-service', 'auth-service'],
    candidateExplanations: [
      {
        id: 'hyp-upstream-deployment-desync',
        statement:
          "Root cause stems from upstream dependency 'auth-service' deployment v2.4.1 triggering operational failures in 'checkout-service'.",
        status: 'supported',
        supportingEvidenceIds: ['EV-101-01', 'EV-101-09'],
        contradictoryEvidenceIds: [],
        missingEvidence: [],
        graphPaths: [
          'INC-2026-101 -[:AFFECTS]-> checkout-service -[:DEPENDS_ON]-> auth-service',
        ],
        explanation: 'Detailed verification confirmed signature failures following rollout.',
      },
      {
        id: 'hyp-database-connection-exhaustion',
        statement: 'Database connection pool exhaustion caused transaction timeouts.',
        status: 'contradicted',
        supportingEvidenceIds: [],
        contradictoryEvidenceIds: ['EV-101-04'],
        missingEvidence: [],
        graphPaths: [],
        explanation: 'Contradicted by metric: latency < 2ms and connections 42/500.',
      },
    ],
    evidenceBundle: [
      {
        id: 'EV-101-01',
        sourceType: 'log',
        sourceRecordId: 'l-1',
        observedAt: '2026-10-15T14:03:00Z',
        ingestedAt: '2026-10-15T14:03:05Z',
        summary: 'AuthTokenVerificationError from auth-service',
        content: 'AuthTokenVerificationError: Signature verification failed',
        contentHash: 'hash-1',
        synthetic: true,
        reliabilityClass: 'authoritative',
      },
      {
        id: 'EV-101-09',
        sourceType: 'trace',
        sourceRecordId: 't-1',
        observedAt: '2026-10-15T14:03:12Z',
        ingestedAt: '2026-10-15T14:03:14Z',
        summary: 'Distributed trace span HTTP 500',
        content: 'span failed with 500',
        contentHash: 'hash-9',
        synthetic: true,
        reliabilityClass: 'authoritative',
      },
      {
        id: 'EV-101-04',
        sourceType: 'metric',
        sourceRecordId: 'm-db',
        observedAt: '2026-10-15T14:04:00Z',
        ingestedAt: '2026-10-15T14:04:05Z',
        summary: 'Postgres latency normal < 2ms',
        content: 'connections: 42/500, p99: 1.6ms',
        contentHash: 'hash-4',
        synthetic: true,
        reliabilityClass: 'high',
      },
    ],
    graphPaths: [
      {
        description:
          'INC-2026-101 -[:AFFECTS]-> checkout-service -[:DEPENDS_ON]-> auth-service',
        pathString:
          'INC-2026-101 -[:AFFECTS]-> checkout-service -[:DEPENDS_ON]-> auth-service',
        nodes: ['INC-2026-101', 'checkout-service', 'auth-service'],
        relationships: ['AFFECTS', 'DEPENDS_ON'],
      },
    ],
    missingInformation: [],
    recommendedNextStep:
      "Execute non-destructive diagnostics: 1) Verify signing key cache status in 'auth-service' pod logs; 2) Query 'auth-service' JWKS endpoint directly from 'checkout-service' host to verify token key alignment; 3) Review rollback procedure for v2.4.1 if cache desync persists.",
    metrics: {
      durationMs: 25,
      graphQueryCount: 5,
      nodesEvaluated: 12,
      relationshipsEvaluated: 18,
    },
    recalledMemories: [],
    events: [],
  };

  // Mock repository factory for pure unit testing
  function createMockRepo() {
    return {
      episodes: new Map<string, MemoryEpisode>(),
      claims: new Map<string, KnowledgeClaim>(),
      procedures: new Map<string, DiagnosticProcedure>(),

      async saveEpisode(ep: MemoryEpisode) {
        this.episodes.set(ep.id, ep);
        return ep;
      },
      async saveKnowledgeClaim(claim: KnowledgeClaim) {
        this.claims.set(claim.id, claim);
        return claim;
      },
      async saveDiagnosticProcedure(proc: DiagnosticProcedure) {
        this.procedures.set(proc.id, proc);
        return proc;
      },
      async getKnowledgeClaim(id: string) {
        return this.claims.get(id) || null;
      },
      async findConnectedMemories(params: any) {
        const claims = Array.from(this.claims.values()).filter((c) =>
          params.serviceIds.includes(c.subject) || params.serviceIds.includes(c.object)
        );
        const procedures = Array.from(this.procedures.values()).filter((p) =>
          params.serviceIds.includes(p.serviceId)
        );
        const episodes = Array.from(this.episodes.values()).filter((e) =>
          e.serviceIds.some((s: string) => params.serviceIds.includes(s))
        );
        return { episodes, claims, procedures };
      },
      async updateClaimStatus(claimId: string, status: any, reason?: string) {
        const c = this.claims.get(claimId);
        if (!c) return false;
        const validTransitions: any = {
          candidate: ['active', 'invalidated'],
          active: ['superseded', 'invalidated', 'archived'],
          superseded: ['archived'],
          invalidated: ['archived'],
          archived: [],
        };
        if (!validTransitions[c.status].includes(status)) {
          throw new Error(`Invalid transition from ${c.status} to ${status}`);
        }
        c.status = status;
        return true;
      },
    };
  }

  const mockRepo = createMockRepo();

  it('extracts grounded Episodic memory from completed investigation', async () => {
    const extractor = new MemoryExtractor(mockRepo as any);
    const { episode } = await extractor.extractAndPersist(sampleResult);

    expect(episode).toBeDefined();
    expect(episode.investigationId).toBe('inv-test-001');
    expect(episode.incidentId).toBe('INC-2026-101');
    expect(episode.outcome).toBe('completed');
    expect(episode.serviceIds).toContain('checkout-service');
    expect(episode.serviceIds).toContain('auth-service');
    expect(episode.supportedHypotheses.length).toBe(1);
    expect(episode.contradictedHypotheses.length).toBe(1);
  });

  it('extracts Semantic Knowledge Claims with grounded evidence references', async () => {
    const extractor = new MemoryExtractor(mockRepo as any);
    const { claims } = await extractor.extractAndPersist(sampleResult);

    expect(claims.length).toBeGreaterThanOrEqual(1);
    const verifiedClaim = claims.find((c) => c.claimType === 'verified');
    expect(verifiedClaim).toBeDefined();
    expect(verifiedClaim?.subject).toBe('checkout-service');
    expect(verifiedClaim?.confidence).toBeGreaterThanOrEqual(0.9);
    // Must only contain evidence IDs present in the evidence bundle
    expect(verifiedClaim?.supportingEvidenceIds).toContain('EV-101-01');
    expect(verifiedClaim?.supportingEvidenceIds).toContain('EV-101-09');
  });

  it('extracts Procedural diagnostic memory with actionable steps', async () => {
    const extractor = new MemoryExtractor(mockRepo as any);
    const { procedures } = await extractor.extractAndPersist(sampleResult);

    expect(procedures.length).toBe(1);
    const proc = procedures[0];
    expect(proc.serviceId).toBe('checkout-service');
    expect(proc.status).toBe('active');
    expect(proc.diagnosticSteps.length).toBeGreaterThanOrEqual(2);
    expect(proc.diagnosticSteps.some((s) => s.includes('JWKS endpoint'))).toBe(true);
  });

  it('rejects invalid lifecycle state transitions', async () => {
    const claim: KnowledgeClaim = {
      id: 'claim-trans-01',
      subject: 'checkout-service',
      predicate: 'depends_on',
      object: 'auth-service',
      statement: 'checkout relies on auth-service for JWT tokens',
      claimType: 'verified',
      status: 'archived',
      confidence: 1.0,
      supportingEvidenceIds: ['EV-101-01'],
      contradictoryEvidenceIds: [],
      sourceProvenance: 'test',
      firstObservedAt: '2026-10-15T14:02:00Z',
      lastVerifiedAt: '2026-10-15T14:02:00Z',
      revision: 1,
      synthetic: true,
    };
    await mockRepo.saveKnowledgeClaim(claim);

    // Attempting to move from 'archived' back to 'active' must throw an error
    await expect(
      mockRepo.updateClaimStatus('claim-trans-01', 'active')
    ).rejects.toThrow(/Invalid transition/);
  });

  it('scores and ranks memories using multi-signal retrieval algorithm', async () => {
    const retrieval = new MemoryRetrievalEngine(mockRepo as any);

    const recalled = await retrieval.retrieveRelevantMemories({
      incident: {
        id: 'INC-2026-101',
        title: 'Checkout elevated 500s',
        description: 'Errors during token verification',
        severity: 'SEV-1',
        status: 'investigating',
        startedAt: '2026-10-15T14:02:00Z',
        environment: 'production',
        synthetic: true,
      },
      affectedService: {
        id: 'checkout-service',
        name: 'Checkout Service',
        description: 'Web checkout',
        criticality: 'tier-1',
        environment: 'production',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-10-15T00:00:00Z',
      },
      upstreamDependencies: [
        {
          service: {
            id: 'auth-service',
            name: 'Authentication Service',
            description: 'Auth',
            criticality: 'tier-1',
            environment: 'production',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-10-15T00:00:00Z',
          },
          depth: 1,
        },
      ],
      currentEvidence: sampleResult.evidenceBundle,
      limit: 5,
    });

    expect(recalled.length).toBeGreaterThanOrEqual(1);
    expect(recalled[0].relevanceScore).toBeGreaterThan(0.5);
    expect(recalled.some((m) => m.retrievalReason.includes('checkout-service'))).toBe(true);
  });

  it('rejects recalled memory when current live evidence directly contradicts it', async () => {
    // Add a false memory claiming database connection pool failure
    const falseDbClaim: KnowledgeClaim = {
      id: 'claim-false-db',
      subject: 'checkout-service',
      predicate: 'caused_by_condition',
      object: 'database-failure',
      statement: 'Database connection pool exhaustion caused transaction timeouts in checkout-service',
      claimType: 'inferred',
      status: 'active',
      confidence: 0.9,
      supportingEvidenceIds: ['old-ev-1'],
      contradictoryEvidenceIds: [],
      sourceProvenance: 'old-investigation',
      firstObservedAt: '2026-10-01T00:00:00Z',
      lastVerifiedAt: '2026-10-01T00:00:00Z',
      revision: 1,
      synthetic: true,
    };
    const localMockRepo = createMockRepo();
    await localMockRepo.saveKnowledgeClaim(falseDbClaim);

    const retrieval = new MemoryRetrievalEngine(localMockRepo as any);
    const recalled = await retrieval.retrieveRelevantMemories({
      affectedService: {
        id: 'checkout-service',
        name: 'Checkout Service',
        description: 'Web checkout',
        criticality: 'tier-1',
        environment: 'production',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-10-15T00:00:00Z',
      },
      // Live evidence showing database latency is perfectly normal (< 2ms)
      currentEvidence: [
        {
          id: 'EV-LIVE-DB',
          sourceType: 'metric',
          sourceRecordId: 'm-live-db',
          observedAt: '2026-10-15T14:04:00Z',
          ingestedAt: '2026-10-15T14:04:05Z',
          summary: 'Postgres database latency normal < 2ms',
          content: 'active connections 42/500, p99 latency 1.6ms (healthy)',
          contentHash: 'hash-live-db',
          synthetic: true,
          reliabilityClass: 'high',
        },
      ],
      limit: 5,
    });

    const dbMemory = recalled.find((m) => m.memoryId === 'claim-false-db');
    expect(dbMemory).toBeDefined();
    // Critical Rule: Live contradictory evidence overrides prior memory!
    expect(dbMemory?.influence).toBe('rejected_by_evidence');
    expect(dbMemory?.currentEvidenceContradiction).toContain('EV-LIVE-DB');
  });
});
