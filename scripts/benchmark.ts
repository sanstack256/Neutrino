import { performance } from 'node:perf_hooks';
import { GraphRepository } from '../apps/api/src/graph/repository.js';
import { InvestigationEngine } from '../apps/api/src/investigation/engine.js';

async function benchmark() {
  const repo = new GraphRepository();
  const engine = new InvestigationEngine(repo);
  const graph = await repo.getGraph();

  console.log('================================================================');
  console.log('       NEUTRINO LIVE FALKORDB BENCHMARK & PERFORMANCE AUDIT     ');
  console.log('================================================================');

  // 1. Point lookup
  const t1s: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = performance.now();
    await graph.query('MATCH (i:Incident {id: $id}) RETURN i', { params: { id: 'INC-2026-101' } });
    t1s.push(performance.now() - s);
  }
  console.log('1. Point Lookup (Incident Context):', {
    min: Math.min(...t1s).toFixed(2) + 'ms',
    avg: (t1s.reduce((a, b) => a + b) / 5).toFixed(2) + 'ms',
    max: Math.max(...t1s).toFixed(2) + 'ms',
  });

  // 2. Multi-hop traversal (DEPENDS_ON 1..3)
  const t2s: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = performance.now();
    await graph.query(
      'MATCH p = (s:Service {id: $id})-[:DEPENDS_ON*1..3]->(dep:Service) RETURN dep, length(p) as depth',
      { params: { id: 'checkout-service' } }
    );
    t2s.push(performance.now() - s);
  }
  console.log('2. Multi-hop Traversal (depth 1..3):', {
    min: Math.min(...t2s).toFixed(2) + 'ms',
    avg: (t2s.reduce((a, b) => a + b) / 5).toFixed(2) + 'ms',
    max: Math.max(...t2s).toFixed(2) + 'ms',
  });

  // 3. Path query (shortest / explanation path)
  const t3s: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = performance.now();
    await repo.getInvestigationPaths('INC-2026-101', 'auth-service', 3);
    t3s.push(performance.now() - s);
  }
  console.log('3. Causal Path Query:', {
    min: Math.min(...t3s).toFixed(2) + 'ms',
    avg: (t3s.reduce((a, b) => a + b) / 5).toFixed(2) + 'ms',
    max: Math.max(...t3s).toFixed(2) + 'ms',
  });

  // 4. Subgraph extraction
  const t4s: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = performance.now();
    await repo.getSubgraph('INC-2026-101');
    t4s.push(performance.now() - s);
  }
  console.log('4. Subgraph Extraction Query:', {
    min: Math.min(...t4s).toFixed(2) + 'ms',
    avg: (t4s.reduce((a, b) => a + b) / 5).toFixed(2) + 'ms',
    max: Math.max(...t4s).toFixed(2) + 'ms',
  });

  // 5. Complete Investigation Execution
  const t5s: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = performance.now();
    await engine.execute({
      question: 'Why is checkout-service failing with 500 errors during token validation?',
      incidentId: 'INC-2026-101',
      executionMode: 'deterministic',
    });
    t5s.push(performance.now() - s);
  }
  console.log('5. Complete Investigation Execution (All operations + FalkorDB persistence):', {
    min: Math.min(...t5s).toFixed(2) + 'ms',
    avg: (t5s.reduce((a, b) => a + b) / 5).toFixed(2) + 'ms',
    max: Math.max(...t5s).toFixed(2) + 'ms',
  });

  // 6. Graph DB Node & Rel counts
  const nodeCountRes = await graph.query('MATCH (n) RETURN count(n) AS cnt');
  const relCountRes = await graph.query('MATCH ()-[r]->() RETURN count(r) AS cnt');
  console.log('6. Graph Database Totals:', {
    totalNodes: Number(nodeCountRes.data[0].cnt),
    totalRelationships: Number(relCountRes.data[0].cnt),
  });

  console.log('================================================================');
  process.exit(0);
}

benchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
