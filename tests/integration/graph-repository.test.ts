import { describe, it, expect, beforeAll } from 'vitest';
import { graphManager } from '../../apps/api/src/graph/client.js';
import { graphRepository } from '../../apps/api/src/graph/repository.js';
import { seedDatabase } from '../../apps/api/src/seed.js';

describe('Integration Tests: Real FalkorDB Graph Repository', () => {
  beforeAll(async () => {
    // Ensure graph is seeded
    await seedDatabase();
  });

  it('connects to FalkorDB and passes health check', async () => {
    const health = await graphManager.checkHealth();
    expect(health.connected).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('retrieves graph counts and verified labels', async () => {
    const counts = await graphRepository.getGraphCounts();
    expect(counts.nodeCount).toBeGreaterThanOrEqual(40);
    expect(counts.relationshipCount).toBeGreaterThanOrEqual(45);
    expect(counts.labels).toContain('Service');
    expect(counts.labels).toContain('Incident');
    expect(counts.labels).toContain('Deployment');
    expect(counts.labels).toContain('Evidence');
    expect(counts.relationshipTypes).toContain('DEPENDS_ON');
    expect(counts.relationshipTypes).toContain('AFFECTS');
  });

  it('retrieves incident context for INC-2026-101', async () => {
    const ctx = await graphRepository.getIncidentContext('INC-2026-101');
    expect(ctx.incident).toBeDefined();
    expect(ctx.incident?.id).toBe('INC-2026-101');
    expect(ctx.affectedService?.id).toBe('checkout-service');
    expect(ctx.owningTeam?.id).toBe('team-commerce');
    expect(ctx.evidence.length).toBeGreaterThanOrEqual(5);
    expect(ctx.relatedIncidents.length).toBeGreaterThanOrEqual(1);
    expect(ctx.relatedIncidents[0].id).toBe('INC-2025-089');
  });

  it('performs multi-hop dependency traversal (Operation B)', async () => {
    const deps = await graphRepository.getServiceDependencies('checkout-service', 3);
    expect(deps.length).toBeGreaterThanOrEqual(3);

    const depServiceIds = deps.map((d) => d.service.id);
    expect(depServiceIds).toContain('auth-service');
    expect(depServiceIds).toContain('payment-gateway');
    expect(depServiceIds).toContain('inventory-service');

    // Verify depth ordering
    const authDep = deps.find((d) => d.service.id === 'auth-service');
    expect(authDep?.depth).toBe(1);
  });

  it('performs downstream impact traversal (Operation C)', async () => {
    // auth-service is depended on by checkout-service, payment-gateway, user-profile-service
    const impact = await graphRepository.getAffectedServices('auth-service', 2);
    expect(impact.length).toBeGreaterThanOrEqual(2);

    const impactedIds = impact.map((i) => i.service.id);
    expect(impactedIds).toContain('checkout-service');
  });

  it('retrieves recent deployments for services (Operation D)', async () => {
    const deployments = await graphRepository.getRecentDeployments(['auth-service', 'checkout-service'], 10);
    expect(deployments.length).toBeGreaterThanOrEqual(2);

    const versions = deployments.map((d) => d.version);
    expect(versions).toContain('v2.4.1');
  });

  it('retrieves incident evidence (Operation E)', async () => {
    const evidence = await graphRepository.getIncidentEvidence('INC-2026-101');
    expect(evidence.length).toBeGreaterThanOrEqual(5);

    const logEv = evidence.find((e) => e.id === 'EV-101-01');
    expect(logEv).toBeDefined();
    expect(logEv?.content).toContain('AuthTokenVerificationError');
  });

  it('retrieves related historical incidents (Operation F)', async () => {
    const related = await graphRepository.getRelatedIncidents('INC-2026-101');
    expect(related.length).toBeGreaterThanOrEqual(1);
    expect(related[0].id).toBe('INC-2025-089');
  });

  it('retrieves multi-hop explanation paths (Operation G)', async () => {
    const paths = await graphRepository.getInvestigationPaths('INC-2026-101', 'auth-service', 3);
    expect(paths.length).toBeGreaterThanOrEqual(1);

    const pathDesc = paths[0].description;
    expect(pathDesc).toContain('INC-2026-101');
    expect(pathDesc).toContain('auth-service');
  });

  it('retrieves visual subgraph with nodes and directed edges', async () => {
    const subgraph = await graphRepository.getSubgraph('INC-2026-101');
    expect(subgraph.nodes.length).toBeGreaterThanOrEqual(10);
    expect(subgraph.edges.length).toBeGreaterThanOrEqual(8);

    const incidentNode = subgraph.nodes.find((n) => n.id === 'INC-2026-101');
    expect(incidentNode).toBeDefined();
    expect(incidentNode?.label).toBe('Incident');

    const affectsEdge = subgraph.edges.find((e) => e.type === 'AFFECTS');
    expect(affectsEdge).toBeDefined();
    expect(affectsEdge?.source).toBe('INC-2026-101');
    expect(affectsEdge?.target).toBe('checkout-service');
  });

  it('persists and retrieves an investigation record', async () => {
    const testInvId = `inv-test-persist-${Date.now()}`;
    const testResult = {
      investigationId: testInvId,
      incidentId: 'INC-2026-101',
      question: 'Testing persistence',
      status: 'completed' as const,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      executionMode: 'deterministic' as const,
      summary: 'Persistence test passed',
      affectedServices: ['checkout-service'],
      candidateExplanations: [
        {
          id: 'hyp-test',
          statement: 'Testing hypothesis persistence',
          status: 'supported' as const,
          supportingEvidenceIds: ['EV-101-01'],
          contradictoryEvidenceIds: [],
          missingEvidence: [],
          graphPaths: ['INC-2026-101 -> checkout -> auth'],
          explanation: 'Verified persistence',
        },
      ],
      evidenceBundle: [],
      graphPaths: [],
      missingInformation: [],
      recommendedNextStep: 'Verify retrieval',
      metrics: {
        durationMs: 20,
        graphQueryCount: 2,
        nodesEvaluated: 5,
        relationshipsEvaluated: 4,
      },
    };

    await graphRepository.persistInvestigation(testResult);

    const retrieved = await graphRepository.getPersistedInvestigation(testInvId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.investigationId).toBe(testInvId);
    expect(retrieved?.summary).toBe('Persistence test passed');

    const history = await graphRepository.listPersistedInvestigations(10);
    expect(history.some((h) => h.id === testInvId)).toBe(true);
  });
});
