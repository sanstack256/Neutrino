import express from 'express';
import cors from 'cors';
import { config } from './config/config.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.routes.js';
import { incidentRoutes } from './routes/incidents.routes.js';
import { investigationRoutes } from './routes/investigations.routes.js';
import { graphManager } from './graph/client.js';

export function createApp() {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: [config.CORS_ORIGIN, config.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    })
  );

  // Body parser with size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Logging & correlation IDs
  app.use(requestLogger);

  // Mount API v1 routes
  app.use('/api/v1', healthRoutes);
  app.use('/api/v1/incidents', incidentRoutes);
  app.use('/api/v1/investigations', investigationRoutes);

  // Error handling middleware
  app.use(errorHandler);

  return app;
}

const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.PORT, () => {
    console.log(`[Neutrino API] Server listening on http://localhost:${config.PORT} (env: ${config.NODE_ENV})`);
    console.log(`[Neutrino API] FalkorDB graph target: ${config.FALKORDB_GRAPH_NAME} at ${config.FALKORDB_HOST}:${config.FALKORDB_PORT}`);
  });

  const shutdown = async () => {
    console.log('[Neutrino API] Gracefully shutting down...');
    server.close(async () => {
      await graphManager.close();
      console.log('[Neutrino API] FalkorDB connection closed. Process exiting.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
