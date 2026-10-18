import { Router, Response } from 'express';
import { AuthenticatedRequest, requireRoles } from '../middleware/auth-tenant.js';
import { auditRepository } from '../audit/repository.js';
import { AuditActionEnum } from '@neutrino/contracts';

export const auditRouter = Router();

/**
 * GET /api/v1/audit
 * Lists audit records for the caller's authorized tenant
 */
auditRouter.get('/', requireRoles(['operator', 'admin', 'system']), async (req: AuthenticatedRequest, res: Response) => {
  const context = req.tenantContext!;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const actionParam = req.query.action as string | undefined;
  const resourceType = req.query.resourceType as string | undefined;

  let action: any = undefined;
  if (actionParam) {
    const parsed = AuditActionEnum.safeParse(actionParam);
    if (parsed.success) {
      action = parsed.data;
    }
  }

  const records = await auditRepository.listAuditRecords({
    tenantId: context.tenantId,
    action,
    resourceType,
    limit,
  });

  return res.json({
    tenantId: context.tenantId,
    count: records.length,
    records,
  });
});
