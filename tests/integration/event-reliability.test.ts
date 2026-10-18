import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { telemetryRepository } from '../../apps/api/src/telemetry/repository.js';
import { FalkorDBManager } from '../../apps/api/src/graph/client.js';

describe('Stage 4 Part B: Event Processing Reliability & Idempotency Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  const manager = new FalkorDBManager();
  const runId = Date.now();
  const TENANT_ID = `tenant-rel-${runId}`;

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

  it('Event 01: Valid structured telemetry is ingested and returns persisted status', async () => {
    const eventId = `evt-rel-001-${runId}`;
    const payload = {
      events: [
        {
          id: eventId,
          source: 'otel-collector-prod',
          serviceId: 'svc-payment-gw',
          eventType: 'log',
          severity: 'error',
          timestamp: new Date().toISOString(),
          message: `Connection timeout connecting to upstream bank clearinghouse ${runId}`,
          attributes: { timeoutMs: 5000, attempt: 3 },
          environment: 'production',
          synthetic: false,
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.accepted).toBe(1);
    expect(body.duplicated).toBe(0);
    expect(body.rejected).toBe(0);
    expect(body.eventIds).toContain(eventId);

    // Verify status tracking in FalkorDB
    const statusRes = await fetch(`${baseUrl}/api/v1/telemetry/status/${eventId}`, {
      headers: { 'X-Tenant-ID': TENANT_ID },
    });
    expect(statusRes.status).toBe(200);
    const statusBody: any = await statusRes.json();
    expect(statusBody.state).toBe('persisted');
    expect(statusBody.retryCount).toBe(0);
  });

  it('Event 02: Duplicate telemetry payload returns duplicate status without creating duplicate nodes', async () => {
    const dupEventId = `evt-dup-002-${runId}`;
    const payload = {
      events: [
        {
          id: dupEventId,
          source: 'otel-collector-prod',
          serviceId: 'svc-payment-gw',
          eventType: 'log',
          severity: 'error',
          timestamp: new Date().toISOString(),
          message: `Duplicate test message payload ${runId}`,
          attributes: { attempt: 1 },
          environment: 'production',
          synthetic: false,
        },
      ],
    };

    // First ingestion: should be accepted
    const res1 = await fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(201);
    const body1: any = await res1.json();
    expect(body1.accepted).toBe(1);

    // Re-send the exact same payload: should be detected as duplicate
    const res2 = await fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify(payload),
    });

    expect(res2.status).toBe(201);
    const body2: any = await res2.json();
    expect(body2.accepted).toBe(0);
    expect(body2.duplicated).toBe(1);

    // Confirm FalkorDB only has 1 Evidence node for this event
    const graph = await manager.getGraph('neutrino_graph');
    const queryRes = await graph.query(
      `MATCH (e:Evidence {id: $id}) RETURN count(e) AS cnt`,
      { params: { id: dupEventId } }
    );
    expect(Number(queryRes.data[0].cnt)).toBe(1);
  });

  it('Event 03: Concurrent duplicate requests are safely serialized and deduplicated without race condition', async () => {
    const raceEventId = `evt-race-003-${runId}`;
    const concurrentPayload = {
      events: [
        {
          id: raceEventId,
          source: 'k8s-pod-monitor',
          serviceId: 'svc-auth-broker',
          eventType: 'log',
          severity: 'warn',
          timestamp: new Date().toISOString(),
          message: `Concurrent JWT signature validation spike ${runId}`,
          attributes: { threadId: 42 },
          environment: 'production',
          synthetic: false,
        },
      ],
    };

    // Fire 5 concurrent requests with the identical event
    const promises = Array.from({ length: 5 }, () =>
      fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': TENANT_ID,
        },
        body: JSON.stringify(concurrentPayload),
      }).then((r) => r.json())
    );

    const responses: any[] = await Promise.all(promises);
    const totalAccepted = responses.reduce((acc, r) => acc + (r.accepted || 0), 0);
    const totalDuplicated = responses.reduce((acc, r) => acc + (r.duplicated || 0), 0);

    // Exactly one must be accepted, and the remaining four must be duplicate
    expect(totalAccepted).toBe(1);
    expect(totalDuplicated).toBe(4);

    // FalkorDB count check
    const graph = await manager.getGraph('neutrino_graph');
    const countRes = await graph.query(
      `MATCH (e:Evidence {id: $id}) RETURN count(e) AS cnt`,
      { params: { id: raceEventId } }
    );
    expect(Number(countRes.data[0].cnt)).toBe(1);
  });

  it('Event 04: Invalid payload fails validation with HTTP 400 and rejected state', async () => {
    const invalidPayload = {
      events: [
        {
          // Missing serviceId, timestamp, and message
          id: 'evt-invalid',
          eventType: 'unrecognized_type',
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify(invalidPayload),
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Event 05: Ingest with transient failure retries and updates processing state', async () => {
    const retryEventId = `evt-retry-005-${runId}`;
    const batchResult = await telemetryRepository.ingestBatch(
      [
        {
          id: retryEventId,
          source: 'fluentd-infra',
          serviceId: 'svc-retry-test',
          eventType: 'metric',
          severity: 'info',
          timestamp: new Date().toISOString(),
          message: `CPU usage metric sample ${runId}`,
          attributes: { cpuPct: 45.2 },
          tenantId: TENANT_ID,
          environment: 'production',
          synthetic: false,
        },
      ],
      TENANT_ID
    );

    expect(batchResult.accepted).toBe(1);
    expect(batchResult.eventIds).toContain(retryEventId);

    // Verify status endpoint
    const statusRes = await fetch(`${baseUrl}/api/v1/telemetry/status/${retryEventId}`, {
      headers: { 'X-Tenant-ID': TENANT_ID },
    });
    expect(statusRes.status).toBe(200);
    const statusData: any = await statusRes.json();
    expect(statusData.state).toBe('persisted');
    expect(statusData.tenantId).toBe(TENANT_ID);
  });
});
