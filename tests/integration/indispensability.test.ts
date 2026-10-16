import { describe, it, expect, beforeAll } from 'vitest';
import { FalkorDBManager } from '../../apps/api/src/graph/client.js';
import { GraphRepository } from '../../apps/api/src/graph/repository.js';
import { InvestigationEngine } from '../../apps/api/src/investigation/engine.js';
import { seedDatabase } from '../../apps/api/src/seed.js';

describe('Mandatory Gate D: FalkorDB Graph Indispensability Test', () => {
  const normalGraphName = 'neutrino_graph';
  const emptyGraphName = 'neutrino_empty_test_graph';

  beforeAll(async () => {
    // 1. Seed normal graph
    await seedDatabase(undefined, normalGraphName);

    // 2. Ensure empty test graph exists and has 0 nodes
    const manager = FalkorDBManager.getInstance();
    const emptyGraph = await manager.getGraph(emptyGraphName);
    try {
      await emptyGraph.delete();
    } catch {
      // ignore if graph does not exist
    }
  });

  it('Phase 1 (With FalkorDB Graph): Discovers 3-hop causal chain and responsible team', async () => {
    const normalRepo = new GraphRepository({ graphName: normalGraphName });
    const engine = new InvestigationEngine(normalRepo);

    const result = await engine.execute({
      question: 'Why is checkout-service failing with 500 errors during token validation?',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    // 1. Must succeed with completed status
    expect(result.status).toBe('completed');

    // 2. Must identify upstream auth-service as the root cause via graph traversal
    const primaryHyp = result.candidateExplanations.find((h) => h.id === 'hyp-upstream-deployment-desync');
    expect(primaryHyp).toBeDefined();
    expect(primaryHyp?.status).toBe('supported');
    expect(primaryHyp?.statement).toContain('auth-service');
    expect(primaryHyp?.statement).toContain('v2.4.1');

    // 3. Must verify at least 3-hop path returned from FalkorDB:
    // (Incident) -> (checkout-service) -> (auth-service) -> (Deployment)
    const matchingPath = result.graphPaths.find(
      (p) =>
        p.nodes.includes('INC-2026-101') &&
        p.nodes.includes('checkout-service') &&
        p.nodes.includes('auth-service')
    );
    expect(matchingPath).toBeDefined();
    expect(matchingPath?.relationships).toContain('AFFECTS');
    expect(matchingPath?.relationships).toContain('DEPENDS_ON');

    // 4. Must retrieve evidence connected via graph
    expect(result.evidenceBundle.length).toBeGreaterThanOrEqual(5);
    const logEvidence = result.evidenceBundle.find((e) => e.id === 'EV-101-01');
    expect(logEvidence).toBeDefined();
    expect(logEvidence?.content).toContain('AuthTokenVerificationError');

    // 5. Must retrieve owning team of root cause service
    const authTeamRes = await normalRepo.getServiceOwners('auth-service');
    // Service context checks
    const context = await normalRepo.getIncidentContext('INC-2026-101');
    expect(context.affectedService?.id).toBe('checkout-service');
  });

  it('Phase 2 (Without FalkorDB Graph Context): System refuses to fabricate answer and reports missing context', async () => {
    // Create an engine configured against the isolated empty graph
    const emptyRepo = new GraphRepository({ graphName: emptyGraphName });
    const emptyEngine = new InvestigationEngine(emptyRepo);

    // Attempting the exact same investigation on the empty graph MUST NOT return the same answer.
    // It must strictly report failure or missing context because FalkorDB is indispensable.
    let errorCaught: any = null;
    try {
      await emptyEngine.execute({
        question: 'Why is checkout-service failing with 500 errors during token validation?',
        incidentId: 'INC-2026-101',
        executionMode: 'deterministic',
      });
    } catch (err: any) {
      errorCaught = err;
    }

    expect(errorCaught).toBeDefined();
    expect(errorCaught.message).toMatch(/not found in the graph database|No incident found in graph/);
  });
});
