import { describe, it, expect } from 'vitest';
import { EvidenceUtils } from '../../apps/api/src/domain/evidence-utils.js';
import { Evidence, Deployment } from '../../packages/contracts/src/index.js';

describe('Unit Tests: EvidenceUtils', () => {
  const sampleEvidence: Evidence[] = [
    {
      id: 'EV-3',
      sourceType: 'metric',
      sourceRecordId: 'm-1',
      observedAt: '2026-10-15T14:05:00Z',
      ingestedAt: '2026-10-15T14:05:05Z',
      summary: 'Postgres database latency normal < 2ms',
      content: 'healthy pool',
      contentHash: 'hash-db',
      synthetic: true,
      reliabilityClass: 'high',
    },
    {
      id: 'EV-1',
      sourceType: 'log',
      sourceRecordId: 'l-1',
      observedAt: '2026-10-15T14:01:00Z',
      ingestedAt: '2026-10-15T14:01:05Z',
      summary: 'AuthTokenVerificationError',
      content: 'failed keyId',
      contentHash: 'hash-auth',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
    {
      id: 'EV-2',
      sourceType: 'alert',
      sourceRecordId: 'a-1',
      observedAt: '2026-10-15T14:02:00Z',
      ingestedAt: '2026-10-15T14:02:05Z',
      summary: 'SEV-1 500 error rate alert',
      content: 'spike to 14%',
      contentHash: 'hash-alert',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
    // Duplicate record with same hash
    {
      id: 'EV-1-dup',
      sourceType: 'log',
      sourceRecordId: 'l-1',
      observedAt: '2026-10-15T14:01:00Z',
      ingestedAt: '2026-10-15T14:01:05Z',
      summary: 'AuthTokenVerificationError',
      content: 'failed keyId',
      contentHash: 'hash-auth',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
  ];

  it('deduplicates evidence records by hash and id', () => {
    const deduped = EvidenceUtils.deduplicate(sampleEvidence);
    expect(deduped.length).toBe(3);
    expect(deduped.map((e) => e.id)).toEqual(['EV-3', 'EV-1', 'EV-2']);
  });

  it('sorts evidence chronologically by observedAt', () => {
    const sorted = EvidenceUtils.sortByTimestamp(sampleEvidence);
    expect(sorted[0].id).toBe('EV-1');
    expect(sorted[sorted.length - 1].id).toBe('EV-3');
  });

  it('groups evidence by sourceType', () => {
    const grouped = EvidenceUtils.groupBySourceType(sampleEvidence);
    expect(grouped['log'].length).toBe(2);
    expect(grouped['metric'].length).toBe(1);
    expect(grouped['alert'].length).toBe(1);
  });

  it('identifies preceding deployments within the lookback window', () => {
    const deployments: Deployment[] = [
      {
        id: 'dep-1',
        serviceId: 'auth-service',
        version: 'v2.4.1',
        environment: 'production',
        deployedAt: '2026-10-15T13:45:00Z', // 17 mins before incident
        status: 'succeeded',
        changeSummary: 'Reduced key cache TTL',
      },
      {
        id: 'dep-old',
        serviceId: 'catalog-service',
        version: 'v1.0.0',
        environment: 'production',
        deployedAt: '2026-10-14T00:00:00Z', // 38 hours before incident
        status: 'succeeded',
        changeSummary: 'Old change',
      },
      {
        id: 'dep-future',
        serviceId: 'checkout-service',
        version: 'v1.13.0',
        environment: 'production',
        deployedAt: '2026-10-15T15:00:00Z', // After incident start
        status: 'succeeded',
        changeSummary: 'Future change',
      },
    ];

    const preceding = EvidenceUtils.findPrecedingDeployments(deployments, '2026-10-15T14:02:00Z', 120);
    expect(preceding.length).toBe(1);
    expect(preceding[0].id).toBe('dep-1');
  });

  it('detects contradictions in evidence for competing hypotheses', () => {
    const contradictions = EvidenceUtils.detectContradictions(sampleEvidence);
    expect(contradictions.length).toBeGreaterThan(0);
    const dbContradiction = contradictions.find((c) => c.targetHypothesisPattern === 'database');
    expect(dbContradiction).toBeDefined();
    expect(dbContradiction?.contradictedByEvidenceId).toBe('EV-3');
  });

  it('builds an ordered timeline merging deployments and observations', () => {
    const deployments: Deployment[] = [
      {
        id: 'dep-1',
        serviceId: 'auth-service',
        version: 'v2.4.1',
        environment: 'production',
        deployedAt: '2026-10-15T13:45:00Z',
        status: 'succeeded',
        changeSummary: 'Key TTL patch',
      },
    ];

    const timeline = EvidenceUtils.buildTimeline(
      '2026-10-15T14:02:00Z',
      'Checkout Elevated 500s',
      deployments,
      sampleEvidence.slice(0, 3)
    );

    expect(timeline.length).toBe(5);
    expect(timeline[0].type).toBe('deployment');
    expect(timeline[0].timestamp).toBe('2026-10-15T13:45:00Z');
  });
});
