import { describe, it, expect } from 'vitest';
import { HypothesisEngine } from '../../apps/api/src/domain/hypothesis-rules.js';
import { Incident, Service, Deployment, Evidence } from '../../packages/contracts/src/index.js';

describe('Unit Tests: HypothesisEngine', () => {
  const incident: Incident = {
    id: 'INC-2026-101',
    title: 'Elevated 500 error rate in checkout flow',
    description: 'Checkout submit failure',
    severity: 'SEV-1',
    status: 'investigating',
    startedAt: '2026-10-15T14:02:00Z',
    resolvedAt: null,
    environment: 'production',
    synthetic: true,
  };

  const affectedService: Service = {
    id: 'checkout-service',
    name: 'Checkout Service',
    description: 'Web checkout',
    criticality: 'tier-1',
    environment: 'production',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
  };

  const upstreamDeps = [
    {
      service: {
        id: 'auth-service',
        name: 'Authentication Service',
        description: 'Auth & JWT',
        criticality: 'tier-1' as const,
        environment: 'production',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-10-15T00:00:00Z',
      },
      depth: 1,
      path: ['checkout-service', 'auth-service'],
    },
  ];

  const deployments: Deployment[] = [
    {
      id: 'dep-auth-2.4.1',
      serviceId: 'auth-service',
      version: 'v2.4.1',
      environment: 'production',
      deployedAt: '2026-10-15T13:45:00Z',
      status: 'succeeded',
      changeSummary: 'Reduced signing key cache TTL',
    },
  ];

  const evidence: Evidence[] = [
    {
      id: 'EV-1',
      sourceType: 'log',
      sourceRecordId: 'l-1',
      observedAt: '2026-10-15T14:03:00Z',
      ingestedAt: '2026-10-15T14:03:05Z',
      summary: 'AuthTokenVerificationError from auth-service',
      content: 'AuthTokenVerificationError: Signature verification failed from auth-service:8081',
      contentHash: 'h1',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
    {
      id: 'EV-2',
      sourceType: 'metric',
      sourceRecordId: 'm-db',
      observedAt: '2026-10-15T14:04:00Z',
      ingestedAt: '2026-10-15T14:04:05Z',
      summary: 'Postgres database latency normal < 2ms',
      content: 'healthy connection pool',
      contentHash: 'h2',
      synthetic: true,
      reliabilityClass: 'high',
    },
    {
      id: 'EV-3',
      sourceType: 'metric',
      sourceRecordId: 'm-redis',
      observedAt: '2026-10-15T14:04:30Z',
      ingestedAt: '2026-10-15T14:04:35Z',
      summary: 'Redis latency 1.8ms CPU < 5%',
      content: 'healthy',
      contentHash: 'h3',
      synthetic: true,
      reliabilityClass: 'high',
    },
  ];

  it('forms a supported hypothesis for upstream deployment desync', () => {
    const result = HypothesisEngine.evaluate({
      incident,
      affectedService,
      upstreamDependencies: upstreamDeps,
      deployments,
      evidence,
      relatedIncidents: [],
      investigationPaths: [],
    });

    expect(result.explanations.length).toBeGreaterThanOrEqual(3);
    const upstreamHyp = result.explanations.find((e) => e.id === 'hyp-upstream-deployment-desync');
    expect(upstreamHyp).toBeDefined();
    expect(upstreamHyp?.status).toBe('supported');
    expect(upstreamHyp?.supportingEvidenceIds).toContain('EV-1');
  });

  it('marks competing database and redis hypotheses as contradicted based on metric evidence', () => {
    const result = HypothesisEngine.evaluate({
      incident,
      affectedService,
      upstreamDependencies: upstreamDeps,
      deployments,
      evidence,
      relatedIncidents: [],
      investigationPaths: [],
    });

    const dbHyp = result.explanations.find((e) => e.id === 'hyp-database-connection-exhaustion');
    expect(dbHyp).toBeDefined();
    expect(dbHyp?.status).toBe('contradicted');
    expect(dbHyp?.contradictoryEvidenceIds).toContain('EV-2');

    const redisHyp = result.explanations.find((e) => e.id === 'hyp-redis-cache-starvation');
    expect(redisHyp).toBeDefined();
    expect(redisHyp?.status).toBe('contradicted');
    expect(redisHyp?.contradictoryEvidenceIds).toContain('EV-3');
  });

  it('generates a non-destructive diagnostic recommendation', () => {
    const result = HypothesisEngine.evaluate({
      incident,
      affectedService,
      upstreamDependencies: upstreamDeps,
      deployments,
      evidence,
      relatedIncidents: [],
      investigationPaths: [],
    });

    expect(result.recommendedNextStep).toContain('non-destructive diagnostics');
    expect(result.recommendedNextStep).toContain('auth-service');
  });
});
