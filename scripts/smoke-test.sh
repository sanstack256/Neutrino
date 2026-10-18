#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "   NEUTRINO SMOKE TEST — FalkorDB Investigation   "
echo "=================================================="

API_PORT="${PORT:-4000}"
BASE_URL="http://127.0.0.1:${API_PORT}/api/v1"

echo "1. Checking FalkorDB Docker container status..."
if ! docker compose ps | grep -q "neutrino-falkordb.*Up"; then
  echo "FalkorDB container is not running. Starting via docker compose up -d..."
  docker compose up -d
  sleep 2
fi

echo "2. Seeding synthetic graph operational data..."
pnpm seed > /dev/null

ALREADY_RUNNING=0
if curl -sf "${BASE_URL}/health" > /dev/null 2>&1; then
  echo "✓ Existing API server detected running at ${BASE_URL}."
  ALREADY_RUNNING=1
else
  echo "3. Starting Neutrino API service in background..."
  npx tsx apps/api/src/server.ts &
  API_PID=$!

  cleanup() {
    echo "Stopping background API service (PID $API_PID)..."
    kill $API_PID 2>/dev/null || true
  }
  trap cleanup EXIT

  # Wait for API readiness
  echo "Waiting for API readiness at ${BASE_URL}/health..."
  READY=0
  for i in {1..20}; do
    if curl -sf "${BASE_URL}/health" > /dev/null 2>&1; then
      READY=1
      break
    fi
    sleep 0.5
  done

  if [ $READY -ne 1 ]; then
    echo "ERROR: API failed to become ready within timeout."
    exit 1
  fi
fi

echo "✓ API is live."

echo "4. Testing /api/v1/health..."
HEALTH=$(curl -sf "${BASE_URL}/health")
echo "Health payload: $HEALTH"

echo "5. Testing /api/v1/graph/health..."
GRAPH_HEALTH=$(curl -sf "${BASE_URL}/graph/health")
echo "Graph health payload: $GRAPH_HEALTH"

echo "6. Triggering Investigation for INC-2026-101..."
INV_RES=$(curl -sf -X POST "${BASE_URL}/investigations" \
  -H "Content-Type: application/json" \
  -d '{"question":"Why is checkout-service failing with 500 errors during token validation?","incidentId":"INC-2026-101","executionMode":"deterministic"}')

echo "Investigation Result:"
echo "$INV_RES" | grep -o '"investigationId":"[^"]*"' || true
echo "$INV_RES" | grep -o '"status":"[^"]*"' || true
echo "$INV_RES" | grep -o '"summary":"[^"]*"' || true

# Extract investigation ID
INV_ID=$(echo "$INV_RES" | sed -n 's/.*"investigationId":"\([^"]*\)".*/\1/p')

if [ -z "$INV_ID" ]; then
  echo "ERROR: Failed to obtain investigationId"
  exit 1
fi

echo "7. Retrieving persisted investigation by ID (${INV_ID})..."
RETRIEVED=$(curl -sf "${BASE_URL}/investigations/${INV_ID}")
echo "Retrieved payload contains status: $(echo "$RETRIEVED" | grep -o '"status":"[^"]*"' || true)"

echo "8. Testing Live Telemetry Ingestion (/api/v1/telemetry/ingest)..."
INGEST_RES=$(curl -sf -X POST "${BASE_URL}/telemetry/ingest" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"source":"smoke-test-runner","eventType":"log","severity":"info","timestamp":"2026-10-18T14:34:00Z","serviceId":"auth-service","summary":"Smoke test synthetic telemetry event","environment":"production"}]}')
echo "Telemetry Ingestion result: $INGEST_RES"

echo "9. Testing Dynamic Graph Intelligence & Failure Domains (/api/v1/intelligence/failure-domains)..."
INTEL_RES=$(curl -sf "${BASE_URL}/intelligence/failure-domains")
echo "Discovered failure domains: $(echo "$INTEL_RES" | grep -o '"count":[0-9]*' || true)"

echo "10. Testing Action Proposals & Approval Boundary (/api/v1/actions)..."
ACTIONS_RES=$(curl -sf "${BASE_URL}/actions")
echo "Action proposals count: $(echo "$ACTIONS_RES" | grep -o '"count":[0-9]*' || true)"

echo "11. Testing Stage 4 Readiness & Observability Metrics (/api/v1/health/ready & /api/v1/metrics)..."
READY_RES=$(curl -sf "${BASE_URL}/health/ready")
echo "Readiness status: $(echo "$READY_RES" | grep -o '"ready":[^,]*' || true)"
METRICS_RES=$(curl -sf "${BASE_URL}/metrics")
echo "Metrics uptime: $(echo "$METRICS_RES" | grep -o '"uptimeSeconds":[0-9]*' || true)"

echo "12. Testing Stage 4 Tenant-Isolated Audit Trail (/api/v1/audit)..."
AUDIT_RES=$(curl -sf -H "X-Tenant-ID: tenant-default" -H "X-User-Role: admin" "${BASE_URL}/audit?limit=5")
echo "Audit records retrieved: $(echo "$AUDIT_RES" | grep -o '"count":[0-9]*' || true)"

echo "13. Testing Stage 4 Graph Lifecycle Stats (/api/v1/lifecycle/stats)..."
LC_STATS=$(curl -sf -H "X-Tenant-ID: tenant-default" "${BASE_URL}/lifecycle/stats")
echo "Lifecycle evidence count: $(echo "$LC_STATS" | grep -o '"evidenceCount":[0-9]*' || true)"

echo "=================================================="
echo "   ✓ ALL STAGE 4 SMOKE TEST CHECKS PASSED         "
echo "=================================================="
