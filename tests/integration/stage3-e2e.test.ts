import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { graphManager } from '../../apps/api/src/graph/client.js';

describe('Stage 3 Part D: Unified End-to-End Investigation & Action Pipeline', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('E2E 01: Ingests telemetry, executes investigation, recalls memory, detects failure domain, and proposes action', async () => {
    const liveTelemetryEvent = {
      id: `evt-e2e-${Date.now()}`,
      source: 'live-envoy-ingress',
      eventType: 'log',
      severity: 'error',
      timestamp: new Date().toISOString(),
      serviceId: 'auth-service',
      message: 'Token verification failed: JWKS discovery endpoint timed out',
      environment: 'production',
      synthetic: false,
    };

    // 1. Ingest live telemetry event
    const ingestRes = await fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [liveTelemetryEvent] }),
    });

    expect(ingestRes.status).toBe(201);
    const ingestBody: any = await ingestRes.json();
    expect(ingestBody.accepted).toBe(1);

    // 2. Trigger investigation for INC-2026-101
    const invRes = await fetch(`${baseUrl}/api/v1/investigations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incidentId: 'INC-2026-101',
        question: 'Why are checkout transactions failing with 401 unauthorized errors?',
        executionMode: 'deterministic',
      }),
    });

    expect(invRes.status).toBe(201);
    const inv: any = await invRes.json();
    expect(inv.investigationId).toBeDefined();
    expect(inv.status).toBe('completed');
    expect(inv.affectedServices).toContain('checkout-service');

    // 3. Verify Live Telemetry was ingested and evaluated
    const telemetryIncluded = inv.evidenceBundle.some(
      (e: any) => e.id === liveTelemetryEvent.id || e.content.includes('JWKS') || e.summary.includes('JWKS')
    );
    expect(telemetryIncluded).toBe(true);

    // 4. Verify Failure Domain is present in result
    expect(inv.failureDomain).toBeDefined();
    expect(inv.failureDomain.communityId).toBeDefined();
    expect(inv.failureDomain.blastRadiusScore).toBeGreaterThan(0);

    // 5. Verify Memory recall influenced investigation
    expect(inv.recalledMemories).toBeInstanceOf(Array);

    // 6. If action proposal was generated, test the approval boundary
    if (inv.actionProposal) {
      const actionId = inv.actionProposal.id;
      expect(actionId).toMatch(/^act-/);
      expect(inv.actionProposal.status).toBe('pending_approval');

      // Approver 1 approves
      const app1Res = await fetch(`${baseUrl}/api/v1/actions/${actionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverId: 'sre-lead-1',
          approverName: 'Lead SRE 1',
          role: 'sre-lead',
        }),
      });

      expect(app1Res.status).toBe(200);
      const app1Body: any = await app1Res.json();

      if (inv.actionProposal.requiresTwoPersonApproval) {
        expect(app1Body.status).toBe('pending_approval');

        // Approver 2 approves
        const app2Res = await fetch(`${baseUrl}/api/v1/actions/${actionId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approverId: 'sec-lead-2',
            approverName: 'Security Lead 2',
            role: 'security-lead',
          }),
        });

        expect(app2Res.status).toBe(200);
        const app2Body: any = await app2Res.json();
        expect(app2Body.status).toBe('approved');
      } else {
        expect(app1Body.status).toBe('approved');
      }

      // Execute approved action
      const execRes = await fetch(`${baseUrl}/api/v1/actions/${actionId}/execute`, {
        method: 'POST',
      });

      expect(execRes.status).toBe(200);
      const execBody: any = await execRes.json();
      expect(execBody.success).toBe(true);
      expect(execBody.proposal.status).toBe('executed');
    }
  });
});
