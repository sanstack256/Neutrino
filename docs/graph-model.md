# Neutrino Graph Data Model Specification

## 1. Overview
Neutrino is built on **FalkorDB** as its primary graph database. The graph represents an enterprise operational topology comprising software services, team ownership, deployment history, operational incidents, and observable evidence telemetry.

---

## 2. Implemented Node Labels

### `Service`
Represents an application or operational component.
- **Properties**:
  - `id` (String, Indexed): Unique service identifier (e.g., `checkout-service`, `auth-service`)
  - `name` (String): Human-readable display name
  - `description` (String): Functional description
  - `criticality` (String): Tier categorization (`tier-1`, `tier-2`, `tier-3`)
  - `environment` (String): Deployment environment (`production`, `staging`)
  - `createdAt` (ISO 8601 UTC Timestamp)
  - `updatedAt` (ISO 8601 UTC Timestamp)

### `Deployment`
Represents a software release or configuration change event on a service.
- **Properties**:
  - `id` (String, Indexed): Stable deployment ID (e.g., `dep-auth-2.4.1`)
  - `serviceId` (String): Service identifier
  - `version` (String): Semantic version string (e.g., `v2.4.1`)
  - `environment` (String): Target environment
  - `deployedAt` (ISO 8601 UTC Timestamp): Release timestamp
  - `status` (String): `succeeded`, `failed`, `in-progress`, `rolled-back`
  - `changeSummary` (String): Commit message or release notes explaining what changed
  - `author` (String, Optional): Engineering user handle

### `Incident`
Represents an operational incident or performance degradation.
- **Properties**:
  - `id` (String, Indexed): Incident identifier (e.g., `INC-2026-101`)
  - `title` (String): Incident summary title
  - `description` (String): Detailed symptom report
  - `severity` (String): `SEV-1`, `SEV-2`, `SEV-3`, `SEV-4`
  - `status` (String): `investigating`, `identified`, `monitoring`, `resolved`
  - `startedAt` (ISO 8601 UTC Timestamp): Error onset time
  - `resolvedAt` (ISO 8601 UTC Timestamp, Optional): Resolution timestamp
  - `environment` (String): Operational environment
  - `synthetic` (Boolean): Identifies record as synthetic demonstration data

### `Evidence`
Represents an observation, metric spike, log entry, alert, or postmortem record.
- **Properties**:
  - `id` (String, Indexed): Stable evidence ID (e.g., `EV-101-01`)
  - `sourceType` (String): Telemetry source (`log`, `metric`, `alert`, `postmortem`, `status_page`)
  - `sourceRecordId` (String): External identifier in the source telemetry system
  - `observedAt` (ISO 8601 UTC Timestamp): When the observation occurred
  - `ingestedAt` (ISO 8601 UTC Timestamp): When the observation was ingested
  - `summary` (String): Concise statement of observation
  - `content` (String): Raw log snippet, metric JSON, or alert payload
  - `contentHash` (String): SHA-256 or unique content hash for deduplication
  - `synthetic` (Boolean): Identifies record as synthetic
  - `reliabilityClass` (String): Policy class (`authoritative`, `high`, `medium`, `observational`)

### `Team`
Represents an engineering or operations team responsible for services or incidents.
- **Properties**:
  - `id` (String, Indexed): Team identifier (e.g., `team-identity`, `team-commerce`)
  - `name` (String): Team name
  - `description` (String): Team remit
  - `onCallContact` (String): PagerDuty / Slack on-call handle

### `Hypothesis`
Represents a candidate explanation evaluated during an investigation.
- **Properties**:
  - `id` (String, Indexed): Hypothesis ID (e.g., `hyp-upstream-deployment-desync`)
  - `statement` (String): Candidate causal statement
  - `status` (String): `candidate`, `supported`, `contradicted`, `unresolved`
  - `explanation` (String): Detailed reasoning
  - `incidentId` (String): Associated incident ID
  - `updatedAt` (ISO 8601 UTC Timestamp)

### `Investigation`
Represents an executed investigation run.
- **Properties**:
  - `id` (String, Indexed): Investigation ID (e.g., `inv-9fdb09ca`)
  - `question` (String): Initial investigation question
  - `status` (String): `completed`, `insufficient-evidence`, `failed`
  - `startedAt` (ISO 8601 UTC Timestamp)
  - `completedAt` (ISO 8601 UTC Timestamp)
  - `executionMode` (String): `deterministic` or `llm-assisted`
  - `summary` (String): Synthesized outcome summary
  - `recommendedNextStep` (String): Non-destructive diagnostic action
  - `rawResult` (JSON String): Full serialized investigation result bundle

### `SourceRecord`
Represents the provenance origin of an evidence telemetry record in an upstream system.
- **Properties**:
  - `id` (String, Indexed): Source system ID (e.g., `src-apm-datadog`, `src-k8s-logs`)
  - `sourceType` (String): Source category (`apm`, `alertmanager`, `k8s-logs`, `github-releases`, `postmortem-archive`, `external-status`)
  - `externalId` (String): External provider identifier
  - `uri` (String, Optional): External source URL or dashboard reference
  - `observedAt` (ISO 8601 UTC Timestamp)
  - `contentHash` (String)
  - `synthetic` (Boolean): Identifies record as synthetic demonstration data

---

## 3. Implemented Relationship Types

| Relationship Type | Source Label | Target Label | Semantics |
|---|---|---|---|
| `DEPENDS_ON` | `Service` | `Service` | Source service synchronously or asynchronously depends on target service |
| `HAS_DEPLOYMENT` | `Service` | `Deployment` | Target deployment was released on source service |
| `AFFECTS` | `Incident` | `Service` | Source incident degrades or disrupts target service |
| `OWNED_BY` | `Service` | `Team` | Target team is responsible for source service |
| `OBSERVED_IN` | `Evidence` | `Incident` | Source evidence was captured during target incident |
| `REFERENCES` | `Evidence` | `SourceRecord` | Source evidence links directly to its provenance origin record |
| `SUPPORTED_BY` | `Hypothesis` | `Evidence` | Source hypothesis is corroborated by target evidence |
| `CONTRADICTED_BY`| `Hypothesis` | `Evidence` | Source hypothesis is disproven by target evidence |
| `INVESTIGATED_IN` | `Incident` | `Investigation`| Target investigation investigated source incident |
| `RELATED_TO` | `Incident` | `Incident` | Historical or topological relationship between incidents |
| `EVALUATED_HYPOTHESIS` | `Investigation` | `Hypothesis` | Investigation evaluated candidate hypothesis |

---

## 4. FalkorDB Indexing & Identity Strategy
Every node has a primary `id` property. On database startup and during seeding, the repository executes:
```cypher
CREATE INDEX FOR (s:Service) ON (s.id);
CREATE INDEX FOR (d:Deployment) ON (d.id);
CREATE INDEX FOR (i:Incident) ON (i.id);
CREATE INDEX FOR (e:Evidence) ON (e.id);
CREATE INDEX FOR (t:Team) ON (t.id);
CREATE INDEX FOR (h:Hypothesis) ON (h.id);
CREATE INDEX FOR (inv:Investigation) ON (inv.id);
CREATE INDEX FOR (src:SourceRecord) ON (src.id);
```
All seed mutations use Cypher `MERGE` statements on primary `id` attributes, guaranteeing idempotent execution without duplicate node or relationship creation.

---

## 5. Core Cypher Queries Used in Neutrino

### Operation A — Incident Context Retrieval
```cypher
MATCH (i:Incident {id: $id})
OPTIONAL MATCH (i)-[:AFFECTS]->(s:Service)
OPTIONAL MATCH (s)-[:OWNED_BY]->(t:Team)
RETURN i, s, t LIMIT 1
```

### Operation B — Multi-Hop Dependency Traversal (Bounded Depth)
```cypher
MATCH p = (start:Service {id: $svcId})-[:DEPENDS_ON*1..3]->(dep:Service)
RETURN dep, length(p) AS depth, [n IN nodes(p) | n.id] AS pathNodes
ORDER BY depth ASC
LIMIT 50
```

### Operation C — Downstream Impact Traversal
```cypher
MATCH p = (consumer:Service)-[:DEPENDS_ON*1..3]->(target:Service {id: $svcId})
RETURN consumer, length(p) AS depth, [n IN nodes(p) | n.id] AS pathNodes
ORDER BY depth ASC
LIMIT 50
```

### Operation D — Recent Deployments on Target & Upstream Services
```cypher
MATCH (s:Service)-[:HAS_DEPLOYMENT]->(d:Deployment)
WHERE s.id IN $serviceIds
RETURN d, s.id AS serviceId
ORDER BY d.deployedAt DESC
LIMIT $limit
```

### Operation E — Incident Evidence Observations
```cypher
MATCH (e:Evidence)-[:OBSERVED_IN]->(i:Incident {id: $id})
RETURN e
ORDER BY e.observedAt ASC
LIMIT 50
```

### Operation F — Related Historical Incidents
```cypher
MATCH (i:Incident {id: $id})-[:RELATED_TO]-(hist:Incident)
RETURN DISTINCT hist
LIMIT 10
```

### Operation G — Multi-Hop Explanation Path Exploration
```cypher
MATCH p = (start {id: $startId})-[r*1..4]-(target {id: $endId})
RETURN p,
       [n IN nodes(p) | coalesce(n.id, id(n))] AS nodeIds,
       [rel IN relationships(p) | type(rel)] AS relTypes
LIMIT 5
```

---

## 5. Stage 2 Persistent Graph Memory Nodes

### `MemoryEpisode`
Represents a discrete, synthesized operational investigation experience persisted in FalkorDB.
- **Properties**:
  - `id` (String, Indexed): Stable episode identifier (e.g., `ep-8a3f912c`)
  - `investigationId` (String): Source investigation identifier
  - `incidentId` (String, Optional): Associated incident ID
  - `summary` (String): Factual summary grounded in observed investigation events
  - `serviceIds` (List<String>): Services traversed and evaluated
  - `hypothesisIds` (List<String>): Hypotheses evaluated
  - `supportedHypothesisId` (String, Optional): Validated explanation ID
  - `outcome` (String): `completed`, `insufficient-evidence`, `blocked`
  - `status` (String): `active`, `superseded`, `invalidated`, `archived`
  - `createdAt` (ISO 8601 UTC Timestamp)
  - `synthetic` (Boolean)

### `KnowledgeClaim`
Represents an evidence-grounded semantic operational fact or causal dependency claim.
- **Properties**:
  - `id` (String, Indexed): Unique claim ID (e.g., `claim-0dbe71bb`)
  - `subject` (String): Entity subject (e.g., `checkout-service`)
  - `predicate` (String): Relational predicate (`depends_on`, `caused_by_condition`, `degraded_by`)
  - `object` (String): Entity object (e.g., `auth-service`, `database-failure`)
  - `statement` (String): Natural language proposition
  - `claimType` (String): `observational`, `inferred`, `verified`
  - `status` (String): `candidate`, `active`, `superseded`, `invalidated`, `archived`
  - `confidence` (Float): Quality score [0.0 - 1.0]
  - `sourceProvenance` (String): Traceable origin investigation or monitor
  - `firstObservedAt` (ISO 8601 UTC Timestamp)
  - `lastVerifiedAt` (ISO 8601 UTC Timestamp)
  - `validUntil` (ISO 8601 UTC Timestamp, Optional)
  - `revision` (Integer): Monotonically increasing revision number
  - `supersededById` (String, Optional): ID of newer claim superseding this record
  - `invalidationReason` (String, Optional): Documented justification for invalidation

### `DiagnosticProcedure`
Represents a reusable, non-destructive diagnostic procedure derived from validated investigations.
- **Properties**:
  - `id` (String, Indexed): Unique procedure ID (e.g., `proc-jwks-check`)
  - `name` (String): Short descriptive procedure title
  - `purpose` (String): Diagnostic objective
  - `serviceId` (String): Target service
  - `preconditions` (List<String>): Trigger criteria (e.g., active 500 error spikes)
  - `requiredEvidenceTypes` (List<String>): Evidence sources needed (`metric`, `log`)
  - `diagnosticSteps` (List<String>): Ordered non-destructive steps
  - `expectedObservations` (List<String>): Expected healthy signals
  - `supportingConditions` (List<String>): Observations supporting the diagnosis
  - `contradictingConditions` (List<String>): Observations refuting the diagnosis
  - `knownFailureModes` (List<String>): Known failure symptoms
  - `status` (String): `candidate`, `active`, `superseded`, `invalidated`, `archived`
  - `validationCriteria` (String): Verification check
  - `version` (Integer)
  - `lastValidatedAt` (ISO 8601 UTC Timestamp)
  - `synthetic` (Boolean)

---

## 6. Stage 2 Memory Graph Relationships

| Relationship | Source Label | Target Label | Description |
|---|---|---|---|
| `GENERATED_EPISODE` | `Investigation` | `MemoryEpisode` | Links completed investigation to persisted episode |
| `CONCERNS_SERVICE` | `MemoryEpisode` | `Service` | Associates episode with impacted services |
| `CONCERNS_INCIDENT` | `MemoryEpisode` | `Incident` | Associates episode with root incident |
| `RECORDED_CLAIM` | `MemoryEpisode` | `KnowledgeClaim` | Links episode to extracted operational facts |
| `RECOMMENDED_PROCEDURE` | `MemoryEpisode` | `DiagnosticProcedure`| Links episode to derived diagnostic procedure |
| `GROUNDED_IN` | `KnowledgeClaim` | `Evidence` | Explicit provenance edge to corroborating evidence |
| `CONTRADICTED_BY` | `KnowledgeClaim` | `Evidence` | Explicit edge to live disproving evidence |
| `SUPERSEDES` | `KnowledgeClaim` | `KnowledgeClaim` | Audit edge from new revision to replaced revision |
| `TARGETS_SERVICE` | `DiagnosticProcedure` | `Service` | Connects procedure to target service topology |

---

## 7. Stage 2 Memory Cypher Operations

### Operation H — Multi-Signal Connected Memory Retrieval
```cypher
MATCH (c:KnowledgeClaim)
WHERE c.status = 'active' AND (c.subject IN $services OR c.object IN $services)
RETURN c ORDER BY c.lastVerifiedAt DESC LIMIT $limit
```

### Operation I — Validated Diagnostic Procedure Recall
```cypher
MATCH (p:DiagnosticProcedure)
WHERE p.status = 'active' AND p.serviceId IN $services
RETURN p ORDER BY p.lastValidatedAt DESC LIMIT $limit
```

### Operation J — Atomic Claim Supersession
```cypher
MATCH (c:KnowledgeClaim {id: $cId}), (old:KnowledgeClaim {id: $oldId})
MERGE (c)-[:SUPERSEDES]->(old)
SET old.status = 'superseded', old.supersededById = $cId
```

### Operation K — Grounded Evidence Verification
```cypher
MATCH (c:KnowledgeClaim {id: $id})-[:GROUNDED_IN]->(e:Evidence)
RETURN e
```

---

## 8. Stage 4 Production Architecture & Multi-Tenant Model

### 8.1 Tenant Ownership & Boundaries
Every operational entity in FalkorDB (`Service`, `Deployment`, `Incident`, `Evidence`, `Team`, `Investigation`, `Hypothesis`, `MemoryEpisode`, `KnowledgeClaim`, `DiagnosticProcedure`, `ActionProposal`, `AuditRecord`, `EventProcessingStatus`) includes a `tenantId` property.
- **Default Isolation Rule**:
  ```cypher
  WHERE (n.tenantId = $tenantId OR n.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND n.tenantId IS NULL))
  ```
- **Strict Boundary Traversal Rule**:
  Multi-hop graph paths are restricted to ensure no node along the traversal hops into another tenant's private infrastructure:
  ```cypher
  MATCH p = (s:Service {id: $serviceId})-[:DEPENDS_ON*1..3]->(target:Service)
  WHERE ALL(n IN nodes(p) WHERE n.tenantId = $tenantId OR n.tenantId = 'shared' OR ($tenantId = 'tenant-default' AND n.tenantId IS NULL))
  RETURN target, relationships(p)
  ```

### 8.2 Additional Stage 4 Node Labels

#### `AuditRecord`
Durable operational audit trail stored in FalkorDB for security, compliance, and sensitive action tracking.
- **Properties**:
  - `id` (String, Indexed): Stable UUID identifier (`aud-xxx`)
  - `tenantId` (String, Indexed): Owning tenant
  - `principalId` (String): Authenticated identity that executed or requested the action
  - `action` (String): Action identifier (`telemetry_ingested`, `investigation_created`, `action_proposed`, `action_approved`, `action_rejected`, `action_executed`, `lifecycle_pruned`, `authz_denied`)
  - `resourceType` (String): Target resource category (`action_proposal`, `incident`, `telemetry_batch`, `graph_lifecycle`)
  - `resourceId` (String): Targeted resource ID
  - `status` (String): `success`, `failure`, `denied`
  - `timestamp` (ISO 8601 UTC Timestamp)
  - `correlationId` (String): End-to-end request tracing correlation ID
  - `details` (JSON String): Structured action details

#### `EventProcessingStatus`
Durable event ingestion and retry lifecycle status tracking.
- **Properties**:
  - `eventId` (String, Indexed): Telemetry event ID
  - `tenantId` (String, Indexed): Owning tenant
  - `state` (String): `received`, `validated`, `persisted`, `duplicate`, `rejected`, `failed`
  - `timestamp` (ISO 8601 UTC Timestamp)
  - `retryCount` (Integer): Backoff retry counter
  - `contentHash` (String, Indexed): Content hash for deduplication
  - `error` (String, Optional): Failure description if rejected or failed

### 8.3 Documented Retention Policies
| Category | Retention Policy | Protection Criteria |
|---|---|---|
| `telemetry_evidence` | 30 days | Preserved if linked to active incident (`status IN ['investigating', 'identified', 'monitoring']`), hypothesis (`SUPPORTED_BY`), memory claim (`GROUNDED_IN`), or action proposal (`VERIFIED_BY`) |
| `investigations` | 90 days | Preserved if investigation status is active or referenced by postmortem |
| `knowledge_claims` | Permanent provenance | Superseded claims transitioned to `archived` status rather than destructively deleted |
| `audit_records` | 365 days | Protected immutable audit log; non-erasable by standard operators |


