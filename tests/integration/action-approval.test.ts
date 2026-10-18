import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { graphManager } from '../../apps/api/src/graph/client.js';
import { remediationEngine } from '../../apps/api/src/remediation/engine.js';

describe('Stage 3 Part C: Safe Remediation & Approval-Gated Actions Test Suite', () => {
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

  it('Action 01: Proposes a safe remediation action with pending_approval status', async () => {
    const payload = {
      investigationId: 'inv-test-approval-1',
      incidentId: 'INC-2026-101',
      procedureId: 'proc-jwks-rotation-sync',
      actionType: 'jwks_sync',
      targetServiceId: 'auth-service',
      targetResource: 'auth-service/jwks-cache',
      parameters: { forceRefresh: true },
      explanation: 'Synchronize public keys from Keycloak IdP endpoint to resolve JWT validation errors',
      riskLevel: 'medium',
    };

    const res = await fetch(`${baseUrl}/api/v1/actions/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.id).toMatch(/^act-/);
    expect(body.status).toBe('pending_approval');
    expect(body.requiresTwoPersonApproval).toBe(true);
    expect(body.preconditions.length).toBeGreaterThan(0);
    expect(body.expectedPostconditions.length).toBeGreaterThan(0);
  });

  it('Action 02: Blocks execution of unapproved actions (Safety Gate C)', async () => {
    // Create fresh proposal
    const proposal = await remediationEngine.proposeAction({
      investigationId: 'inv-test-unapproved',
      incidentId: 'INC-2026-101',
      actionType: 'cache_flush',
      targetServiceId: 'checkout-service',
      targetResource: 'redis-cart-cache',
      explanation: 'Flush corrupt cart session keys',
      riskLevel: 'medium',
    });

    // Attempt direct execution without approvals -> must fail
    const res = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/execute`, {
      method: 'POST',
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error.code).toBe('EXECUTION_ERROR');
    expect(body.error.message).toContain('pending_approval');
  });

  it('Action 03: Enforces two-person approval boundary for medium/high-risk actions', async () => {
    const proposal = await remediationEngine.proposeAction({
      investigationId: 'inv-test-twoperson',
      incidentId: 'INC-2026-101',
      actionType: 'jwks_sync',
      targetServiceId: 'auth-service',
      targetResource: 'auth-service/jwks-cache',
      explanation: 'Rotate JWKS public keys',
      riskLevel: 'medium',
    });

    // Approver 1 approves
    const res1 = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approverId: 'sre-alice',
        approverName: 'Alice SRE',
        role: 'on-call-sre',
      }),
    });

    expect(res1.status).toBe(200);
    const body1: any = await res1.json();
    expect(body1.status).toBe('pending_approval');
    expect(body1.approvals.length).toBe(1);

    // Approver 1 attempts to approve again (replay attack) -> must reject
    const resReplay = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approverId: 'sre-alice',
        approverName: 'Alice SRE',
        role: 'on-call-sre',
      }),
    });

    expect(resReplay.status).toBe(400);
    const bodyReplay: any = await resReplay.json();
    expect(bodyReplay.error.message).toContain('already approved');

    // Approver 2 (distinct actor) approves
    const res2 = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approverId: 'lead-bob',
        approverName: 'Bob Lead',
        role: 'engineering-lead',
      }),
    });

    expect(res2.status).toBe(200);
    const body2: any = await res2.json();
    expect(body2.status).toBe('approved');
    expect(body2.approvals.length).toBe(2);
  });

  it('Action 04: Executes approved action via allowlisted handler and records sanitized output', async () => {
    const proposal = await remediationEngine.proposeAction({
      investigationId: 'inv-test-exec',
      incidentId: 'INC-2026-101',
      actionType: 'cache_flush',
      targetServiceId: 'inventory-service',
      targetResource: 'inventory-service/cache',
      explanation: 'Clear cached stock levels',
      riskLevel: 'low', // low risk only needs 1 approval
    });

    // 1 approval for low risk
    const appRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approverId: 'sre-charlie',
        approverName: 'Charlie SRE',
        role: 'on-call-sre',
      }),
    });
    expect(appRes.status).toBe(200);

    // Execute
    const execRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/execute`, {
      method: 'POST',
    });

    expect(execRes.status).toBe(200);
    const execBody: any = await execRes.json();
    expect(execBody.success).toBe(true);
    expect(execBody.proposal.status).toBe('executed');
    expect(execBody.proposal.executedAt).toBeDefined();
    expect(execBody.proposal.executionResult.status).toBe('success');
  });

  it('Action 05: Postcondition verification checks FalkorDB for corroborating evidence', async () => {
    // Propose low-risk probe
    const proposal = await remediationEngine.proposeAction({
      investigationId: 'inv-test-verify',
      incidentId: 'INC-2026-101',
      actionType: 'diagnostic_probe',
      targetServiceId: 'auth-service',
      targetResource: 'auth-service/healthz',
      explanation: 'Check auth service health endpoint',
      riskLevel: 'low',
    });

    await remediationEngine.approveAction(proposal.id, {
      approverId: 'sre-charlie',
      approverName: 'Charlie SRE',
      role: 'on-call-sre',
    });

    await remediationEngine.executeAction(proposal.id);

    // Verify postconditions
    const verifyRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/verify`, {
      method: 'POST',
    });

    expect(verifyRes.status).toBe(200);
    const verifyBody: any = await verifyRes.json();
    expect(['verified', 'unverified']).toContain(verifyBody.status);
    expect(verifyBody.verificationNotes).toBeDefined();
  });

  it('Action 06: Rejection lifecycle terminates proposal and prevents subsequent execution', async () => {
    const proposal = await remediationEngine.proposeAction({
      investigationId: 'inv-test-reject',
      incidentId: 'INC-2026-101',
      actionType: 'pod_restart',
      targetServiceId: 'checkout-service',
      targetResource: 'pod/checkout-service-7f4c9',
      explanation: 'Restart container',
      riskLevel: 'high',
    });

    // Reject proposal
    const rejectRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: 'manager-dan',
        reason: 'Peak traffic hour, pod restart too disruptive right now',
      }),
    });

    expect(rejectRes.status).toBe(200);
    const rejectBody: any = await rejectRes.json();
    expect(rejectBody.status).toBe('rejected');
    expect(rejectBody.rejectedBy.reason).toContain('Peak traffic hour');

    // Attempt execution of rejected proposal -> must fail
    const execRes = await fetch(`${baseUrl}/api/v1/actions/${proposal.id}/execute`, {
      method: 'POST',
    });

    expect(execRes.status).toBe(400);
    const execBody: any = await execRes.json();
    expect(execBody.error.message).toContain('rejected');
  });
});
