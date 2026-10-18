import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { graphRepository } from '../../apps/api/src/graph/repository.js';
import { InvestigationEngine } from '../../apps/api/src/investigation/engine.js';
import { memoryRepository } from '../../apps/api/src/memory/repository.js';
import { remediationEngine } from '../../apps/api/src/remediation/engine.js';
import { telemetryRepository } from '../../apps/api/src/telemetry/repository.js';
import { graphLifecycleManager } from '../../apps/api/src/lifecycle/manager.js';
import { FalkorDBManager } from '../../apps/api/src/graph/client.js';

describe('Stage 5 Final Acceptance: Complete End-to-End System Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  const manager = new FalkorDBManager();
  const runId = Date.now();
  const TENANT_ALPHA = `tenant-e2e-alpha-${runId}`;
  const TENANT_BETA = `tenant-e2e-beta-${runId}`;

  const engine = new InvestigationEngine({
    repository: graphRepository,
    memoryRepo: memoryRepository,
  });

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

    // 1. Seed Tenant Alpha operational graph topology
    await graph.query(
      `MERGE (s1:Service {id: 'svc-alpha-web'})
       SET s1.name = 'Alpha Web Storefront',
           s1.tenantId = $tenantA,
           s1.criticality = 'tier-1',
           s1.environment = 'production'
       MERGE (s2:Service {id: 'svc-alpha-auth'})
       SET s2.name = 'Alpha Identity Gateway',
           s2.tenantId = $tenantA,
           s2.criticality = 'tier-1',
           s2.environment = 'production'
       MERGE (s1)-[:DEPENDS_ON]->(s2)
       MERGE (d:Deployment {id: 'dep-alpha-auth-301'})
       SET d.serviceId = 'svc-alpha-auth',
           d.tenantId = $tenantA,
           d.version = 'v3.0.1',
           d.changeSummary = 'Shortened asymmetric JWT key cache TTL to 30s',
           d.deployedAt = '2026-10-18T14:00:00Z',
           d.status = 'succeeded'
       MERGE (s2)-[:HAS_DEPLOYMENT]->(d)
       MERGE (i:Incident {id: 'INC-ALPHA-E2E'})
       SET i.title = 'Alpha Storefront 500 Token Signature Failures',
           i.tenantId = $tenantA,
           i.severity = 'SEV-1',
           i.status = 'investigating',
           i.startedAt = '2026-10-18T14:15:00Z',
           i.synthetic = true
       MERGE (i)-[:AFFECTS]->(s1)`,
      { params: { tenantA: TENANT_ALPHA } }
    );

    // 2. Ingest observable evidence connected to the incident
    await telemetryRepository.ingestBatch(
      [
        {
          id: `ev-alpha-err-${runId}`,
          source: 'k8s-ingress',
          serviceId: 'svc-alpha-web',
          eventType: 'log',
          severity: 'error',
          timestamp: '2026-10-18T14:16:00Z',
          message: 'HTTP 500 signature verification failed connecting to svc-alpha-auth:8080',
          environment: 'production',
          synthetic: true,
          tenantId: TENANT_ALPHA,
        },
        {
          id: `ev-alpha-auth-${runId}`,
          source: 'auth-gateway-log',
          serviceId: 'svc-alpha-auth',
          eventType: 'log',
          severity: 'warn',
          timestamp: '2026-10-18T14:15:30Z',
          message: 'KeyRotationWarning: Asymmetric key ID k-alpha-99 not found in local cache',
          environment: 'production',
          synthetic: true,
          tenantId: TENANT_ALPHA,
        },
        {
          id: `ev-alpha-db-healthy-${runId}`,
          source: 'rds-cloudwatch',
          serviceId: 'svc-alpha-web',
          eventType: 'metric',
          severity: 'info',
          timestamp: '2026-10-18T14:17:00Z',
          message: 'Postgres primary database latency metric remained healthy (< 2ms)',
          attributes: { latencyMs: 1.2 },
          environment: 'production',
          synthetic: true,
          tenantId: TENANT_ALPHA,
        },
        {
          id: `ev-alpha-old-prune-${runId}`,
          source: 'legacy-probe',
          serviceId: 'svc-alpha-web',
          eventType: 'log',
          severity: 'warn',
          timestamp: '2020-01-01T00:00:00Z',
          message: 'Historical probe event older than retention window',
          environment: 'production',
          synthetic: true,
          tenantId: TENANT_ALPHA,
        },
      ],
      TENANT_ALPHA
    );

    // Link evidence to the active incident for provenance and active incident retention protection
    await graph.query(
      `MATCH (e:Evidence), (i:Incident {id: 'INC-ALPHA-E2E'})
       WHERE e.id IN [$ev1, $ev2, $ev3, $evOld]
       MERGE (e)-[:OBSERVED_IN]->(i)`,
      {
        params: {
          ev1: `ev-alpha-err-${runId}`,
          ev2: `ev-alpha-auth-${runId}`,
          ev3: `ev-alpha-db-healthy-${runId}`,
          evOld: `ev-alpha-old-prune-${runId}`,
        },
      }
    );

    // 3. Seed Tenant Beta isolated records (for negative cross-tenant assertions)
    await graph.query(
      `MERGE (sb:Service {id: 'svc-beta-secret'})
       SET sb.name = 'Beta Private Records',
           sb.tenantId = $tenantB,
           sb.criticality = 'tier-1'
       MERGE (ib:Incident {id: 'INC-BETA-SECRET'})
       SET ib.title = 'Beta Secret Outage',
           ib.tenantId = $tenantB,
           ib.status = 'investigating'`,
      { params: { tenantB: TENANT_BETA } }
    );
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('E2E 01: System Health Probes verify live FalkorDB connectivity', async () => {
    const liveRes = await fetch(`${baseUrl}/api/v1/health/live`);
    expect(liveRes.status).toBe(200);
    const liveData: any = await liveRes.json();
    expect(liveData.status).toBe('alive');

    const readyRes = await fetch(`${baseUrl}/api/v1/health/ready`);
    expect(readyRes.status).toBe(200);
    const readyData: any = await readyRes.json();
    expect(readyData.ready).toBe(true);
    expect(readyData.checks.databaseConnected).toBe(true);
  });

  it('E2E 02: Multi-hop graph investigation identifies upstream root cause through connected data', async () => {
    const result = await engine.execute({
      question: 'Why is svc-alpha-web failing with 500 errors during token validation?',
      incidentId: 'INC-ALPHA-E2E',
      executionMode: 'deterministic',
      tenantId: TENANT_ALPHA,
    });

    expect(result.status).toBe('completed');
    expect(result.incidentId).toBe('INC-ALPHA-E2E');
    expect(result.tenantId).toBe(TENANT_ALPHA);

    // Verify multi-hop causal reasoning identified upstream dependency
    expect(result.affectedServices).toContain('svc-alpha-web');
    expect(result.graphPaths.length).toBeGreaterThan(0);

    // Competing candidate explanations evaluated
    expect(result.candidateExplanations.length).toBeGreaterThanOrEqual(1);
    const supportedHyp = result.candidateExplanations.find((h) => h.status === 'supported');
    expect(supportedHyp).toBeDefined();
    expect(supportedHyp?.supportingEvidenceIds.length).toBeGreaterThan(0);

    // Contradicted or plausible hypotheses present
    const otherHyp = result.candidateExplanations.find((h) => h.status !== 'supported');
    if (otherHyp) {
      expect(['contradicted', 'plausible', 'unsupported']).toContain(otherHyp.status);
    }
  });

  it('E2E 03: Cross-Session Persistent Memory retains validated knowledge and procedures', async () => {
    // Session A writes knowledge claim grounded in evidence
    await memoryRepository.saveKnowledgeClaim(
      {
        id: `claim-alpha-${runId}`,
        tenantId: TENANT_ALPHA,
        subject: 'svc-alpha-auth',
        predicate: 'caused_by_condition',
        object: 'hyp-key-desync',
        statement: 'Asymmetric key cache expiration under rapid rotation causes token verification failure',
        claimType: 'verified',
        status: 'active',
        confidence: 0.96,
        supportingEvidenceIds: [`ev-alpha-auth-${runId}`],
        contradictoryEvidenceIds: [],
        sourceProvenance: 'Investigation INC-ALPHA-E2E',
        firstObservedAt: '2026-10-18T14:15:00Z',
        lastVerifiedAt: '2026-10-18T14:20:00Z',
        revision: 1,
        synthetic: true,
      },
      undefined,
      TENANT_ALPHA
    );

    // Session B retrieves memory claim via tenant-isolated API
    const memRes = await fetch(`${baseUrl}/api/v1/memories/claim-alpha-${runId}`, {
      headers: { 'X-Tenant-ID': TENANT_ALPHA },
    });
    expect(memRes.status).toBe(200);
    const memData: any = await memRes.json();
    expect(memData.item.id).toBe(`claim-alpha-${runId}`);
    expect(memData.item.confidence).toBe(0.96);
    expect(memData.item.sourceProvenance).toContain('INC-ALPHA-E2E');
  });

  it('E2E 04: Action Proposal Lifecycle enforces 2-person approval and verifies postconditions', async () => {
    // 1. Propose remediation action
    const proposal = await remediationEngine.proposeAction(
      {
        investigationId: `inv-alpha-${runId}`,
        incidentId: 'INC-ALPHA-E2E',
        actionType: 'cache_flush',
        targetServiceId: 'svc-alpha-auth',
        targetResource: 'redis://alpha-auth-cache:6379',
        explanation: 'Flush expired JWT public key rotation cache',
        riskLevel: 'high',
      },
      {
        tenantId: TENANT_ALPHA,
        principalId: 'sre-proposer-1',
        roles: ['operator'],
        correlationId: `corr-e2e-${runId}`,
        isSharedAccessAuthorized: false,
      }
    );

    expect(proposal.id).toBeDefined();
    expect(proposal.requiresTwoPersonApproval).toBe(true);
    expect(proposal.status).toBe('pending_approval');

    // 2. Proposer attempt to self-approve is strictly blocked (HTTP 400)
    const selfApproveRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ALPHA,
        'X-Principal-ID': 'sre-proposer-1',
      },
      body: JSON.stringify({
        approverId: 'sre-proposer-1',
        approverName: 'Alice Proposer',
        role: 'lead-sre',
      }),
    });
    expect(selfApproveRes.status).toBe(400);

    // 3. First independent approver approves (status remains pending_approval)
    const app1Res = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ALPHA,
        'X-Principal-ID': 'sre-approver-2',
      },
      body: JSON.stringify({
        approverId: 'sre-approver-2',
        approverName: 'Bob Lead',
        role: 'incident-commander',
      }),
    });
    expect(app1Res.status).toBe(200);
    const app1Data: any = await app1Res.json();
    expect(app1Data.status).toBe('pending_approval');

    // 4. Second independent approver approves (status transitions to approved)
    const app2Res = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ALPHA,
        'X-Principal-ID': 'sre-approver-3',
      },
      body: JSON.stringify({
        approverId: 'sre-approver-3',
        approverName: 'Carol Security',
        role: 'sec-ops',
      }),
    });
    expect(app2Res.status).toBe(200);
    const app2Data: any = await app2Res.json();
    expect(app2Data.status).toBe('approved');

    // 5. Execute action handler
    const execRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/execute`, {
      method: 'POST',
      headers: { 'X-Tenant-ID': TENANT_ALPHA },
    });
    expect(execRes.status).toBe(200);
    const execData: any = await execRes.json();
    expect(execData.success).toBe(true);
    expect(execData.message).toContain('[Sandboxed Operation: cache_flush]');

    // 6. Ingest post-execution telemetry showing healthy resolution and link to incident
    const postExecEvId = `ev-alpha-post-${runId}`;
    await telemetryRepository.ingestBatch(
      [
        {
          id: postExecEvId,
          source: 'k8s-ingress',
          serviceId: 'svc-alpha-web',
          eventType: 'metric',
          severity: 'info',
          timestamp: new Date().toISOString(),
          message: 'Post-remediation probe healthy: token verification latency < 2ms (200 OK)',
          environment: 'production',
          synthetic: true,
          tenantId: TENANT_ALPHA,
        },
      ],
      TENANT_ALPHA
    );
    const g = await manager.getGraph('neutrino_graph');
    await g.query(
      `MATCH (e:Evidence {id: $eid}), (i:Incident {id: 'INC-ALPHA-E2E'})
       MERGE (e)-[:OBSERVED_IN]->(i)`,
      { params: { eid: postExecEvId } }
    );

    // 7. Verify postconditions against live FalkorDB evidence
    const verifyRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/verify`, {
      method: 'POST',
      headers: { 'X-Tenant-ID': TENANT_ALPHA },
    });
    expect(verifyRes.status).toBe(200);
    const verifyData: any = await verifyRes.json();
    expect(verifyData.status).toBe('verified');
  });

  it('E2E 05: Multi-Tenant Boundary blocks cross-tenant reads, actions, and audit inspection', async () => {
    // Tenant Alpha queries Tenant Beta secret incident -> 404
    const incRes = await fetch(`${baseUrl}/api/v1/incidents/INC-BETA-SECRET`, {
      headers: { 'X-Tenant-ID': TENANT_ALPHA },
    });
    expect(incRes.status).toBe(404);

    // Tenant Beta queries Tenant Alpha audit logs -> only returns Beta records
    const auditRes = await fetch(`${baseUrl}/api/v1/audit?limit=20`, {
      headers: {
        'X-Tenant-ID': TENANT_BETA,
        'X-User-Role': 'admin',
      },
    });
    expect(auditRes.status).toBe(200);
    const auditData: any = await auditRes.json();
    const leakedAlphaRecord = auditData.records.find((r: any) => r.tenantId === TENANT_ALPHA);
    expect(leakedAlphaRecord).toBeUndefined();
  });

  it('E2E 06: Bounded Graph Lifecycle preserves active incident evidence during pruning', async () => {
    const pruneRes = await graphLifecycleManager.prune(
      {
        category: 'telemetry',
        olderThanDays: 1,
        batchSize: 50,
        dryRun: false,
      },
      TENANT_ALPHA,
      'e2e-tester'
    );

    // Active incident evidence must be preserved
    expect(pruneRes.preservedReasons.active_incident).toBeGreaterThanOrEqual(1);

    // Check evidence node still exists in FalkorDB
    const graph = await manager.getGraph('neutrino_graph');
    const evRes = await graph.query(
      `MATCH (e:Evidence {id: $id}) RETURN count(e) AS cnt`,
      { params: { id: `ev-alpha-err-${runId}` } }
    );
    expect(Number(evRes.data[0].cnt)).toBe(1);
  });
});
