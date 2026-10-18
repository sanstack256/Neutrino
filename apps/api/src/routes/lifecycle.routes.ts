import { Router, Response } from 'express';
import { AuthenticatedRequest, requireRoles } from '../middleware/auth-tenant.js';
import { graphLifecycleManager } from '../lifecycle/manager.js';
import { LifecyclePruneRequestSchema } from '@neutrino/contracts';

export const lifecycleRouter = Router();

/**
 * POST /api/v1/lifecycle/prune
 * Executes a bounded lifecycle prune operation (dry-run by default)
 */
lifecycleRouter.post('/prune', requireRoles(['admin', 'system', 'operator']), async (req: AuthenticatedRequest, res: Response) => {
  const context = req.tenantContext!;
  try {
    const validated = LifecyclePruneRequestSchema.parse(req.body);
    const result = await graphLifecycleManager.prune(validated, context.tenantId, context.principalId);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({
      error: {
        code: 'LIFECYCLE_PRUNE_ERROR',
        message: err.message,
        correlationId: context.correlationId,
      },
    });
  }
});

/**
 * GET /api/v1/lifecycle/stats
 * Inspects current lifecycle metrics by category
 */
lifecycleRouter.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';
  const stats = await graphLifecycleManager.getLifecycleStats(tenantId);
  return res.json(stats);
});
