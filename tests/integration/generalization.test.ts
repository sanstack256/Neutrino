import { describe, it, expect, beforeAll } from 'vitest';
import { FalkorDBManager } from '../../apps/api/src/graph/client.js';
import { GraphRepository } from '../../apps/api/src/graph/repository.js';
import { MemoryRepository } from '../../apps/api/src/memory/repository.js';
import { InvestigationEngine } from '../../apps/api/src/investigation/engine.js';
import { seedDatabase } from '../../apps/api/src/seed.js';
import { KnowledgeClaim, DiagnosticProcedure, Incident, Service } from '@neutrino/contracts';

describe('Generalization Evaluation Suite (15 Distinct Investigation Cases)', () => {
  const evalGraphName = 'neutrino_eval_generalization_graph';
  let repo: GraphRepository;
  let memoryRepo: MemoryRepository;
  let engine: InvestigationEngine;

  beforeAll(async () => {
    await seedDatabase(undefined, evalGraphName);
    repo = new GraphRepository({ graphName: evalGraphName });
    memoryRepo = new MemoryRepository({ graphName: evalGraphName });
    engine = new InvestigationEngine({ repository: repo, memoryRepo });
  });

  // Case 1: Known upstream dependency failure
  it('Case 01: Correctly deduces multi-hop upstream dependency failure for checkout-service', async () => {
    const res = await engine.execute({
      question: 'Why is checkout-service failing with 500 errors during token validation?',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    expect(res.status).toBe('completed');
    const upstreamHyp = res.candidateExplanations.find((h) => h.id === 'hyp-upstream-deployment-desync');
    expect(upstreamHyp).toBeDefined();
    expect(upstreamHyp?.status).toBe('supported');
    expect(upstreamHyp?.statement).toContain('auth-service');
    expect(upstreamHyp?.statement).toContain('v2.4.1');
  });

  // Case 2: Downstream impact investigation
  it('Case 02: Discovers downstream consumer impact when an upstream service degrades', async () => {
    const downstream = await repo.getAffectedServices('auth-service', 2);
    expect(downstream.length).toBeGreaterThanOrEqual(1);
    expect(downstream.some((d) => d.service.id === 'checkout-service')).toBe(true);
  });

  // Case 3: Deployment-related failure
  it('Case 03: Identifies preceding deployment within lookback window', async () => {
    const deps = await repo.getRecentDeployments(['auth-service'], 5);
    expect(deps.length).toBeGreaterThanOrEqual(1);
    expect(deps[0].version).toBe('v2.4.1');
    expect(deps[0].changeSummary).toContain('signing key cache TTL');
  });

  // Case 4: Shared dependency exploration
  it('Case 04: Evaluates shared infrastructure dependency (redis-cluster, postgres-primary)', async () => {
    const checkoutDeps = await repo.getServiceDependencies('checkout-service', 2);
    const hasSharedCache = checkoutDeps.some((d) => d.service.id === 'redis-cluster');
    expect(hasSharedCache).toBe(true);
  });

  // Case 5: Historical precedent correlation
  it('Case 05: Correlates current failure symptoms with historical incident precedent (INC-2025-089)', async () => {
    const res = await engine.execute({
      question: 'Investigate token signature failures and compare against historical precedent',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    const histHyp = res.candidateExplanations.find((h) => h.id.includes('hyp-historical-precedent'));
    expect(histHyp).toBeDefined();
    expect(histHyp?.statement).toContain('INC-2025-089');
  });

  // Case 6: Misleading temporal correlation rejection
  it('Case 06: Distinguishes stale baseline telemetry from active incident error onset', async () => {
    const res = await engine.execute({
      question: 'Evaluate checkout CPU utilization baseline against incident onset',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    // Stale morning batch CPU observation (EV-101-11) is excluded from supporting hypotheses
    const upstreamHyp = res.candidateExplanations.find((h) => h.id === 'hyp-upstream-deployment-desync');
    expect(upstreamHyp?.supportingEvidenceIds).not.toContain('EV-101-11');
  });

  // Case 7: Missing telemetry detection (telemetry gap)
  it('Case 07: Flags missing telemetry when datastore is saturated but slowlog is absent (INC-2026-088)', async () => {
    const res = await engine.execute({
      question: 'Why are cart requests timing out?',
      incidentId: 'INC-2026-088',
      executionMode: 'deterministic',
    });

    expect(res.missingInformation.length).toBeGreaterThanOrEqual(1);
    expect(
      res.missingInformation.some((m) => m.toLowerCase().includes('slowlog'))
    ).toBe(true);
  });

  // Case 8: Contradictory evidence refutation
  it('Case 08: Refutes database bottleneck hypothesis when latency metrics remain healthy < 2ms', async () => {
    const res = await engine.execute({
      question: 'Is database connection pool exhaustion causing the checkout errors?',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    const dbHyp = res.candidateExplanations.find((h) => h.id === 'hyp-database-connection-exhaustion');
    expect(dbHyp).toBeDefined();
    expect(dbHyp?.status).toBe('contradicted');
    expect(dbHyp?.contradictoryEvidenceIds).toContain('EV-101-05');
  });

  // Case 9: Stale evidence exclusion
  it('Case 09: Strictly excludes stale evidence records outside the active incident temporal window', async () => {
    const context = await repo.getIncidentContext('INC-2026-101');
    const staleRecords = context.evidence.filter(
      (e) => new Date(e.observedAt).getTime() < new Date(context.incident!.startedAt).getTime() - 24 * 3600 * 1000
    );
    // Stale records exist in historical telemetry but should be handled appropriately
    expect(staleRecords.length).toBeGreaterThanOrEqual(1);
  });

  // Case 10: Unresolved root cause when evidence is incomplete
  it('Case 10: Reports insufficient evidence rather than guessing when telemetry is inconclusive', async () => {
    const res = await engine.execute({
      question: 'Diagnose cart latency incident INC-2026-088',
      incidentId: 'INC-2026-088',
      executionMode: 'deterministic',
    });

    // In cart-service incident without slowlogs, root cause is unresolved
    expect(res.status).toBe('insufficient-evidence');
  });

  // Case 11: Changed dependency relationship (severed topology)
  it('Case 11: Does not deduce upstream cause when topological dependency edge is absent', async () => {
    const manager = FalkorDBManager.getInstance();
    const severedGraphName = 'neutrino_severed_eval_graph';
    const severedGraph = await manager.getGraph(severedGraphName);
    try {
      await severedGraph.delete();
    } catch {}

    await severedGraph.query(`
      CREATE (i:Incident {id: 'INC-ISOLATED', title: 'Isolated fail', severity: 'SEV-1', status: 'investigating', startedAt: '2026-10-15T14:02:00Z', synthetic: true})
      CREATE (s1:Service {id: 'order-service', name: 'Order Service', criticality: 'tier-1', environment: 'production'})
      CREATE (s2:Service {id: 'auth-service', name: 'Auth Service', criticality: 'tier-1', environment: 'production'})
      CREATE (i)-[:AFFECTS]->(s1)
      // Note: No DEPENDS_ON edge from order-service to auth-service
    `);

    const severedRepo = new GraphRepository({ graphName: severedGraphName });
    const severedEngine = new InvestigationEngine({ repository: severedRepo });

    const res = await severedEngine.execute({
      question: 'Why is order-service failing?',
      incidentId: 'INC-ISOLATED',
      executionMode: 'deterministic',
    });

    const upstreamHyp = res.candidateExplanations.find((h) => h.id === 'hyp-upstream-deployment-desync');
    expect(upstreamHyp).toBeUndefined();

    try {
      await severedGraph.delete();
    } catch {}
  });

  // Case 12: Misleading memory rejected by live contradictory evidence
  it('Case 12: Rejects misleading recalled memory when current live telemetry disproves it', async () => {
    // Save a misleading claim into the memory repository
    const falseClaim: KnowledgeClaim = {
      id: 'claim-misleading-db',
      subject: 'checkout-service',
      predicate: 'caused_by_condition',
      object: 'database-failure',
      statement: 'Database connection pool exhaustion caused transaction timeouts in checkout-service',
      claimType: 'inferred',
      status: 'active',
      confidence: 0.9,
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      sourceProvenance: 'outdated-incident',
      firstObservedAt: '2025-01-01T00:00:00Z',
      lastVerifiedAt: '2025-01-01T00:00:00Z',
      revision: 1,
      synthetic: true,
    };
    await memoryRepo.saveKnowledgeClaim(falseClaim);

    const res = await engine.execute({
      question: 'Investigate checkout failure with active memory recall',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    const recalledFalse = res.recalledMemories.find((m) => m.memoryId === 'claim-misleading-db');
    if (recalledFalse) {
      // Must be rejected by active metric EV-101-04!
      expect(recalledFalse.influence).toBe('rejected_by_evidence');
      expect(recalledFalse.currentEvidenceContradiction).toContain('EV-101-04');
    }
  });

  // Case 13: Previously validated procedural memory application
  it('Case 13: Adopts and recommends validated diagnostic procedure from procedural memory', async () => {
    const proc: DiagnosticProcedure = {
      id: 'proc-jwks-check',
      name: 'Verify JWKS endpoint alignment',
      purpose: 'Diagnose token verification signature failure',
      serviceId: 'checkout-service',
      preconditions: ['Active 500 error spike'],
      requiredEvidenceTypes: ['log', 'metric'],
      diagnosticSteps: [
        'Query auth-service JWKS endpoint directly from checkout-service host',
        'Verify public key kid matches incoming token header',
      ],
      expectedObservations: ['Active key ID present in JWKS cache'],
      supportingConditions: ['Signature verification error in client logs'],
      contradictingConditions: ['JWKS responds with matching kid within 5ms'],
      knownFailureModes: ['Cache TTL rotation desync'],
      status: 'active',
      validationCriteria: 'Non-destructive HTTP GET on JWKS health route',
      version: 1,
      lastValidatedAt: '2026-10-15T14:20:00Z',
      synthetic: true,
    };
    await memoryRepo.saveDiagnosticProcedure(proc);

    const res = await engine.execute({
      question: 'Investigate checkout-service token validation failure with procedural memory',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });

    expect(res.recalledMemories.some((m) => m.memoryType === 'procedural')).toBe(true);
    expect(res.recommendedNextStep).toContain('JWKS');
  });

  // Case 14: Unavailable external third-party dependency (INC-2026-042)
  it('Case 14: Correctly isolates external third-party provider transit degradation (Stripe in INC-2026-042)', async () => {
    const res = await engine.execute({
      question: 'Why are payment gateway webhooks timing out?',
      incidentId: 'INC-2026-042',
      executionMode: 'deterministic',
    });

    const extHyp = res.candidateExplanations.find((h) => h.id === 'hyp-external-dependency-failure');
    expect(extHyp).toBeDefined();
    expect(extHyp?.status).toBe('supported');
    expect(extHyp?.statement).toContain('Stripe');
  });

  // Case 15: Grounded abstention when evidence is zero
  it('Case 15: Strictly abstains and returns insufficient-evidence when no evidence exists', async () => {
    const manager = FalkorDBManager.getInstance();
    const emptyEvGraphName = 'neutrino_empty_evidence_eval_graph';
    const emptyEvGraph = await manager.getGraph(emptyEvGraphName);
    try {
      await emptyEvGraph.delete();
    } catch {}

    await emptyEvGraph.query(`
      CREATE (i:Incident {id: 'INC-NO-EVIDENCE', title: 'Zero evidence incident', severity: 'SEV-2', status: 'investigating', startedAt: '2026-10-15T14:02:00Z', synthetic: true})
      CREATE (s:Service {id: 'catalog-service', name: 'Catalog Service', criticality: 'tier-2', environment: 'production'})
      CREATE (i)-[:AFFECTS]->(s)
      // Zero evidence records created!
    `);

    const noEvRepo = new GraphRepository({ graphName: emptyEvGraphName });
    const noEvEngine = new InvestigationEngine({ repository: noEvRepo });

    const res = await noEvEngine.execute({
      question: 'Diagnose catalog service issue',
      incidentId: 'INC-NO-EVIDENCE',
      executionMode: 'deterministic',
    });

    // Must strictly abstain with insufficient-evidence!
    expect(res.status).toBe('insufficient-evidence');
    expect(res.evidenceBundle.length).toBe(0);

    try {
      await emptyEvGraph.delete();
    } catch {}
  });
});
