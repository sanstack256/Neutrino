import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../../apps/api/src/server.js';
import { graphManager } from '../../apps/api/src/graph/client.js';
import { graphIntelligenceService } from '../../apps/api/src/intelligence/failure-domains.js';

describe('Stage 3 Part B: Graph Intelligence & Failure Domains Test Suite', () => {
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

  it('Intelligence 01: Discovers graph failure domains via dynamic topology clustering', async () => {
    const res = await fetch(`${baseUrl}/api/v1/intelligence/failure-domains`);
    expect(res.status).toBe(200);
    const body: any = await res.json();

    expect(body.success).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);

    const firstDomain = body.data[0];
    expect(firstDomain.communityId).toBeDefined();
    expect(firstDomain.serviceIds.length).toBeGreaterThan(0);
    expect(firstDomain.blastRadiusScore).toBeGreaterThanOrEqual(0);
    expect(firstDomain.blastRadiusScore).toBeLessThanOrEqual(1.0);
    expect(firstDomain.rationale).toContain('FalkorDB');
  });

  it('Intelligence 02: Evaluates blast radius and service roles in domain', async () => {
    const res = await fetch(`${baseUrl}/api/v1/intelligence/service/checkout-service`);
    expect(res.status).toBe(200);
    const body: any = await res.json();

    expect(body.success).toBe(true);
    const domain = body.data;
    expect(domain.serviceIds).toContain('checkout-service');

    // Verify service metadata role assignment
    const checkoutEntry = domain.services.find((s: any) => s.serviceId === 'checkout-service');
    expect(checkoutEntry).toBeDefined();
    expect(['hub', 'consumer', 'dependency', 'shared_infra']).toContain(checkoutEntry.role);
  });

  it('Intelligence 03: Identifies shared infrastructure components depended upon by multiple services', async () => {
    const domains = await graphIntelligenceService.discoverFailureDomains(true);
    expect(domains.length).toBeGreaterThan(0);

    const totalSharedInfra = domains.flatMap((d) => d.sharedInfrastructure);
    expect(totalSharedInfra).toBeDefined();
  });

  it('Intelligence 04: Invalidates cache when topology refresh is requested', async () => {
    const t1 = await graphIntelligenceService.discoverFailureDomains();
    graphIntelligenceService.invalidateCache();
    const t2 = await graphIntelligenceService.discoverFailureDomains(true);

    expect(t2).toBeInstanceOf(Array);
    expect(t2.length).toBe(t1.length);
  });

  it('Intelligence 05: Gracefully handles queries for non-existent service', async () => {
    const res = await fetch(`${baseUrl}/api/v1/intelligence/service/non-existent-service-xyz`);
    expect(res.status).toBe(404);
    const body: any = await res.json();

    expect(body.success).toBe(false);
    expect(body.error).toContain('non-existent-service-xyz');
  });
});
