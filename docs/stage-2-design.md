# Neutrino Stage 2 Technical Architecture & Design Specification
## Persistent Graph Memory, Generalized Graph Reasoning, and Adaptive Investigations

### 1. Architectural Scope & Track Alignment
Neutrino Stage 2 enhances the foundation established in Stage 1 to deliver:
- **Track 01 (Agents That Act on Connected Data)**: A bounded, evidence-driven investigation planner that uses a finite tool registry to traverse topological dependencies, evaluate hypotheses, check contradictions, and abstain when evidence is insufficient.
- **Track 02 (Agent Memory & Coordination)**: Persistent, evidence-grounded episodic, semantic, and procedural graph memory in FalkorDB with full lifecycle tracking (`active`, `superseded`, `invalidated`, `archived`), conflict resolution, multi-signal retrieval, and cross-session continuity that survives process restarts.
- **Track 03 (Company Brain)**: Reusable diagnostic procedures, institutional knowledge claims, and incident precedents indexed and connected directly within the enterprise operational topology.

---

### 2. Graph Memory Model & Schema

#### 2.1 The Three Memory Types
1. **Episodic Memory (`MemoryEpisode`)**:
   - Represents a specific completed investigation experience.
   - Connects to the originating `Investigation`, `Incident`, involved `Service` nodes, and `Evidence` bundle.
   - Preserves what was investigated, which hypotheses were confirmed or disproved, and what unresolved questions remained.
2. **Semantic Memory (`KnowledgeClaim`)**:
   - Represents reusable, factual assertions about the operational topology (e.g., "auth-service v2.4.1 reduced key cache TTL causing downstream token verification timeouts").
   - Categorized as `observed`, `inferred`, or `verified`.
   - Strictly grounded in specific `Evidence` IDs via `[:GROUNDED_IN]` edges.
   - Supports explicit `[:CONTRADICTED_BY]` edges to disproving evidence and `[:SUPERSEDES]` edges to prior revisions.
3. **Procedural Memory (`DiagnosticProcedure`)**:
   - Represents validated diagnostic workflows derived from past resolutions.
   - Encapsulates preconditions, required telemetry sources, step-by-step diagnostic actions, expected observations, and validation criteria.
   - Connects to target `Service` nodes via `[:TARGETS_SERVICE]`.

#### 2.2 FalkorDB Node Labels & Properties
- **`MemoryEpisode`**:
  - `id` (String, Indexed)
  - `investigationId` (String)
  - `incidentId` (String, Optional)
  - `summary` (String)
  - `outcome` (String: `completed` | `insufficient-evidence` | `failed`)
  - `status` (String: `candidate` | `active` | `superseded` | `invalidated` | `archived`)
  - `serviceIds` (Array of Strings)
  - `deploymentIds` (Array of Strings)
  - `evidenceIds` (Array of Strings)
  - `graphPaths` (Array of Strings)
  - `hypothesesEvaluated` (Array of Strings)
  - `supportedHypotheses` (Array of Strings)
  - `contradictedHypotheses` (Array of Strings)
  - `unresolvedQuestions` (Array of Strings)
  - `createdAt` / `updatedAt` (ISO 8601 UTC)
  - `synthetic` (Boolean)
- **`KnowledgeClaim`**:
  - `id` (String, Indexed)
  - `subject` (String)
  - `predicate` (String)
  - `object` (String)
  - `statement` (String)
  - `claimType` (String: `observed` | `inferred` | `verified`)
  - `status` (String: `candidate` | `active` | `superseded` | `invalidated` | `archived`)
  - `confidence` (Float: 0.0 to 1.0)
  - `firstObservedAt` / `lastVerifiedAt` (ISO 8601 UTC)
  - `validFrom` / `validUntil` (ISO 8601 UTC, Optional)
  - `revision` (Integer)
  - `supersededById` (String, Optional)
  - `invalidationReason` (String, Optional)
  - `sourceProvenance` (String)
- **`DiagnosticProcedure`**:
  - `id` (String, Indexed)
  - `name` (String)
  - `purpose` (String)
  - `serviceId` (String)
  - `preconditions` (Array of Strings)
  - `requiredEvidenceTypes` (Array of Strings)
  - `diagnosticSteps` (Array of Strings)
  - `expectedObservations` (Array of Strings)
  - `supportingConditions` (Array of Strings)
  - `contradictingConditions` (Array of Strings)
  - `knownFailureModes` (Array of Strings)
  - `status` (String: `candidate` | `active` | `superseded` | `invalidated` | `archived`)
  - `validationCriteria` (String)
  - `version` (Integer)
  - `lastValidatedAt` (ISO 8601 UTC)

#### 2.3 Memory Graph Relationships
| Relationship Type | Source | Target | Semantics |
|---|---|---|---|
| `GENERATED_EPISODE` | `Investigation` | `MemoryEpisode` | Investigation generated episodic memory |
| `RECORDED_CLAIM` | `MemoryEpisode` | `KnowledgeClaim` | Episode established semantic knowledge claim |
| `RECOMMENDED_PROCEDURE`| `MemoryEpisode` | `DiagnosticProcedure` | Episode produced/validated a diagnostic procedure |
| `CONCERNS_SERVICE` | `MemoryEpisode` | `Service` | Episode relates to service |
| `CONCERNS_INCIDENT` | `MemoryEpisode` | `Incident` | Episode investigated incident |
| `GROUNDED_IN` | `KnowledgeClaim` | `Evidence` | Claim is substantiated by evidence record |
| `CONTRADICTED_BY` | `KnowledgeClaim` | `Evidence` | Claim is disproved by evidence record |
| `SUPERSEDES` | `KnowledgeClaim` | `KnowledgeClaim` | New claim revision supersedes prior revision |
| `TARGETS_SERVICE` | `DiagnosticProcedure` | `Service` | Procedure applies to service |
| `SUPERSEDES` | `DiagnosticProcedure` | `DiagnosticProcedure` | Revised procedure supersedes prior version |

---

### 3. Memory Lifecycle & Conflict Resolution Rules

#### 3.1 Lifecycle States & Allowable Transitions
- `candidate`: Newly extracted memory awaiting initial validation.
- `active`: Validated memory eligible for operational retrieval.
- `superseded`: Memory replaced by a more recent, verified revision.
- `invalidated`: Memory refuted by fresh authoritative evidence.
- `archived`: Retained strictly for historical auditing.

**Allowed Transitions**:
- `candidate` -> `active` (upon validation pass)
- `candidate` -> `invalidated` (if evidence ungrounded or contradicts ground truth)
- `active` -> `superseded` (when a new verified revision links via `[:SUPERSEDES]`)
- `active` -> `invalidated` (when new evidence directly refutes the claim)
- `active` -> `archived` (routine lifecycle aging)
- `superseded` -> `archived`
- `invalidated` -> `archived`

#### 3.2 Conflict Resolution & Invalidation Policy
1. **Never Silently Overwrite**: Prior memories are retained in the graph; supersession or invalidation explicitly links the replacing entity or marks the reason.
2. **Temporal Window Discipline**: Stale observations outside the active incident window cannot invalidate fresh, temporally aligned observations.
3. **Missing Evidence is Not Contradiction**: The absence of telemetry cannot disprove an existing verified claim.
4. **Current Ground Truth Overrides Prior Memory**: If active evidence collected during an investigation directly contradicts a recalled memory, the recalled memory is marked as rejected for that decision, and the investigation adheres strictly to live evidence.

---

### 4. Multi-Signal Memory Retrieval Algorithm

Memory retrieval does not rely on opaque string similarity or external embedding databases. It computes an explainable multi-signal relevance score:

$$\text{Score} = (w_e \cdot S_{\text{entity}}) + (w_t \cdot S_{\text{topology}}) + (w_r \cdot S_{\text{recency}}) + (w_c \cdot S_{\text{confidence}})$$

Where:
- $S_{\text{entity}} \in [0, 1]$: Jaccard overlap between target incident services/deployments and memory services/deployments ($w_e = 0.35$).
- $S_{\text{topology}} \in [0, 1]$: Graph proximity: 1.0 for direct match, 0.7 for 1-hop neighbor, 0.4 for 2-hop neighbor ($w_t = 0.25$).
- $S_{\text{recency}} \in [0, 1]$: Exponential decay based on elapsed time since observation ($w_r = 0.20$).
- $S_{\text{confidence}} \in [0, 1]$: Intrinsic claim confidence and reliability class of supporting evidence ($w_c = 0.20$).

**Filtering**: Records with status `invalidated` or `superseded` are automatically excluded from active retrieval unless explicit historical auditing is requested.

---

### 5. Generalized Graph-Native Reasoning Loop

#### 5.1 Elimination of Scenario Hard-Coding
All hard-coded incident ID checks (`if (incident.id === '...')`) are eliminated. The engine investigates unfamiliar incidents dynamically by evaluating:
- Topological upstream dependencies (`getServiceDependencies`).
- Preceding deployments within the temporal lookback window (`findPrecedingDeployments`).
- Evidence classifications (logs, error rate spikes, latency metrics, connection pool saturations, external status feeds).
- Discovered graph paths between affected services and upstream dependencies.

#### 5.2 Finite Bounded Tool Registry
The investigation planner interacts with FalkorDB exclusively through an allowlisted registry of bounded tools:
1. `get_incident_context`: Resolves incident properties, affected service, and owning team.
2. `traverse_service_dependencies`: Bounded (depth 1..3) upstream and downstream dependency discovery.
3. `get_recent_deployments`: Looks up deployments on affected services and their dependencies.
4. `get_windowed_evidence`: Fetches and deduplicates evidence within the incident temporal window.
5. `explore_causal_paths`: Finds multi-hop explanation paths between affected services and candidate root causes.
6. `retrieve_relevant_memory`: Executes multi-signal graph memory recall.
7. `evaluate_hypotheses`: Tests candidate hypotheses against live evidence, topology, and recalled memory.
8. `find_missing_telemetry`: Identifies operational blind spots (missing traces, missing slowlogs).

#### 5.3 Investigation Lifecycle State Machine
```
[INITIALIZING]
      │
      ▼
[CONTEXT_LOADED] ──► (Resolves Incident, Service, Team)
      │
      ▼
[MEMORY_RECALLED] ──► (Recalls relevant Episodes, Claims, Procedures)
      │
      ▼
[TOPOLOGY_EXPLORED] ──► (Discovers Upstream Deps & Preceding Deployments)
      │
      ▼
[EVIDENCE_ANALYZED] ──► (Deduplicates, Checks Temporal Window & Contradictions)
      │
      ▼
[HYPOTHESES_EVALUATED] ──► (Tests Hypotheses against Graph Paths & Evidence)
      │
      ▼
[CONCLUDED / ABSTAINED] ──► (Synthesizes Result, Persists to FalkorDB, Extracts Memory)
```

#### 5.4 Grounded Abstention Policy
The engine strictly abstains (`status: 'insufficient-evidence'`) when:
- The required causal dependency graph path is absent or severed.
- Competing hypotheses lack distinguishing evidence.
- Telemetry coverage within the incident window is incomplete or stale.
- The only supporting information comes from unverified or superseded memory.

---

### 6. High-Performance Execution & Resource Budgets
- **Request-Scoped Context**: Per-investigation cache preventing duplicate Cypher queries for the same service or incident within a single investigation run.
- **Investigation Safety Budgets**:
  - Max tool executions: 12
  - Max execution duration: 5000 ms
  - Max graph nodes evaluated: 250
  - Max candidate explanations: 8
- **Bounded Concurrency**: Independent read queries (e.g. initial context resolution + initial memory recall) run concurrently via `Promise.all`.
