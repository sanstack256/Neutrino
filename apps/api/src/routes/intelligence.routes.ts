import { Router } from 'express';
import { graphIntelligenceService } from '../intelligence/failure-domains.js';
import { AuthenticatedRequest } from '../middleware/auth-tenant.js';

export const intelligenceRouter = Router();

/**
 * GET /api/v1/intelligence/failure-domains
 * Returns dynamic graph-derived failure domains and blast radius assessments isolated by tenant
 */
intelligenceRouter.get('/failure-domains', async (req: AuthenticatedRequest, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';
    const domains = await graphIntelligenceService.discoverFailureDomains(forceRefresh, tenantId);
    res.json({
      success: true,
      tenantId,
      data: domains,
      count: domains.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/intelligence/service/:serviceId
 * Returns failure domain membership and blast radius for a specific service isolated by tenant
 */
intelligenceRouter.get('/service/:serviceId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const serviceId = String(req.params.serviceId);
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';
    const domain = await graphIntelligenceService.getFailureDomainForService(serviceId, tenantId);
    if (!domain) {
      return res.status(404).json({
        success: false,
        error: `No failure domain found containing service '${serviceId}'`,
      });
    }
    res.json({
      success: true,
      tenantId,
      data: domain,
    });
  } catch (error) {
    next(error);
  }
});
