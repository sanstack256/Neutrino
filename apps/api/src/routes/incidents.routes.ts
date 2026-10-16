import { Router, Request, Response, NextFunction } from 'express';
import { graphRepository } from '../graph/repository.js';
import { IncidentListItem, IncidentDetailResponse } from '@neutrino/contracts';

const router = Router();

// GET /api/v1/incidents
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const incidents = await graphRepository.listIncidents(limit);

    const items: IncidentListItem[] = [];
    for (const inc of incidents) {
      const ctx = await graphRepository.getIncidentContext(inc.id);
      items.push({
        id: inc.id,
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incidentId = String(req.params.id);
    const ctx = await graphRepository.getIncidentContext(incidentId);

    if (!ctx.incident) {
      return res.status(404).json({
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: `Incident '${incidentId}' was not found`,
        },
      });
    }

    const subgraph = await graphRepository.getSubgraph(incidentId);

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
router.get('/:id/subgraph', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incidentId = String(req.params.id);
    const inc = await graphRepository.getIncidentById(incidentId);
    if (!inc) {
      return res.status(404).json({
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: `Incident '${incidentId}' was not found`,
        },
      });
    }

    const subgraph = await graphRepository.getSubgraph(incidentId);
    res.json(subgraph);
  } catch (err) {
    next(err);
  }
});

export const incidentRoutes = router;
