import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { graphLifecycleManager } from '../../apps/api/src/lifecycle/manager.js';
import { memoryRepository } from '../../apps/api/src/memory/repository.js';
import { FalkorDBManager } from '../../apps/api/src/graph/client.js';

describe('Stage 4 Part C: Graph Lifecycle, Retention & Scale Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  const manager = new FalkorDBManager();
  const runId = Date.now();
  const TENANT_A = `tenant-lifecycle-a-${runId}`;
  const TENANT_B = `tenant-lifecycle-b-${runId}`;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    const graph = await manager.getGraph('neutrino_graph');

    // 1. Create an Active Incident with evidence (MUST BE PRESERVED)
    await graph.query(
      `MERGE (i:Incident {id: 'INC-ACTIVE-${runId}'})
       SET i.title = 'Active Critical Outage',
           i.tenantId = $tenantA,
           i.status = 'investigating',
           i.startedAt = '2020-01-01T10:00:00Z',
           i.synthetic = true
       MERGE (e1:Evidence {id: 'EV-ACTIVE-${runId}'})
       SET e1.tenantId = $tenantA,
           e1.summary = 'Active incident key error log',
           e1.observedAt = '2020-01-01T10:00:01Z',
           e1.ingestedAt = '2020-01-01T10:00:05Z'
       MERGE (e1)-[:OBSERVED_IN]->(i)`,
      { params: { tenantA: TENANT_A } }
    );

    // 2. Create an Investigation Hypothesis referencing an evidence (MUST BE PRESERVED)
    await graph.query(
      `MERGE (h:Hypothesis {id: 'HYP-PROVENANCE-${runId}'})
       SET h.tenantId = $tenantA,
           h.statement = 'Root cause hypothesis',
           h.confidence = 0.95
       MERGE (e2:Evidence {id: 'EV-HYP-${runId}'})
       SET e2.tenantId = $tenantA,
           e2.summary = 'Hypothesis supporting evidence',
           e2.observedAt = '2020-01-01T09:00:00Z',
           e2.ingestedAt = '2020-01-01T09:00:05Z'
       MERGE (h)-[:SUPPORTED_BY]->(e2)`,
      { params: { tenantA: TENANT_A } }
    );

    // 3. Create an Unreferenced Stale Evidence node (ELIGIBLE FOR PRUNING)
    await graph.query(
      `MERGE (e3:Evidence {id: 'EV-STALE-${runId}'})
       SET e3.tenantId = $tenantA,
           e3.summary = 'Orphaned stale metric',
           e3.observedAt = '2020-01-01T00:00:00Z',
           e3.ingestedAt = '2020-01-01T00:00:05Z'`,
      { params: { tenantA: TENANT_A } }
    );

    // 4. Create Tenant B Evidence (MUST NEVER BE TOUCHED BY TENANT A PRUNE)
    await graph.query(
      `MERGE (e4:Evidence {id: 'EV-TENANT-B-${runId}'})
       SET e4.tenantId = $tenantB,
           e4.summary = 'Tenant B private evidence',
           e4.observedAt = '2020-01-01T00:00:00Z',
           e4.ingestedAt = '2020-01-01T00:00:05Z'`,
      { params: { tenantB: TENANT_B } }
    );

    // 5. Create a Superseded Knowledge Claim for Tenant A
    await memoryRepository.saveKnowledgeClaim(
      {
        id: `claim-superseded-${runId}`,
        tenantId: TENANT_A,
        subject: 'svc-cache',
        predicate: 'caused_by_condition',
        object: 'hyp-old',
        statement: 'Old superseded knowledge claim',
        claimType: 'inferred',
        status: 'superseded',
        confidence: 0.5,
        supportingEvidenceIds: [],
        contradictoryEvidenceIds: [],
        sourceProvenance: 'Investigation OLD',
        firstObservedAt: '2020-01-01T00:00:00Z',
        lastVerifiedAt: '2020-01-01T00:00:00Z',
        revision: 1,
        synthetic: true,
      },
      undefined,
      TENANT_A
    );
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('Lifecycle 01: Dry-run prune identifies eligible stale evidence without modifying graph data', async () => {
    const res = await fetch(`${baseUrl}/api/v1/lifecycle/prune`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_A,
        'X-User-Role': 'admin',
      },
      body: JSON.stringify({
        category: 'telemetry',
        olderThanDays: 30,
        batchSize: 50,
        dryRun: true,
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.candidatesIdentified).toBeGreaterThanOrEqual(1);
    expect(body.recordsPruned).toBe(0);
    expect(body.preservedReasons.active_incident).toBeGreaterThanOrEqual(1);

    // Verify EV-STALE is still present in the graph after dry-run
    const graph = await manager.getGraph('neutrino_graph');
    const checkRes = await graph.query(
      `MATCH (e:Evidence {id: 'EV-STALE-${runId}'}) RETURN count(e) AS cnt`
    );
    expect(Number(checkRes.data[0].cnt)).toBe(1);
  });

  it('Lifecycle 02: Active incident and hypothesis evidence are strictly protected from deletion', async () => {
    const res = await fetch(`${baseUrl}/api/v1/lifecycle/prune`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_A,
        'X-User-Role': 'admin',
      },
      body: JSON.stringify({
        category: 'telemetry',
        olderThanDays: 1,
        batchSize: 50,
        dryRun: false,
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.dryRun).toBe(false);

    const graph = await manager.getGraph('neutrino_graph');

    // EV-ACTIVE must STILL exist (protected by active incident status)
    const activeRes = await graph.query(
      `MATCH (e:Evidence {id: 'EV-ACTIVE-${runId}'}) RETURN count(e) AS cnt`
    );
    expect(Number(activeRes.data[0].cnt)).toBe(1);

    // EV-HYP must STILL exist (protected by hypothesis reference)
    const hypRes = await graph.query(
      `MATCH (e:Evidence {id: 'EV-HYP-${runId}'}) RETURN count(e) AS cnt`
    );
    expect(Number(hypRes.data[0].cnt)).toBe(1);

    // EV-STALE was orphaned and older than cutoff, so it was safely pruned
    const staleRes = await graph.query(
      `MATCH (e:Evidence {id: 'EV-STALE-${runId}'}) RETURN count(e) AS cnt`
    );
    expect(Number(staleRes.data[0].cnt)).toBe(0);
  });

  it('Lifecycle 03: Tenant A prune NEVER touches Tenant B evidence', async () => {
    const graph = await manager.getGraph('neutrino_graph');
    const bRes = await graph.query(
      `MATCH (e:Evidence {id: 'EV-TENANT-B-${runId}'}) RETURN count(e) AS cnt`
    );
    expect(Number(bRes.data[0].cnt)).toBe(1);
  });

  it('Lifecycle 04: Superseded memory claims are safely archived without destroying provenance', async () => {
    const archiveResult = await graphLifecycleManager.archiveSupersededClaims(TENANT_A);
    expect(archiveResult.archivedCount).toBeGreaterThanOrEqual(1);

    // Verify claim status is now 'archived' in FalkorDB
    const graph = await manager.getGraph('neutrino_graph');
    const claimRes = await graph.query(
      `MATCH (k:KnowledgeClaim {id: 'claim-superseded-${runId}'}) RETURN k.status AS status`
    );
    expect(claimRes.data[0].status).toBe('archived');
  });

  it('Lifecycle 05: GET /api/v1/lifecycle/stats reports tenant-isolated graph statistics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/lifecycle/stats`, {
      headers: { 'X-Tenant-ID': TENANT_A },
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.tenantId).toBe(TENANT_A);
    expect(body.evidenceCount).toBeGreaterThanOrEqual(1);
    expect(body.activeIncidentsCount).toBeGreaterThanOrEqual(1);
    expect(body.timestamp).toBeDefined();
  });
});
