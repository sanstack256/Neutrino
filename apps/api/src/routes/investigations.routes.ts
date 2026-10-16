import { Router, Request, Response, NextFunction } from 'express';
import { investigationEngine } from '../investigation/engine.js';
import { graphRepository } from '../graph/repository.js';
import { InvestigationRequestSchema } from '@neutrino/contracts';

const router = Router();

// POST /api/v1/investigations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const history = await graphRepository.listPersistedInvestigations(limit);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/investigations
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = InvestigationRequestSchema.parse(req.body);
    const result = await investigationEngine.execute(parsed);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/investigations/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const result = await graphRepository.getPersistedInvestigation(id);

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

export const investigationRoutes = router;
