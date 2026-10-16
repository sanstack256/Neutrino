import { FalkorDBManager, graphManager } from './graph/client.js';
import { GraphRepository } from './graph/repository.js';

export interface SeedSummary {
  servicesCount: number;
  teamsCount: number;
  deploymentsCount: number;
  incidentsCount: number;
  evidenceCount: number;
  relationshipsCount: number;
  graphName: string;
}

export async function seedDatabase(customManager?: FalkorDBManager, customGraphName?: string): Promise<SeedSummary> {
  const manager = customManager || graphManager;
  const graph = await manager.getGraph(customGraphName);
  const repo = new GraphRepository({ customManager: manager, graphName: customGraphName });

  console.log(`[Seed] Initializing schema indexes on graph...`);
  await repo.setupIndexes();

  console.log(`[Seed] Upserting Teams...`);
  const teams = [
    { id: 'team-commerce', name: 'Core Commerce Team', description: 'Owns user checkout, shopping cart, and order workflows.', onCallContact: '@commerce-oncall' },
    { id: 'team-identity', name: 'Identity & Security Team', description: 'Owns authentication, token lifecycle, JWKS, and authorization services.', onCallContact: '@identity-oncall' },
    { id: 'team-payments', name: 'Payments Platform Team', description: 'Owns payment gateway integrations, processor webhooks, and settlements.', onCallContact: '@payments-oncall' },
    { id: 'team-infra', name: 'Infrastructure Platform Team', description: 'Owns distributed cache clusters, database instances, and network fabrics.', onCallContact: '@infra-oncall' },
  ];

  for (const t of teams) {
    await graph.query(
      `MERGE (t:Team {id: $id})
       SET t.name = $name,
           t.description = $description,
           t.onCallContact = $onCallContact`,
      { params: t }
    );
  }

  console.log(`[Seed] Upserting Services...`);
  const services = [
    { id: 'checkout-service', name: 'Checkout Service', description: 'Web/API checkout orchestration for customer purchases', criticality: 'tier-1', environment: 'production', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2026-10-15T10:00:00Z', teamId: 'team-commerce' },
    { id: 'auth-service', name: 'Authentication & Session Service', description: 'Issue and verify JWT access tokens and public keys', criticality: 'tier-1', environment: 'production', createdAt: '2024-06-01T00:00:00Z', updatedAt: '2026-10-15T13:45:00Z', teamId: 'team-identity' },
    { id: 'payment-gateway', name: 'Payment Gateway Proxy', description: 'Handles credit card capture and third-party processor routing', criticality: 'tier-1', environment: 'production', createdAt: '2024-08-01T00:00:00Z', updatedAt: '2026-10-14T18:00:00Z', teamId: 'team-payments' },
    { id: 'cart-service', name: 'Shopping Cart Service', description: 'Active customer cart state and basket computation', criticality: 'tier-2', environment: 'production', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2026-10-15T13:30:00Z', teamId: 'team-commerce' },
    { id: 'order-service', name: 'Order Fulfillment Service', description: 'Downstream order placement and ledger record generation', criticality: 'tier-1', environment: 'production', createdAt: '2024-09-01T00:00:00Z', updatedAt: '2026-10-11T16:00:00Z', teamId: 'team-commerce' },
    { id: 'inventory-service', name: 'Inventory & Stock Service', description: 'Real-time SKU reservation and stock checks', criticality: 'tier-2', environment: 'production', createdAt: '2025-03-01T00:00:00Z', updatedAt: '2026-10-14T12:00:00Z', teamId: 'team-commerce' },
    { id: 'user-profile-service', name: 'User Profile & Preferences', description: 'Customer preferences, saved addresses, and loyalty tier', criticality: 'tier-2', environment: 'production', createdAt: '2025-01-15T00:00:00Z', updatedAt: '2026-10-13T09:00:00Z', teamId: 'team-identity' },
    { id: 'notification-service', name: 'Transactional Notification Service', description: 'Dispatches customer receipts via SMS and email', criticality: 'tier-3', environment: 'production', createdAt: '2025-04-01T00:00:00Z', updatedAt: '2026-10-12T14:00:00Z', teamId: 'team-commerce' },
    { id: 'catalog-service', name: 'Product Catalog Service', description: 'Read-heavy product details and category listings', criticality: 'tier-2', environment: 'production', createdAt: '2024-11-01T00:00:00Z', updatedAt: '2026-10-10T11:00:00Z', teamId: 'team-commerce' },
    { id: 'redis-cluster', name: 'Redis Cache Cluster', description: 'Shared in-memory cache for carts and session tokens', criticality: 'tier-1', environment: 'production', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', teamId: 'team-infra' },
    { id: 'postgres-primary', name: 'Postgres Primary Database', description: 'Relational storage for orders and catalog data', criticality: 'tier-1', environment: 'production', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', teamId: 'team-infra' },
  ];

  for (const s of services) {
    await graph.query(
      `MERGE (s:Service {id: $id})
       SET s.name = $name,
           s.description = $description,
           s.criticality = $criticality,
           s.environment = $environment,
           s.createdAt = $createdAt,
           s.updatedAt = $updatedAt
       WITH s
       MATCH (t:Team {id: $teamId})
       MERGE (s)-[:OWNED_BY]->(t)`,
      { params: s }
    );
  }

  console.log(`[Seed] Creating Service Dependencies (DEPENDS_ON)...`);
  // Multi-hop chains:
  // checkout-service -> auth-service
  // checkout-service -> payment-gateway -> auth-service (shared dependency!)
  // checkout-service -> inventory-service
  // order-service -> checkout-service
  // notification-service -> order-service
  // cart-service -> redis-cluster
  // auth-service -> redis-cluster
  // catalog-service -> postgres-primary
  // user-profile-service -> auth-service
  const serviceDependencies = [
    { from: 'checkout-service', to: 'auth-service' },
    { from: 'checkout-service', to: 'payment-gateway' },
    { from: 'payment-gateway', to: 'auth-service' }, // Shared dependency!
    { from: 'checkout-service', to: 'inventory-service' },
    { from: 'order-service', to: 'checkout-service' },
    { from: 'order-service', to: 'inventory-service' },
    { from: 'notification-service', to: 'order-service' },
    { from: 'cart-service', to: 'redis-cluster' },
    { from: 'auth-service', to: 'redis-cluster' },
    { from: 'catalog-service', to: 'postgres-primary' },
    { from: 'user-profile-service', to: 'auth-service' },
  ];

  for (const dep of serviceDependencies) {
    await graph.query(
      `MATCH (from:Service {id: $from}), (to:Service {id: $to})
       MERGE (from)-[:DEPENDS_ON]->(to)`,
      { params: dep }
    );
  }

  console.log(`[Seed] Upserting Deployments...`);
  const deployments = [
    // The causal change: auth-service v2.4.1 deployed 17m before INC-2026-101
    {
      id: 'dep-auth-2.4.1',
      serviceId: 'auth-service',
      version: 'v2.4.1',
      environment: 'production',
      deployedAt: '2026-10-15T13:45:00Z',
      status: 'succeeded',
      changeSummary: 'Reduced internal JWT signing key cache TTL to 60s; introduced key-rotation desync bug under token rotation',
      author: 'jdoe-security',
    },
    {
      id: 'dep-cart-3.1.0',
      serviceId: 'cart-service',
      version: 'v3.1.0',
      environment: 'production',
      deployedAt: '2026-10-15T13:30:00Z',
      status: 'succeeded',
      changeSummary: 'Upgraded Redis connection pool max size to 250 connections',
      author: 'alice-commerce',
    },
    {
      id: 'dep-checkout-1.12.0',
      serviceId: 'checkout-service',
      version: 'v1.12.0',
      environment: 'production',
      deployedAt: '2026-10-15T10:00:00Z',
      status: 'succeeded',
      changeSummary: 'Minor frontend asset bundle optimization for checkout modal',
      author: 'bob-commerce',
    },
    {
      id: 'dep-payment-4.0.2',
      serviceId: 'payment-gateway',
      version: 'v4.0.2',
      environment: 'production',
      deployedAt: '2026-10-14T18:00:00Z',
      status: 'succeeded',
      changeSummary: 'Stripe webhook retry exponential backoff tuning',
      author: 'charlie-payments',
    },
    {
      id: 'dep-inventory-2.0.1',
      serviceId: 'inventory-service',
      version: 'v2.0.1',
      environment: 'production',
      deployedAt: '2026-10-14T12:00:00Z',
      status: 'succeeded',
      changeSummary: 'Stock reservation pessimistic lock release patch',
      author: 'david-commerce',
    },
    {
      id: 'dep-profile-1.8.0',
      serviceId: 'user-profile-service',
      version: 'v1.8.0',
      environment: 'production',
      deployedAt: '2026-10-13T09:00:00Z',
      status: 'succeeded',
      changeSummary: 'Added support for custom user profile avatars',
      author: 'eva-identity',
    },
    {
      id: 'dep-notif-1.4.2',
      serviceId: 'notification-service',
      version: 'v1.4.2',
      environment: 'production',
      deployedAt: '2026-10-12T14:00:00Z',
      status: 'succeeded',
      changeSummary: 'SendGrid email receipt dynamic template upgrade',
      author: 'frank-commerce',
    },
    {
      id: 'dep-order-2.3.0',
      serviceId: 'order-service',
      version: 'v2.3.0',
      environment: 'production',
      deployedAt: '2026-10-11T16:00:00Z',
      status: 'succeeded',
      changeSummary: 'Batch order write throughput improvements',
      author: 'grace-commerce',
    },
    {
      id: 'dep-catalog-1.9.4',
      serviceId: 'catalog-service',
      version: 'v1.9.4',
      environment: 'production',
      deployedAt: '2026-10-10T11:00:00Z',
      status: 'succeeded',
      changeSummary: 'Elasticsearch catalog query caching',
      author: 'hank-commerce',
    },
    // Historical deployment
    {
      id: 'dep-auth-2.3.9',
      serviceId: 'auth-service',
      version: 'v2.3.9',
      environment: 'production',
      deployedAt: '2025-08-10T14:00:00Z',
      status: 'succeeded',
      changeSummary: 'Hotfix patch for INC-2025-089 JWT signing key rotation',
      author: 'jdoe-security',
    },
  ];

  for (const d of deployments) {
    await graph.query(
      `MERGE (d:Deployment {id: $id})
       SET d.serviceId = $serviceId,
           d.version = $version,
           d.environment = $environment,
           d.deployedAt = $deployedAt,
           d.status = $status,
           d.changeSummary = $changeSummary,
           d.author = $author
       WITH d
       MATCH (s:Service {id: $serviceId})
       MERGE (s)-[:HAS_DEPLOYMENT]->(d)`,
      { params: d }
    );
  }

  console.log(`[Seed] Upserting Incidents...`);
  const incidents = [
    // Primary incident with multi-hop ground truth
    {
      id: 'INC-2026-101',
      title: 'Elevated 500 error rate in checkout flow during token validation',
      description: 'Checkout submit endpoint failing with 500 status codes for 14.8% of user transactions. Authentication signature verification errors reported.',
      severity: 'SEV-1',
      status: 'investigating',
      startedAt: '2026-10-15T14:02:00Z',
      resolvedAt: null,
      environment: 'production',
      synthetic: true,
      affectedServiceId: 'checkout-service',
    },
    // Incomplete evidence scenario
    {
      id: 'INC-2026-088',
      title: 'Cart checkout latency degradation',
      description: 'Customer cart load latencies increased by 400ms. Telemetry is currently incomplete for Redis slowlog.',
      severity: 'SEV-3',
      status: 'investigating',
      startedAt: '2026-10-14T09:15:00Z',
      resolvedAt: null,
      environment: 'production',
      synthetic: true,
      affectedServiceId: 'cart-service',
    },
    // Resolved third-party incident
    {
      id: 'INC-2026-042',
      title: 'Payment gateway processor webhook timeouts',
      description: 'Intermittent 504 Gateway Timeout receiving external Stripe webhook callbacks.',
      severity: 'SEV-2',
      status: 'resolved',
      startedAt: '2026-10-13T16:20:00Z',
      resolvedAt: '2026-10-13T17:45:00Z',
      environment: 'production',
      synthetic: true,
      affectedServiceId: 'payment-gateway',
    },
    // Historical related incident
    {
      id: 'INC-2025-089',
      title: 'Historical: Auth token cache desync during key rotation',
      description: 'Auth service key rotation caused signature verification failures across checkout and payment gateways.',
      severity: 'SEV-1',
      status: 'resolved',
      startedAt: '2025-08-10T13:45:00Z',
      resolvedAt: '2025-08-10T15:20:00Z',
      environment: 'production',
      synthetic: true,
      affectedServiceId: 'auth-service',
    },
  ];

  for (const inc of incidents) {
    await graph.query(
      `MERGE (i:Incident {id: $id})
       SET i.title = $title,
           i.description = $description,
           i.severity = $severity,
           i.status = $status,
           i.startedAt = $startedAt,
           i.resolvedAt = $resolvedAt,
           i.environment = $environment,
           i.synthetic = $synthetic
       WITH i
       MATCH (s:Service {id: $affectedServiceId})
       MERGE (i)-[:AFFECTS]->(s)`,
      { params: inc }
    );
  }

  // Connect historical incident relationship
  await graph.query(
    `MATCH (i1:Incident {id: 'INC-2026-101'}), (i2:Incident {id: 'INC-2025-089'})
     MERGE (i1)-[:RELATED_TO]->(i2)`
  );

  console.log(`[Seed] Upserting Evidence Records...`);
  const evidenceRecords = [
    // Evidence for INC-2026-101 (Primary scenario)
    {
      id: 'EV-101-01',
      incidentId: 'INC-2026-101',
      sourceType: 'log',
      sourceRecordId: 'log-checkout-001',
      observedAt: '2026-10-15T14:03:12Z',
      ingestedAt: '2026-10-15T14:03:15Z',
      summary: 'Checkout server logged AuthTokenVerificationError: Signature verification failed from auth-service:8081',
      content: '{"timestamp":"2026-10-15T14:03:12.184Z","level":"ERROR","service":"checkout-service","caller":"auth_client.go:88","error":"AuthTokenVerificationError: Signature verification failed from auth-service:8081; keyId=k-2026-b not found in local cache","traceId":"tr-889104"}',
      contentHash: 'hash-ev-101-01',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
    {
      id: 'EV-101-02',
      incidentId: 'INC-2026-101',
      sourceType: 'alert',
      sourceRecordId: 'alert-checkout-500',
      observedAt: '2026-10-15T14:02:30Z',
      ingestedAt: '2026-10-15T14:02:35Z',
      summary: 'PagerDuty SEV-1 Alert: Checkout 500 error rate exceeded 5% threshold (current: 14.8%)',
      content: 'Alert rule: checkout_http_5xx_rate > 0.05 for 2m. Current value: 0.148. Fired on checkout-service-prod.',
      contentHash: 'hash-ev-101-02',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
    {
      id: 'EV-101-03',
      incidentId: 'INC-2026-101',
      sourceType: 'metric',
      sourceRecordId: 'apm-error-rate',
      observedAt: '2026-10-15T14:02:00Z',
      ingestedAt: '2026-10-15T14:02:10Z',
      summary: 'APM metric showing sudden spike in HTTP 500 responses starting at 14:02:00Z',
      content: 'checkout-service /v1/checkout/submit status=500 rate jumped from 0.02% to 14.8% at 14:02 UTC.',
      contentHash: 'hash-ev-101-03',
      synthetic: true,
      reliabilityClass: 'high',
    },
    {
      id: 'EV-101-04',
      incidentId: 'INC-2026-101',
      sourceType: 'log',
      sourceRecordId: 'log-auth-002',
      observedAt: '2026-10-15T14:01:45Z',
      ingestedAt: '2026-10-15T14:01:50Z',
      summary: 'Auth-service reported KeyRotationWarning: Asymmetric key ID k-2026-b not found in local cache',
      content: '{"timestamp":"2026-10-15T14:01:45.021Z","level":"WARN","service":"auth-service","msg":"KeyRotationWarning: Asymmetric key ID k-2026-b not found in local cache; falling back to remote endpoint"}',
      contentHash: 'hash-ev-101-04',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
    // Contradictory evidence: Contradicts Database bottleneck hypothesis
    {
      id: 'EV-101-05',
      incidentId: 'INC-2026-101',
      sourceType: 'metric',
      sourceRecordId: 'db-perf-metric-01',
      observedAt: '2026-10-15T14:05:00Z',
      ingestedAt: '2026-10-15T14:05:10Z',
      summary: 'Postgres primary database latency metric remained healthy (< 2ms) and pool active connections 42/500',
      content: '{"service":"postgres-primary","p99_latency_ms":1.9,"active_connections":42,"max_connections":500,"status":"healthy"}',
      contentHash: 'hash-ev-101-05',
      synthetic: true,
      reliabilityClass: 'high',
    },
    // Contradictory evidence: Contradicts Redis pool exhaustion hypothesis
    {
      id: 'EV-101-06',
      incidentId: 'INC-2026-101',
      sourceType: 'metric',
      sourceRecordId: 'redis-perf-metric-02',
      observedAt: '2026-10-15T14:04:00Z',
      ingestedAt: '2026-10-15T14:04:10Z',
      summary: 'Redis cache latency measured steady at 1.8ms with CPU utilization under 5%',
      content: '{"cluster":"redis-cluster","p99_latency_ms":1.8,"cpu_percent":4.2,"connected_clients":118,"evicted_keys":0}',
      contentHash: 'hash-ev-101-06',
      synthetic: true,
      reliabilityClass: 'high',
    },
    // Evidence connecting upstream deployment
    {
      id: 'EV-101-07',
      incidentId: 'INC-2026-101',
      sourceType: 'deployment',
      sourceRecordId: 'dep-auth-2.4.1',
      observedAt: '2026-10-15T13:45:00Z',
      ingestedAt: '2026-10-15T13:45:30Z',
      summary: 'Deployment record for auth-service v2.4.1 completed 17 minutes prior to error onset',
      content: 'auth-service deployment v2.4.1 finished rollout at 13:45:00Z. Commit msg: Reduced internal JWT signing key cache TTL to 60s; introduced key-rotation desync bug under token rotation',
      contentHash: 'hash-ev-101-07',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
    // Historical precedent evidence
    {
      id: 'EV-101-08',
      incidentId: 'INC-2026-101',
      sourceType: 'postmortem',
      sourceRecordId: 'postmortem-inc-2025-089',
      observedAt: '2025-08-11T10:00:00Z',
      ingestedAt: '2026-10-15T14:00:00Z',
      summary: 'Postmortem INC-2025-089: Key rotation desync resolved by flushing JWKS cache and reverting key TTL config',
      content: 'Root cause was local key cache eviction desync during key rotation on auth-service. Remediation: Flush local cache or rollback auth-service version.',
      contentHash: 'hash-ev-101-08',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },

    // Evidence for INC-2026-088 (Incomplete evidence scenario)
    {
      id: 'EV-088-01',
      incidentId: 'INC-2026-088',
      sourceType: 'alert',
      sourceRecordId: 'alert-cart-latency',
      observedAt: '2026-10-14T09:15:30Z',
      ingestedAt: '2026-10-14T09:15:40Z',
      summary: 'Cart latency alert fired: P99 latency exceeded 800ms',
      content: 'Cart service response time degraded to 920ms.',
      contentHash: 'hash-ev-088-01',
      synthetic: true,
      reliabilityClass: 'observational',
    },
    {
      id: 'EV-088-02',
      incidentId: 'INC-2026-088',
      sourceType: 'log',
      sourceRecordId: 'log-cart-slow',
      observedAt: '2026-10-14T09:20:00Z',
      ingestedAt: '2026-10-14T09:20:10Z',
      summary: 'Client-side timeouts logged on cart item retrieval',
      content: 'Cart lookup took 1100ms for user 99120.',
      contentHash: 'hash-ev-088-02',
      synthetic: true,
      reliabilityClass: 'observational',
    },

    // Evidence for INC-2026-042 (Resolved Stripe webhook incident)
    {
      id: 'EV-042-01',
      incidentId: 'INC-2026-042',
      sourceType: 'alert',
      sourceRecordId: 'alert-stripe-504',
      observedAt: '2026-10-13T16:21:00Z',
      ingestedAt: '2026-10-13T16:21:05Z',
      summary: 'External Stripe webhook callback gateway timeout',
      content: 'Stripe webhook delivery failure rate 12% due to external upstream transit delay.',
      contentHash: 'hash-ev-042-01',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
    {
      id: 'EV-042-02',
      incidentId: 'INC-2026-042',
      sourceType: 'status_page',
      sourceRecordId: 'stripe-status-incident',
      observedAt: '2026-10-13T16:30:00Z',
      ingestedAt: '2026-10-13T16:35:00Z',
      summary: 'Stripe status page confirmed API degradation in US-East webhook dispatcher',
      content: 'Stripe degraded performance notice on outbound webhook deliveries.',
      contentHash: 'hash-ev-042-02',
      synthetic: true,
      reliabilityClass: 'authoritative',
    },
  ];

  for (const ev of evidenceRecords) {
    await graph.query(
      `MERGE (e:Evidence {id: $id})
       SET e.sourceType = $sourceType,
           e.sourceRecordId = $sourceRecordId,
           e.observedAt = $observedAt,
           e.ingestedAt = $ingestedAt,
           e.summary = $summary,
           e.content = $content,
           e.contentHash = $contentHash,
           e.synthetic = $synthetic,
           e.reliabilityClass = $reliabilityClass
       WITH e
       MATCH (i:Incident {id: $incidentId})
       MERGE (e)-[:OBSERVED_IN]->(i)`,
      { params: ev }
    );
  }

  const counts = await repo.getGraphCounts();
  console.log(`[Seed] Graph seeding complete! Current counts:`, counts);

  return {
    servicesCount: services.length,
    teamsCount: teams.length,
    deploymentsCount: deployments.length,
    incidentsCount: incidents.length,
    evidenceCount: evidenceRecords.length,
    relationshipsCount: counts.relationshipCount,
    graphName: customGraphName || 'neutrino_graph',
  };
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then((summary) => {
      console.log('Seed summary:', JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
