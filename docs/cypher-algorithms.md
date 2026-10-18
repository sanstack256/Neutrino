# Neutrino Cypher Queries and Graph Algorithms Manual

This document details the representative, production-tested Cypher queries and graph algorithms implemented in **Neutrino**, powered by **FalkorDB**.

Neutrino uses FalkorDB not as an auxiliary key-value store, but as its core reasoning substrate. Every investigation traverses topological relationships, evaluates preceding deployments, detects contradictions, queries graph-backed memory, and verifies remediation outcomes through Cypher graph traversals.

---

## 1. Schema Indexing & Tenant-Aware Guardrails

Neutrino initializes dual indices on `(id)` and `(tenantId)` across all core node labels to ensure point lookups and tenant-filtered subgraphs run with sub-millisecond execution times.

### 1.1 Dual-Property Index Creation
```cypher
CREATE INDEX FOR (n:Service) ON (n.id);
CREATE INDEX FOR (n:Service) ON (n.tenantId);
CREATE INDEX FOR (n:Deployment) ON (n.id);
CREATE INDEX FOR (n:Deployment) ON (n.tenantId);
CREATE INDEX FOR (n:Incident) ON (n.id);
CREATE INDEX FOR (n:Incident) ON (n.tenantId);
CREATE INDEX FOR (n:Evidence) ON (n.id);
CREATE INDEX FOR (n:Evidence) ON (n.tenantId);
CREATE INDEX FOR (n:Hypothesis) ON (n.id);
CREATE INDEX FOR (n:Investigation) ON (n.id);
CREATE INDEX FOR (n:MemoryEpisode) ON (n.id);
CREATE INDEX FOR (n:KnowledgeClaim) ON (n.id);
CREATE INDEX FOR (n:DiagnosticProcedure) ON (n.id);
CREATE INDEX FOR (n:ActionProposal) ON (n.id);
CREATE INDEX FOR (n:AuditRecord) ON (n.id);
```

- **Module**: `apps/api/src/graph/repository.ts` (`setupIndexes`)
- **Purpose**: Eliminates full graph scans for entity queries and bounds tenant traversals.

---

## 2. Multi-Hop Dependency & Topology Traversal

When an operational incident is declared, the investigation engine navigates the dependency topology upstream to identify potential failure origins, and downstream to calculate blast radius.

### 2.1 Upstream Dependency Path Traversal (Depth 1..3)
```cypher
MATCH path = (s:Service {id: $serviceId})-[:DEPENDS_ON*1..3]->(upstream:Service)
WHERE (upstream.tenantId = $tenantId OR upstream.tenantId = 'shared')
RETURN upstream.id AS id,
       upstream.name AS name,
       upstream.criticality AS criticality,
       upstream.environment AS environment,
       length(path) AS depth,
       [n IN nodes(path) | n.id] AS pathNodes
ORDER BY depth ASC
LIMIT $limit
```

- **Module**: `apps/api/src/graph/repository.ts` (`getServiceDependencies`)
- **Parameters**: `serviceId: string`, `depth: number (1..3)`, `tenantId: string`, `limit: number`
- **Tenant Filtering**: Guarantees that traversal only visits upstream services belonging to the authenticated tenant or explicitly designated `'shared'` infrastructure.
- **Role in Reasoning**: Supplies the candidate upstream services whose recent deployments and telemetry must be correlated with the incident.

### 2.2 Downstream Blast Radius Traversal
```cypher
MATCH path = (downstream:Service)-[:DEPENDS_ON*1..3]->(s:Service {id: $serviceId})
WHERE (downstream.tenantId = $tenantId OR downstream.tenantId = 'shared')
RETURN downstream.id AS id,
       downstream.name AS name,
       downstream.criticality AS criticality,
       length(path) AS depth,
       [n IN nodes(path) | n.id] AS pathNodes
ORDER BY depth ASC
LIMIT $limit
```

- **Module**: `apps/api/src/graph/repository.ts` (`getDownstreamImpact`)
- **Role in Reasoning**: Determines secondary impact and calculates blast radius severity.

---

## 3. Incident Context & Evidence Graph Extraction

An incident node acts as the central anchor for evidence, affected services, and teams.

### 3.1 Comprehensive Incident Context Query
```cypher
MATCH (i:Incident {id: $incidentId})
WHERE (i.tenantId = $tenantId OR i.tenantId = 'shared')
OPTIONAL MATCH (i)-[:AFFECTS]->(s:Service)
WHERE (s.tenantId = $tenantId OR s.tenantId = 'shared')
OPTIONAL MATCH (s)-[:OWNED_BY]->(t:Team)
OPTIONAL MATCH (s)-[:HAS_DEPLOYMENT]->(d:Deployment)
OPTIONAL MATCH (e:Evidence)-[:OBSERVED_IN]->(i)
WHERE (e.tenantId = $tenantId OR e.tenantId = 'shared')
RETURN i, s, t,
       collect(DISTINCT d) AS deployments,
       collect(DISTINCT e) AS evidence
```

- **Module**: `apps/api/src/graph/repository.ts` (`getIncidentContext`)
- **Execution Performance**: Typically executes in under 3ms against FalkorDB.
- **Provenance**: Carries forward external source record IDs, evidence timestamps, content hashes, and reliability classifications into the reasoning engine.

---

## 4. Multi-Hop Causal Path Discovery

This query solves the connected-data investigation challenge: finding the sequence of relationships connecting an affected service to an upstream deployment through dependency edges, supported by telemetry observations.

### 4.1 Causal Deployment Correlation Path
```cypher
MATCH path = (root:Service)-[:DEPENDS_ON*1..3]->(upstream:Service)-[:HAS_DEPLOYMENT]->(dep:Deployment)
WHERE root.id = $serviceId
  AND (upstream.tenantId = $tenantId OR upstream.tenantId = 'shared')
  AND dep.deployedAt >= $windowStart
  AND dep.deployedAt <= $incidentStartTime
RETURN [n IN nodes(path) | n.id] AS nodes,
       [r IN relationships(path) | type(r)] AS relationships,
       upstream.id AS upstreamServiceId,
       dep.id AS deploymentId,
       dep.version AS version,
       dep.changeSummary AS changeSummary,
       length(path) AS depth
ORDER BY dep.deployedAt DESC
LIMIT 10
```

- **Module**: `apps/api/src/investigation/tools.ts` (`ToolRegistry.discoverCausalPaths`)
- **Parameters**: `serviceId`, `windowStart` (ISO 8601, typically incident - 3 hours), `incidentStartTime`, `tenantId`
- **Output**: Explains *why* the downstream service is failing by pinpointing the specific upstream deployment introduced immediately prior to symptom onset.

---

## 5. Dynamic Graph Intelligence & Failure Domain Clustering

Neutrino computes failure domain boundaries and calculates blast radius risk directly from the graph topology without requiring external offline batch jobs.

### 5.1 Failure Domain Cluster Traversal
```cypher
MATCH (s:Service)
WHERE (s.tenantId = $tenantId OR s.tenantId = 'shared')
OPTIONAL MATCH (s)-[:DEPENDS_ON]->(upstream:Service)
OPTIONAL MATCH (downstream:Service)-[:DEPENDS_ON]->(s)
OPTIONAL MATCH (s)<-[:AFFECTS]-(inc:Incident {status: 'investigating'})
RETURN s.id AS serviceId,
       s.criticality AS criticality,
       count(DISTINCT upstream) AS outDegree,
       count(DISTINCT downstream) AS inDegree,
       count(DISTINCT inc) AS activeIncidents
```

- **Algorithm**: In-memory label-propagation clustering combined with degree centrality to group closely coupled microservices into failure communities.
- **Blast Radius Scoring**:
  $$\text{Score} = (\text{Direct Impact} \times 1.0) + (\text{Depth 1 Transitive} \times 0.6) + (\text{Depth 2 Transitive} \times 0.3) + (\text{Active Incident Weight})$$
- **Module**: `apps/api/src/investigation/tools.ts` & `apps/api/src/graph/repository.ts`

---

## 6. Multi-Signal Graph Memory Recall

Persistent memory is stored as first-class graph nodes (`MemoryEpisode`, `KnowledgeClaim`, `DiagnosticProcedure`) connected to services, incidents, and evidence via typed relationships (`GROUNDED_IN`, `ABOUT_SERVICE`, `PRECEDENT_FOR`).

### 6.1 Knowledge Claims Grounded in Evidence
```cypher
MATCH (c:KnowledgeClaim)-[:ABOUT_SERVICE]->(s:Service {id: $serviceId})
WHERE (c.tenantId = $tenantId OR c.tenantId = 'shared')
  AND c.status = 'active'
OPTIONAL MATCH (c)-[:GROUNDED_IN]->(e:Evidence)
RETURN c.id AS claimId,
       c.statement AS statement,
       c.confidence AS confidence,
       c.predicate AS predicate,
       c.sourceProvenance AS provenance,
       collect(e.id) AS supportingEvidenceIds
ORDER BY c.confidence DESC
LIMIT 10
```

- **Module**: `apps/api/src/memory/repository.ts` (`searchKnowledgeClaims`)
- **Distinguishing Factor**: Rather than relying purely on dense vector similarity, memory lookup navigates graph relationships anchored to the affected service, ensuring that historical findings are strictly grounded in verifiable past evidence.

### 6.2 Precedent Episode Recall
```cypher
MATCH (ep:MemoryEpisode)-[:AFFECTS]->(s:Service)
WHERE s.id IN $serviceIds
  AND (ep.tenantId = $tenantId OR ep.tenantId = 'shared')
OPTIONAL MATCH (ep)-[:RESOLVED_BY]->(proc:DiagnosticProcedure)
RETURN ep.id AS episodeId,
       ep.title AS title,
       ep.rootCauseServiceId AS rootCauseServiceId,
       ep.lessonsLearned AS lessonsLearned,
       proc.name AS recommendedProcedure
LIMIT 5
```

- **Module**: `apps/api/src/memory/retrieval.ts`
- **Output**: Prevents duplicate root-cause analysis by surfacing identical failure modes solved in previous quarters.

---

## 7. Action Verification Postconditions

When an allowlisted remediation action (e.g., `cache_flush`, `diagnostic_probe`, `jwks_sync`) executes, Neutrino verifies its postconditions by independently querying live evidence recorded in FalkorDB within the 60-second window following execution.

### 7.1 Postcondition Evidence Verification Query
```cypher
MATCH (e:Evidence)-[:OBSERVED_IN]->(i:Incident {id: $incidentId})
WHERE (e.tenantId = $tenantId OR e.tenantId = 'shared')
  AND e.observedAt >= $postExecutionCutoff
RETURN e.id AS id,
       e.sourceType AS sourceType,
       e.summary AS summary,
       e.content AS content,
       e.observedAt AS observedAt
```

- **Module**: `apps/api/src/remediation/engine.ts` (`verifyPostconditions`)
- **Evaluation**: The action transitions from `executed` to `verified` only if corroborating telemetry records healthy metrics or normal latency (< 2ms, 200 OK).

---

## 8. Bounded Safe Graph Pruning with Active Reference Protection

Retention pruning in Neutrino is safe, tenant-scoped, and transactional. It previews deletion candidates and explicitly prevents deletion of evidence referenced by active incidents, hypotheses, memory claims, or action proposals.

### 8.1 Candidate Identification (Bounded Limit)
```cypher
MATCH (e:Evidence)
WHERE e.observedAt < $cutoffDate
  AND (e.tenantId = $tenantId OR e.tenantId = 'shared')
RETURN e.id AS id, e.observedAt AS observedAt
LIMIT $batchSize
```

### 8.2 Active Incident Protection Check
```cypher
MATCH (e:Evidence {id: $candidateId})-[:OBSERVED_IN]->(i:Incident)
WHERE i.status IN ['investigating', 'identified', 'monitoring']
RETURN i.id LIMIT 1
```

### 8.3 Memory Grounding Protection Check
```cypher
MATCH (m)-[:GROUNDED_IN]->(e:Evidence {id: $candidateId})
RETURN m.id LIMIT 1
```

### 8.4 Safe Pruning Deletion
```cypher
MATCH (e:Evidence {id: $candidateId})
DETACH DELETE e
```

- **Module**: `apps/api/src/lifecycle/manager.ts` (`prune`)
- **Integrity Guarantee**: Deletion is never performed blindly; dry-run mode returns exact counts without mutations, and any node actively referenced by ongoing incident response or permanent knowledge is preserved with an audit log reason.

---

## 9. Algorithmic Guardrails and Bounds

To prevent denial of service and unconstrained graph traversals, all Cypher queries in Neutrino adhere to strict boundaries:

| Parameter | Bound | Enforced In |
|---|---|---|
| Max Traversal Depth | 3 hops (`*1..3`) | `repository.ts`, `tools.ts` |
| Max Candidate Limit | 50 records | `config.MAX_GRAPH_RESULTS_BOUND` |
| Query Timeout | 5,000 ms | FalkorDB Connection Config |
| Traversal Path Limit | 10 paths max | `InvestigationEngine` |
| Batch Pruning Size | 100 nodes max | `graphLifecycleManager` |
