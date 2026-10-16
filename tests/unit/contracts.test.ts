import { describe, it, expect } from 'vitest';
import {
  InvestigationRequestSchema,
  InvestigationResultSchema,
  ServiceSchema,
  IncidentSchema,
  EvidenceSchema,
} from '../../packages/contracts/src/index.js';

describe('Unit Tests: Contracts & Schemas', () => {
  it('validates a valid investigation request', () => {
    const valid = {
      question: 'Why is checkout-service failing with 500 errors?',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    };
    const parsed = InvestigationRequestSchema.parse(valid);
    expect(parsed.question).toBe(valid.question);
    expect(parsed.incidentId).toBe('INC-2026-101');
    expect(parsed.executionMode).toBe('deterministic');
  });

  it('rejects an invalid investigation request with short question', () => {
    const invalid = { question: 'ab' };
    expect(() => InvestigationRequestSchema.parse(invalid)).toThrow();
  });

  it('validates a complete investigation result structure', () => {
    const result = {
      investigationId: 'inv-test-123',
      incidentId: 'INC-2026-101',
      question: 'Investigate token failure',
      status: 'completed',
      startedAt: '2026-10-15T14:00:00Z',
      completedAt: '2026-10-15T14:00:01Z',
      executionMode: 'deterministic',
      summary: 'Auth token desync confirmed.',
      affectedServices: ['checkout-service', 'payment-gateway'],
      candidateExplanations: [
        {
          id: 'hyp-1',
          statement: 'Auth deployment desync',
          status: 'supported',
          supportingEvidenceIds: ['EV-1'],
          contradictoryEvidenceIds: [],
          missingEvidence: [],
          graphPaths: ['INC-2026-101 -> checkout -> auth'],
          explanation: 'Confirmed by logs.',
        },
      ],
      evidenceBundle: [
        {
          id: 'EV-1',
          sourceType: 'log',
          sourceRecordId: 'log-1',
          observedAt: '2026-10-15T14:02:00Z',
          ingestedAt: '2026-10-15T14:02:05Z',
          summary: 'Signature verification error',
          content: 'AuthTokenVerificationError',
          contentHash: 'hash1',
          synthetic: true,
          reliabilityClass: 'authoritative',
        },
      ],
      graphPaths: [
        {
          description: 'INC -> checkout -> auth',
          pathString: 'INC -> checkout -> auth',
          nodes: ['INC', 'checkout', 'auth'],
          relationships: ['AFFECTS', 'DEPENDS_ON'],
        },
      ],
      missingInformation: [],
      recommendedNextStep: 'Flush JWKS cache',
      metrics: {
        durationMs: 45,
        graphQueryCount: 5,
        nodesEvaluated: 12,
        relationshipsEvaluated: 10,
      },
    };

    const parsed = InvestigationResultSchema.parse(result);
    expect(parsed.investigationId).toBe('inv-test-123');
    expect(parsed.candidateExplanations.length).toBe(1);
    expect(parsed.candidateExplanations[0].status).toBe('supported');
  });

  it('validates Service and Incident schemas', () => {
    const svc = ServiceSchema.parse({
      id: 'checkout-service',
      name: 'Checkout Service',
      description: 'Core checkout orchestrator',
      criticality: 'tier-1',
      environment: 'production',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-15T00:00:00Z',
    });
    expect(svc.criticality).toBe('tier-1');

    const inc = IncidentSchema.parse({
      id: 'INC-2026-101',
      title: 'Checkout failure',
      description: '500 errors',
      severity: 'SEV-1',
      status: 'investigating',
      startedAt: '2026-10-15T14:02:00Z',
      resolvedAt: null,
      environment: 'production',
      synthetic: true,
    });
    expect(inc.severity).toBe('SEV-1');
  });
});
