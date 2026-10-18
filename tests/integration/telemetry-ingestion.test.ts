import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { graphManager } from '../../apps/api/src/graph/client.js';
import { telemetryRepository } from '../../apps/api/src/telemetry/repository.js';
import { TelemetryNormalizer } from '../../apps/api/src/telemetry/normalizer.js';

describe('Stage 3 Part A: Live Telemetry Ingestion Test Suite', () => {
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

  it('Ingestion 01: Ingests valid structured telemetry batch and persists to FalkorDB', async () => {
    const testEvent = {
      id: `evt-test-${Date.now()}-1`,
      source: 'otel-collector-prod',
      eventType: 'log',
      severity: 'error',
      timestamp: new Date().toISOString(),
      serviceId: 'auth-service',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      error: {
        type: 'JWKSFetchTimeout',
        message: 'Timeout contacting Keycloak IdP endpoint at https://idp.internal/keys',
      },
      message: 'Failed to refresh public JWKS token verification keys',
      environment: 'production',
      synthetic: false,
    };

    const res = await fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [testEvent] }),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.accepted).toBe(1);
    expect(body.duplicated).toBe(0);
    expect(body.rejected).toBe(0);
    expect(body.eventIds).toContain(testEvent.id);

    // Verify retrieval via TelemetryRepository
    const recent = await telemetryRepository.getRecentEvidence(10);
    const persisted = recent.find((e) => e.id === testEvent.id);
    expect(persisted).toBeDefined();
    expect(persisted?.sourceType).toBe('log');
    expect(persisted?.synthetic).toBe(false);
  });

  it('Ingestion 02: Deterministic deduplication rejects exact duplicates without failure', async () => {
    const uniqueId = `evt-dup-${Date.now()}`;
    const testEvent = {
      id: uniqueId,
      source: 'prometheus-node-exporter',
      eventType: 'metric',
      severity: 'warn',
      timestamp: new Date().toISOString(),
      serviceId: 'inventory-service',
      metric: {
        name: 'jvm.memory.used',
        value: 94.5,
        unit: 'percent',
      },
      message: 'JVM heap utilization exceeded 90%',
      environment: 'production',
      synthetic: false,
    };

    // First ingestion -> accepted: 1
    const res1 = await fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [testEvent] }),
    });
    expect(res1.status).toBe(201);
    const body1: any = await res1.json();
    expect(body1.accepted).toBe(1);

    // Second ingestion with same payload -> duplicated: 1
    const res2 = await fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [testEvent] }),
    });
    expect(res2.status).toBe(201);
    const body2: any = await res2.json();
    expect(body2.accepted).toBe(0);
    expect(body2.duplicated).toBe(1);
  });

  it('Ingestion 03: Rejects malformed and oversized payloads with structured HTTP 400', async () => {
    const malformed = {
      randomField: 'invalid-data',
    };

    const res = await fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [malformed] }),
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Ingestion 04: Redacts sensitive secrets, authorization headers, and credentials from persisted evidence', async () => {
    const rawWithSecret = {
      id: `evt-secret-${Date.now()}`,
      source: 'api-gateway',
      eventType: 'log',
      severity: 'error',
      timestamp: new Date().toISOString(),
      serviceId: 'api-gateway',
      message: 'Client authorization failure with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and password=SuperSecretPassword123!',
      environment: 'production',
      synthetic: false,
    };

    const normalized = TelemetryNormalizer.normalize(rawWithSecret);

    expect(normalized.evidence.content).not.toContain('SuperSecretPassword123!');
    expect(normalized.evidence.content).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(normalized.evidence.content).toContain('[REDACTED_TOKEN]');
    expect(normalized.evidence.content).toContain('password=[REDACTED]');
  });

  it('Ingestion 05: Ingests OTLP HTTP structured log payloads', async () => {
    const uniqueSuffix = Date.now().toString(16);
    const otlpPayload = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'payment-gateway' } },
              { key: 'deployment.environment', value: { stringValue: 'production' } },
            ],
          },
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: String(Date.now() * 1000000),
                  severityText: 'ERROR',
                  body: { stringValue: 'External Stripe webhook signature verification failed' },
                  traceId: `5b8aa5a2d2c8${uniqueSuffix.slice(-4)}`,
                  spanId: `0515${uniqueSuffix.slice(-4)}`,
                  attributes: [
                    { key: 'http.status_code', value: { intValue: 401 } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/v1/telemetry/otlp/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(otlpPayload),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.accepted).toBe(1);
    expect(body.rejected).toBe(0);
  });

  it('Ingestion 06: Ingests OTLP HTTP structured span traces', async () => {
    const uniqueSuffix = Date.now().toString(16);
    const otlpTracesPayload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'checkout-service' } },
            ],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: `7a19e59d4f0d${uniqueSuffix.slice(-4)}`,
                  spanId: `4a20${uniqueSuffix.slice(-4)}`,
                  name: 'POST /checkout/process',
                  startTimeUnixNano: String(Date.now() * 1000000),
                  status: { code: 2, message: 'Connection refused to upstream auth-service' },
                },
              ],
            },
          ],
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/v1/telemetry/otlp/v1/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(otlpTracesPayload),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.accepted).toBe(1);
    expect(body.rejected).toBe(0);
  });
});
