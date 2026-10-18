import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { auditRepository } from '../../apps/api/src/audit/repository.js';
import { remediationEngine } from '../../apps/api/src/remediation/engine.js';
import { FalkorDBManager } from '../../apps/api/src/graph/client.js';

describe('Stage 4 Part E: Accessible Audit Trails & Action Safety Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  const manager = new FalkorDBManager();
  const runId = Date.now();
  const TENANT_A = `tenant-audit-a-${runId}`;
  const TENANT_B = `tenant-audit-b-${runId}`;

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

    // Create target service and incident for action tests
    await graph.query(
      `MERGE (s:Service {id: 'svc-audit-target-${runId}'})
       SET s.name = 'Audit Test Service',
           s.tenantId = $tenantA,
           s.criticality = 'tier-1',
           s.environment = 'production'
       MERGE (i:Incident {id: 'INC-AUDIT-${runId}'})
       SET i.title = 'Audit Incident',
           i.tenantId = $tenantA,
           i.status = 'investigating',
           i.severity = 'SEV-1',
           i.startedAt = '2026-10-18T12:00:00Z',
           i.synthetic = true
       MERGE (i)-[:AFFECTS]->(s)`,
      { params: { tenantA: TENANT_A } }
    );
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('Audit 01: Audit records are durably persisted in FalkorDB with tenantId and principalId', async () => {
    const record = await auditRepository.log({
      tenantId: TENANT_A,
      principalId: 'sre-alice',
      action: 'action_proposed',
      resourceType: 'action_proposal',
      resourceId: `prop-audit-${runId}`,
      status: 'success',
      details: { risk: 'high', target: `svc-audit-target-${runId}` },
    });

    expect(record.id).toBeDefined();
    expect(record.tenantId).toBe(TENANT_A);
    expect(record.principalId).toBe('sre-alice');

    // Verify presence directly in FalkorDB
    const graph = await manager.getGraph('neutrino_graph');
    const res = await graph.query(
      `MATCH (a:AuditRecord {id: $id}) RETURN a.action AS action, a.principalId AS principal`,
      { params: { id: record.id } }
    );
    expect(res.data[0].action).toBe('action_proposed');
    expect(res.data[0].principal).toBe('sre-alice');
  });

  it('Audit 02: GET /api/v1/audit strictly isolates audit logs between tenants', async () => {
    // Log an event for Tenant B
    await auditRepository.log({
      tenantId: TENANT_B,
      principalId: 'sre-bob',
      action: 'action_approved',
      resourceType: 'action_proposal',
      resourceId: `prop-audit-b-${runId}`,
      status: 'success',
    });

    // Query audit records as Tenant A
    const resA = await fetch(`${baseUrl}/api/v1/audit?limit=50`, {
      headers: {
        'X-Tenant-ID': TENANT_A,
        'X-User-Role': 'admin',
      },
    });
    expect(resA.status).toBe(200);
    const bodyA: any = await resA.json();

    // Must find Tenant A's record but NEVER Tenant B's record
    const hasTenantARecord = bodyA.records.some((r: any) => r.principalId === 'sre-alice');
    const hasTenantBRecord = bodyA.records.some((r: any) => r.principalId === 'sre-bob');

    expect(hasTenantARecord).toBe(true);
    expect(hasTenantBRecord).toBe(false);
  });

  it('Audit 03: Proposer cannot approve their own action proposal (2-person rule)', async () => {
    const proposal = await remediationEngine.proposeAction(
      {
        investigationId: `inv-audit-${runId}`,
        incidentId: `INC-AUDIT-${runId}`,
        actionType: 'pod_restart',
        targetServiceId: `svc-audit-target-${runId}`,
        targetResource: 'k8s://production/svc-audit-target',
        explanation: 'Restart service pods to recover from memory leak',
        riskLevel: 'high',
      },
      {
        tenantId: TENANT_A,
        principalId: 'sre-carol',
        roles: ['operator'],
        correlationId: `corr-propose-${runId}`,
        isSharedAccessAuthorized: false,
      }
    );

    expect(proposal.id).toBeDefined();

    // sre-carol tries to approve their own proposal
    const approveRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_A,
        'X-Principal-ID': 'sre-carol',
      },
      body: JSON.stringify({
        approverId: 'sre-carol',
        approverName: 'Carol SRE',
        role: 'sre-lead',
      }),
    });

    expect(approveRes.status).toBe(400);
    const errorBody: any = await approveRes.json();
    expect(errorBody.error.code).toBe('PROPOSER_CANNOT_APPROVE');
  });

  it('Audit 04: Independent approver can approve and audit trail records both events', async () => {
    const proposal = await remediationEngine.proposeAction(
      {
        investigationId: `inv-audit-2-${runId}`,
        incidentId: `INC-AUDIT-${runId}`,
        actionType: 'cache_flush',
        targetServiceId: `svc-audit-target-${runId}`,
        targetResource: 'redis://production/svc-audit-target',
        explanation: 'Flush stale cache keys',
        riskLevel: 'medium',
      },
      {
        tenantId: TENANT_A,
        principalId: 'sre-dave',
        roles: ['operator'],
        correlationId: `corr-prop-dave-${runId}`,
        isSharedAccessAuthorized: false,
      }
    );

    // Independent approver sre-elena approves
    const approveRes1 = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_A,
        'X-Principal-ID': 'sre-elena',
      },
      body: JSON.stringify({
        approverId: 'sre-elena',
        approverName: 'Elena Lead',
        role: 'incident-commander',
      }),
    });

    expect(approveRes1.status).toBe(200);
    const body1: any = await approveRes1.json();
    // 1st approval of medium risk leaves it in pending_approval
    expect(body1.status).toBe('pending_approval');
    expect(body1.approvals[0].approverId).toBe('sre-elena');

    // Second independent approver sre-frank approves
    const approveRes2 = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_A,
        'X-Principal-ID': 'sre-frank',
      },
      body: JSON.stringify({
        approverId: 'sre-frank',
        approverName: 'Frank SRE',
        role: 'sec-ops',
      }),
    });

    expect(approveRes2.status).toBe(200);
    const body2: any = await approveRes2.json();
    expect(body2.status).toBe('approved');
    expect(body2.approvals).toHaveLength(2);

    // Verify audit logs contain both proposal and approval
    const auditRes = await fetch(`${baseUrl}/api/v1/audit?limit=20`, {
      headers: {
        'X-Tenant-ID': TENANT_A,
        'X-User-Role': 'admin',
      },
    });
    const auditData: any = await auditRes.json();
    const actionsLogged = auditData.records.map((r: any) => r.action);
    expect(actionsLogged).toContain('action_proposed');
    expect(actionsLogged).toContain('action_approved');
  });
});
