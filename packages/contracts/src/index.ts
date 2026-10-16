import { z } from 'zod';

// ==========================================
// 1. Core Graph Domain Entities & Schemas
// ==========================================

export const CriticalityEnum = z.enum(['tier-1', 'tier-2', 'tier-3', 'low', 'medium', 'high', 'critical']);
export type Criticality = z.infer<typeof CriticalityEnum>;

export const ServiceSchema = z.object({
  id: z.string().min(1),
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
  name: z.string().min(1),
  description: z.string(),
  onCallContact: z.string().optional(),
});
export type Team = z.infer<typeof TeamSchema>;

export const HypothesisStatusEnum = z.enum(['candidate', 'supported', 'contradicted', 'unresolved']);
export type HypothesisStatus = z.infer<typeof HypothesisStatusEnum>;

export const HypothesisSchema = z.object({
  id: z.string().min(1),
  incidentId: z.string().min(1),
  statement: z.string().min(1),
  status: HypothesisStatusEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const SourceRecordSchema = z.object({
  id: z.string().min(1),
  sourceType: z.string(),
  externalId: z.string(),
  uri: z.string().optional(),
  observedAt: z.string(),
  contentHash: z.string(),
  synthetic: z.boolean().default(true),
});
export type SourceRecord = z.infer<typeof SourceRecordSchema>;

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

export const InvestigationResultSchema = z.object({
  investigationId: z.string(),
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
  incidentId?: string | null;
  question: string;
  status: InvestigationStatus;
  startedAt: string;
  completedAt?: string;
  executionMode: InvestigationExecutionMode;
  summary: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    correlationId?: string;
  };
}
