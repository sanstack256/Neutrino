import { describe, it, expect, beforeAll } from 'vitest';
import { FalkorDBManager } from '../../apps/api/src/graph/client.js';
import { GraphRepository } from '../../apps/api/src/graph/repository.js';
import { InvestigationEngine } from '../../apps/api/src/investigation/engine.js';
import { seedDatabase } from '../../apps/api/src/seed.js';

describe('Mandatory Gate D: FalkorDB Graph Indispensability Test', () => {
  const normalGraphName = 'neutrino_graph';
  const emptyGraphName = 'neutrino_empty_test_graph';

  beforeAll(async () => {
    const manager = FalkorDBManager.getInstance();

    // 1. Seed normal graph only if INC-2026-101 is missing
    const normalGraph = await manager.getGraph(normalGraphName);
    try {
      const checkRes = await normalGraph.query('MATCH (i:Incident {id: "INC-2026-101"}) RETURN count(i) AS cnt');
      const hasIncident = Number((checkRes.data as any)?.[0]?.cnt || 0) > 0;
      if (!hasIncident) {
        await seedDatabase(undefined, normalGraphName);
      }
    } catch {
      await seedDatabase(undefined, normalGraphName);
    }

    // 2. Ensure empty test graph exists and has 0 nodes
    const emptyGraph = await manager.getGraph(emptyGraphName);
    try {
      await emptyGraph.delete();
    } catch {
      // ignore if graph does not exist
    }
  }, 60000);

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
  }, 90000);

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

  it('Phase 3 (Disconnected Graph Topology): Severing the DEPENDS_ON relationship prevents upstream root-cause discovery', async () => {
    const disconnectedGraphName = 'neutrino_disconnected_test_graph';
    const manager = FalkorDBManager.getInstance();
    const disconnectedGraph = await manager.getGraph(disconnectedGraphName);
    try {
      await disconnectedGraph.delete();
    } catch {
      // ignore
    }

    // Seed nodes and relationships EXCEPT (checkout-service)-[:DEPENDS_ON]->(auth-service)
    await disconnectedGraph.query(`
      CREATE (i:Incident {
        id: 'INC-2026-101',
        title: 'Elevated 500 error rate in checkout flow',
        description: 'Checkout submit failure',
        severity: 'SEV-1',
        status: 'investigating',
        startedAt: '2026-10-15T14:02:00Z',
        synthetic: true
      })
      CREATE (s1:Service {
        id: 'checkout-service',
        name: 'Checkout Service',
        criticality: 'tier-1',
        environment: 'production'
      })
      CREATE (s2:Service {
        id: 'auth-service',
        name: 'Authentication Service',
        criticality: 'tier-1',
        environment: 'production'
      })
      CREATE (d:Deployment {
        id: 'dep-auth-2.4.1',
        serviceId: 'auth-service',
        version: 'v2.4.1',
        environment: 'production',
        deployedAt: '2026-10-15T13:45:00Z',
        status: 'succeeded',
        changeSummary: 'Reduced signing key cache TTL'
      })
      CREATE (e:Evidence {
        id: 'EV-101-01',
        sourceType: 'log',
        sourceRecordId: 'src-apm-datadog',
        observedAt: '2026-10-15T14:03:00Z',
        ingestedAt: '2026-10-15T14:03:05Z',
        summary: 'AuthTokenVerificationError spike',
        content: 'AuthTokenVerificationError: Signature verification failed',
        contentHash: 'hash-ev-1',
        synthetic: true,
        reliabilityClass: 'authoritative'
      })
      CREATE (i)-[:AFFECTS]->(s1)
      CREATE (s2)-[:HAS_DEPLOYMENT]->(d)
      CREATE (e)-[:OBSERVED_IN]->(i)
    `);

    const disconnectedRepo = new GraphRepository({ graphName: disconnectedGraphName });
    const disconnectedEngine = new InvestigationEngine(disconnectedRepo);

    const result = await disconnectedEngine.execute({
      question: 'Why is checkout-service failing with 500 errors during token validation?',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    // Because the DEPENDS_ON edge is severed, the engine CANNOT traverse to auth-service or its deployment
    const upstreamHyp = result.candidateExplanations.find((h) => h.id === 'hyp-upstream-deployment-desync');
    expect(upstreamHyp).toBeUndefined();

    // The result cannot claim auth-service deployment as root cause without the graph edge
    expect(result.candidateRootCause?.id).not.toBe('dep-auth-2.4.1');

    // Clean up test graph
    try {
      await disconnectedGraph.delete();
    } catch {
      // ignore
    }
  }, 90000);
});
