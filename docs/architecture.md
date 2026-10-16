# Neutrino Architecture & Engineering Design

## 1. System Overview
**Neutrino** is a graph-native AI investigation platform designed for production reliability teams. It uses **FalkorDB** as the source of truth for service dependencies, operational incidents, deployment timelines, and observable evidence.

Unlike traditional keyword-search incident tools, Neutrino reasons over graph paths: when an incident occurs on an edge service, Neutrino executes bounded graph traversals to discover upstream dependencies, recent changes across those dependencies, and corroborating error signals.

---

## 2. Architectural Boundaries

```
[ Web Client: Next.js 14 App Router ]
                  |
         HTTP/JSON (REST API v1)
                  v
[ API Server: Express + TypeScript (Strict Mode) ]
  ├── /api/v1/health (Liveness & DB ping)
  ├── /api/v1/graph/health (FalkorDB metrics)
  ├── /api/v1/incidents (Listing & Subgraph)
  └── /api/v1/investigations (Trigger & Persistence)
                  |
  ┌───────────────┴───────────────┐
  ▼                               ▼
[ Investigation Engine ]      [ Graph Repository Layer ]
  ├── 9-Step Lifecycle          ├── Parameterized Cypher Queries
  ├── Evidence Normalization    ├── Graph Health & Metadata
  └── Hypothesis Engine         └── Investigation Persistence
                  │
                  ▼
         [ FalkorDB (Port 6379) ]
           neutrino_graph
```

### Clean Separation Rules:
1. **No direct database access from the browser**: Web clients communicate strictly via `/api/v1` REST endpoints. All database connection credentials and Cypher queries reside exclusively on the server.
2. **Strict Shared Contracts**: API schemas and domain models are unified in `@neutrino/contracts` with runtime validation using Zod.
3. **Deterministic Foundation First**: Stage 1 operates deterministically by default, producing verifiable evidence-backed explanations from FalkorDB graph traversals without requiring external paid LLM accounts.

---

## 3. The 9-Step Investigation Lifecycle

Every investigation triggered via `POST /api/v1/investigations` executes through `InvestigationEngine.ts`:

1. **Request Validation**: Validates question length (3–1000 chars), optional incident ID, and execution mode via `InvestigationRequestSchema`.
2. **Context Establishment**: Creates unique `inv-<uuid>` ID and start timestamp. If no incident ID is supplied, performs bounded search for active incidents mentioned in the query.
3. **Connected Context Retrieval**:
   - Queries `(Incident)-[:AFFECTS]->(Service)`
   - Traverses upstream dependencies: `(Service)-[:DEPENDS_ON*1..3]->(Service)` (Operation B)
   - Traverses downstream dependents: `(Service)-[:DEPENDS_ON*1..3]->(Service)` (Operation C)
   - Queries recent deployments on affected and upstream services (Operation D)
   - Queries evidence records: `(Evidence)-[:OBSERVED_IN]->(Incident)` (Operation E)
   - Queries historical incidents: `(Incident)-[:RELATED_TO]->(Incident)` (Operation F)
   - Discovers multi-hop graph paths connecting incident to upstream services (Operation G)
4. **Evidence Bundle Assembly**:
   - Normalizes evidence records
   - Deduplicates records by ID and SHA-256 `contentHash`
   - Sorts records chronologically by UTC `observedAt`
5. **Candidate Hypothesis Formulation**:
   - Evaluates upstream deployment failure hypotheses based on pre-incident timing and matching error logs
   - Formulates competing hypotheses (e.g. database pool exhaustion, Redis memory starvation)
6. **Competing Explanation Evaluation**:
   - Evaluates corroborating telemetry
   - Evaluates contradictory telemetry (e.g., metric evidence showing DB latency < 2ms directly contradicts DB pool exhaustion)
   - Marks hypotheses with explicit statuses: `supported`, `contradicted`, `candidate`, or `unresolved`
7. **Structured Result Generation**:
   - Compiles executive summary, candidate hypotheses, evidence references, multi-hop paths, missing telemetry gaps, and diagnostic next steps
   - Records execution metrics (`durationMs`, `graphQueryCount`, `nodesEvaluated`, `relationshipsEvaluated`)
8. **FalkorDB Persistence**:
   - Persists `(:Investigation)` node with serialized result bundle
   - Creates `(Incident)-[:INVESTIGATED_IN]->(Investigation)` relationship
   - Persists evaluated `(:Hypothesis)` nodes with `[:SUPPORTED_BY]` and `[:CONTRADICTED_BY]` edges to evidence
9. **Validated Response Delivery**: Validates output against `InvestigationResultSchema` and returns HTTP 201.

---

## 4. FalkorDB Indispensability Proof (Gate D)

To prove that FalkorDB is indispensable to the core application:
1. **The Primary Scenario**: Incident `INC-2026-101` affects `checkout-service`. The root cause is `auth-service v2.4.1` deployed 17 minutes prior, which introduced a JWT key-cache desync bug. The responsible team is `team-identity` (who owns `auth-service`).
2. **Multi-Hop Traversal Required**: Resolving the failure requires traversing:
   `(INC-2026-101)-[:AFFECTS]->(checkout-service)-[:DEPENDS_ON]->(auth-service)-[:HAS_DEPLOYMENT]->(dep-auth-2.4.1)`
3. **The Indispensability Test** (`tests/integration/indispensability.test.ts`):
   - **Phase 1**: Executes the investigation with the FalkorDB graph; verifies that the 3-hop path and upstream deployment root cause are correctly discovered and supported.
   - **Phase 2**: Executes the exact same query against an isolated, empty FalkorDB graph. The system strictly refuses to produce a canned or fabricated response, reporting that graph context is missing or insufficient.
   - This test runs in CI and passes completely, verifying that FalkorDB is indispensable to Neutrino.
