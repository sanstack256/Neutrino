import { Router, Response } from 'express';
import {
  ActionProposeRequestSchema,
  ActionApproveRequestSchema,
  ActionRejectRequestSchema,
} from '@neutrino/contracts';
import { remediationEngine } from '../remediation/engine.js';
import { remediationRepository } from '../remediation/repository.js';
import { AuthenticatedRequest } from '../middleware/auth-tenant.js';

export const actionsRouter = Router();

/**
 * GET /api/v1/actions
 * Lists action proposals (supports status and incidentId filters) isolated by tenant
 */
actionsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const incidentId = req.query.incidentId as string | undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';

  try {
    const proposals = await remediationRepository.listActionProposals({ status, incidentId, limit }, tenantId);
    return res.json({ count: proposals.length, actions: proposals });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  }
});

/**
 * GET /api/v1/actions/:id
 * Retrieves an action proposal by ID isolated by tenant
 */
actionsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.tenantContext?.tenantId || 'tenant-default';

  try {
    const proposal = await remediationRepository.getActionProposal(id, tenantId);
    if (!proposal) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Action proposal ${id} not found` },
      });
    }
    return res.json(proposal);
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  }
});

/**
 * POST /api/v1/actions/propose
 * Propose a new action
 */
actionsRouter.post('/propose', async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = req.correlationId;
  try {
    const validated = ActionProposeRequestSchema.parse(req.body);
    const proposal = await remediationEngine.proposeAction(validated, req.tenantContext);
    console.log(`[ActionPropose] Created proposal ${proposal.id} for ${proposal.targetServiceId} (correlation: ${correlationId})`);
    return res.status(201).json(proposal);
  } catch (err: any) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: err.message, correlationId },
    });
  }
});

/**
 * POST /api/v1/actions/:id/approve
 * Approve an action proposal
 */
actionsRouter.post('/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const correlationId = req.correlationId;
  try {
    const validated = ActionApproveRequestSchema.parse(req.body);
    const proposal = await remediationEngine.approveAction(id, validated, req.tenantContext);
    console.log(`[ActionApprove] Action ${id} approved by ${validated.approverId} (correlation: ${correlationId})`);
    return res.json(proposal);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : err.message.includes('Unauthorized') ? 403 : 400;
    const code = err.code || (status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'APPROVAL_ERROR');
    return res.status(status).json({
      error: { code, message: err.message, correlationId },
    });
  }
});

/**
 * POST /api/v1/actions/:id/reject
 * Reject an action proposal
 */
actionsRouter.post('/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const correlationId = req.correlationId;
  try {
    const validated = ActionRejectRequestSchema.parse(req.body);
    const proposal = await remediationEngine.rejectAction(id, validated, req.tenantContext);
    console.log(`[ActionReject] Action ${id} rejected by ${validated.actorId} (correlation: ${correlationId})`);
    return res.json(proposal);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : err.message.includes('Unauthorized') ? 403 : 400;
    return res.status(status).json({
      error: { code: 'REJECTION_ERROR', message: err.message, correlationId },
    });
  }
});

/**
 * POST /api/v1/actions/:id/execute
 * Execute an approved action proposal
 */
actionsRouter.post('/:id/execute', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const correlationId = req.correlationId;
  try {
    const outcome = await remediationEngine.executeAction(id, req.tenantContext);
    console.log(`[ActionExecute] Action ${id} executed with result ${outcome.proposal.status} (correlation: ${correlationId})`);
    return res.json(outcome);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : err.message.includes('Unauthorized') ? 403 : 400;
    return res.status(status).json({
      error: { code: 'EXECUTION_ERROR', message: err.message, correlationId },
    });
  }
});

/**
 * POST /api/v1/actions/:id/verify
 * Verify postconditions against FalkorDB evidence
 */
actionsRouter.post('/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const correlationId = req.correlationId;
  try {
    const proposal = await remediationEngine.verifyPostconditions(id, req.tenantContext);
    console.log(`[ActionVerify] Action ${id} verified status: ${proposal.status} (correlation: ${correlationId})`);
    return res.json(proposal);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : err.message.includes('Unauthorized') ? 403 : 400;
    return res.status(status).json({
      error: { code: 'VERIFICATION_ERROR', message: err.message, correlationId },
    });
  }
});
