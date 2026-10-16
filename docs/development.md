# Neutrino Developer Guide

## 1. Prerequisites
- **Node.js**: v20 or v22+
- **pnpm**: v11+
- **Docker**: Docker Desktop or Docker Engine running with Docker Compose

## 2. Environment Setup
```bash
# Clone the repository and enter workspace
cd /Users/nssanjeev/Neutrino

# Copy environment variables
cp .env.example .env

# Install monorepo dependencies
pnpm install

# Start local FalkorDB container
docker compose up -d

# Verify FalkorDB is running and healthy
docker compose ps
```

## 3. Database Seeding
To seed or re-seed the synthetic connected operations dataset into FalkorDB:
```bash
pnpm seed
```
This script creates all node indexes and idempotently upserts teams, services, dependencies, deployments, incidents, and evidence into `neutrino_graph`.

## 4. Running the Application
```bash
# Option A: Start both API and Web concurrently
pnpm dev

# Option B: Start services independently
pnpm dev:api   # Starts API on http://localhost:4000
pnpm dev:web   # Starts Web on http://localhost:3001
```

## 5. Running Tests
```bash
# Run all unit and integration tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run FalkorDB integration tests
pnpm test:integration

# Run mandatory Gate D Graph Indispensability test
pnpm test:indispensability

# Run end-to-end smoke test
pnpm smoke
```

## 6. Inspecting the Graph Directly via Redis CLI
```bash
# Connect to FalkorDB container
docker exec -it neutrino-falkordb redis-cli

# Run a Cypher query on neutrino_graph
GRAPH.QUERY neutrino_graph "MATCH (n) RETURN labels(n), count(n)"
GRAPH.QUERY neutrino_graph "MATCH (s:Service)-[:DEPENDS_ON]->(d:Service) RETURN s.id, d.id"
```
