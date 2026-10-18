import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { graphRepository } from '../../apps/api/src/graph/repository.js';
import { memoryRepository } from '../../apps/api/src/memory/repository.js';
import { remediationEngine } from '../../apps/api/src/remediation/engine.js';
import { FalkorDBManager } from '../../apps/api/src/graph/client.js';

describe('Stage 4 Part A: Tenant Isolation and Access Control Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  const manager = new FalkorDBManager();
  const TENANT_A = 'tenant-alpha-finance';
  const TENANT_B = 'tenant-beta-health';

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

    // Create Tenant A isolated service and incident
    await graph.query(
      `MERGE (s:Service {id: 'svc-alpha-ledger'})
       SET s.name = 'Alpha Ledger Service',
           s.tenantId = $tenantA,
           s.criticality = 'tier-1',
           s.environment = 'production'
       MERGE (i:Incident {id: 'INC-ALPHA-001'})
       SET i.title = 'Alpha Ledger Outage',
           i.tenantId = $tenantA,
           i.severity = 'SEV-1',
           i.status = 'investigating',
           i.startedAt = '2026-10-18T10:00:00Z',
           i.synthetic = true
       MERGE (i)-[:AFFECTS]->(s)
       MERGE (e:Evidence {id: 'EV-ALPHA-001'})
       SET e.tenantId = $tenantA,
           e.summary = 'Alpha confidential financial ledger corruption',
           e.content = 'Database checksum failure on alpha ledger account tables',
           e.sourceType = 'log',
           e.sourceRecordId = 'ledger-db',
           e.observedAt = '2026-10-18T10:01:00Z',
           e.ingestedAt = '2026-10-18T10:01:05Z',
           e.contentHash = 'hash-alpha-secret-001',
           e.reliabilityClass = 'high'
       MERGE (e)-[:OBSERVED_IN]->(i)`,
      { params: { tenantA: TENANT_A } }
    );

    // Create Tenant B isolated service and incident
    await graph.query(
      `MERGE (s:Service {id: 'svc-beta-records'})
       SET s.name = 'Beta Patient Records',
           s.tenantId = $tenantB,
           s.criticality = 'tier-1',
           s.environment = 'production'
       MERGE (i:Incident {id: 'INC-BETA-002'})
       SET i.title = 'Beta Records EHR Latency',
           i.tenantId = $tenantB,
           i.severity = 'SEV-2',
           i.status = 'investigating',
           i.startedAt = '2026-10-18T11:00:00Z',
           i.synthetic = true
       MERGE (i)-[:AFFECTS]->(s)
       MERGE (e:Evidence {id: 'EV-BETA-002'})
       SET e.tenantId = $tenantB,
           e.summary = 'Beta confidential medical patient record latency spike',
           e.content = 'Patient EHR lookup response time > 5000ms',
           e.sourceType = 'metric',
           e.sourceRecordId = 'ehr-gateway',
           e.observedAt = '2026-10-18T11:01:00Z',
           e.ingestedAt = '2026-10-18T11:01:05Z',
           e.contentHash = 'hash-beta-secret-002',
           e.reliabilityClass = 'high'
       MERGE (e)-[:OBSERVED_IN]->(i)`,
      { params: { tenantB: TENANT_B } }
    );

    // Create private memory for Tenant A
    await memoryRepository.saveKnowledgeClaim(
      {
        id: 'claim-alpha-private',
        tenantId: TENANT_A,
        subject: 'svc-alpha-ledger',
        predicate: 'caused_by_condition',
        object: 'hyp-alpha-lock',
        statement: 'Alpha ledger deadlocks under concurrent debit reconciliation',
        claimType: 'verified',
        status: 'active',
        confidence: 0.98,
        supportingEvidenceIds: ['EV-ALPHA-001'],
        contradictoryEvidenceIds: [],
        sourceProvenance: 'Investigation INV-ALPHA-CONFIDENTIAL',
        firstObservedAt: '2026-10-18T10:00:00Z',
        lastVerifiedAt: '2026-10-18T10:05:00Z',
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

  it('Isolation 01: Tenant B cannot retrieve Tenant A incident by ID', async () => {
    // Tenant B queries Tenant A incident
    const res = await fetch(`${baseUrl}/api/v1/incidents/INC-ALPHA-001`, {
      headers: { 'X-Tenant-ID': TENANT_B },
    });

    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.error.code).toBe('INCIDENT_NOT_FOUND');
  });

  it('Isolation 02: Tenant A can retrieve its own incident successfully', async () => {
    const res = await fetch(`${baseUrl}/api/v1/incidents/INC-ALPHA-001`, {
      headers: { 'X-Tenant-ID': TENANT_A },
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.incident.id).toBe('INC-ALPHA-001');
    expect(body.incident.title).toBe('Alpha Ledger Outage');
    expect(body.affectedService.id).toBe('svc-alpha-ledger');
  });

  it('Isolation 03: Tenant B cannot access Tenant A private evidence via recent telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/v1/telemetry/recent?limit=50`, {
      headers: { 'X-Tenant-ID': TENANT_B },
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    const alphaEvidence = body.evidence.find((e: any) => e.id === 'EV-ALPHA-001');
    expect(alphaEvidence).toBeUndefined();
  });

  it('Isolation 04: Tenant B cannot retrieve Tenant A private knowledge memory claim', async () => {
    const res = await fetch(`${baseUrl}/api/v1/memories/claim-alpha-private`, {
      headers: { 'X-Tenant-ID': TENANT_B },
    });

    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.error.code).toBe('MEMORY_NOT_FOUND');
  });

  it('Isolation 05: Tenant A can access its own private knowledge memory claim', async () => {
    const res = await fetch(`${baseUrl}/api/v1/memories/claim-alpha-private`, {
      headers: { 'X-Tenant-ID': TENANT_A },
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.item.id).toBe('claim-alpha-private');
    expect(body.item.statement).toContain('Alpha ledger deadlocks');
  });

  it('Isolation 06: Cross-tenant dependency traversal is strictly blocked in FalkorDB', async () => {
    // Add a forbidden cross-tenant edge (simulating multi-tenant shared graph)
    const graph = await manager.getGraph('neutrino_graph');
    await graph.query(
      `MATCH (a:Service {id: 'svc-alpha-ledger'}), (b:Service {id: 'svc-beta-records'})
       MERGE (a)-[:DEPENDS_ON]->(b)`
    );

    // Tenant A traverses its service dependencies
    const depsForA = await graphRepository.getServiceDependencies('svc-alpha-ledger', 3, TENANT_A);

    // Tenant B's service should NOT be returned because it belongs to Tenant B and is not shared
    const leakedService = depsForA.find((d) => d.service.id === 'svc-beta-records');
    expect(leakedService).toBeUndefined();
  });

  it('Isolation 07: Tenant B cannot approve or execute an action proposed by Tenant A', async () => {
    // Propose an action for Tenant A
    const proposal = await remediationEngine.proposeAction(
      {
        investigationId: 'inv-alpha-test',
        incidentId: 'INC-ALPHA-001',
        actionType: 'cache_flush',
        targetServiceId: 'svc-alpha-ledger',
        targetResource: 'redis://alpha-cache:6379',
        explanation: 'Flush corrupt debit ledger key cache',
        riskLevel: 'medium',
      },
      {
        tenantId: TENANT_A,
        principalId: 'operator-alpha-1',
        roles: ['operator'],
        correlationId: 'test-corr-alpha',
        isSharedAccessAuthorized: false,
      }
    );

    expect(proposal.id).toBeDefined();

    // Tenant B attempts to approve Tenant A proposal
    const approveRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_B,
      },
      body: JSON.stringify({
        approverId: 'operator-beta-intruder',
        approverName: 'Mallory Malicious',
        role: 'lead-sre',
      }),
    });

    expect(approveRes.status).toBe(404); // Blocked: not found in Tenant B's context

    // Tenant B attempts to execute Tenant A proposal
    const execRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/execute`, {
      method: 'POST',
      headers: { 'X-Tenant-ID': TENANT_B },
    });

    expect(execRes.status).toBe(404);
  });

  it('Isolation 08: Invalid or malicious tenant identifiers fail with HTTP 400', async () => {
    const maliciousTenantId = "tenant-hack'; DROP GRAPH neutrino_graph;--";
    const res = await fetch(`${baseUrl}/api/v1/incidents`, {
      headers: { 'X-Tenant-ID': maliciousTenantId },
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error.code).toBe('INVALID_TENANT_ID');
  });
});
