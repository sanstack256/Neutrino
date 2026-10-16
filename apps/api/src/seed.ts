import { FalkorDBManager, graphManager } from './graph/client.js';
import { GraphRepository } from './graph/repository.js';

export interface SeedSummary {
  servicesCount: number;
  teamsCount: number;
  deploymentsCount: number;
  incidentsCount: number;
  evidenceCount: number;
  sourceRecordsCount: number;
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

  console.log(`[Seed] Upserting Source Records...`);
  const sourceRecords = [
    { id: 'src-apm-datadog', sourceType: 'apm', externalId: 'datadog-monitors-prod', uri: 'https://apm.internal.net/monitors', observedAt: '2026-10-15T00:00:00Z', contentHash: 'h-src-apm', synthetic: true },
    { id: 'src-pagerduty', sourceType: 'alert_manager', externalId: 'pagerduty-service-alerts', uri: 'https://pagerduty.internal.net/services', observedAt: '2026-10-15T00:00:00Z', contentHash: 'h-src-pd', synthetic: true },
    { id: 'src-k8s-logs', sourceType: 'log_aggregator', externalId: 'k8s-fluentbit-prod-us-east', uri: 'https://logs.internal.net/k8s', observedAt: '2026-10-15T00:00:00Z', contentHash: 'h-src-logs', synthetic: true },
    { id: 'src-github-releases', sourceType: 'ci_cd', externalId: 'github-deploy-workflows', uri: 'https://github.internal.net/releases', observedAt: '2026-10-15T00:00:00Z', contentHash: 'h-src-gh', synthetic: true },
    { id: 'src-postmortems', sourceType: 'knowledge_base', externalId: 'internal-postmortems-wiki', uri: 'https://wiki.internal.net/postmortems', observedAt: '2025-08-11T00:00:00Z', contentHash: 'h-src-pm', synthetic: true },
    { id: 'src-external-status', sourceType: 'status_page', externalId: 'stripe-status-feed', uri: 'https://status.stripe.com', observedAt: '2026-10-13T00:00:00Z', contentHash: 'h-src-ext', synthetic: true },
  ];

  for (const sr of sourceRecords) {
    await graph.query(
      `MERGE (sr:SourceRecord {id: $id})
       SET sr.sourceType = $sourceType,
           sr.externalId = $externalId,
           sr.uri = $uri,
           sr.observedAt = $observedAt,
           sr.contentHash = $contentHash,
           sr.synthetic = $synthetic`,
      { params: sr }
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

  await graph.query(
    `MATCH (i1:Incident {id: 'INC-2026-101'}), (i2:Incident {id: 'INC-2025-089'})
     MERGE (i1)-[:RELATED_TO]->(i2)`
  );

  console.log(`[Seed] Upserting Expanded Evidence Records (Target: 25-40 records)...`);
  const evidenceRecords = [
    // -------------------------------------------------------------
    // INC-2026-101 (Primary Scenario: Multi-Hop Checkout Failure)
    // -------------------------------------------------------------
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
      sourceRef: 'src-k8s-logs',
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
      sourceRef: 'src-pagerduty',
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
      sourceRef: 'src-apm-datadog',
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
      sourceRef: 'src-k8s-logs',
    },
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
      sourceRef: 'src-apm-datadog',
    },
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
      sourceRef: 'src-apm-datadog',
    },
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
      sourceRef: 'src-github-releases',
    },
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
      sourceRef: 'src-postmortems',
    },
    {
      id: 'EV-101-09',
      incidentId: 'INC-2026-101',
      sourceType: 'trace',
      sourceRecordId: 'trace-checkout-auth-01',
      observedAt: '2026-10-15T14:03:12Z',
      ingestedAt: '2026-10-15T14:03:14Z',
      summary: 'Distributed trace span tr-889104: checkout-service -> auth-service /v1/tokens/verify failed with HTTP 500',
      content: '{"traceId":"tr-889104","spanId":"sp-01","parentSpanId":"sp-root","service":"checkout-service","remoteService":"auth-service","http_status":500,"duration_ms":38.2,"error":"AuthTokenVerificationError"}',
      contentHash: 'hash-ev-101-09',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-apm-datadog',
    },
    {
      id: 'EV-101-10',
      incidentId: 'INC-2026-101',
      sourceType: 'log',
      sourceRecordId: 'k8s-pod-auth-event',
      observedAt: '2026-10-15T13:46:10Z',
      ingestedAt: '2026-10-15T13:46:15Z',
      summary: 'Kubernetes Pod Lifecycle: auth-service-pod-99b restarted following rollout of image v2.4.1',
      content: '{"pod":"auth-service-pod-99b","event":"Started","container":"auth-service","image":"auth-service:v2.4.1","node":"worker-pool-3"}',
      contentHash: 'hash-ev-101-10',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-k8s-logs',
    },
    {
      id: 'EV-101-11',
      incidentId: 'INC-2026-101',
      sourceType: 'metric',
      sourceRecordId: 'checkout-cpu-stale-01',
      observedAt: '2026-10-12T08:00:00Z', // STALE: 3 days prior to incident!
      ingestedAt: '2026-10-12T08:00:10Z',
      summary: 'Checkout service CPU utilization was 45% during routine morning batch (Stale baseline telemetry)',
      content: '{"service":"checkout-service","cpu_percent":45.1,"memory_mb":512,"timestamp":"2026-10-12T08:00:00Z"}',
      contentHash: 'hash-ev-101-11',
      synthetic: true,
      reliabilityClass: 'observational',
      sourceRef: 'src-apm-datadog',
    },
    {
      id: 'EV-101-12',
      incidentId: 'INC-2026-101',
      sourceType: 'log',
      sourceRecordId: 'envoy-gateway-checkout-502',
      observedAt: '2026-10-15T14:02:15Z',
      ingestedAt: '2026-10-15T14:02:20Z',
      summary: 'Edge Envoy proxy logged upstream 500 error from checkout-service on /v1/checkout/submit',
      content: '{"proxy":"envoy-edge-01","path":"/v1/checkout/submit","upstream_cluster":"checkout_service_cluster","response_code":500,"response_flags":"-"}',
      contentHash: 'hash-ev-101-12',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-k8s-logs',
    },

    // -------------------------------------------------------------
    // INC-2026-088 (Cart Latency Degradation — Incomplete Evidence)
    // -------------------------------------------------------------
    {
      id: 'EV-088-01',
      incidentId: 'INC-2026-088',
      sourceType: 'alert',
      sourceRecordId: 'alert-cart-latency',
      observedAt: '2026-10-14T09:15:30Z',
      ingestedAt: '2026-10-14T09:15:40Z',
      summary: 'Cart latency alert fired: P99 latency exceeded 800ms (measured 920ms)',
      content: 'Cart service response time degraded to 920ms on endpoint /v1/cart/items.',
      contentHash: 'hash-ev-088-01',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-pagerduty',
    },
    {
      id: 'EV-088-02',
      incidentId: 'INC-2026-088',
      sourceType: 'log',
      sourceRecordId: 'log-cart-slow',
      observedAt: '2026-10-14T09:20:00Z',
      ingestedAt: '2026-10-14T09:20:10Z',
      summary: 'Client-side timeouts logged on customer cart item retrieval',
      content: 'Cart lookup took 1100ms for user 99120; connection wait queue exceeded 50ms.',
      contentHash: 'hash-ev-088-02',
      synthetic: true,
      reliabilityClass: 'observational',
      sourceRef: 'src-k8s-logs',
    },
    {
      id: 'EV-088-03',
      incidentId: 'INC-2026-088',
      sourceType: 'metric',
      sourceRecordId: 'redis-cart-pool-active',
      observedAt: '2026-10-14T09:18:00Z',
      ingestedAt: '2026-10-14T09:18:10Z',
      summary: 'Redis client pool metric: Active connections at 248/250 approaching hard pool saturation limit',
      content: '{"service":"cart-service","pool":"redis-pool","active":248,"max":250,"pending_wait_ms":120}',
      contentHash: 'hash-ev-088-03',
      synthetic: true,
      reliabilityClass: 'high',
      sourceRef: 'src-apm-datadog',
    },
    {
      id: 'EV-088-04',
      incidentId: 'INC-2026-088',
      sourceType: 'metric',
      sourceRecordId: 'cart-gc-pause',
      observedAt: '2026-10-14T09:19:00Z',
      ingestedAt: '2026-10-14T09:19:05Z',
      summary: 'NodeJS Garbage Collection metric on cart-service: P99 pause 12ms (healthy, contradicts memory leak)',
      content: '{"service":"cart-service","gc_pause_p99_ms":12.1,"heap_used_mb":340,"heap_total_mb":512}',
      contentHash: 'hash-ev-088-04',
      synthetic: true,
      reliabilityClass: 'high',
      sourceRef: 'src-apm-datadog',
    },
    {
      id: 'EV-088-05',
      incidentId: 'INC-2026-088',
      sourceType: 'deployment',
      sourceRecordId: 'dep-cart-3.1.0',
      observedAt: '2026-10-14T08:30:00Z',
      ingestedAt: '2026-10-14T08:30:20Z',
      summary: 'Deployment of cart-service v3.1.0 occurred 45 minutes prior to latency alert',
      content: 'cart-service deployment v3.1.0: Upgraded Redis connection pool max size to 250 connections',
      contentHash: 'hash-ev-088-05',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-github-releases',
    },
    {
      id: 'EV-088-06',
      incidentId: 'INC-2026-088',
      sourceType: 'metric',
      sourceRecordId: 'redis-cpu-healthy',
      observedAt: '2026-10-14T09:22:00Z',
      ingestedAt: '2026-10-14T09:22:10Z',
      summary: 'Redis instance CPU utilization remained low at 6.1% during the cart latency degradation window',
      content: '{"cluster":"redis-cluster","cpu_percent":6.1,"memory_used_pct":38.2,"status":"healthy"}',
      contentHash: 'hash-ev-088-06',
      synthetic: true,
      reliabilityClass: 'high',
      sourceRef: 'src-apm-datadog',
    },

    // -------------------------------------------------------------
    // INC-2026-042 (Payment Gateway Third-Party Webhook Timeout)
    // -------------------------------------------------------------
    {
      id: 'EV-042-01',
      incidentId: 'INC-2026-042',
      sourceType: 'alert',
      sourceRecordId: 'alert-stripe-504',
      observedAt: '2026-10-13T16:21:00Z',
      ingestedAt: '2026-10-13T16:21:05Z',
      summary: 'External Stripe webhook callback gateway timeout: HTTP 504 on endpoint /webhooks/stripe',
      content: 'Stripe webhook delivery failure rate 12% due to external upstream transit delay.',
      contentHash: 'hash-ev-042-01',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-pagerduty',
    },
    {
      id: 'EV-042-02',
      incidentId: 'INC-2026-042',
      sourceType: 'status_page',
      sourceRecordId: 'stripe-status-incident',
      observedAt: '2026-10-13T16:30:00Z',
      ingestedAt: '2026-10-13T16:35:00Z',
      summary: 'Stripe status page confirmed API degradation in US-East webhook dispatcher',
      content: 'Stripe degraded performance notice on outbound webhook deliveries in us-east region.',
      contentHash: 'hash-ev-042-02',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-external-status',
    },
    {
      id: 'EV-042-03',
      incidentId: 'INC-2026-042',
      sourceType: 'metric',
      sourceRecordId: 'payment-egress-latency',
      observedAt: '2026-10-13T16:25:00Z',
      ingestedAt: '2026-10-13T16:25:10Z',
      summary: 'Payment gateway outbound TLS connection latency to api.stripe.com spiked from 45ms to 5200ms',
      content: '{"target":"api.stripe.com","p99_handshake_ms":5210,"connect_timeout_count":84}',
      contentHash: 'hash-ev-042-03',
      synthetic: true,
      reliabilityClass: 'high',
      sourceRef: 'src-apm-datadog',
    },
    {
      id: 'EV-042-04',
      incidentId: 'INC-2026-042',
      sourceType: 'status_page',
      sourceRecordId: 'stripe-status-resolved',
      observedAt: '2026-10-13T17:40:00Z',
      ingestedAt: '2026-10-13T17:41:00Z',
      summary: 'Stripe status page updated: Webhook dispatcher transit route fully restored',
      content: 'All webhook deliveries processing normally with backlogged events drained.',
      contentHash: 'hash-ev-042-04',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-external-status',
    },
    {
      id: 'EV-042-05',
      incidentId: 'INC-2026-042',
      sourceType: 'metric',
      sourceRecordId: 'payment-error-rate-resolved',
      observedAt: '2026-10-13T17:45:00Z',
      ingestedAt: '2026-10-13T17:45:10Z',
      summary: 'Payment gateway webhook error rate normalized back to 0.01%',
      content: '{"service":"payment-gateway","5xx_rate":0.0001,"status":"healthy"}',
      contentHash: 'hash-ev-042-05',
      synthetic: true,
      reliabilityClass: 'high',
      sourceRef: 'src-apm-datadog',
    },

    // -------------------------------------------------------------
    // INC-2025-089 (Historical: Auth Token Cache Desync Runbook)
    // -------------------------------------------------------------
    {
      id: 'EV-089-01',
      incidentId: 'INC-2025-089',
      sourceType: 'log',
      sourceRecordId: 'hist-auth-log-01',
      observedAt: '2025-08-10T13:48:00Z',
      ingestedAt: '2025-08-10T13:48:10Z',
      summary: 'Historical log: KeyRotationException during asymmetric key roll',
      content: '{"level":"ERROR","service":"auth-service","caller":"keys.go:42","msg":"KeyRotationException: Verification key mismatch"}',
      contentHash: 'hash-ev-089-01',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-k8s-logs',
    },
    {
      id: 'EV-089-02',
      incidentId: 'INC-2025-089',
      sourceType: 'alert',
      sourceRecordId: 'hist-alert-auth-rate',
      observedAt: '2025-08-10T13:46:00Z',
      ingestedAt: '2025-08-10T13:46:05Z',
      summary: 'Historical alert: Auth service token validation error rate exceeded 20%',
      content: 'SEV-1 fired: auth-service token_validation_error_rate > 0.20.',
      contentHash: 'hash-ev-089-02',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-pagerduty',
    },
    {
      id: 'EV-089-03',
      incidentId: 'INC-2025-089',
      sourceType: 'deployment',
      sourceRecordId: 'dep-auth-2.3.9',
      observedAt: '2025-08-10T14:00:00Z',
      ingestedAt: '2025-08-10T14:00:15Z',
      summary: 'Historical deployment: auth-service v2.3.9 hotfix patch rolled out to resolve key desync',
      content: 'auth-service deployment v2.3.9: Hotfix patch for INC-2025-089 JWT signing key rotation',
      contentHash: 'hash-ev-089-03',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-github-releases',
    },
    {
      id: 'EV-089-04',
      incidentId: 'INC-2025-089',
      sourceType: 'postmortem',
      sourceRecordId: 'runbook-auth-key-flush',
      observedAt: '2025-08-10T15:00:00Z',
      ingestedAt: '2025-08-10T15:05:00Z',
      summary: 'Standard Runbook: JWKS public key cache invalidation protocol',
      content: 'RUNBOOK RB-AUTH-04: To force-flush stale JWKS verification cache, send POST /v1/admin/flush-key-cache or execute rolling pod restart.',
      contentHash: 'hash-ev-089-04',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-postmortems',
    },
    {
      id: 'EV-089-05',
      incidentId: 'INC-2025-089',
      sourceType: 'postmortem',
      sourceRecordId: 'hist-postmortem-signoff',
      observedAt: '2025-08-11T12:00:00Z',
      ingestedAt: '2025-08-11T12:05:00Z',
      summary: 'Postmortem INC-2025-089 officially approved by Security & Platform teams',
      content: 'Resolution confirmed: key cache desync prevented by increasing minimum key rotation grace period to 4 hours.',
      contentHash: 'hash-ev-089-05',
      synthetic: true,
      reliabilityClass: 'authoritative',
      sourceRef: 'src-postmortems',
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
       MERGE (e)-[:OBSERVED_IN]->(i)
       WITH e
       MATCH (sr:SourceRecord {id: $sourceRef})
       MERGE (e)-[:REFERENCES]->(sr)`,
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
    sourceRecordsCount: sourceRecords.length,
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
