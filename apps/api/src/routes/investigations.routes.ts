import { Router, Response, NextFunction } from 'express';
import { investigationEngine } from '../investigation/engine.js';
import { graphRepository } from '../graph/repository.js';
import { InvestigationRequestSchema } from '@neutrino/contracts';
import { AuthenticatedRequest } from '../middleware/auth-tenant.js';
import { auditRepository } from '../audit/repository.js';

const router = Router();

// GET /api/v1/investigations
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';
    const history = await graphRepository.listPersistedInvestigations(limit, tenantId);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/investigations
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const correlationId = req.correlationId;
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';
  const principalId = req.tenantContext?.principalId || 'unknown';

  try {
    const parsed = InvestigationRequestSchema.parse(req.body);

    await auditRepository.log({
      tenantId,
      principalId,
      action: 'investigation_created',
      resourceType: 'investigation',
      resourceId: parsed.incidentId || 'ad-hoc',
      status: 'success',
      correlationId,
      details: { question: parsed.question, executionMode: parsed.executionMode },
    });

    const result = await investigationEngine.execute(parsed, req.tenantContext);

    await auditRepository.log({
      tenantId,
      principalId,
      action: 'investigation_completed',
      resourceType: 'investigation',
      resourceId: result.investigationId,
      status: 'success',
      correlationId,
      details: {
        summary: result.summary,
        status: result.status,
        affectedServices: result.affectedServices,
        explanationsCount: result.candidateExplanations.length,
      },
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/investigations/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';
    const result = await graphRepository.getPersistedInvestigation(id, tenantId);

    if (!result) {
      return res.status(404).json({
        error: {
          code: 'INVESTIGATION_NOT_FOUND',
          message: `Investigation with ID '${id}' was not found.`,
        },
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/investigations/:id/events - Retrieve reasoning and planning events trace
router.get('/:id/events', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';
    const result = await graphRepository.getPersistedInvestigation(id, tenantId);

    if (!result) {
      return res.status(404).json({
        error: {
          code: 'INVESTIGATION_NOT_FOUND',
          message: `Investigation with ID '${id}' was not found.`,
        },
      });
    }

    res.json({
      investigationId: id,
      events: result.events || [],
    });
  } catch (err) {
    next(err);
  }
});

export const investigationRoutes = router;
