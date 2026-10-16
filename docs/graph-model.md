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

---

## 3. Implemented Relationship Types

| Relationship Type | Source Label | Target Label | Semantics |
|---|---|---|---|
| `DEPENDS_ON` | `Service` | `Service` | Source service synchronously or asynchronously depends on target service |
| `HAS_DEPLOYMENT` | `Service` | `Deployment` | Target deployment was released on source service |
| `AFFECTS` | `Incident` | `Service` | Source incident degrades or disrupts target service |
| `OWNED_BY` | `Service` | `Team` | Target team is responsible for source service |
| `OBSERVED_IN` | `Evidence` | `Incident` | Source evidence was captured during target incident |
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
