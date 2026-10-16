import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../apps/api/src/server.js';
import { seedDatabase } from '../../apps/api/src/seed.js';
import http from 'http';

describe('Integration Tests: API Endpoints', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await seedDatabase();
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    return () => {
      server.close();
    };
  });

  it('GET /api/v1/health returns healthy status and database connection info', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.database.connected).toBe(true);
    expect(data.version).toBe('0.1.0');
    expect(data.executionMode).toBe('deterministic');
  });

  it('GET /api/v1/graph/health returns live FalkorDB stats and counts', async () => {
    const res = await fetch(`${baseUrl}/api/v1/graph/health`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.connected).toBe(true);
    expect(data.nodeCount).toBeGreaterThanOrEqual(40);
    expect(data.relationshipCount).toBeGreaterThanOrEqual(45);
    expect(data.labels).toContain('Incident');
    expect(data.relationshipTypes).toContain('AFFECTS');
  });

  it('GET /api/v1/incidents lists seeded incidents', async () => {
    const res = await fetch(`${baseUrl}/api/v1/incidents`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(4);
    const inc101 = data.find((i: any) => i.id === 'INC-2026-101');
    expect(inc101).toBeDefined();
    expect(inc101.severity).toBe('SEV-1');
    expect(inc101.synthetic).toBe(true);
  });

  it('GET /api/v1/incidents/:id returns detailed context and evidence', async () => {
    const res = await fetch(`${baseUrl}/api/v1/incidents/INC-2026-101`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.incident.id).toBe('INC-2026-101');
    expect(data.affectedService.id).toBe('checkout-service');
    expect(data.owningTeam.id).toBe('team-commerce');
    expect(data.evidence.length).toBeGreaterThanOrEqual(5);
    expect(data.subgraph.nodes.length).toBeGreaterThanOrEqual(8);
  });

  it('GET /api/v1/incidents/:id returns 404 for unknown incident', async () => {
    const res = await fetch(`${baseUrl}/api/v1/incidents/UNKNOWN-999`);
    expect(res.status).toBe(404);
    const data: any = await res.json();
    expect(data.error.code).toBe('INCIDENT_NOT_FOUND');
  });

  it('GET /api/v1/incidents/:id/subgraph returns visual graph structure', async () => {
    const res = await fetch(`${baseUrl}/api/v1/incidents/INC-2026-101/subgraph`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.nodes).toBeDefined();
    expect(data.edges).toBeDefined();
    expect(data.nodes.some((n: any) => n.id === 'INC-2026-101')).toBe(true);
  });

  let createdInvId: string;

  it('POST /api/v1/investigations executes investigation workflow', async () => {
    const res = await fetch(`${baseUrl}/api/v1/investigations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Why did checkout submit fail with signature verification error?',
        incidentId: 'INC-2026-101',
        executionMode: 'deterministic',
      }),
    });

    expect(res.status).toBe(201);
    const data: any = await res.json();
    expect(data.investigationId).toBeDefined();
    createdInvId = data.investigationId;
    expect(data.status).toBe('completed');
    expect(data.summary).toContain('auth-service');
    expect(data.candidateExplanations.length).toBeGreaterThanOrEqual(3);
    expect(data.graphPaths.length).toBeGreaterThanOrEqual(1);
    expect(data.metrics.durationMs).toBeGreaterThan(0);
  });

  it('POST /api/v1/investigations returns 400 for invalid question payload', async () => {
    const res = await fetch(`${baseUrl}/api/v1/investigations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'a', // invalid length
      }),
    });

    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/investigations/:id retrieves persisted investigation', async () => {
    const res = await fetch(`${baseUrl}/api/v1/investigations/${createdInvId}`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.investigationId).toBe(createdInvId);
    expect(data.summary).toContain('auth-service');
  });

  it('GET /api/v1/investigations lists investigation history', async () => {
    const res = await fetch(`${baseUrl}/api/v1/investigations`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((inv: any) => inv.id === createdInvId)).toBe(true);
  });
});
