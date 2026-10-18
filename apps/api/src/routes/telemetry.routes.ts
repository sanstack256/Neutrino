import { Router, Response } from 'express';
import { IngestionBatchSchema, TelemetryEventSchema } from '@neutrino/contracts';
import { telemetryRepository } from '../telemetry/repository.js';
import { OtlpParser } from '../telemetry/otlp.js';
import { AuthenticatedRequest } from '../middleware/auth-tenant.js';
import { auditRepository } from '../audit/repository.js';

export const telemetryRouter = Router();

/**
 * POST /api/v1/telemetry/ingest
 * Standard JSON batch ingestion endpoint with tenant context and audit logging
 */
telemetryRouter.post('/ingest', async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = req.correlationId;
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';
  const principalId = req.tenantContext?.principalId || 'unknown';

  try {
    // Support single event or batch
    const rawEvents = Array.isArray(req.body)
      ? req.body
      : req.body?.events && Array.isArray(req.body.events)
      ? req.body.events
      : [req.body];

    const parsedBatch = IngestionBatchSchema.parse({ events: rawEvents });

    const result = await telemetryRepository.ingestBatch(parsedBatch.events, tenantId);

    // Audit log ingestion event
    await auditRepository.log({
      tenantId,
      principalId,
      action: 'telemetry_ingested',
      resourceType: 'telemetry_batch',
      resourceId: result.eventIds[0] || `BATCH-${Date.now()}`,
      status: result.rejected > 0 && result.accepted === 0 ? 'failure' : 'success',
      correlationId,
      details: {
        accepted: result.accepted,
        duplicated: result.duplicated,
        rejected: result.rejected,
        errors: result.errors,
      },
    });

    console.log(
      `[TelemetryIngest] [${tenantId}] Accepted: ${result.accepted}, Duplicated: ${result.duplicated}, Rejected: ${result.rejected} (correlation: ${correlationId})`
    );

    return res.status(201).json(result);
  } catch (err: any) {
    console.warn(`[TelemetryIngest] Validation error: ${err.message} (correlation: ${correlationId})`);
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.issues || err.errors,
        correlationId,
      },
    });
  }
});

/**
 * POST /api/v1/telemetry/otlp/v1/logs
 * OpenTelemetry OTLP/HTTP Logs Ingestion
 */
telemetryRouter.post('/otlp/v1/logs', async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = req.correlationId;
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';

  try {
    const events = OtlpParser.parseLogs(req.body);
    if (events.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_OTLP_LOGS', message: 'No valid log records found in OTLP payload', correlationId },
      });
    }

    const result = await telemetryRepository.ingestBatch(events, tenantId);
    return res.status(201).json(result);
  } catch (err: any) {
    console.warn(`[OTLP Logs] Error: ${err.message} (correlation: ${correlationId})`);
    return res.status(400).json({
      error: { code: 'OTLP_PARSE_ERROR', message: err.message, correlationId },
    });
  }
});

/**
 * POST /api/v1/telemetry/otlp/v1/traces
 * OpenTelemetry OTLP/HTTP Traces Ingestion
 */
telemetryRouter.post('/otlp/v1/traces', async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = req.correlationId;
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';

  try {
    const events = OtlpParser.parseTraces(req.body);
    if (events.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_OTLP_TRACES', message: 'No valid span records found in OTLP payload', correlationId },
      });
    }

    const result = await telemetryRepository.ingestBatch(events, tenantId);
    return res.status(201).json(result);
  } catch (err: any) {
    console.warn(`[OTLP Traces] Error: ${err.message} (correlation: ${correlationId})`);
    return res.status(400).json({
      error: { code: 'OTLP_PARSE_ERROR', message: err.message, correlationId },
    });
  }
});

/**
 * POST /api/v1/telemetry/otlp/v1/metrics
 * OpenTelemetry OTLP/HTTP Metrics Ingestion
 */
telemetryRouter.post('/otlp/v1/metrics', async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = req.correlationId;
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';

  try {
    const events = OtlpParser.parseMetrics(req.body);
    if (events.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_OTLP_METRICS', message: 'No valid metric records found in OTLP payload', correlationId },
      });
    }

    const result = await telemetryRepository.ingestBatch(events, tenantId);
    return res.status(201).json(result);
  } catch (err: any) {
    console.warn(`[OTLP Metrics] Error: ${err.message} (correlation: ${correlationId})`);
    return res.status(400).json({
      error: { code: 'OTLP_PARSE_ERROR', message: err.message, correlationId },
    });
  }
});

/**
 * GET /api/v1/telemetry/status/:id
 * Retrieve event processing lifecycle status
 */
telemetryRouter.get('/status/:id', async (req: AuthenticatedRequest, res: Response) => {
  const eventId = String(req.params.id);
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';

  const status = await telemetryRepository.getEventStatus(eventId, tenantId);
  if (!status) {
    return res.status(404).json({
      error: {
        code: 'EVENT_STATUS_NOT_FOUND',
        message: `Processing status for event '${eventId}' was not found.`,
      },
    });
  }

  return res.json(status);
});

/**
 * GET /api/v1/telemetry/recent
 * Retrieve recently ingested evidence records from FalkorDB isolated by tenant
 */
telemetryRouter.get('/recent', async (req: AuthenticatedRequest, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 25;
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';

  try {
    const evidence = await telemetryRepository.getRecentEvidence(limit, tenantId);
    return res.json({ count: evidence.length, evidence });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  }
});
