import { Router, Response, NextFunction } from 'express';
import { graphRepository } from '../graph/repository.js';
import { IncidentListItem, IncidentDetailResponse } from '@neutrino/contracts';
import { AuthenticatedRequest } from '../middleware/auth-tenant.js';

const router = Router();

// GET /api/v1/incidents
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';
    const incidents = await graphRepository.listIncidents(limit, tenantId);

    const items: IncidentListItem[] = [];
    for (const inc of incidents) {
      const ctx = await graphRepository.getIncidentContext(inc.id, tenantId);
      items.push({
        id: inc.id,
        tenantId: inc.tenantId || tenantId,
        title: inc.title,
        description: inc.description,
        severity: inc.severity,
        status: inc.status,
        startedAt: inc.startedAt,
        resolvedAt: inc.resolvedAt,
        affectedService: ctx.affectedService?.name || ctx.affectedService?.id,
        owningTeam: ctx.owningTeam?.name,
        synthetic: inc.synthetic,
      });
    }

    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/incidents/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const incidentId = String(req.params.id);
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';
    const ctx = await graphRepository.getIncidentContext(incidentId, tenantId);

    if (!ctx.incident) {
      return res.status(404).json({
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: `Incident '${incidentId}' was not found`,
        },
      });
    }

    const subgraph = await graphRepository.getSubgraph(incidentId, tenantId);

    const response: IncidentDetailResponse = {
      incident: ctx.incident,
      affectedService: ctx.affectedService,
      owningTeam: ctx.owningTeam,
      recentDeployments: ctx.deployments,
      evidence: ctx.evidence,
      subgraph,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/incidents/:id/subgraph
router.get('/:id/subgraph', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const incidentId = String(req.params.id);
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';
    const inc = await graphRepository.getIncidentById(incidentId, tenantId);
    if (!inc) {
      return res.status(404).json({
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: `Incident '${incidentId}' was not found`,
        },
      });
    }

    const subgraph = await graphRepository.getSubgraph(incidentId, tenantId);
    res.json(subgraph);
  } catch (err) {
    next(err);
  }
});

export const incidentRoutes = router;
