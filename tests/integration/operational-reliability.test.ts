import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { metricsRegistry } from '../../apps/api/src/observability/metrics.js';

describe('Stage 4 Part D: Operational Reliability & Observability Suite', () => {
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

  it('Health 01: Liveness probe GET /api/v1/health/live returns healthy process status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health/live`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.status).toBe('alive');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
  });

  it('Health 02: Readiness probe GET /api/v1/health/ready verifies FalkorDB graph connectivity and indices', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health/ready`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ready).toBe(true);
    expect(body.checks).toBeDefined();
    expect(body.checks.api).toBe(true);
    expect(body.checks.databaseConnected).toBe(true);
    expect(body.checks.graphExists).toBe(true);
    expect(body.checks.indicesReady).toBe(true);
  });

  it('Metrics 03: GET /api/v1/metrics exposes accurate operational counters and latencies', async () => {
    // Record sample operations in metricsRegistry
    metricsRegistry.recordIngestion({
      received: 20,
      persisted: 15,
      duplicates: 5,
      rejected: 0,
      durationMs: 120,
    });
    metricsRegistry.recordInvestigation({
      status: 'completed',
      durationMs: 450,
    });
    metricsRegistry.recordGraphQuery(12);

    const res = await fetch(`${baseUrl}/api/v1/metrics`);
    expect(res.status).toBe(200);
    const metrics: any = await res.json();

    expect(metrics.ingestion.persisted).toBeGreaterThanOrEqual(15);
    expect(metrics.ingestion.duplicates).toBeGreaterThanOrEqual(5);
    expect(metrics.investigations.completed).toBeGreaterThanOrEqual(1);
    expect(metrics.graph.queriesExecuted).toBeGreaterThanOrEqual(1);
    expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('Observability 04: Health endpoints never leak credentials, auth tokens, or passwords', async () => {
    const [liveRes, readyRes, metricsRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/health/live`).then((r) => r.text()),
      fetch(`${baseUrl}/api/v1/health/ready`).then((r) => r.text()),
      fetch(`${baseUrl}/api/v1/metrics`).then((r) => r.text()),
    ]);

    const forbiddenStrings = ['password', 'secret', 'private_key'];
    for (const forbidden of forbiddenStrings) {
      expect(liveRes.toLowerCase()).not.toContain(forbidden);
      expect(readyRes.toLowerCase()).not.toContain(forbidden);
      expect(metricsRes.toLowerCase()).not.toContain(forbidden);
    }
  });
});
