import { z } from 'zod';

// ==========================================
// 1. Core Graph Domain Entities & Schemas
// ==========================================

export const CriticalityEnum = z.enum(['tier-1', 'tier-2', 'tier-3', 'low', 'medium', 'high', 'critical']);
export type Criticality = z.infer<typeof CriticalityEnum>;

export const ServiceSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  name: z.string().min(1),
  description: z.string(),
  criticality: CriticalityEnum,
  environment: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const DeploymentStatusEnum = z.enum(['succeeded', 'failed', 'in-progress', 'rolled-back']);
export type DeploymentStatus = z.infer<typeof DeploymentStatusEnum>;

export const DeploymentSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  serviceId: z.string().min(1),
  version: z.string().min(1),
  environment: z.string(),
  deployedAt: z.string(),
  status: DeploymentStatusEnum,
  changeSummary: z.string(),
  author: z.string().optional(),
});
export type Deployment = z.infer<typeof DeploymentSchema>;

export const IncidentSeverityEnum = z.enum(['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4']);
export type IncidentSeverity = z.infer<typeof IncidentSeverityEnum>;

export const IncidentStatusEnum = z.enum(['investigating', 'identified', 'monitoring', 'resolved']);
export type IncidentStatus = z.infer<typeof IncidentStatusEnum>;

export const IncidentSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  title: z.string().min(1),
  description: z.string(),
  severity: IncidentSeverityEnum,
  status: IncidentStatusEnum,
  startedAt: z.string(),
  resolvedAt: z.string().nullable().optional(),
  environment: z.string(),
  synthetic: z.boolean().default(true),
});
export type Incident = z.infer<typeof IncidentSchema>;

export const ReliabilityClassEnum = z.enum(['authoritative', 'high', 'medium', 'observational']);
export type ReliabilityClass = z.infer<typeof ReliabilityClassEnum>;

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  sourceType: z.string(),
  sourceRecordId: z.string(),
  observedAt: z.string(),
  ingestedAt: z.string(),
  summary: z.string(),
  content: z.string(),
  contentHash: z.string(),
  synthetic: z.boolean().default(true),
  reliabilityClass: ReliabilityClassEnum,
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  name: z.string().min(1),
  description: z.string(),
  onCallContact: z.string().optional(),
});
export type Team = z.infer<typeof TeamSchema>;

export const HypothesisStatusEnum = z.enum(['candidate', 'supported', 'contradicted', 'unresolved']);
export type HypothesisStatus = z.infer<typeof HypothesisStatusEnum>;

export const HypothesisSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  incidentId: z.string().min(1),
  statement: z.string().min(1),
  status: HypothesisStatusEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const SourceRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  sourceType: z.string(),
  externalId: z.string(),
  uri: z.string().optional(),
  observedAt: z.string(),
  contentHash: z.string(),
  synthetic: z.boolean().default(true),
});
export type SourceRecord = z.infer<typeof SourceRecordSchema>;

// ==========================================
// 1b. Stage 2 Graph Memory Entities & Schemas
// ==========================================

export const MemoryStatusEnum = z.enum(['candidate', 'active', 'superseded', 'invalidated', 'archived']);
export type MemoryStatus = z.infer<typeof MemoryStatusEnum>;

export const ClaimTypeEnum = z.enum(['observed', 'inferred', 'verified']);
export type ClaimType = z.infer<typeof ClaimTypeEnum>;

export const MemoryTypeEnum = z.enum(['episodic', 'semantic', 'procedural']);
export type MemoryType = z.infer<typeof MemoryTypeEnum>;

export const MemoryEpisodeSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  investigationId: z.string().min(1),
  incidentId: z.string().nullable().optional(),
  summary: z.string().min(1),
  outcome: z.string(),
  status: MemoryStatusEnum.default('active'),
  serviceIds: z.array(z.string()).default([]),
  deploymentIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  graphPaths: z.array(z.string()).default([]),
  hypothesesEvaluated: z.array(z.string()).default([]),
  supportedHypotheses: z.array(z.string()).default([]),
  contradictedHypotheses: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  synthetic: z.boolean().default(true),
});
export type MemoryEpisode = z.infer<typeof MemoryEpisodeSchema>;

export const KnowledgeClaimSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  statement: z.string().min(1),
  claimType: ClaimTypeEnum.default('observed'),
  status: MemoryStatusEnum.default('active'),
  confidence: z.number().min(0).max(1).default(1.0),
  supportingEvidenceIds: z.array(z.string()).default([]),
  contradictoryEvidenceIds: z.array(z.string()).default([]),
  sourceProvenance: z.string(),
  firstObservedAt: z.string(),
  lastVerifiedAt: z.string(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  revision: z.number().int().default(1),
  supersededById: z.string().optional(),
  invalidationReason: z.string().optional(),
  synthetic: z.boolean().default(true),
});
export type KnowledgeClaim = z.infer<typeof KnowledgeClaimSchema>;

export const DiagnosticProcedureSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().default('tenant-default'),
  name: z.string().min(1),
  purpose: z.string().min(1),
  serviceId: z.string().min(1),
  preconditions: z.array(z.string()).default([]),
  requiredEvidenceTypes: z.array(z.string()).default([]),
  diagnosticSteps: z.array(z.string()).default([]),
  expectedObservations: z.array(z.string()).default([]),
  supportingConditions: z.array(z.string()).default([]),
  contradictingConditions: z.array(z.string()).default([]),
  knownFailureModes: z.array(z.string()).default([]),
  status: MemoryStatusEnum.default('active'),
  validationCriteria: z.string(),
  version: z.number().int().default(1),
  lastValidatedAt: z.string(),
  synthetic: z.boolean().default(true),
});
export type DiagnosticProcedure = z.infer<typeof DiagnosticProcedureSchema>;

export const RecalledMemoryRecordSchema = z.object({
  memoryId: z.string(),
  memoryType: MemoryTypeEnum,
  statement: z.string(),
  relevanceScore: z.number(),
  retrievalReason: z.string(),
  status: MemoryStatusEnum,
  influence: z.enum([
    'prioritized_hypothesis',
    'guided_traversal',
    'suggested_procedure',
    'rejected_by_evidence',
    'inconclusive',
  ]),
  currentEvidenceCorroboration: z.array(z.string()).default([]),
  currentEvidenceContradiction: z.array(z.string()).default([]),
});
export type RecalledMemoryRecord = z.infer<typeof RecalledMemoryRecordSchema>;

export const InvestigationEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  phase: z.string(),
  action: z.string(),
  details: z.record(z.any()).default({}),
  durationMs: z.number().optional(),
});
export type InvestigationEvent = z.infer<typeof InvestigationEventSchema>;

// ==========================================
// 2. Graph Node & Relationship Definitions
// ==========================================

export const RelationshipTypes = [
  'DEPENDS_ON',
  'HAS_DEPLOYMENT',
  'AFFECTS',
  'OWNED_BY',
  'OBSERVED_IN',
  'SUPPORTED_BY',
  'CONTRADICTED_BY',
  'INVESTIGATED_IN',
  'REFERENCES',
  'RELATED_TO',
  // Stage 2 Memory Relationships
  'GENERATED_EPISODE',
  'RECORDED_CLAIM',
  'RECOMMENDED_PROCEDURE',
  'CONCERNS_SERVICE',
  'CONCERNS_INCIDENT',
  'GROUNDED_IN',
  'TARGETS_SERVICE',
  'SUPERSEDES',
  // Stage 3 Telemetry, Community & Remediation Relationships
  'OBSERVED_ON',
  'IN_COMMUNITY',
  'PROPOSED_ACTION',
  'VERIFIED_BY',
  // Stage 4 Multi-Tenant & Audit Relationships
  'SHARED_WITH',
  'AUDITED_BY',
] as const;
export type RelationshipType = (typeof RelationshipTypes)[number];

export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  type: RelationshipType | string;
  properties?: Record<string, any>;
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: string[];
  description: string;
}

export interface SubgraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ==========================================
// 3. Investigation Domain Contracts
// ==========================================

export const CandidateExplanationSchema = z.object({
  id: z.string(),
  statement: z.string(),
  status: HypothesisStatusEnum,
  supportingEvidenceIds: z.array(z.string()),
  contradictoryEvidenceIds: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  graphPaths: z.array(z.string()),
  explanation: z.string(),
});
export type CandidateExplanation = z.infer<typeof CandidateExplanationSchema>;

export const InvestigationExecutionModeEnum = z.enum(['deterministic', 'llm-assisted']);
export type InvestigationExecutionMode = z.infer<typeof InvestigationExecutionModeEnum>;

export const InvestigationStatusEnum = z.enum(['started', 'analyzing', 'completed', 'insufficient-evidence', 'failed']);
export type InvestigationStatus = z.infer<typeof InvestigationStatusEnum>;

export const InvestigationRequestSchema = z.object({
  question: z.string().min(3).max(1000),
  incidentId: z.string().min(1).optional(),
  executionMode: InvestigationExecutionModeEnum.default('deterministic'),
});
export type InvestigationRequest = z.infer<typeof InvestigationRequestSchema>;

// ==========================================
// 3a. Stage 3 Telemetry Ingestion Schemas
// ==========================================

export const TelemetryEventTypeEnum = z.enum(['log', 'metric', 'alert', 'trace']);
export type TelemetryEventType = z.infer<typeof TelemetryEventTypeEnum>;

export const TelemetrySeverityEnum = z.enum(['debug', 'info', 'warn', 'error', 'critical']);
export type TelemetrySeverity = z.infer<typeof TelemetrySeverityEnum>;

export const TelemetryEventSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().optional(),
  source: z.string().min(1),
  eventType: TelemetryEventTypeEnum,
  severity: TelemetrySeverityEnum.default('info'),
  timestamp: z.string().default(() => new Date().toISOString()),
  serviceId: z.string().optional(),
  environment: z.string().default('production'),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  metricName: z.string().optional(),
  metricValue: z.number().optional(),
  metricUnit: z.string().optional(),
  summary: z.string().optional(),
  message: z.string().optional(),
  content: z.string().optional(),
  error: z.record(z.any()).optional(),
  attributes: z.record(z.any()).optional(),
  synthetic: z.boolean().default(false),
});
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

export const IngestionBatchSchema = z.object({
  events: z.array(TelemetryEventSchema).min(1).max(100),
});
export type IngestionBatch = z.infer<typeof IngestionBatchSchema>;

export const IngestionResponseSchema = z.object({
  accepted: z.number(),
  duplicated: z.number(),
  rejected: z.number(),
  eventIds: z.array(z.string()),
  errors: z.array(z.object({ index: z.number(), error: z.string() })).default([]),
});
export type IngestionResponse = z.infer<typeof IngestionResponseSchema>;

// ==========================================
// 3b. Stage 3 Graph Intelligence & Failure Domain Schemas
// ==========================================

export const FailureDomainRoleEnum = z.enum(['hub', 'consumer', 'dependency', 'shared_infra']);
export type FailureDomainRole = z.infer<typeof FailureDomainRoleEnum>;

export const ServiceFailureDomainSchema = z.object({
  communityId: z.string(),
  name: z.string(),
  serviceIds: z.array(z.string()),
  services: z.array(
    z.object({
      serviceId: z.string(),
      role: FailureDomainRoleEnum,
      criticality: z.string(),
    })
  ),
  sharedInfrastructure: z.array(z.string()),
  blastRadiusScore: z.number(),
  computedAt: z.string(),
  rationale: z.string(),
});
export type ServiceFailureDomain = z.infer<typeof ServiceFailureDomainSchema>;

// ==========================================
// 3c. Stage 3 Action Proposal & Remediation Schemas
// ==========================================

export const ActionTypeEnum = z.enum([
  'cache_flush',
  'pod_restart',
  'config_rollback',
  'jwks_sync',
  'diagnostic_probe',
]);
export type ActionType = z.infer<typeof ActionTypeEnum>;

export const ActionRiskLevelEnum = z.enum(['low', 'medium', 'high']);
export type ActionRiskLevel = z.infer<typeof ActionRiskLevelEnum>;

export const ActionStatusEnum = z.enum([
  'proposed',
  'pending_approval',
  'approved',
  'rejected',
  'executing',
  'executed',
  'failed',
  'verified',
  'unverified',
  'expired',
]);
export type ActionStatus = z.infer<typeof ActionStatusEnum>;

export const ActionApprovalSchema = z.object({
  approverId: z.string(),
  approverName: z.string(),
  role: z.string(),
  approvedAt: z.string(),
});
export type ActionApproval = z.infer<typeof ActionApprovalSchema>;

export const ActionProposalSchema = z.object({
  id: z.string(),
  tenantId: z.string().default('tenant-default'),
  proposerId: z.string().optional(),
  investigationId: z.string(),
  incidentId: z.string(),
  procedureId: z.string().optional(),
  procedureVersion: z.number().optional(),
  actionType: ActionTypeEnum,
  targetServiceId: z.string(),
  targetResource: z.string(),
  parameters: z.record(z.any()).default({}),
  riskLevel: ActionRiskLevelEnum,
  status: ActionStatusEnum,
  explanation: z.string(),
  supportingEvidenceIds: z.array(z.string()).default([]),
  preconditions: z.array(z.string()).default([]),
  expectedPostconditions: z.array(z.string()).default([]),
  requiresTwoPersonApproval: z.boolean().default(false),
  approvals: z.array(ActionApprovalSchema).default([]),
  rejectedBy: z
    .object({
      actorId: z.string(),
      reason: z.string(),
      rejectedAt: z.string(),
    })
    .optional(),
  proposedAt: z.string(),
  expiresAt: z.string(),
  executedAt: z.string().optional(),
  executionResult: z
    .object({
      status: z.enum(['success', 'failure']),
      output: z.string(),
      durationMs: z.number(),
    })
    .optional(),
  verificationEvidenceIds: z.array(z.string()).default([]),
  verificationNotes: z.string().optional(),
});
export type ActionProposal = z.infer<typeof ActionProposalSchema>;

export const ActionProposeRequestSchema = z.object({
  tenantId: z.string().optional(),
  investigationId: z.string(),
  incidentId: z.string(),
  procedureId: z.string().optional(),
  actionType: ActionTypeEnum,
  targetServiceId: z.string(),
  targetResource: z.string(),
  parameters: z.record(z.any()).default({}),
  explanation: z.string(),
  riskLevel: ActionRiskLevelEnum.default('medium'),
});
export type ActionProposeRequest = z.infer<typeof ActionProposeRequestSchema>;

export const ActionApproveRequestSchema = z.object({
  approverId: z.string().min(1),
  approverName: z.string().min(1),
  role: z.string().default('on-call-sre'),
});
export type ActionApproveRequest = z.infer<typeof ActionApproveRequestSchema>;

export const ActionRejectRequestSchema = z.object({
  actorId: z.string().min(1),
  reason: z.string().min(1),
});
export type ActionRejectRequest = z.infer<typeof ActionRejectRequestSchema>;

export const InvestigationResultSchema = z.object({
  investigationId: z.string(),
  tenantId: z.string().default('tenant-default'),
  incidentId: z.string().nullable().optional(),
  question: z.string(),
  status: InvestigationStatusEnum,
  startedAt: z.string(),
  completedAt: z.string(),
  executionMode: InvestigationExecutionModeEnum,
  summary: z.string(),
  affectedServices: z.array(z.string()),
  candidateExplanations: z.array(CandidateExplanationSchema),
  evidenceBundle: z.array(EvidenceSchema),
  graphPaths: z.array(
    z.object({
      description: z.string(),
      pathString: z.string(),
      nodes: z.array(z.string()),
      relationships: z.array(z.string()),
    })
  ),
  missingInformation: z.array(z.string()),
  recommendedNextStep: z.string(),
  metrics: z.object({
    durationMs: z.number(),
    graphQueryCount: z.number(),
    nodesEvaluated: z.number(),
    relationshipsEvaluated: z.number(),
  }),
  recalledMemories: z.array(RecalledMemoryRecordSchema).default([]),
  generatedMemories: z
    .object({
      episodeId: z.string().optional(),
      claimIds: z.array(z.string()).default([]),
      procedureIds: z.array(z.string()).default([]),
    })
    .optional(),
  events: z.array(InvestigationEventSchema).default([]),
  failureDomain: ServiceFailureDomainSchema.optional(),
  actionProposal: ActionProposalSchema.optional(),
});
export type InvestigationResult = z.infer<typeof InvestigationResultSchema>;

// ==========================================
// 4. API Request & Response Contracts
// ==========================================

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    graphName: string;
    details?: string;
  };
  environment: string;
  executionMode: 'deterministic' | 'llm-assisted';
}

export interface GraphHealthResponse {
  connected: boolean;
  graphName: string;
  latencyMs: number;
  nodeCount: number;
  relationshipCount: number;
  labels: string[];
  relationshipTypes: string[];
}

export interface IncidentListItem {
  id: string;
  tenantId?: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt?: string | null;
  affectedService?: string;
  owningTeam?: string;
  synthetic: boolean;
}

export interface IncidentDetailResponse {
  incident: Incident;
  affectedService: Service | null;
  owningTeam: Team | null;
  recentDeployments: Deployment[];
  evidence: Evidence[];
  subgraph: SubgraphData;
}

export interface InvestigationHistoryItem {
  id: string;
  tenantId?: string;
  incidentId?: string | null;
  question: string;
  status: InvestigationStatus;
  startedAt: string;
  completedAt?: string;
  executionMode: InvestigationExecutionMode;
  summary: string;
}

export interface MemorySearchRequest {
  incidentId?: string;
  serviceIds?: string[];
  deploymentIds?: string[];
  limit?: number;
  includeSuperseded?: boolean;
}

export interface MemoryListResponse {
  episodes: MemoryEpisode[];
  claims: KnowledgeClaim[];
  procedures: DiagnosticProcedure[];
  totalCount: number;
}

export interface MemoryDetailResponse {
  memoryType: MemoryType;
  item: MemoryEpisode | KnowledgeClaim | DiagnosticProcedure;
  connectedEntities: {
    services: Service[];
    incidents: Incident[];
    groundedEvidence: Evidence[];
    contradictoryEvidence: Evidence[];
  };
  revisions?: KnowledgeClaim[];
}

export interface InvestigationEventsResponse {
  investigationId: string;
  events: InvestigationEvent[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    correlationId?: string;
  };
}

// ==========================================
// 5. Stage 4 Production Multi-Tenancy Schemas
// ==========================================

export const TenantRoleEnum = z.enum(['admin', 'operator', 'viewer', 'system']);
export type TenantRole = z.infer<typeof TenantRoleEnum>;

export const TenantContextSchema = z.object({
  tenantId: z.string().min(1),
  principalId: z.string().min(1),
  roles: z.array(TenantRoleEnum).default(['operator']),
  correlationId: z.string(),
  isSharedAccessAuthorized: z.boolean().default(false),
});
export type TenantContext = z.infer<typeof TenantContextSchema>;

// ==========================================
// 5a. Stage 4 Event Processing Reliability Schemas
// ==========================================

export const EventProcessingStateEnum = z.enum([
  'received',
  'validated',
  'persisted',
  'duplicate',
  'rejected',
  'retryable_failure',
  'failed',
]);
export type EventProcessingState = z.infer<typeof EventProcessingStateEnum>;

export const EventProcessingStatusSchema = z.object({
  eventId: z.string(),
  tenantId: z.string(),
  state: EventProcessingStateEnum,
  timestamp: z.string(),
  retryCount: z.number().optional(),
  error: z.string().optional(),
  contentHash: z.string().optional(),
});
export type EventProcessingStatus = z.infer<typeof EventProcessingStatusSchema>;

// ==========================================
// 5b. Stage 4 Audit Records Schemas
// ==========================================

export const AuditActionEnum = z.enum([
  'auth_failure',
  'authz_denied',
  'telemetry_ingested',
  'investigation_created',
  'investigation_completed',
  'memory_created',
  'memory_superseded',
  'memory_archived',
  'action_proposed',
  'action_approved',
  'action_rejected',
  'action_executed',
  'postcondition_verified',
  'lifecycle_pruned',
  'maintenance_run',
]);
export type AuditAction = z.infer<typeof AuditActionEnum>;

export const AuditRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  principalId: z.string(),
  action: AuditActionEnum,
  resourceType: z.string(),
  resourceId: z.string(),
  status: z.enum(['success', 'failure', 'denied']),
  timestamp: z.string(),
  correlationId: z.string().optional(),
  details: z.record(z.any()).default({}),
});
export type AuditRecord = z.infer<typeof AuditRecordSchema>;

// ==========================================
// 5c. Stage 4 Graph Lifecycle & Scale Schemas
// ==========================================

export const LifecycleRetentionPolicySchema = z.object({
  telemetryDays: z.number().default(30),
  investigationDays: z.number().default(90),
  evidenceDays: z.number().default(60),
  memoryDays: z.number().default(365),
  protectActiveIncidents: z.boolean().default(true),
  protectActiveInvestigations: z.boolean().default(true),
});
export type LifecycleRetentionPolicy = z.infer<typeof LifecycleRetentionPolicySchema>;

export const LifecyclePruneRequestSchema = z.object({
  dryRun: z.boolean().default(true),
  category: z.enum(['telemetry', 'evidence', 'investigations', 'all']).default('all'),
  olderThanDays: z.number().min(1).default(30),
  batchSize: z.number().min(1).max(1000).default(100),
});
export type LifecyclePruneRequest = z.infer<typeof LifecyclePruneRequestSchema>;

export const LifecyclePruneResultSchema = z.object({
  dryRun: z.boolean(),
  tenantId: z.string(),
  category: z.string(),
  candidatesIdentified: z.number(),
  recordsPruned: z.number(),
  recordsPreserved: z.number(),
  preservedReasons: z.record(z.number()),
  timestamp: z.string(),
});
export type LifecyclePruneResult = z.infer<typeof LifecyclePruneResultSchema>;

// ==========================================
// 5d. Stage 4 Operational Metrics & Health
// ==========================================

export interface OperationalMetricsResponse {
  timestamp: string;
  uptimeSeconds: number;
  ingestion: {
    received: number;
    persisted: number;
    duplicates: number;
    rejected: number;
    retryableFailures: number;
    failed: number;
    avgLatencyMs: number;
  };
  investigations: {
    total: number;
    completed: number;
    failed: number;
    avgDurationMs: number;
  };
  actions: {
    proposed: number;
    approved: number;
    executed: number;
    rejected: number;
  };
  graph: {
    queriesExecuted: number;
    avgQueryLatencyMs: number;
  };
}

export interface ReadinessResponse {
  ready: boolean;
  checks: {
    api: boolean;
    databaseConnected: boolean;
    graphExists: boolean;
    indicesReady: boolean;
  };
  timestamp: string;
}

