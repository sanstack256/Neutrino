import { performance } from 'node:perf_hooks';
import { GraphRepository } from '../apps/api/src/graph/repository.js';
import { MemoryRepository } from '../apps/api/src/memory/repository.js';
import { MemoryRetrievalEngine } from '../apps/api/src/memory/retrieval.js';
import { InvestigationEngine } from '../apps/api/src/investigation/engine.js';
import { graphIntelligenceService } from '../apps/api/src/intelligence/failure-domains.js';
import { telemetryRepository } from '../apps/api/src/telemetry/repository.js';
import { remediationEngine } from '../apps/api/src/remediation/engine.js';

function calcStats(durations: number[]) {
  const sorted = [...durations].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    samples: sorted.length,
    min: min.toFixed(2) + 'ms',
    p50: p50.toFixed(2) + 'ms',
    p95: p95.toFixed(2) + 'ms',
    max: max.toFixed(2) + 'ms',
    avg: avg.toFixed(2) + 'ms',
  };
}

async function benchmark() {
  const repo = new GraphRepository();
  const memRepo = new MemoryRepository();
  const retrievalEngine = new MemoryRetrievalEngine(memRepo);
  const engine = new InvestigationEngine({ repository: repo, memoryRepo: memRepo });
  const graph = await repo.getGraph();

  console.log('========================================================================');
  console.log('    NEUTRINO STAGE 3 COMPETITION BENCHMARK & PERFORMANCE AUDIT (p50/p95) ');
  console.log('========================================================================\n');

  // Warmup iterations
  for (let i = 0; i < 3; i++) {
    await graph.query('MATCH (i:Incident {id: $id}) RETURN i', { params: { id: 'INC-2026-101' } });
    await graph.query('MATCH p = (s:Service {id: $id})-[:DEPENDS_ON*1..3]->(dep:Service) RETURN dep', {
      params: { id: 'checkout-service' },
    });
  }

  const iterations = 20;

  // 1. Point lookup (Incident Context)
  const t1s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    await graph.query('MATCH (i:Incident {id: $id}) RETURN i', { params: { id: 'INC-2026-101' } });
    t1s.push(performance.now() - s);
  }
  console.log('1. Point Lookup (Incident Entity Context):', calcStats(t1s));

  // 2. Multi-hop traversal (DEPENDS_ON 1..3)
  const t2s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    await graph.query(
      'MATCH p = (s:Service {id: $id})-[:DEPENDS_ON*1..3]->(dep:Service) RETURN dep, length(p) as depth',
      { params: { id: 'checkout-service' } }
    );
    t2s.push(performance.now() - s);
  }
  console.log('2. Multi-hop Topology Traversal (Depth 1..3):', calcStats(t2s));

  // 3. Evidence Retrieval (Incident Bundle)
  const t3s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    await repo.getIncidentContext('INC-2026-101');
    t3s.push(performance.now() - s);
  }
  console.log('3. Evidence Retrieval (Incident Context & Evidence):', calcStats(t3s));

  // 4. Memory Retrieval (Multi-Signal Recall from FalkorDB)
  const context = await repo.getIncidentContext('INC-2026-101');
  const t4s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    await retrievalEngine.retrieveRelevantMemories({
      incident: context.incident,
      affectedService: context.affectedService,
      currentEvidence: context.evidence,
      limit: 5,
    });
    t4s.push(performance.now() - s);
  }
  console.log('4. Persistent Memory Recall (Multi-Signal FalkorDB):', calcStats(t4s));

  // 5. Causal Path Query
  const t5s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    await repo.getInvestigationPaths('INC-2026-101', 'auth-service', 3);
    t5s.push(performance.now() - s);
  }
  console.log('5. Causal Path Discovery Query (FalkorDB):', calcStats(t5s));

  // 6. Dynamic Graph Intelligence & Failure Domain Detection
  const t6s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    graphIntelligenceService.invalidateCache();
    const s = performance.now();
    await graphIntelligenceService.discoverFailureDomains(true);
    t6s.push(performance.now() - s);
  }
  console.log('6. Dynamic Graph Intelligence & Failure Domains:', calcStats(t6s));

  // 7. Live Telemetry Ingestion (Batch persistence to FalkorDB)
  const t7s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const event = {
      id: `bench-evt-${Date.now()}-${i}`,
      source: 'benchmark-runner',
      eventType: 'log' as const,
      severity: 'error' as const,
      timestamp: new Date().toISOString(),
      serviceId: 'checkout-service',
      summary: `Benchmark telemetry log event iteration ${i}`,
      content: `Sample payload with latency measurement ${Math.random() * 100}ms`,
      synthetic: true,
    };
    const s = performance.now();
    await telemetryRepository.ingestBatch([event]);
    t7s.push(performance.now() - s);
  }
  console.log('7. Live Telemetry Batch Ingestion & Indexing:', calcStats(t7s));

  // 8. Safe Action Proposal Lifecycle
  const t8s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    const prop = await remediationEngine.proposeAction({
      investigationId: `bench-inv-${i}`,
      incidentId: 'INC-2026-101',
      actionType: 'diagnostic_probe',
      targetServiceId: 'auth-service',
      targetResource: 'auth-service/healthz',
      explanation: 'Benchmark diagnostic probe',
      riskLevel: 'low',
    });
    await remediationEngine.approveAction(prop.id, {
      approverId: 'bench-user',
      approverName: 'Bench User',
      role: 'on-call-sre',
    });
    await remediationEngine.executeAction(prop.id);
    t8s.push(performance.now() - s);
  }
  console.log('8. Safe Action Proposal + Approval + Allowlisted Exec:', calcStats(t8s));

  // 9. Complete Investigation Execution Loop
  const t9s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    await engine.execute({
      question: 'Why is checkout-service failing with 500 errors during token validation?',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });
    t9s.push(performance.now() - s);
  }
  console.log('9. Complete Unified Investigation Loop (FalkorDB End-to-End):', calcStats(t9s));

  // 10. Stage 4: Tenant-Filtered Multi-Hop Traversal vs Base
  const t10s: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    await repo.getServiceDependencies('checkout-service', 3, 'tenant-default');
    t10s.push(performance.now() - s);
  }
  console.log('10. Stage 4 Tenant-Aware Multi-Hop Path Traversal (Isolated):', calcStats(t10s));

  // 11. Stage 4: Graph DB Totals
  const nodeCountRes = await graph.query('MATCH (n) RETURN count(n) AS cnt');
  const relCountRes = await graph.query('MATCH ()-[r]->() RETURN count(r) AS cnt');
  console.log('\n11. FalkorDB Authoritative Graph Totals:', {
    totalNodes: Number(nodeCountRes.data[0].cnt),
    totalRelationships: Number(relCountRes.data[0].cnt),
  });

  console.log('========================================================================\n');
  process.exit(0);
}

benchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
