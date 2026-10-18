import { z } from 'zod';
export declare const CriticalityEnum: z.ZodEnum<["tier-1", "tier-2", "tier-3", "low", "medium", "high", "critical"]>;
export type Criticality = z.infer<typeof CriticalityEnum>;
export declare const ServiceSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    name: z.ZodString;
    description: z.ZodString;
    criticality: z.ZodEnum<["tier-1", "tier-2", "tier-3", "low", "medium", "high", "critical"]>;
    environment: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    name: string;
    description: string;
    criticality: "tier-1" | "tier-2" | "tier-3" | "low" | "medium" | "high" | "critical";
    environment: string;
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    name: string;
    description: string;
    criticality: "tier-1" | "tier-2" | "tier-3" | "low" | "medium" | "high" | "critical";
    environment: string;
    createdAt: string;
    updatedAt: string;
    tenantId?: string | undefined;
}>;
export type Service = z.infer<typeof ServiceSchema>;
export declare const DeploymentStatusEnum: z.ZodEnum<["succeeded", "failed", "in-progress", "rolled-back"]>;
export type DeploymentStatus = z.infer<typeof DeploymentStatusEnum>;
export declare const DeploymentSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    serviceId: z.ZodString;
    version: z.ZodString;
    environment: z.ZodString;
    deployedAt: z.ZodString;
    status: z.ZodEnum<["succeeded", "failed", "in-progress", "rolled-back"]>;
    changeSummary: z.ZodString;
    author: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    environment: string;
    status: "succeeded" | "failed" | "in-progress" | "rolled-back";
    serviceId: string;
    version: string;
    deployedAt: string;
    changeSummary: string;
    author?: string | undefined;
}, {
    id: string;
    environment: string;
    status: "succeeded" | "failed" | "in-progress" | "rolled-back";
    serviceId: string;
    version: string;
    deployedAt: string;
    changeSummary: string;
    tenantId?: string | undefined;
    author?: string | undefined;
}>;
export type Deployment = z.infer<typeof DeploymentSchema>;
export declare const IncidentSeverityEnum: z.ZodEnum<["SEV-1", "SEV-2", "SEV-3", "SEV-4"]>;
export type IncidentSeverity = z.infer<typeof IncidentSeverityEnum>;
export declare const IncidentStatusEnum: z.ZodEnum<["investigating", "identified", "monitoring", "resolved"]>;
export type IncidentStatus = z.infer<typeof IncidentStatusEnum>;
export declare const IncidentSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    title: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<["SEV-1", "SEV-2", "SEV-3", "SEV-4"]>;
    status: z.ZodEnum<["investigating", "identified", "monitoring", "resolved"]>;
    startedAt: z.ZodString;
    resolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    environment: z.ZodString;
    synthetic: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    description: string;
    environment: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
    title: string;
    severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
    startedAt: string;
    synthetic: boolean;
    resolvedAt?: string | null | undefined;
}, {
    id: string;
    description: string;
    environment: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
    title: string;
    severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
    startedAt: string;
    tenantId?: string | undefined;
    resolvedAt?: string | null | undefined;
    synthetic?: boolean | undefined;
}>;
export type Incident = z.infer<typeof IncidentSchema>;
export declare const ReliabilityClassEnum: z.ZodEnum<["authoritative", "high", "medium", "observational"]>;
export type ReliabilityClass = z.infer<typeof ReliabilityClassEnum>;
export declare const EvidenceSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    sourceType: z.ZodString;
    sourceRecordId: z.ZodString;
    observedAt: z.ZodString;
    ingestedAt: z.ZodString;
    summary: z.ZodString;
    content: z.ZodString;
    contentHash: z.ZodString;
    synthetic: z.ZodDefault<z.ZodBoolean>;
    reliabilityClass: z.ZodEnum<["authoritative", "high", "medium", "observational"]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    synthetic: boolean;
    sourceType: string;
    sourceRecordId: string;
    observedAt: string;
    ingestedAt: string;
    summary: string;
    content: string;
    contentHash: string;
    reliabilityClass: "medium" | "high" | "authoritative" | "observational";
}, {
    id: string;
    sourceType: string;
    sourceRecordId: string;
    observedAt: string;
    ingestedAt: string;
    summary: string;
    content: string;
    contentHash: string;
    reliabilityClass: "medium" | "high" | "authoritative" | "observational";
    tenantId?: string | undefined;
    synthetic?: boolean | undefined;
}>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export declare const TeamSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    name: z.ZodString;
    description: z.ZodString;
    onCallContact: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    name: string;
    description: string;
    onCallContact?: string | undefined;
}, {
    id: string;
    name: string;
    description: string;
    tenantId?: string | undefined;
    onCallContact?: string | undefined;
}>;
export type Team = z.infer<typeof TeamSchema>;
export declare const HypothesisStatusEnum: z.ZodEnum<["candidate", "supported", "contradicted", "unresolved"]>;
export type HypothesisStatus = z.infer<typeof HypothesisStatusEnum>;
export declare const HypothesisSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    incidentId: z.ZodString;
    statement: z.ZodString;
    status: z.ZodEnum<["candidate", "supported", "contradicted", "unresolved"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    createdAt: string;
    updatedAt: string;
    status: "candidate" | "supported" | "contradicted" | "unresolved";
    incidentId: string;
    statement: string;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    status: "candidate" | "supported" | "contradicted" | "unresolved";
    incidentId: string;
    statement: string;
    tenantId?: string | undefined;
}>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export declare const SourceRecordSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    sourceType: z.ZodString;
    externalId: z.ZodString;
    uri: z.ZodOptional<z.ZodString>;
    observedAt: z.ZodString;
    contentHash: z.ZodString;
    synthetic: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    synthetic: boolean;
    sourceType: string;
    observedAt: string;
    contentHash: string;
    externalId: string;
    uri?: string | undefined;
}, {
    id: string;
    sourceType: string;
    observedAt: string;
    contentHash: string;
    externalId: string;
    tenantId?: string | undefined;
    synthetic?: boolean | undefined;
    uri?: string | undefined;
}>;
export type SourceRecord = z.infer<typeof SourceRecordSchema>;
export declare const MemoryStatusEnum: z.ZodEnum<["candidate", "active", "superseded", "invalidated", "archived"]>;
export type MemoryStatus = z.infer<typeof MemoryStatusEnum>;
export declare const ClaimTypeEnum: z.ZodEnum<["observed", "inferred", "verified"]>;
export type ClaimType = z.infer<typeof ClaimTypeEnum>;
export declare const MemoryTypeEnum: z.ZodEnum<["episodic", "semantic", "procedural"]>;
export type MemoryType = z.infer<typeof MemoryTypeEnum>;
export declare const MemoryEpisodeSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    investigationId: z.ZodString;
    incidentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    summary: z.ZodString;
    outcome: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["candidate", "active", "superseded", "invalidated", "archived"]>>;
    serviceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    deploymentIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    graphPaths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    hypothesesEvaluated: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    supportedHypotheses: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    contradictedHypotheses: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    unresolvedQuestions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    synthetic: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    createdAt: string;
    updatedAt: string;
    status: "candidate" | "active" | "superseded" | "invalidated" | "archived";
    synthetic: boolean;
    summary: string;
    investigationId: string;
    outcome: string;
    serviceIds: string[];
    deploymentIds: string[];
    evidenceIds: string[];
    graphPaths: string[];
    hypothesesEvaluated: string[];
    supportedHypotheses: string[];
    contradictedHypotheses: string[];
    unresolvedQuestions: string[];
    incidentId?: string | null | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    summary: string;
    investigationId: string;
    outcome: string;
    tenantId?: string | undefined;
    status?: "candidate" | "active" | "superseded" | "invalidated" | "archived" | undefined;
    synthetic?: boolean | undefined;
    incidentId?: string | null | undefined;
    serviceIds?: string[] | undefined;
    deploymentIds?: string[] | undefined;
    evidenceIds?: string[] | undefined;
    graphPaths?: string[] | undefined;
    hypothesesEvaluated?: string[] | undefined;
    supportedHypotheses?: string[] | undefined;
    contradictedHypotheses?: string[] | undefined;
    unresolvedQuestions?: string[] | undefined;
}>;
export type MemoryEpisode = z.infer<typeof MemoryEpisodeSchema>;
export declare const KnowledgeClaimSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    subject: z.ZodString;
    predicate: z.ZodString;
    object: z.ZodString;
    statement: z.ZodString;
    claimType: z.ZodDefault<z.ZodEnum<["observed", "inferred", "verified"]>>;
    status: z.ZodDefault<z.ZodEnum<["candidate", "active", "superseded", "invalidated", "archived"]>>;
    confidence: z.ZodDefault<z.ZodNumber>;
    supportingEvidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    contradictoryEvidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sourceProvenance: z.ZodString;
    firstObservedAt: z.ZodString;
    lastVerifiedAt: z.ZodString;
    validFrom: z.ZodOptional<z.ZodString>;
    validUntil: z.ZodOptional<z.ZodString>;
    revision: z.ZodDefault<z.ZodNumber>;
    supersededById: z.ZodOptional<z.ZodString>;
    invalidationReason: z.ZodOptional<z.ZodString>;
    synthetic: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    object: string;
    id: string;
    tenantId: string;
    status: "candidate" | "active" | "superseded" | "invalidated" | "archived";
    synthetic: boolean;
    statement: string;
    subject: string;
    predicate: string;
    claimType: "observed" | "inferred" | "verified";
    confidence: number;
    supportingEvidenceIds: string[];
    contradictoryEvidenceIds: string[];
    sourceProvenance: string;
    firstObservedAt: string;
    lastVerifiedAt: string;
    revision: number;
    validFrom?: string | undefined;
    validUntil?: string | undefined;
    supersededById?: string | undefined;
    invalidationReason?: string | undefined;
}, {
    object: string;
    id: string;
    statement: string;
    subject: string;
    predicate: string;
    sourceProvenance: string;
    firstObservedAt: string;
    lastVerifiedAt: string;
    tenantId?: string | undefined;
    status?: "candidate" | "active" | "superseded" | "invalidated" | "archived" | undefined;
    synthetic?: boolean | undefined;
    claimType?: "observed" | "inferred" | "verified" | undefined;
    confidence?: number | undefined;
    supportingEvidenceIds?: string[] | undefined;
    contradictoryEvidenceIds?: string[] | undefined;
    validFrom?: string | undefined;
    validUntil?: string | undefined;
    revision?: number | undefined;
    supersededById?: string | undefined;
    invalidationReason?: string | undefined;
}>;
export type KnowledgeClaim = z.infer<typeof KnowledgeClaimSchema>;
export declare const DiagnosticProcedureSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    name: z.ZodString;
    purpose: z.ZodString;
    serviceId: z.ZodString;
    preconditions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    requiredEvidenceTypes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    diagnosticSteps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    expectedObservations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    supportingConditions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    contradictingConditions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    knownFailureModes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["candidate", "active", "superseded", "invalidated", "archived"]>>;
    validationCriteria: z.ZodString;
    version: z.ZodDefault<z.ZodNumber>;
    lastValidatedAt: z.ZodString;
    synthetic: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    name: string;
    status: "candidate" | "active" | "superseded" | "invalidated" | "archived";
    serviceId: string;
    version: number;
    synthetic: boolean;
    purpose: string;
    preconditions: string[];
    requiredEvidenceTypes: string[];
    diagnosticSteps: string[];
    expectedObservations: string[];
    supportingConditions: string[];
    contradictingConditions: string[];
    knownFailureModes: string[];
    validationCriteria: string;
    lastValidatedAt: string;
}, {
    id: string;
    name: string;
    serviceId: string;
    purpose: string;
    validationCriteria: string;
    lastValidatedAt: string;
    tenantId?: string | undefined;
    status?: "candidate" | "active" | "superseded" | "invalidated" | "archived" | undefined;
    version?: number | undefined;
    synthetic?: boolean | undefined;
    preconditions?: string[] | undefined;
    requiredEvidenceTypes?: string[] | undefined;
    diagnosticSteps?: string[] | undefined;
    expectedObservations?: string[] | undefined;
    supportingConditions?: string[] | undefined;
    contradictingConditions?: string[] | undefined;
    knownFailureModes?: string[] | undefined;
}>;
export type DiagnosticProcedure = z.infer<typeof DiagnosticProcedureSchema>;
export declare const RecalledMemoryRecordSchema: z.ZodObject<{
    memoryId: z.ZodString;
    memoryType: z.ZodEnum<["episodic", "semantic", "procedural"]>;
    statement: z.ZodString;
    relevanceScore: z.ZodNumber;
    retrievalReason: z.ZodString;
    status: z.ZodEnum<["candidate", "active", "superseded", "invalidated", "archived"]>;
    influence: z.ZodEnum<["prioritized_hypothesis", "guided_traversal", "suggested_procedure", "rejected_by_evidence", "inconclusive"]>;
    currentEvidenceCorroboration: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    currentEvidenceContradiction: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "candidate" | "active" | "superseded" | "invalidated" | "archived";
    statement: string;
    memoryId: string;
    memoryType: "episodic" | "semantic" | "procedural";
    relevanceScore: number;
    retrievalReason: string;
    influence: "prioritized_hypothesis" | "guided_traversal" | "suggested_procedure" | "rejected_by_evidence" | "inconclusive";
    currentEvidenceCorroboration: string[];
    currentEvidenceContradiction: string[];
}, {
    status: "candidate" | "active" | "superseded" | "invalidated" | "archived";
    statement: string;
    memoryId: string;
    memoryType: "episodic" | "semantic" | "procedural";
    relevanceScore: number;
    retrievalReason: string;
    influence: "prioritized_hypothesis" | "guided_traversal" | "suggested_procedure" | "rejected_by_evidence" | "inconclusive";
    currentEvidenceCorroboration?: string[] | undefined;
    currentEvidenceContradiction?: string[] | undefined;
}>;
export type RecalledMemoryRecord = z.infer<typeof RecalledMemoryRecordSchema>;
export declare const InvestigationEventSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    phase: z.ZodString;
    action: z.ZodString;
    details: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    durationMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    phase: string;
    action: string;
    details: Record<string, any>;
    durationMs?: number | undefined;
}, {
    id: string;
    timestamp: string;
    phase: string;
    action: string;
    details?: Record<string, any> | undefined;
    durationMs?: number | undefined;
}>;
export type InvestigationEvent = z.infer<typeof InvestigationEventSchema>;
export declare const RelationshipTypes: readonly ["DEPENDS_ON", "HAS_DEPLOYMENT", "AFFECTS", "OWNED_BY", "OBSERVED_IN", "SUPPORTED_BY", "CONTRADICTED_BY", "INVESTIGATED_IN", "REFERENCES", "RELATED_TO", "GENERATED_EPISODE", "RECORDED_CLAIM", "RECOMMENDED_PROCEDURE", "CONCERNS_SERVICE", "CONCERNS_INCIDENT", "GROUNDED_IN", "TARGETS_SERVICE", "SUPERSEDES", "OBSERVED_ON", "IN_COMMUNITY", "PROPOSED_ACTION", "VERIFIED_BY", "SHARED_WITH", "AUDITED_BY"];
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
export declare const CandidateExplanationSchema: z.ZodObject<{
    id: z.ZodString;
    statement: z.ZodString;
    status: z.ZodEnum<["candidate", "supported", "contradicted", "unresolved"]>;
    supportingEvidenceIds: z.ZodArray<z.ZodString, "many">;
    contradictoryEvidenceIds: z.ZodArray<z.ZodString, "many">;
    missingEvidence: z.ZodArray<z.ZodString, "many">;
    graphPaths: z.ZodArray<z.ZodString, "many">;
    explanation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "candidate" | "supported" | "contradicted" | "unresolved";
    statement: string;
    graphPaths: string[];
    supportingEvidenceIds: string[];
    contradictoryEvidenceIds: string[];
    missingEvidence: string[];
    explanation: string;
}, {
    id: string;
    status: "candidate" | "supported" | "contradicted" | "unresolved";
    statement: string;
    graphPaths: string[];
    supportingEvidenceIds: string[];
    contradictoryEvidenceIds: string[];
    missingEvidence: string[];
    explanation: string;
}>;
export type CandidateExplanation = z.infer<typeof CandidateExplanationSchema>;
export declare const InvestigationExecutionModeEnum: z.ZodEnum<["deterministic", "llm-assisted"]>;
export type InvestigationExecutionMode = z.infer<typeof InvestigationExecutionModeEnum>;
export declare const InvestigationStatusEnum: z.ZodEnum<["started", "analyzing", "completed", "insufficient-evidence", "failed"]>;
export type InvestigationStatus = z.infer<typeof InvestigationStatusEnum>;
export declare const InvestigationRequestSchema: z.ZodObject<{
    question: z.ZodString;
    incidentId: z.ZodOptional<z.ZodString>;
    executionMode: z.ZodDefault<z.ZodEnum<["deterministic", "llm-assisted"]>>;
}, "strip", z.ZodTypeAny, {
    question: string;
    executionMode: "deterministic" | "llm-assisted";
    incidentId?: string | undefined;
}, {
    question: string;
    incidentId?: string | undefined;
    executionMode?: "deterministic" | "llm-assisted" | undefined;
}>;
export type InvestigationRequest = z.infer<typeof InvestigationRequestSchema>;
export declare const TelemetryEventTypeEnum: z.ZodEnum<["log", "metric", "alert", "trace"]>;
export type TelemetryEventType = z.infer<typeof TelemetryEventTypeEnum>;
export declare const TelemetrySeverityEnum: z.ZodEnum<["debug", "info", "warn", "error", "critical"]>;
export type TelemetrySeverity = z.infer<typeof TelemetrySeverityEnum>;
export declare const TelemetryEventSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    eventType: z.ZodEnum<["log", "metric", "alert", "trace"]>;
    severity: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error", "critical"]>>;
    timestamp: z.ZodDefault<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
    environment: z.ZodDefault<z.ZodString>;
    traceId: z.ZodOptional<z.ZodString>;
    spanId: z.ZodOptional<z.ZodString>;
    metricName: z.ZodOptional<z.ZodString>;
    metricValue: z.ZodOptional<z.ZodNumber>;
    metricUnit: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    synthetic: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    environment: string;
    severity: "critical" | "debug" | "info" | "warn" | "error";
    synthetic: boolean;
    timestamp: string;
    source: string;
    eventType: "log" | "metric" | "alert" | "trace";
    id?: string | undefined;
    tenantId?: string | undefined;
    message?: string | undefined;
    serviceId?: string | undefined;
    summary?: string | undefined;
    content?: string | undefined;
    error?: Record<string, any> | undefined;
    traceId?: string | undefined;
    spanId?: string | undefined;
    metricName?: string | undefined;
    metricValue?: number | undefined;
    metricUnit?: string | undefined;
    attributes?: Record<string, any> | undefined;
}, {
    source: string;
    eventType: "log" | "metric" | "alert" | "trace";
    id?: string | undefined;
    tenantId?: string | undefined;
    environment?: string | undefined;
    message?: string | undefined;
    serviceId?: string | undefined;
    severity?: "critical" | "debug" | "info" | "warn" | "error" | undefined;
    synthetic?: boolean | undefined;
    summary?: string | undefined;
    content?: string | undefined;
    timestamp?: string | undefined;
    error?: Record<string, any> | undefined;
    traceId?: string | undefined;
    spanId?: string | undefined;
    metricName?: string | undefined;
    metricValue?: number | undefined;
    metricUnit?: string | undefined;
    attributes?: Record<string, any> | undefined;
}>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export declare const IngestionBatchSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        tenantId: z.ZodOptional<z.ZodString>;
        source: z.ZodString;
        eventType: z.ZodEnum<["log", "metric", "alert", "trace"]>;
        severity: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error", "critical"]>>;
        timestamp: z.ZodDefault<z.ZodString>;
        serviceId: z.ZodOptional<z.ZodString>;
        environment: z.ZodDefault<z.ZodString>;
        traceId: z.ZodOptional<z.ZodString>;
        spanId: z.ZodOptional<z.ZodString>;
        metricName: z.ZodOptional<z.ZodString>;
        metricValue: z.ZodOptional<z.ZodNumber>;
        metricUnit: z.ZodOptional<z.ZodString>;
        summary: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        synthetic: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        environment: string;
        severity: "critical" | "debug" | "info" | "warn" | "error";
        synthetic: boolean;
        timestamp: string;
        source: string;
        eventType: "log" | "metric" | "alert" | "trace";
        id?: string | undefined;
        tenantId?: string | undefined;
        message?: string | undefined;
        serviceId?: string | undefined;
        summary?: string | undefined;
        content?: string | undefined;
        error?: Record<string, any> | undefined;
        traceId?: string | undefined;
        spanId?: string | undefined;
        metricName?: string | undefined;
        metricValue?: number | undefined;
        metricUnit?: string | undefined;
        attributes?: Record<string, any> | undefined;
    }, {
        source: string;
        eventType: "log" | "metric" | "alert" | "trace";
        id?: string | undefined;
        tenantId?: string | undefined;
        environment?: string | undefined;
        message?: string | undefined;
        serviceId?: string | undefined;
        severity?: "critical" | "debug" | "info" | "warn" | "error" | undefined;
        synthetic?: boolean | undefined;
        summary?: string | undefined;
        content?: string | undefined;
        timestamp?: string | undefined;
        error?: Record<string, any> | undefined;
        traceId?: string | undefined;
        spanId?: string | undefined;
        metricName?: string | undefined;
        metricValue?: number | undefined;
        metricUnit?: string | undefined;
        attributes?: Record<string, any> | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    events: {
        environment: string;
        severity: "critical" | "debug" | "info" | "warn" | "error";
        synthetic: boolean;
        timestamp: string;
        source: string;
        eventType: "log" | "metric" | "alert" | "trace";
        id?: string | undefined;
        tenantId?: string | undefined;
        message?: string | undefined;
        serviceId?: string | undefined;
        summary?: string | undefined;
        content?: string | undefined;
        error?: Record<string, any> | undefined;
        traceId?: string | undefined;
        spanId?: string | undefined;
        metricName?: string | undefined;
        metricValue?: number | undefined;
        metricUnit?: string | undefined;
        attributes?: Record<string, any> | undefined;
    }[];
}, {
    events: {
        source: string;
        eventType: "log" | "metric" | "alert" | "trace";
        id?: string | undefined;
        tenantId?: string | undefined;
        environment?: string | undefined;
        message?: string | undefined;
        serviceId?: string | undefined;
        severity?: "critical" | "debug" | "info" | "warn" | "error" | undefined;
        synthetic?: boolean | undefined;
        summary?: string | undefined;
        content?: string | undefined;
        timestamp?: string | undefined;
        error?: Record<string, any> | undefined;
        traceId?: string | undefined;
        spanId?: string | undefined;
        metricName?: string | undefined;
        metricValue?: number | undefined;
        metricUnit?: string | undefined;
        attributes?: Record<string, any> | undefined;
    }[];
}>;
export type IngestionBatch = z.infer<typeof IngestionBatchSchema>;
export declare const IngestionResponseSchema: z.ZodObject<{
    accepted: z.ZodNumber;
    duplicated: z.ZodNumber;
    rejected: z.ZodNumber;
    eventIds: z.ZodArray<z.ZodString, "many">;
    errors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        index: z.ZodNumber;
        error: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        error: string;
        index: number;
    }, {
        error: string;
        index: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    accepted: number;
    duplicated: number;
    rejected: number;
    eventIds: string[];
    errors: {
        error: string;
        index: number;
    }[];
}, {
    accepted: number;
    duplicated: number;
    rejected: number;
    eventIds: string[];
    errors?: {
        error: string;
        index: number;
    }[] | undefined;
}>;
export type IngestionResponse = z.infer<typeof IngestionResponseSchema>;
export declare const FailureDomainRoleEnum: z.ZodEnum<["hub", "consumer", "dependency", "shared_infra"]>;
export type FailureDomainRole = z.infer<typeof FailureDomainRoleEnum>;
export declare const ServiceFailureDomainSchema: z.ZodObject<{
    communityId: z.ZodString;
    name: z.ZodString;
    serviceIds: z.ZodArray<z.ZodString, "many">;
    services: z.ZodArray<z.ZodObject<{
        serviceId: z.ZodString;
        role: z.ZodEnum<["hub", "consumer", "dependency", "shared_infra"]>;
        criticality: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        criticality: string;
        serviceId: string;
        role: "hub" | "consumer" | "dependency" | "shared_infra";
    }, {
        criticality: string;
        serviceId: string;
        role: "hub" | "consumer" | "dependency" | "shared_infra";
    }>, "many">;
    sharedInfrastructure: z.ZodArray<z.ZodString, "many">;
    blastRadiusScore: z.ZodNumber;
    computedAt: z.ZodString;
    rationale: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    serviceIds: string[];
    communityId: string;
    services: {
        criticality: string;
        serviceId: string;
        role: "hub" | "consumer" | "dependency" | "shared_infra";
    }[];
    sharedInfrastructure: string[];
    blastRadiusScore: number;
    computedAt: string;
    rationale: string;
}, {
    name: string;
    serviceIds: string[];
    communityId: string;
    services: {
        criticality: string;
        serviceId: string;
        role: "hub" | "consumer" | "dependency" | "shared_infra";
    }[];
    sharedInfrastructure: string[];
    blastRadiusScore: number;
    computedAt: string;
    rationale: string;
}>;
export type ServiceFailureDomain = z.infer<typeof ServiceFailureDomainSchema>;
export declare const ActionTypeEnum: z.ZodEnum<["cache_flush", "pod_restart", "config_rollback", "jwks_sync", "diagnostic_probe"]>;
export type ActionType = z.infer<typeof ActionTypeEnum>;
export declare const ActionRiskLevelEnum: z.ZodEnum<["low", "medium", "high"]>;
export type ActionRiskLevel = z.infer<typeof ActionRiskLevelEnum>;
export declare const ActionStatusEnum: z.ZodEnum<["proposed", "pending_approval", "approved", "rejected", "executing", "executed", "failed", "verified", "unverified", "expired"]>;
export type ActionStatus = z.infer<typeof ActionStatusEnum>;
export declare const ActionApprovalSchema: z.ZodObject<{
    approverId: z.ZodString;
    approverName: z.ZodString;
    role: z.ZodString;
    approvedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    role: string;
    approverId: string;
    approverName: string;
    approvedAt: string;
}, {
    role: string;
    approverId: string;
    approverName: string;
    approvedAt: string;
}>;
export type ActionApproval = z.infer<typeof ActionApprovalSchema>;
export declare const ActionProposalSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    proposerId: z.ZodOptional<z.ZodString>;
    investigationId: z.ZodString;
    incidentId: z.ZodString;
    procedureId: z.ZodOptional<z.ZodString>;
    procedureVersion: z.ZodOptional<z.ZodNumber>;
    actionType: z.ZodEnum<["cache_flush", "pod_restart", "config_rollback", "jwks_sync", "diagnostic_probe"]>;
    targetServiceId: z.ZodString;
    targetResource: z.ZodString;
    parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    riskLevel: z.ZodEnum<["low", "medium", "high"]>;
    status: z.ZodEnum<["proposed", "pending_approval", "approved", "rejected", "executing", "executed", "failed", "verified", "unverified", "expired"]>;
    explanation: z.ZodString;
    supportingEvidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    preconditions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    expectedPostconditions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    requiresTwoPersonApproval: z.ZodDefault<z.ZodBoolean>;
    approvals: z.ZodDefault<z.ZodArray<z.ZodObject<{
        approverId: z.ZodString;
        approverName: z.ZodString;
        role: z.ZodString;
        approvedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: string;
        approverId: string;
        approverName: string;
        approvedAt: string;
    }, {
        role: string;
        approverId: string;
        approverName: string;
        approvedAt: string;
    }>, "many">>;
    rejectedBy: z.ZodOptional<z.ZodObject<{
        actorId: z.ZodString;
        reason: z.ZodString;
        rejectedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        actorId: string;
        reason: string;
        rejectedAt: string;
    }, {
        actorId: string;
        reason: string;
        rejectedAt: string;
    }>>;
    proposedAt: z.ZodString;
    expiresAt: z.ZodString;
    executedAt: z.ZodOptional<z.ZodString>;
    executionResult: z.ZodOptional<z.ZodObject<{
        status: z.ZodEnum<["success", "failure"]>;
        output: z.ZodString;
        durationMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "success" | "failure";
        durationMs: number;
        output: string;
    }, {
        status: "success" | "failure";
        durationMs: number;
        output: string;
    }>>;
    verificationEvidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    verificationNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    status: "failed" | "verified" | "rejected" | "proposed" | "pending_approval" | "approved" | "executing" | "executed" | "unverified" | "expired";
    incidentId: string;
    investigationId: string;
    supportingEvidenceIds: string[];
    preconditions: string[];
    explanation: string;
    actionType: "cache_flush" | "pod_restart" | "config_rollback" | "jwks_sync" | "diagnostic_probe";
    targetServiceId: string;
    targetResource: string;
    parameters: Record<string, any>;
    riskLevel: "low" | "medium" | "high";
    expectedPostconditions: string[];
    requiresTwoPersonApproval: boolean;
    approvals: {
        role: string;
        approverId: string;
        approverName: string;
        approvedAt: string;
    }[];
    proposedAt: string;
    expiresAt: string;
    verificationEvidenceIds: string[];
    proposerId?: string | undefined;
    procedureId?: string | undefined;
    procedureVersion?: number | undefined;
    rejectedBy?: {
        actorId: string;
        reason: string;
        rejectedAt: string;
    } | undefined;
    executedAt?: string | undefined;
    executionResult?: {
        status: "success" | "failure";
        durationMs: number;
        output: string;
    } | undefined;
    verificationNotes?: string | undefined;
}, {
    id: string;
    status: "failed" | "verified" | "rejected" | "proposed" | "pending_approval" | "approved" | "executing" | "executed" | "unverified" | "expired";
    incidentId: string;
    investigationId: string;
    explanation: string;
    actionType: "cache_flush" | "pod_restart" | "config_rollback" | "jwks_sync" | "diagnostic_probe";
    targetServiceId: string;
    targetResource: string;
    riskLevel: "low" | "medium" | "high";
    proposedAt: string;
    expiresAt: string;
    tenantId?: string | undefined;
    supportingEvidenceIds?: string[] | undefined;
    preconditions?: string[] | undefined;
    proposerId?: string | undefined;
    procedureId?: string | undefined;
    procedureVersion?: number | undefined;
    parameters?: Record<string, any> | undefined;
    expectedPostconditions?: string[] | undefined;
    requiresTwoPersonApproval?: boolean | undefined;
    approvals?: {
        role: string;
        approverId: string;
        approverName: string;
        approvedAt: string;
    }[] | undefined;
    rejectedBy?: {
        actorId: string;
        reason: string;
        rejectedAt: string;
    } | undefined;
    executedAt?: string | undefined;
    executionResult?: {
        status: "success" | "failure";
        durationMs: number;
        output: string;
    } | undefined;
    verificationEvidenceIds?: string[] | undefined;
    verificationNotes?: string | undefined;
}>;
export type ActionProposal = z.infer<typeof ActionProposalSchema>;
export declare const ActionProposeRequestSchema: z.ZodObject<{
    tenantId: z.ZodOptional<z.ZodString>;
    investigationId: z.ZodString;
    incidentId: z.ZodString;
    procedureId: z.ZodOptional<z.ZodString>;
    actionType: z.ZodEnum<["cache_flush", "pod_restart", "config_rollback", "jwks_sync", "diagnostic_probe"]>;
    targetServiceId: z.ZodString;
    targetResource: z.ZodString;
    parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    explanation: z.ZodString;
    riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
}, "strip", z.ZodTypeAny, {
    incidentId: string;
    investigationId: string;
    explanation: string;
    actionType: "cache_flush" | "pod_restart" | "config_rollback" | "jwks_sync" | "diagnostic_probe";
    targetServiceId: string;
    targetResource: string;
    parameters: Record<string, any>;
    riskLevel: "low" | "medium" | "high";
    tenantId?: string | undefined;
    procedureId?: string | undefined;
}, {
    incidentId: string;
    investigationId: string;
    explanation: string;
    actionType: "cache_flush" | "pod_restart" | "config_rollback" | "jwks_sync" | "diagnostic_probe";
    targetServiceId: string;
    targetResource: string;
    tenantId?: string | undefined;
    procedureId?: string | undefined;
    parameters?: Record<string, any> | undefined;
    riskLevel?: "low" | "medium" | "high" | undefined;
}>;
export type ActionProposeRequest = z.infer<typeof ActionProposeRequestSchema>;
export declare const ActionApproveRequestSchema: z.ZodObject<{
    approverId: z.ZodString;
    approverName: z.ZodString;
    role: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role: string;
    approverId: string;
    approverName: string;
}, {
    approverId: string;
    approverName: string;
    role?: string | undefined;
}>;
export type ActionApproveRequest = z.infer<typeof ActionApproveRequestSchema>;
export declare const ActionRejectRequestSchema: z.ZodObject<{
    actorId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    actorId: string;
    reason: string;
}, {
    actorId: string;
    reason: string;
}>;
export type ActionRejectRequest = z.infer<typeof ActionRejectRequestSchema>;
export declare const InvestigationResultSchema: z.ZodObject<{
    investigationId: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    incidentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    question: z.ZodString;
    status: z.ZodEnum<["started", "analyzing", "completed", "insufficient-evidence", "failed"]>;
    startedAt: z.ZodString;
    completedAt: z.ZodString;
    executionMode: z.ZodEnum<["deterministic", "llm-assisted"]>;
    summary: z.ZodString;
    affectedServices: z.ZodArray<z.ZodString, "many">;
    candidateExplanations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        statement: z.ZodString;
        status: z.ZodEnum<["candidate", "supported", "contradicted", "unresolved"]>;
        supportingEvidenceIds: z.ZodArray<z.ZodString, "many">;
        contradictoryEvidenceIds: z.ZodArray<z.ZodString, "many">;
        missingEvidence: z.ZodArray<z.ZodString, "many">;
        graphPaths: z.ZodArray<z.ZodString, "many">;
        explanation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "candidate" | "supported" | "contradicted" | "unresolved";
        statement: string;
        graphPaths: string[];
        supportingEvidenceIds: string[];
        contradictoryEvidenceIds: string[];
        missingEvidence: string[];
        explanation: string;
    }, {
        id: string;
        status: "candidate" | "supported" | "contradicted" | "unresolved";
        statement: string;
        graphPaths: string[];
        supportingEvidenceIds: string[];
        contradictoryEvidenceIds: string[];
        missingEvidence: string[];
        explanation: string;
    }>, "many">;
    evidenceBundle: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        tenantId: z.ZodDefault<z.ZodString>;
        sourceType: z.ZodString;
        sourceRecordId: z.ZodString;
        observedAt: z.ZodString;
        ingestedAt: z.ZodString;
        summary: z.ZodString;
        content: z.ZodString;
        contentHash: z.ZodString;
        synthetic: z.ZodDefault<z.ZodBoolean>;
        reliabilityClass: z.ZodEnum<["authoritative", "high", "medium", "observational"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        tenantId: string;
        synthetic: boolean;
        sourceType: string;
        sourceRecordId: string;
        observedAt: string;
        ingestedAt: string;
        summary: string;
        content: string;
        contentHash: string;
        reliabilityClass: "medium" | "high" | "authoritative" | "observational";
    }, {
        id: string;
        sourceType: string;
        sourceRecordId: string;
        observedAt: string;
        ingestedAt: string;
        summary: string;
        content: string;
        contentHash: string;
        reliabilityClass: "medium" | "high" | "authoritative" | "observational";
        tenantId?: string | undefined;
        synthetic?: boolean | undefined;
    }>, "many">;
    graphPaths: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        pathString: z.ZodString;
        nodes: z.ZodArray<z.ZodString, "many">;
        relationships: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        description: string;
        pathString: string;
        nodes: string[];
        relationships: string[];
    }, {
        description: string;
        pathString: string;
        nodes: string[];
        relationships: string[];
    }>, "many">;
    missingInformation: z.ZodArray<z.ZodString, "many">;
    recommendedNextStep: z.ZodString;
    metrics: z.ZodObject<{
        durationMs: z.ZodNumber;
        graphQueryCount: z.ZodNumber;
        nodesEvaluated: z.ZodNumber;
        relationshipsEvaluated: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        durationMs: number;
        graphQueryCount: number;
        nodesEvaluated: number;
        relationshipsEvaluated: number;
    }, {
        durationMs: number;
        graphQueryCount: number;
        nodesEvaluated: number;
        relationshipsEvaluated: number;
    }>;
    recalledMemories: z.ZodDefault<z.ZodArray<z.ZodObject<{
        memoryId: z.ZodString;
        memoryType: z.ZodEnum<["episodic", "semantic", "procedural"]>;
        statement: z.ZodString;
        relevanceScore: z.ZodNumber;
        retrievalReason: z.ZodString;
        status: z.ZodEnum<["candidate", "active", "superseded", "invalidated", "archived"]>;
        influence: z.ZodEnum<["prioritized_hypothesis", "guided_traversal", "suggested_procedure", "rejected_by_evidence", "inconclusive"]>;
        currentEvidenceCorroboration: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        currentEvidenceContradiction: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        status: "candidate" | "active" | "superseded" | "invalidated" | "archived";
        statement: string;
        memoryId: string;
        memoryType: "episodic" | "semantic" | "procedural";
        relevanceScore: number;
        retrievalReason: string;
        influence: "prioritized_hypothesis" | "guided_traversal" | "suggested_procedure" | "rejected_by_evidence" | "inconclusive";
        currentEvidenceCorroboration: string[];
        currentEvidenceContradiction: string[];
    }, {
        status: "candidate" | "active" | "superseded" | "invalidated" | "archived";
        statement: string;
        memoryId: string;
        memoryType: "episodic" | "semantic" | "procedural";
        relevanceScore: number;
        retrievalReason: string;
        influence: "prioritized_hypothesis" | "guided_traversal" | "suggested_procedure" | "rejected_by_evidence" | "inconclusive";
        currentEvidenceCorroboration?: string[] | undefined;
        currentEvidenceContradiction?: string[] | undefined;
    }>, "many">>;
    generatedMemories: z.ZodOptional<z.ZodObject<{
        episodeId: z.ZodOptional<z.ZodString>;
        claimIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        procedureIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        claimIds: string[];
        procedureIds: string[];
        episodeId?: string | undefined;
    }, {
        episodeId?: string | undefined;
        claimIds?: string[] | undefined;
        procedureIds?: string[] | undefined;
    }>>;
    events: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodString;
        phase: z.ZodString;
        action: z.ZodString;
        details: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        durationMs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        timestamp: string;
        phase: string;
        action: string;
        details: Record<string, any>;
        durationMs?: number | undefined;
    }, {
        id: string;
        timestamp: string;
        phase: string;
        action: string;
        details?: Record<string, any> | undefined;
        durationMs?: number | undefined;
    }>, "many">>;
    failureDomain: z.ZodOptional<z.ZodObject<{
        communityId: z.ZodString;
        name: z.ZodString;
        serviceIds: z.ZodArray<z.ZodString, "many">;
        services: z.ZodArray<z.ZodObject<{
            serviceId: z.ZodString;
            role: z.ZodEnum<["hub", "consumer", "dependency", "shared_infra"]>;
            criticality: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            criticality: string;
            serviceId: string;
            role: "hub" | "consumer" | "dependency" | "shared_infra";
        }, {
            criticality: string;
            serviceId: string;
            role: "hub" | "consumer" | "dependency" | "shared_infra";
        }>, "many">;
        sharedInfrastructure: z.ZodArray<z.ZodString, "many">;
        blastRadiusScore: z.ZodNumber;
        computedAt: z.ZodString;
        rationale: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        serviceIds: string[];
        communityId: string;
        services: {
            criticality: string;
            serviceId: string;
            role: "hub" | "consumer" | "dependency" | "shared_infra";
        }[];
        sharedInfrastructure: string[];
        blastRadiusScore: number;
        computedAt: string;
        rationale: string;
    }, {
        name: string;
        serviceIds: string[];
        communityId: string;
        services: {
            criticality: string;
            serviceId: string;
            role: "hub" | "consumer" | "dependency" | "shared_infra";
        }[];
        sharedInfrastructure: string[];
        blastRadiusScore: number;
        computedAt: string;
        rationale: string;
    }>>;
    actionProposal: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        tenantId: z.ZodDefault<z.ZodString>;
        proposerId: z.ZodOptional<z.ZodString>;
        investigationId: z.ZodString;
        incidentId: z.ZodString;
        procedureId: z.ZodOptional<z.ZodString>;
        procedureVersion: z.ZodOptional<z.ZodNumber>;
        actionType: z.ZodEnum<["cache_flush", "pod_restart", "config_rollback", "jwks_sync", "diagnostic_probe"]>;
        targetServiceId: z.ZodString;
        targetResource: z.ZodString;
        parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        riskLevel: z.ZodEnum<["low", "medium", "high"]>;
        status: z.ZodEnum<["proposed", "pending_approval", "approved", "rejected", "executing", "executed", "failed", "verified", "unverified", "expired"]>;
        explanation: z.ZodString;
        supportingEvidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        preconditions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        expectedPostconditions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        requiresTwoPersonApproval: z.ZodDefault<z.ZodBoolean>;
        approvals: z.ZodDefault<z.ZodArray<z.ZodObject<{
            approverId: z.ZodString;
            approverName: z.ZodString;
            role: z.ZodString;
            approvedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            role: string;
            approverId: string;
            approverName: string;
            approvedAt: string;
        }, {
            role: string;
            approverId: string;
            approverName: string;
            approvedAt: string;
        }>, "many">>;
        rejectedBy: z.ZodOptional<z.ZodObject<{
            actorId: z.ZodString;
            reason: z.ZodString;
            rejectedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            actorId: string;
            reason: string;
            rejectedAt: string;
        }, {
            actorId: string;
            reason: string;
            rejectedAt: string;
        }>>;
        proposedAt: z.ZodString;
        expiresAt: z.ZodString;
        executedAt: z.ZodOptional<z.ZodString>;
        executionResult: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<["success", "failure"]>;
            output: z.ZodString;
            durationMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            status: "success" | "failure";
            durationMs: number;
            output: string;
        }, {
            status: "success" | "failure";
            durationMs: number;
            output: string;
        }>>;
        verificationEvidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        verificationNotes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        tenantId: string;
        status: "failed" | "verified" | "rejected" | "proposed" | "pending_approval" | "approved" | "executing" | "executed" | "unverified" | "expired";
        incidentId: string;
        investigationId: string;
        supportingEvidenceIds: string[];
        preconditions: string[];
        explanation: string;
        actionType: "cache_flush" | "pod_restart" | "config_rollback" | "jwks_sync" | "diagnostic_probe";
        targetServiceId: string;
        targetResource: string;
        parameters: Record<string, any>;
        riskLevel: "low" | "medium" | "high";
        expectedPostconditions: string[];
        requiresTwoPersonApproval: boolean;
        approvals: {
            role: string;
            approverId: string;
            approverName: string;
            approvedAt: string;
        }[];
        proposedAt: string;
        expiresAt: string;
        verificationEvidenceIds: string[];
        proposerId?: string | undefined;
        procedureId?: string | undefined;
        procedureVersion?: number | undefined;
        rejectedBy?: {
            actorId: string;
            reason: string;
            rejectedAt: string;
        } | undefined;
        executedAt?: string | undefined;
        executionResult?: {
            status: "success" | "failure";
            durationMs: number;
            output: string;
        } | undefined;
        verificationNotes?: string | undefined;
    }, {
        id: string;
        status: "failed" | "verified" | "rejected" | "proposed" | "pending_approval" | "approved" | "executing" | "executed" | "unverified" | "expired";
        incidentId: string;
        investigationId: string;
        explanation: string;
        actionType: "cache_flush" | "pod_restart" | "config_rollback" | "jwks_sync" | "diagnostic_probe";
        targetServiceId: string;
        targetResource: string;
        riskLevel: "low" | "medium" | "high";
        proposedAt: string;
        expiresAt: string;
        tenantId?: string | undefined;
        supportingEvidenceIds?: string[] | undefined;
        preconditions?: string[] | undefined;
        proposerId?: string | undefined;
        procedureId?: string | undefined;
        procedureVersion?: number | undefined;
        parameters?: Record<string, any> | undefined;
        expectedPostconditions?: string[] | undefined;
        requiresTwoPersonApproval?: boolean | undefined;
        approvals?: {
            role: string;
            approverId: string;
            approverName: string;
            approvedAt: string;
        }[] | undefined;
        rejectedBy?: {
            actorId: string;
            reason: string;
            rejectedAt: string;
        } | undefined;
        executedAt?: string | undefined;
        executionResult?: {
            status: "success" | "failure";
            durationMs: number;
            output: string;
        } | undefined;
        verificationEvidenceIds?: string[] | undefined;
        verificationNotes?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    status: "failed" | "started" | "analyzing" | "completed" | "insufficient-evidence";
    startedAt: string;
    summary: string;
    investigationId: string;
    graphPaths: {
        description: string;
        pathString: string;
        nodes: string[];
        relationships: string[];
    }[];
    question: string;
    executionMode: "deterministic" | "llm-assisted";
    events: {
        id: string;
        timestamp: string;
        phase: string;
        action: string;
        details: Record<string, any>;
        durationMs?: number | undefined;
    }[];
    completedAt: string;
    affectedServices: string[];
    candidateExplanations: {
        id: string;
        status: "candidate" | "supported" | "contradicted" | "unresolved";
        statement: string;
        graphPaths: string[];
        supportingEvidenceIds: string[];
        contradictoryEvidenceIds: string[];
        missingEvidence: string[];
        explanation: string;
    }[];
    evidenceBundle: {
        id: string;
        tenantId: string;
        synthetic: boolean;
        sourceType: string;
        sourceRecordId: string;
        observedAt: string;
        ingestedAt: string;
        summary: string;
        content: string;
        contentHash: string;
        reliabilityClass: "medium" | "high" | "authoritative" | "observational";
    }[];
    missingInformation: string[];
    recommendedNextStep: string;
    metrics: {
        durationMs: number;
        graphQueryCount: number;
        nodesEvaluated: number;
        relationshipsEvaluated: number;
    };
    recalledMemories: {
        status: "candidate" | "active" | "superseded" | "invalidated" | "archived";
        statement: string;
        memoryId: string;
        memoryType: "episodic" | "semantic" | "procedural";
        relevanceScore: number;
        retrievalReason: string;
        influence: "prioritized_hypothesis" | "guided_traversal" | "suggested_procedure" | "rejected_by_evidence" | "inconclusive";
        currentEvidenceCorroboration: string[];
        currentEvidenceContradiction: string[];
    }[];
    incidentId?: string | null | undefined;
    generatedMemories?: {
        claimIds: string[];
        procedureIds: string[];
        episodeId?: string | undefined;
    } | undefined;
    failureDomain?: {
        name: string;
        serviceIds: string[];
        communityId: string;
        services: {
            criticality: string;
            serviceId: string;
            role: "hub" | "consumer" | "dependency" | "shared_infra";
        }[];
        sharedInfrastructure: string[];
        blastRadiusScore: number;
        computedAt: string;
        rationale: string;
    } | undefined;
    actionProposal?: {
        id: string;
        tenantId: string;
        status: "failed" | "verified" | "rejected" | "proposed" | "pending_approval" | "approved" | "executing" | "executed" | "unverified" | "expired";
        incidentId: string;
        investigationId: string;
        supportingEvidenceIds: string[];
        preconditions: string[];
        explanation: string;
        actionType: "cache_flush" | "pod_restart" | "config_rollback" | "jwks_sync" | "diagnostic_probe";
        targetServiceId: string;
        targetResource: string;
        parameters: Record<string, any>;
        riskLevel: "low" | "medium" | "high";
        expectedPostconditions: string[];
        requiresTwoPersonApproval: boolean;
        approvals: {
            role: string;
            approverId: string;
            approverName: string;
            approvedAt: string;
        }[];
        proposedAt: string;
        expiresAt: string;
        verificationEvidenceIds: string[];
        proposerId?: string | undefined;
        procedureId?: string | undefined;
        procedureVersion?: number | undefined;
        rejectedBy?: {
            actorId: string;
            reason: string;
            rejectedAt: string;
        } | undefined;
        executedAt?: string | undefined;
        executionResult?: {
            status: "success" | "failure";
            durationMs: number;
            output: string;
        } | undefined;
        verificationNotes?: string | undefined;
    } | undefined;
}, {
    status: "failed" | "started" | "analyzing" | "completed" | "insufficient-evidence";
    startedAt: string;
    summary: string;
    investigationId: string;
    graphPaths: {
        description: string;
        pathString: string;
        nodes: string[];
        relationships: string[];
    }[];
    question: string;
    executionMode: "deterministic" | "llm-assisted";
    completedAt: string;
    affectedServices: string[];
    candidateExplanations: {
        id: string;
        status: "candidate" | "supported" | "contradicted" | "unresolved";
        statement: string;
        graphPaths: string[];
        supportingEvidenceIds: string[];
        contradictoryEvidenceIds: string[];
        missingEvidence: string[];
        explanation: string;
    }[];
    evidenceBundle: {
        id: string;
        sourceType: string;
        sourceRecordId: string;
        observedAt: string;
        ingestedAt: string;
        summary: string;
        content: string;
        contentHash: string;
        reliabilityClass: "medium" | "high" | "authoritative" | "observational";
        tenantId?: string | undefined;
        synthetic?: boolean | undefined;
    }[];
    missingInformation: string[];
    recommendedNextStep: string;
    metrics: {
        durationMs: number;
        graphQueryCount: number;
        nodesEvaluated: number;
        relationshipsEvaluated: number;
    };
    tenantId?: string | undefined;
    incidentId?: string | null | undefined;
    events?: {
        id: string;
        timestamp: string;
        phase: string;
        action: string;
        details?: Record<string, any> | undefined;
        durationMs?: number | undefined;
    }[] | undefined;
    recalledMemories?: {
        status: "candidate" | "active" | "superseded" | "invalidated" | "archived";
        statement: string;
        memoryId: string;
        memoryType: "episodic" | "semantic" | "procedural";
        relevanceScore: number;
        retrievalReason: string;
        influence: "prioritized_hypothesis" | "guided_traversal" | "suggested_procedure" | "rejected_by_evidence" | "inconclusive";
        currentEvidenceCorroboration?: string[] | undefined;
        currentEvidenceContradiction?: string[] | undefined;
    }[] | undefined;
    generatedMemories?: {
        episodeId?: string | undefined;
        claimIds?: string[] | undefined;
        procedureIds?: string[] | undefined;
    } | undefined;
    failureDomain?: {
        name: string;
        serviceIds: string[];
        communityId: string;
        services: {
            criticality: string;
            serviceId: string;
            role: "hub" | "consumer" | "dependency" | "shared_infra";
        }[];
        sharedInfrastructure: string[];
        blastRadiusScore: number;
        computedAt: string;
        rationale: string;
    } | undefined;
    actionProposal?: {
        id: string;
        status: "failed" | "verified" | "rejected" | "proposed" | "pending_approval" | "approved" | "executing" | "executed" | "unverified" | "expired";
        incidentId: string;
        investigationId: string;
        explanation: string;
        actionType: "cache_flush" | "pod_restart" | "config_rollback" | "jwks_sync" | "diagnostic_probe";
        targetServiceId: string;
        targetResource: string;
        riskLevel: "low" | "medium" | "high";
        proposedAt: string;
        expiresAt: string;
        tenantId?: string | undefined;
        supportingEvidenceIds?: string[] | undefined;
        preconditions?: string[] | undefined;
        proposerId?: string | undefined;
        procedureId?: string | undefined;
        procedureVersion?: number | undefined;
        parameters?: Record<string, any> | undefined;
        expectedPostconditions?: string[] | undefined;
        requiresTwoPersonApproval?: boolean | undefined;
        approvals?: {
            role: string;
            approverId: string;
            approverName: string;
            approvedAt: string;
        }[] | undefined;
        rejectedBy?: {
            actorId: string;
            reason: string;
            rejectedAt: string;
        } | undefined;
        executedAt?: string | undefined;
        executionResult?: {
            status: "success" | "failure";
            durationMs: number;
            output: string;
        } | undefined;
        verificationEvidenceIds?: string[] | undefined;
        verificationNotes?: string | undefined;
    } | undefined;
}>;
export type InvestigationResult = z.infer<typeof InvestigationResultSchema>;
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
export declare const TenantRoleEnum: z.ZodEnum<["admin", "operator", "viewer", "system"]>;
export type TenantRole = z.infer<typeof TenantRoleEnum>;
export declare const TenantContextSchema: z.ZodObject<{
    tenantId: z.ZodString;
    principalId: z.ZodString;
    roles: z.ZodDefault<z.ZodArray<z.ZodEnum<["admin", "operator", "viewer", "system"]>, "many">>;
    correlationId: z.ZodString;
    isSharedAccessAuthorized: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    principalId: string;
    roles: ("admin" | "operator" | "viewer" | "system")[];
    correlationId: string;
    isSharedAccessAuthorized: boolean;
}, {
    tenantId: string;
    principalId: string;
    correlationId: string;
    roles?: ("admin" | "operator" | "viewer" | "system")[] | undefined;
    isSharedAccessAuthorized?: boolean | undefined;
}>;
export type TenantContext = z.infer<typeof TenantContextSchema>;
export declare const EventProcessingStateEnum: z.ZodEnum<["received", "validated", "persisted", "duplicate", "rejected", "retryable_failure", "failed"]>;
export type EventProcessingState = z.infer<typeof EventProcessingStateEnum>;
export declare const EventProcessingStatusSchema: z.ZodObject<{
    eventId: z.ZodString;
    tenantId: z.ZodString;
    state: z.ZodEnum<["received", "validated", "persisted", "duplicate", "rejected", "retryable_failure", "failed"]>;
    timestamp: z.ZodString;
    retryCount: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    contentHash: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    timestamp: string;
    eventId: string;
    state: "received" | "failed" | "rejected" | "validated" | "persisted" | "duplicate" | "retryable_failure";
    contentHash?: string | undefined;
    error?: string | undefined;
    retryCount?: number | undefined;
}, {
    tenantId: string;
    timestamp: string;
    eventId: string;
    state: "received" | "failed" | "rejected" | "validated" | "persisted" | "duplicate" | "retryable_failure";
    contentHash?: string | undefined;
    error?: string | undefined;
    retryCount?: number | undefined;
}>;
export type EventProcessingStatus = z.infer<typeof EventProcessingStatusSchema>;
export declare const AuditActionEnum: z.ZodEnum<["auth_failure", "authz_denied", "telemetry_ingested", "investigation_created", "investigation_completed", "memory_created", "memory_superseded", "memory_archived", "action_proposed", "action_approved", "action_rejected", "action_executed", "postcondition_verified", "lifecycle_pruned", "maintenance_run"]>;
export type AuditAction = z.infer<typeof AuditActionEnum>;
export declare const AuditRecordSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    principalId: z.ZodString;
    action: z.ZodEnum<["auth_failure", "authz_denied", "telemetry_ingested", "investigation_created", "investigation_completed", "memory_created", "memory_superseded", "memory_archived", "action_proposed", "action_approved", "action_rejected", "action_executed", "postcondition_verified", "lifecycle_pruned", "maintenance_run"]>;
    resourceType: z.ZodString;
    resourceId: z.ZodString;
    status: z.ZodEnum<["success", "failure", "denied"]>;
    timestamp: z.ZodString;
    correlationId: z.ZodOptional<z.ZodString>;
    details: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    status: "success" | "failure" | "denied";
    timestamp: string;
    action: "auth_failure" | "authz_denied" | "telemetry_ingested" | "investigation_created" | "investigation_completed" | "memory_created" | "memory_superseded" | "memory_archived" | "action_proposed" | "action_approved" | "action_rejected" | "action_executed" | "postcondition_verified" | "lifecycle_pruned" | "maintenance_run";
    details: Record<string, any>;
    principalId: string;
    resourceType: string;
    resourceId: string;
    correlationId?: string | undefined;
}, {
    id: string;
    tenantId: string;
    status: "success" | "failure" | "denied";
    timestamp: string;
    action: "auth_failure" | "authz_denied" | "telemetry_ingested" | "investigation_created" | "investigation_completed" | "memory_created" | "memory_superseded" | "memory_archived" | "action_proposed" | "action_approved" | "action_rejected" | "action_executed" | "postcondition_verified" | "lifecycle_pruned" | "maintenance_run";
    principalId: string;
    resourceType: string;
    resourceId: string;
    details?: Record<string, any> | undefined;
    correlationId?: string | undefined;
}>;
export type AuditRecord = z.infer<typeof AuditRecordSchema>;
export declare const LifecycleRetentionPolicySchema: z.ZodObject<{
    telemetryDays: z.ZodDefault<z.ZodNumber>;
    investigationDays: z.ZodDefault<z.ZodNumber>;
    evidenceDays: z.ZodDefault<z.ZodNumber>;
    memoryDays: z.ZodDefault<z.ZodNumber>;
    protectActiveIncidents: z.ZodDefault<z.ZodBoolean>;
    protectActiveInvestigations: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    telemetryDays: number;
    investigationDays: number;
    evidenceDays: number;
    memoryDays: number;
    protectActiveIncidents: boolean;
    protectActiveInvestigations: boolean;
}, {
    telemetryDays?: number | undefined;
    investigationDays?: number | undefined;
    evidenceDays?: number | undefined;
    memoryDays?: number | undefined;
    protectActiveIncidents?: boolean | undefined;
    protectActiveInvestigations?: boolean | undefined;
}>;
export type LifecycleRetentionPolicy = z.infer<typeof LifecycleRetentionPolicySchema>;
export declare const LifecyclePruneRequestSchema: z.ZodObject<{
    dryRun: z.ZodDefault<z.ZodBoolean>;
    category: z.ZodDefault<z.ZodEnum<["telemetry", "evidence", "investigations", "all"]>>;
    olderThanDays: z.ZodDefault<z.ZodNumber>;
    batchSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    dryRun: boolean;
    category: "telemetry" | "evidence" | "investigations" | "all";
    olderThanDays: number;
    batchSize: number;
}, {
    dryRun?: boolean | undefined;
    category?: "telemetry" | "evidence" | "investigations" | "all" | undefined;
    olderThanDays?: number | undefined;
    batchSize?: number | undefined;
}>;
export type LifecyclePruneRequest = z.infer<typeof LifecyclePruneRequestSchema>;
export declare const LifecyclePruneResultSchema: z.ZodObject<{
    dryRun: z.ZodBoolean;
    tenantId: z.ZodString;
    category: z.ZodString;
    candidatesIdentified: z.ZodNumber;
    recordsPruned: z.ZodNumber;
    recordsPreserved: z.ZodNumber;
    preservedReasons: z.ZodRecord<z.ZodString, z.ZodNumber>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    timestamp: string;
    dryRun: boolean;
    category: string;
    candidatesIdentified: number;
    recordsPruned: number;
    recordsPreserved: number;
    preservedReasons: Record<string, number>;
}, {
    tenantId: string;
    timestamp: string;
    dryRun: boolean;
    category: string;
    candidatesIdentified: number;
    recordsPruned: number;
    recordsPreserved: number;
    preservedReasons: Record<string, number>;
}>;
export type LifecyclePruneResult = z.infer<typeof LifecyclePruneResultSchema>;
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
//# sourceMappingURL=index.d.ts.map