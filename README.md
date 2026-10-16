# NEUTRINO — Graph-Native AI Investigation Platform

> **Event**: Graph Hacks — Context for AI Agents, powered by FalkorDB  
> **Target Track**: Track 01 — *Agents That Act on Connected Data* (Primary)  
> *Architecturally designed for forward-compatibility with Track 02 (Agent Memory and Coordination) and Track 03 (Company Brain).*  
> **Stage**: 1 of 3 — Foundational Implementation

---

## 1. What is Neutrino?
**Neutrino** is a graph-native operational investigation platform that empowers engineering and site reliability teams to diagnose complex, multi-hop production incidents using **FalkorDB**.

Modern distributed architectures fail across service boundaries: an incident detected at an edge service (e.g. checkout) is frequently triggered by an upstream dependency deployment or cache desync multiple hops away. Shallow keyword searches and isolated log queries cannot discover these structural relationships. 

Neutrino models the complete operational topology directly in FalkorDB—connecting services, deployments, telemetry evidence, ownership teams, and past postmortems—and executes a 9-step evidence-backed reasoning pipeline to isolate root causes with mathematical graph provenance.

---

## 2. What Works in Stage 1

- **Real FalkorDB Graph Storage**: 100% of operational entities and relationships are stored and queried in a live FalkorDB instance using parameterized Cypher queries.
- **Idempotent Synthetic Seeding**: Deterministic operational scenario containing 11 services, 4 teams, 10 deployments, 4 incidents, and 12 evidence records spanning multi-hop dependency chains.
- **The 9-Step Investigation Engine**: Validates inputs, traverses upstream and downstream topologies, normalizes and deduplicates evidence, evaluates candidate and competing hypotheses, and derives non-destructive diagnostic next steps.
- **Mandatory Graph Indispensability Test (Gate D)**: Proves that resolving the primary incident (`INC-2026-101`) strictly requires traversing 3 relationship hops in FalkorDB:
  ```
  (INC-2026-101)-[:AFFECTS]->(checkout-service)-[:DEPENDS_ON]->(auth-service)-[:HAS_DEPLOYMENT]->(dep-auth-2.4.1)
  ```
  When the FalkorDB graph is removed or empty, the system strictly refuses to fabricate an answer.
- **Investigation Persistence in FalkorDB**: Every completed investigation is persisted as an `(:Investigation)` node with edges to evaluated `(:Hypothesis)` nodes and supporting evidence.
- **Full REST API v1**: Endpoints for service health (`/health`), graph readiness (`/graph/health`), incident subgraphs (`/incidents/:id/subgraph`), and investigations (`/investigations`).
- **Production-Minded Dark UI (Next.js 14 App Router)**:
  - **Overview**: Live database status pill, real-time node/relationship metrics, quick investigation launchpad.
  - **Incidents View**: Interactive incident browser with service ownership and connected deployments.
  - **Investigation Workspace**: Query prompt with instant multi-hop hypothesis evaluation, evidence references, and graph paths.
  - **Graph Explorer**: Interactive SVG visualizer rendering FalkorDB subgraphs with node type badges and highlighted causal paths.
  - **History View**: Retrievable archive of persisted graph investigations.

### What is Intentionally Deferred (Preserved for Stage 2 & 3)
- Fully automated remediation scripts (Stage 1 focuses on non-destructive diagnostic recommendations).
- Autonomous multi-agent coordination swarms (Stage 2).
- Advanced cross-session agent memory and dynamic causal inference over continuous telemetry streams (Stage 2).
- Third-party live OpenTelemetry / Prometheus ingestion adapters (Stage 3).

---

## 3. Technology Stack

- **Graph Database**: FalkorDB (`falkordb/falkordb:latest` via Docker, official `falkordb` Node.js client)
- **Backend API**: Node.js v22, Express, TypeScript (strict mode), Zod validation
- **Frontend UI**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide icons
- **Monorepo & Package Management**: pnpm v11 workspaces (`@neutrino/contracts`, `@neutrino/api`, `@neutrino/web`)
- **Testing & Verification**: Vitest (26 unit and integration tests), Bash automated smoke tests

---

## 4. Prerequisites

- **macOS / Linux** with Apple Silicon (arm64) or x86_64
- **Node.js**: v20.x or v22.x+ (`node -v`)
- **pnpm**: v11+ (`pnpm -v`)
- **Docker & Docker Compose**: Docker Desktop or Docker Engine running

---

## 5. Quick Start (Reproducible Setup)

### Step 1: Clone and Configure Environment
```bash
# In the repository root:
cp .env.example .env
```

### Step 2: Install Dependencies
```bash
pnpm install
```

### Step 3: Start FalkorDB
```bash
# Launch FalkorDB container via Docker Compose
docker compose up -d

# Verify container is running and healthy
docker compose ps
```

### Step 4: Seed the FalkorDB Graph
```bash
pnpm seed
```
*Expected output: Upserts teams, services, dependencies, deployments, incidents, and evidence into `neutrino_graph`.*

### Step 5: Start Development Servers
```bash
# Start both backend API (port 4000) and frontend Web (port 3001)
pnpm dev
```
- Web UI: [http://localhost:3001](http://localhost:3001)
- API Health: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)
- Graph Health: [http://localhost:4000/api/v1/graph/health](http://localhost:4000/api/v1/graph/health)

---

## 6. Verification and Testing

### Run All Tests
```bash
pnpm test
```
Executes all 26 unit, integration, and API tests via Vitest:
- `tests/unit/contracts.test.ts`: Zod schema validation
- `tests/unit/evidence-utils.test.ts`: Chronological sorting, deduplication, contradiction detection
- `tests/unit/hypothesis-rules.test.ts`: Deterministic causal rules evaluation
- `tests/integration/graph-repository.test.ts`: Real FalkorDB multi-hop queries, deployments, and subgraph extraction
- `tests/integration/indispensability.test.ts`: Mandatory Gate D Graph Indispensability test
- `tests/integration/api.test.ts`: End-to-end REST API endpoint validation

### Run the Mandatory Graph Indispensability Test
```bash
pnpm test:indispensability
```

### Run Automated Smoke Test
```bash
pnpm smoke
```

---

## 7. How to Inspect the FalkorDB Graph Directly

You can query the live FalkorDB instance directly using `redis-cli`:
```bash
docker exec -it neutrino-falkordb redis-cli

# Run Cypher queries on the neutrino_graph:
GRAPH.QUERY neutrino_graph "MATCH (n) RETURN labels(n), count(n)"
GRAPH.QUERY neutrino_graph "MATCH (s:Service)-[:DEPENDS_ON]->(dep:Service) RETURN s.id, dep.id"
GRAPH.QUERY neutrino_graph "MATCH p = (i:Incident {id: 'INC-2026-101'})-[*1..3]-(n) RETURN p"
```

---

## 8. Optional LLM Assistance Configuration

Neutrino runs in **Deterministic Foundation Mode** by default—requiring zero external API keys or cloud accounts while still executing full multi-hop graph reasoning.

To enable optional LLM-assisted explanations:
1. Edit `.env`:
   ```bash
   LLM_PROVIDER=gemini # or openai, anthropic
   LLM_MODEL=gemini-1.5-pro
   LLM_API_KEY=your_key_here
   ```
2. Restart the API server. In LLM mode, model claims are strictly cross-validated against returned FalkorDB evidence IDs; fabricated claims are rejected.

---

## 9. AI Coding-Assistant Disclosure

In compliance with the Graph Hacks official rules:
- Antigravity AI coding assistant (powered by Google DeepMind) was used as an interactive pair programmer during the implementation of Stage 1.
- All application code, graph data models, Cypher queries, test suites, and documentation were verified, executed, and validated in the local workspace.
