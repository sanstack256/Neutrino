"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LifecyclePruneRequestSchema = exports.LifecycleRetentionPolicySchema = exports.AuditRecordSchema = exports.AuditActionEnum = exports.EventProcessingStatusSchema = exports.EventProcessingStateEnum = exports.TenantContextSchema = exports.TenantRoleEnum = exports.InvestigationResultSchema = exports.ActionRejectRequestSchema = exports.ActionApproveRequestSchema = exports.ActionProposeRequestSchema = exports.ActionProposalSchema = exports.ActionApprovalSchema = exports.ActionStatusEnum = exports.ActionRiskLevelEnum = exports.ActionTypeEnum = exports.ServiceFailureDomainSchema = exports.FailureDomainRoleEnum = exports.IngestionResponseSchema = exports.IngestionBatchSchema = exports.TelemetryEventSchema = exports.TelemetrySeverityEnum = exports.TelemetryEventTypeEnum = exports.InvestigationRequestSchema = exports.InvestigationStatusEnum = exports.InvestigationExecutionModeEnum = exports.CandidateExplanationSchema = exports.RelationshipTypes = exports.InvestigationEventSchema = exports.RecalledMemoryRecordSchema = exports.DiagnosticProcedureSchema = exports.KnowledgeClaimSchema = exports.MemoryEpisodeSchema = exports.MemoryTypeEnum = exports.ClaimTypeEnum = exports.MemoryStatusEnum = exports.SourceRecordSchema = exports.HypothesisSchema = exports.HypothesisStatusEnum = exports.TeamSchema = exports.EvidenceSchema = exports.ReliabilityClassEnum = exports.IncidentSchema = exports.IncidentStatusEnum = exports.IncidentSeverityEnum = exports.DeploymentSchema = exports.DeploymentStatusEnum = exports.ServiceSchema = exports.CriticalityEnum = void 0;
exports.LifecyclePruneResultSchema = void 0;
const zod_1 = require("zod");
// ==========================================
// 1. Core Graph Domain Entities & Schemas
// ==========================================
exports.CriticalityEnum = zod_1.z.enum(['tier-1', 'tier-2', 'tier-3', 'low', 'medium', 'high', 'critical']);
exports.ServiceSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string(),
    criticality: exports.CriticalityEnum,
    environment: zod_1.z.string(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.DeploymentStatusEnum = zod_1.z.enum(['succeeded', 'failed', 'in-progress', 'rolled-back']);
exports.DeploymentSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    serviceId: zod_1.z.string().min(1),
    version: zod_1.z.string().min(1),
    environment: zod_1.z.string(),
    deployedAt: zod_1.z.string(),
    status: exports.DeploymentStatusEnum,
    changeSummary: zod_1.z.string(),
    author: zod_1.z.string().optional(),
});
exports.IncidentSeverityEnum = zod_1.z.enum(['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4']);
exports.IncidentStatusEnum = zod_1.z.enum(['investigating', 'identified', 'monitoring', 'resolved']);
exports.IncidentSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string(),
    severity: exports.IncidentSeverityEnum,
    status: exports.IncidentStatusEnum,
    startedAt: zod_1.z.string(),
    resolvedAt: zod_1.z.string().nullable().optional(),
    environment: zod_1.z.string(),
    synthetic: zod_1.z.boolean().default(true),
});
exports.ReliabilityClassEnum = zod_1.z.enum(['authoritative', 'high', 'medium', 'observational']);
exports.EvidenceSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    sourceType: zod_1.z.string(),
    sourceRecordId: zod_1.z.string(),
    observedAt: zod_1.z.string(),
    ingestedAt: zod_1.z.string(),
    summary: zod_1.z.string(),
    content: zod_1.z.string(),
    contentHash: zod_1.z.string(),
    synthetic: zod_1.z.boolean().default(true),
    reliabilityClass: exports.ReliabilityClassEnum,
});
exports.TeamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string(),
    onCallContact: zod_1.z.string().optional(),
});
exports.HypothesisStatusEnum = zod_1.z.enum(['candidate', 'supported', 'contradicted', 'unresolved']);
exports.HypothesisSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    incidentId: zod_1.z.string().min(1),
    statement: zod_1.z.string().min(1),
    status: exports.HypothesisStatusEnum,
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.SourceRecordSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    sourceType: zod_1.z.string(),
    externalId: zod_1.z.string(),
    uri: zod_1.z.string().optional(),
    observedAt: zod_1.z.string(),
    contentHash: zod_1.z.string(),
    synthetic: zod_1.z.boolean().default(true),
});
// ==========================================
// 1b. Stage 2 Graph Memory Entities & Schemas
// ==========================================
exports.MemoryStatusEnum = zod_1.z.enum(['candidate', 'active', 'superseded', 'invalidated', 'archived']);
exports.ClaimTypeEnum = zod_1.z.enum(['observed', 'inferred', 'verified']);
exports.MemoryTypeEnum = zod_1.z.enum(['episodic', 'semantic', 'procedural']);
exports.MemoryEpisodeSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    investigationId: zod_1.z.string().min(1),
    incidentId: zod_1.z.string().nullable().optional(),
    summary: zod_1.z.string().min(1),
    outcome: zod_1.z.string(),
    status: exports.MemoryStatusEnum.default('active'),
    serviceIds: zod_1.z.array(zod_1.z.string()).default([]),
    deploymentIds: zod_1.z.array(zod_1.z.string()).default([]),
    evidenceIds: zod_1.z.array(zod_1.z.string()).default([]),
    graphPaths: zod_1.z.array(zod_1.z.string()).default([]),
    hypothesesEvaluated: zod_1.z.array(zod_1.z.string()).default([]),
    supportedHypotheses: zod_1.z.array(zod_1.z.string()).default([]),
    contradictedHypotheses: zod_1.z.array(zod_1.z.string()).default([]),
    unresolvedQuestions: zod_1.z.array(zod_1.z.string()).default([]),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    synthetic: zod_1.z.boolean().default(true),
});
exports.KnowledgeClaimSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    subject: zod_1.z.string().min(1),
    predicate: zod_1.z.string().min(1),
    object: zod_1.z.string().min(1),
    statement: zod_1.z.string().min(1),
    claimType: exports.ClaimTypeEnum.default('observed'),
    status: exports.MemoryStatusEnum.default('active'),
    confidence: zod_1.z.number().min(0).max(1).default(1.0),
    supportingEvidenceIds: zod_1.z.array(zod_1.z.string()).default([]),
    contradictoryEvidenceIds: zod_1.z.array(zod_1.z.string()).default([]),
    sourceProvenance: zod_1.z.string(),
    firstObservedAt: zod_1.z.string(),
    lastVerifiedAt: zod_1.z.string(),
    validFrom: zod_1.z.string().optional(),
    validUntil: zod_1.z.string().optional(),
    revision: zod_1.z.number().int().default(1),
    supersededById: zod_1.z.string().optional(),
    invalidationReason: zod_1.z.string().optional(),
    synthetic: zod_1.z.boolean().default(true),
});
exports.DiagnosticProcedureSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().default('tenant-default'),
    name: zod_1.z.string().min(1),
    purpose: zod_1.z.string().min(1),
    serviceId: zod_1.z.string().min(1),
    preconditions: zod_1.z.array(zod_1.z.string()).default([]),
    requiredEvidenceTypes: zod_1.z.array(zod_1.z.string()).default([]),
    diagnosticSteps: zod_1.z.array(zod_1.z.string()).default([]),
    expectedObservations: zod_1.z.array(zod_1.z.string()).default([]),
    supportingConditions: zod_1.z.array(zod_1.z.string()).default([]),
    contradictingConditions: zod_1.z.array(zod_1.z.string()).default([]),
    knownFailureModes: zod_1.z.array(zod_1.z.string()).default([]),
    status: exports.MemoryStatusEnum.default('active'),
    validationCriteria: zod_1.z.string(),
    version: zod_1.z.number().int().default(1),
    lastValidatedAt: zod_1.z.string(),
    synthetic: zod_1.z.boolean().default(true),
});
exports.RecalledMemoryRecordSchema = zod_1.z.object({
    memoryId: zod_1.z.string(),
    memoryType: exports.MemoryTypeEnum,
    statement: zod_1.z.string(),
    relevanceScore: zod_1.z.number(),
    retrievalReason: zod_1.z.string(),
    status: exports.MemoryStatusEnum,
    influence: zod_1.z.enum([
        'prioritized_hypothesis',
        'guided_traversal',
        'suggested_procedure',
        'rejected_by_evidence',
        'inconclusive',
    ]),
    currentEvidenceCorroboration: zod_1.z.array(zod_1.z.string()).default([]),
    currentEvidenceContradiction: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.InvestigationEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    timestamp: zod_1.z.string(),
    phase: zod_1.z.string(),
    action: zod_1.z.string(),
    details: zod_1.z.record(zod_1.z.any()).default({}),
    durationMs: zod_1.z.number().optional(),
});
// ==========================================
// 2. Graph Node & Relationship Definitions
// ==========================================
exports.RelationshipTypes = [
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
];
// ==========================================
// 3. Investigation Domain Contracts
// ==========================================
exports.CandidateExplanationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    statement: zod_1.z.string(),
    status: exports.HypothesisStatusEnum,
    supportingEvidenceIds: zod_1.z.array(zod_1.z.string()),
    contradictoryEvidenceIds: zod_1.z.array(zod_1.z.string()),
    missingEvidence: zod_1.z.array(zod_1.z.string()),
    graphPaths: zod_1.z.array(zod_1.z.string()),
    explanation: zod_1.z.string(),
});
exports.InvestigationExecutionModeEnum = zod_1.z.enum(['deterministic', 'llm-assisted']);
exports.InvestigationStatusEnum = zod_1.z.enum(['started', 'analyzing', 'completed', 'insufficient-evidence', 'failed']);
exports.InvestigationRequestSchema = zod_1.z.object({
    question: zod_1.z.string().min(3).max(1000),
    incidentId: zod_1.z.string().min(1).optional(),
    executionMode: exports.InvestigationExecutionModeEnum.default('deterministic'),
});
// ==========================================
// 3a. Stage 3 Telemetry Ingestion Schemas
// ==========================================
exports.TelemetryEventTypeEnum = zod_1.z.enum(['log', 'metric', 'alert', 'trace']);
exports.TelemetrySeverityEnum = zod_1.z.enum(['debug', 'info', 'warn', 'error', 'critical']);
exports.TelemetryEventSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    tenantId: zod_1.z.string().optional(),
    source: zod_1.z.string().min(1),
    eventType: exports.TelemetryEventTypeEnum,
    severity: exports.TelemetrySeverityEnum.default('info'),
    timestamp: zod_1.z.string().default(() => new Date().toISOString()),
    serviceId: zod_1.z.string().optional(),
    environment: zod_1.z.string().default('production'),
    traceId: zod_1.z.string().optional(),
    spanId: zod_1.z.string().optional(),
    metricName: zod_1.z.string().optional(),
    metricValue: zod_1.z.number().optional(),
    metricUnit: zod_1.z.string().optional(),
    summary: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
    content: zod_1.z.string().optional(),
    error: zod_1.z.record(zod_1.z.any()).optional(),
    attributes: zod_1.z.record(zod_1.z.any()).optional(),
    synthetic: zod_1.z.boolean().default(false),
});
exports.IngestionBatchSchema = zod_1.z.object({
    events: zod_1.z.array(exports.TelemetryEventSchema).min(1).max(100),
});
exports.IngestionResponseSchema = zod_1.z.object({
    accepted: zod_1.z.number(),
    duplicated: zod_1.z.number(),
    rejected: zod_1.z.number(),
    eventIds: zod_1.z.array(zod_1.z.string()),
    errors: zod_1.z.array(zod_1.z.object({ index: zod_1.z.number(), error: zod_1.z.string() })).default([]),
});
// ==========================================
// 3b. Stage 3 Graph Intelligence & Failure Domain Schemas
// ==========================================
exports.FailureDomainRoleEnum = zod_1.z.enum(['hub', 'consumer', 'dependency', 'shared_infra']);
exports.ServiceFailureDomainSchema = zod_1.z.object({
    communityId: zod_1.z.string(),
    name: zod_1.z.string(),
    serviceIds: zod_1.z.array(zod_1.z.string()),
    services: zod_1.z.array(zod_1.z.object({
        serviceId: zod_1.z.string(),
        role: exports.FailureDomainRoleEnum,
        criticality: zod_1.z.string(),
    })),
    sharedInfrastructure: zod_1.z.array(zod_1.z.string()),
    blastRadiusScore: zod_1.z.number(),
    computedAt: zod_1.z.string(),
    rationale: zod_1.z.string(),
});
// ==========================================
// 3c. Stage 3 Action Proposal & Remediation Schemas
// ==========================================
exports.ActionTypeEnum = zod_1.z.enum([
    'cache_flush',
    'pod_restart',
    'config_rollback',
    'jwks_sync',
    'diagnostic_probe',
]);
exports.ActionRiskLevelEnum = zod_1.z.enum(['low', 'medium', 'high']);
exports.ActionStatusEnum = zod_1.z.enum([
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
exports.ActionApprovalSchema = zod_1.z.object({
    approverId: zod_1.z.string(),
    approverName: zod_1.z.string(),
    role: zod_1.z.string(),
    approvedAt: zod_1.z.string(),
});
exports.ActionProposalSchema = zod_1.z.object({
    id: zod_1.z.string(),
    tenantId: zod_1.z.string().default('tenant-default'),
    proposerId: zod_1.z.string().optional(),
    investigationId: zod_1.z.string(),
    incidentId: zod_1.z.string(),
    procedureId: zod_1.z.string().optional(),
    procedureVersion: zod_1.z.number().optional(),
    actionType: exports.ActionTypeEnum,
    targetServiceId: zod_1.z.string(),
    targetResource: zod_1.z.string(),
    parameters: zod_1.z.record(zod_1.z.any()).default({}),
    riskLevel: exports.ActionRiskLevelEnum,
    status: exports.ActionStatusEnum,
    explanation: zod_1.z.string(),
    supportingEvidenceIds: zod_1.z.array(zod_1.z.string()).default([]),
    preconditions: zod_1.z.array(zod_1.z.string()).default([]),
    expectedPostconditions: zod_1.z.array(zod_1.z.string()).default([]),
    requiresTwoPersonApproval: zod_1.z.boolean().default(false),
    approvals: zod_1.z.array(exports.ActionApprovalSchema).default([]),
    rejectedBy: zod_1.z
        .object({
        actorId: zod_1.z.string(),
        reason: zod_1.z.string(),
        rejectedAt: zod_1.z.string(),
    })
        .optional(),
    proposedAt: zod_1.z.string(),
    expiresAt: zod_1.z.string(),
    executedAt: zod_1.z.string().optional(),
    executionResult: zod_1.z
        .object({
        status: zod_1.z.enum(['success', 'failure']),
        output: zod_1.z.string(),
        durationMs: zod_1.z.number(),
    })
        .optional(),
    verificationEvidenceIds: zod_1.z.array(zod_1.z.string()).default([]),
    verificationNotes: zod_1.z.string().optional(),
});
exports.ActionProposeRequestSchema = zod_1.z.object({
    tenantId: zod_1.z.string().optional(),
    investigationId: zod_1.z.string(),
    incidentId: zod_1.z.string(),
    procedureId: zod_1.z.string().optional(),
    actionType: exports.ActionTypeEnum,
    targetServiceId: zod_1.z.string(),
    targetResource: zod_1.z.string(),
    parameters: zod_1.z.record(zod_1.z.any()).default({}),
    explanation: zod_1.z.string(),
    riskLevel: exports.ActionRiskLevelEnum.default('medium'),
});
exports.ActionApproveRequestSchema = zod_1.z.object({
    approverId: zod_1.z.string().min(1),
    approverName: zod_1.z.string().min(1),
    role: zod_1.z.string().default('on-call-sre'),
});
exports.ActionRejectRequestSchema = zod_1.z.object({
    actorId: zod_1.z.string().min(1),
    reason: zod_1.z.string().min(1),
});
exports.InvestigationResultSchema = zod_1.z.object({
    investigationId: zod_1.z.string(),
    tenantId: zod_1.z.string().default('tenant-default'),
    incidentId: zod_1.z.string().nullable().optional(),
    question: zod_1.z.string(),
    status: exports.InvestigationStatusEnum,
    startedAt: zod_1.z.string(),
    completedAt: zod_1.z.string(),
    executionMode: exports.InvestigationExecutionModeEnum,
    summary: zod_1.z.string(),
    affectedServices: zod_1.z.array(zod_1.z.string()),
    candidateExplanations: zod_1.z.array(exports.CandidateExplanationSchema),
    evidenceBundle: zod_1.z.array(exports.EvidenceSchema),
    graphPaths: zod_1.z.array(zod_1.z.object({
        description: zod_1.z.string(),
        pathString: zod_1.z.string(),
        nodes: zod_1.z.array(zod_1.z.string()),
        relationships: zod_1.z.array(zod_1.z.string()),
    })),
    missingInformation: zod_1.z.array(zod_1.z.string()),
    recommendedNextStep: zod_1.z.string(),
    metrics: zod_1.z.object({
        durationMs: zod_1.z.number(),
        graphQueryCount: zod_1.z.number(),
        nodesEvaluated: zod_1.z.number(),
        relationshipsEvaluated: zod_1.z.number(),
    }),
    recalledMemories: zod_1.z.array(exports.RecalledMemoryRecordSchema).default([]),
    generatedMemories: zod_1.z
        .object({
        episodeId: zod_1.z.string().optional(),
        claimIds: zod_1.z.array(zod_1.z.string()).default([]),
        procedureIds: zod_1.z.array(zod_1.z.string()).default([]),
    })
        .optional(),
    events: zod_1.z.array(exports.InvestigationEventSchema).default([]),
    failureDomain: exports.ServiceFailureDomainSchema.optional(),
    actionProposal: exports.ActionProposalSchema.optional(),
});
// ==========================================
// 5. Stage 4 Production Multi-Tenancy Schemas
// ==========================================
exports.TenantRoleEnum = zod_1.z.enum(['admin', 'operator', 'viewer', 'system']);
exports.TenantContextSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    principalId: zod_1.z.string().min(1),
    roles: zod_1.z.array(exports.TenantRoleEnum).default(['operator']),
    correlationId: zod_1.z.string(),
    isSharedAccessAuthorized: zod_1.z.boolean().default(false),
});
// ==========================================
// 5a. Stage 4 Event Processing Reliability Schemas
// ==========================================
exports.EventProcessingStateEnum = zod_1.z.enum([
    'received',
    'validated',
    'persisted',
    'duplicate',
    'rejected',
    'retryable_failure',
    'failed',
]);
exports.EventProcessingStatusSchema = zod_1.z.object({
    eventId: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    state: exports.EventProcessingStateEnum,
    timestamp: zod_1.z.string(),
    retryCount: zod_1.z.number().optional(),
    error: zod_1.z.string().optional(),
    contentHash: zod_1.z.string().optional(),
});
// ==========================================
// 5b. Stage 4 Audit Records Schemas
// ==========================================
exports.AuditActionEnum = zod_1.z.enum([
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
exports.AuditRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    principalId: zod_1.z.string(),
    action: exports.AuditActionEnum,
    resourceType: zod_1.z.string(),
    resourceId: zod_1.z.string(),
    status: zod_1.z.enum(['success', 'failure', 'denied']),
    timestamp: zod_1.z.string(),
    correlationId: zod_1.z.string().optional(),
    details: zod_1.z.record(zod_1.z.any()).default({}),
});
// ==========================================
// 5c. Stage 4 Graph Lifecycle & Scale Schemas
// ==========================================
exports.LifecycleRetentionPolicySchema = zod_1.z.object({
    telemetryDays: zod_1.z.number().default(30),
    investigationDays: zod_1.z.number().default(90),
    evidenceDays: zod_1.z.number().default(60),
    memoryDays: zod_1.z.number().default(365),
    protectActiveIncidents: zod_1.z.boolean().default(true),
    protectActiveInvestigations: zod_1.z.boolean().default(true),
});
exports.LifecyclePruneRequestSchema = zod_1.z.object({
    dryRun: zod_1.z.boolean().default(true),
    category: zod_1.z.enum(['telemetry', 'evidence', 'investigations', 'all']).default('all'),
    olderThanDays: zod_1.z.number().min(1).default(30),
    batchSize: zod_1.z.number().min(1).max(1000).default(100),
});
exports.LifecyclePruneResultSchema = zod_1.z.object({
    dryRun: zod_1.z.boolean(),
    tenantId: zod_1.z.string(),
    category: zod_1.z.string(),
    candidatesIdentified: zod_1.z.number(),
    recordsPruned: zod_1.z.number(),
    recordsPreserved: zod_1.z.number(),
    preservedReasons: zod_1.z.record(zod_1.z.number()),
    timestamp: zod_1.z.string(),
});
//# sourceMappingURL=index.js.map