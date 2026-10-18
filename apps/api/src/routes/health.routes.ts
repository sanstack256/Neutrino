import { Router, Request, Response } from 'express';
import { graphManager } from '../graph/client.js';
import { graphRepository } from '../graph/repository.js';
import { config } from '../config/config.js';
import { HealthResponse, GraphHealthResponse, ReadinessResponse } from '@neutrino/contracts';
import { metricsRegistry } from '../observability/metrics.js';

const router = Router();
const startTime = Date.now();

// GET /api/v1/health - Comprehensive health check
router.get('/health', async (req: Request, res: Response) => {
  const dbHealth = await graphManager.checkHealth();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const status: 'healthy' | 'degraded' | 'unhealthy' = dbHealth.connected ? 'healthy' : 'degraded';

  const response: HealthResponse = {
    status,
    version: '0.1.0',
    uptimeSeconds,
    database: {
      connected: dbHealth.connected,
      graphName: config.FALKORDB_GRAPH_NAME,
      details: dbHealth.error,
    },
    environment: config.NODE_ENV,
    executionMode: config.LLM_PROVIDER === 'none' ? 'deterministic' : 'llm-assisted',
  };

  res.status(dbHealth.connected ? 200 : 503).json(response);
});

// GET /api/v1/health/live - Kubernetes/container liveness probe
router.get('/health/live', (req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    status: 'alive',
    uptimeSeconds,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/v1/health/ready - Kubernetes/container readiness probe
router.get('/health/ready', async (req: Request, res: Response) => {
  const dbHealth = await graphManager.checkHealth();
  let indicesReady = false;

  if (dbHealth.connected) {
    try {
      const counts = await graphRepository.getGraphCounts();
      indicesReady = counts.labels.length > 0;
    } catch {
      indicesReady = false;
    }
  }

  const isReady = dbHealth.connected && indicesReady;

  const response: ReadinessResponse = {
    ready: isReady,
    checks: {
      api: true,
      databaseConnected: dbHealth.connected,
      graphExists: dbHealth.connected,
      indicesReady,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(isReady ? 200 : 503).json(response);
});

// GET /api/v1/metrics - Operational diagnostic metrics
router.get('/metrics', (req: Request, res: Response) => {
  const snapshot = metricsRegistry.getSnapshot();
  res.json(snapshot);
});

// GET /api/v1/graph/health
router.get('/graph/health', async (req: Request, res: Response) => {
  const dbHealth = await graphManager.checkHealth();

  if (!dbHealth.connected) {
    return res.status(503).json({
      connected: false,
      graphName: config.FALKORDB_GRAPH_NAME,
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.error || 'Database is unreachable',
    });
  }

  try {
    const counts = await graphRepository.getGraphCounts();
    const response: GraphHealthResponse = {
      connected: true,
      graphName: config.FALKORDB_GRAPH_NAME,
      latencyMs: dbHealth.latencyMs,
      nodeCount: counts.nodeCount,
      relationshipCount: counts.relationshipCount,
      labels: counts.labels,
      relationshipTypes: counts.relationshipTypes,
    };
    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      connected: true,
      graphName: config.FALKORDB_GRAPH_NAME,
      latencyMs: dbHealth.latencyMs,
      error: err.message,
    });
  }
});

export const healthRoutes = router;
