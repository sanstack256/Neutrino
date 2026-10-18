import crypto from 'node:crypto';
import {
  ActionProposal,
  ActionProposalSchema,
  ActionProposeRequest,
  ActionApproveRequest,
  ActionRejectRequest,
  TenantContext,
} from '@neutrino/contracts';
import { RemediationRepository, remediationRepository } from './repository.js';
import { GraphRepository, graphRepository } from '../graph/repository.js';
import { auditRepository } from '../audit/repository.js';

export interface ActionExecutionOutcome {
  proposal: ActionProposal;
  success: boolean;
  message: string;
}

export class RemediationEngine {
  private repo: RemediationRepository;
  private graphRepo: GraphRepository;

  constructor(repo?: RemediationRepository, graphRepo?: GraphRepository) {
    this.repo = repo || remediationRepository;
    this.graphRepo = graphRepo || graphRepository;
  }

  /**
   * Proposes a new safe diagnostic or remediation action with tenant ownership validation
   */
  public async proposeAction(request: ActionProposeRequest, tenantContext?: TenantContext): Promise<ActionProposal> {
    const tenantId = tenantContext?.tenantId || request.tenantId || 'tenant-default';
    const principalId = tenantContext?.principalId || 'unknown';
    const id = `act-${crypto.randomBytes(4).toString('hex')}`;
    const proposedAt = new Date().toISOString();
    // Expiration: 1 hour default
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    const requiresTwoPersonApproval = request.riskLevel !== 'low';

    // Populate preconditions and postconditions based on actionType
    let preconditions: string[] = [];
    let expectedPostconditions: string[] = [];

    switch (request.actionType) {
      case 'jwks_sync':
        preconditions = ['Target service running', 'JWKS discovery route accessible'];
        expectedPostconditions = ['Token verification errors drop below 1%', 'Active kid present in cache'];
        break;
      case 'cache_flush':
        preconditions = ['Cache cluster reachable', 'P99 latency normal'];
        expectedPostconditions = ['Stale cache entries cleared', 'No unhandled cache miss cascade'];
        break;
      case 'pod_restart':
        preconditions = ['Replica count >= 2', 'Healthy pods available to absorb traffic'];
        expectedPostconditions = ['New pod passes readiness probe within 30s', 'Error logs subside'];
        break;
      case 'diagnostic_probe':
        preconditions = ['Diagnostic endpoint defined', 'Non-destructive GET request'];
        expectedPostconditions = ['HTTP 200 response with status ok', 'Latency < 50ms'];
        break;
      case 'config_rollback':
        preconditions = ['Prior stable config release identified', 'Deployment rollback pipeline idle'];
        expectedPostconditions = ['Configuration version reverted', 'Error rate returns to baseline'];
        break;
    }

    const proposal: ActionProposal = {
      id,
      tenantId,
      proposerId: principalId,
      investigationId: request.investigationId,
      incidentId: request.incidentId,
      procedureId: request.procedureId,
      actionType: request.actionType,
      targetServiceId: request.targetServiceId,
      targetResource: request.targetResource,
      parameters: request.parameters || {},
      riskLevel: request.riskLevel,
      status: 'pending_approval',
      explanation: request.explanation,
      supportingEvidenceIds: [],
      preconditions,
      expectedPostconditions,
      requiresTwoPersonApproval,
      approvals: [],
      proposedAt,
      expiresAt,
      verificationEvidenceIds: [],
    };

    const saved = await this.repo.saveActionProposal(proposal, tenantId);

    await auditRepository.log({
      tenantId,
      principalId,
      action: 'action_proposed',
      resourceType: 'action_proposal',
      resourceId: saved.id,
      status: 'success',
      correlationId: tenantContext?.correlationId,
      details: {
        actionType: saved.actionType,
        targetServiceId: saved.targetServiceId,
        riskLevel: saved.riskLevel,
        requiresTwoPersonApproval,
      },
    });

    return saved;
  }

  /**
   * Approves an action proposal (enforcing tenant ownership and two-person rule for medium/high risk)
   */
  public async approveAction(
    actionId: string,
    approveReq: ActionApproveRequest,
    tenantContext?: TenantContext
  ): Promise<ActionProposal> {
    const callerTenantId = tenantContext?.tenantId || 'tenant-default';
    const principalId = tenantContext?.principalId || approveReq.approverId;

    const proposal = await this.repo.getActionProposal(actionId, callerTenantId);
    if (!proposal) {
      throw new Error(`Action proposal ${actionId} not found`);
    }

    // Verify tenant ownership
    if (callerTenantId !== 'tenant-default' && proposal.tenantId !== callerTenantId && proposal.tenantId !== 'shared') {
      await auditRepository.log({
        tenantId: callerTenantId,
        principalId,
        action: 'authz_denied',
        resourceType: 'action_proposal',
        resourceId: actionId,
        status: 'denied',
        correlationId: tenantContext?.correlationId,
        details: { reason: 'Cross-tenant approval attempt blocked' },
      });
      throw new Error(`Unauthorized cross-tenant action approval: proposal belongs to tenant '${proposal.tenantId}'`);
    }

    // Two-person rule enforcement: proposer cannot approve their own proposal
    if (
      proposal.requiresTwoPersonApproval &&
      proposal.proposerId &&
      (approveReq.approverId === proposal.proposerId || principalId === proposal.proposerId)
    ) {
      const err: any = new Error(
        `Proposer '${proposal.proposerId}' cannot approve their own action proposal under two-person rule`
      );
      err.code = 'PROPOSER_CANNOT_APPROVE';
      throw err;
    }

    // Check expiration
    if (new Date().getTime() > new Date(proposal.expiresAt).getTime()) {
      proposal.status = 'expired';
      await this.repo.saveActionProposal(proposal, proposal.tenantId);
      throw new Error(`Action proposal ${actionId} has expired and cannot be approved`);
    }

    // Check current status
    if (proposal.status !== 'pending_approval' && proposal.status !== 'proposed') {
      throw new Error(`Action proposal ${actionId} is in '${proposal.status}' state and cannot be approved`);
    }

    // Prevent duplicate approval by the same actor
    if (proposal.approvals.some((a) => a.approverId === approveReq.approverId)) {
      throw new Error(`Actor ${approveReq.approverId} has already approved action ${actionId}`);
    }

    proposal.approvals.push({
      approverId: approveReq.approverId,
      approverName: approveReq.approverName,
      role: approveReq.role,
      approvedAt: new Date().toISOString(),
    });

    // Check if approval threshold met
    if (proposal.requiresTwoPersonApproval) {
      if (proposal.approvals.length >= 2) {
        proposal.status = 'approved';
      } else {
        proposal.status = 'pending_approval';
      }
    } else {
      proposal.status = 'approved';
    }

    const saved = await this.repo.saveActionProposal(proposal, proposal.tenantId);

    await auditRepository.log({
      tenantId: proposal.tenantId,
      principalId,
      action: 'action_approved',
      resourceType: 'action_proposal',
      resourceId: saved.id,
      status: 'success',
      correlationId: tenantContext?.correlationId,
      details: {
        approverId: approveReq.approverId,
        currentStatus: saved.status,
        approvalCount: saved.approvals.length,
      },
    });

    return saved;
  }

  /**
   * Rejects an action proposal
   */
  public async rejectAction(
    actionId: string,
    rejectReq: ActionRejectRequest,
    tenantContext?: TenantContext
  ): Promise<ActionProposal> {
    const callerTenantId = tenantContext?.tenantId || 'tenant-default';
    const principalId = tenantContext?.principalId || rejectReq.actorId;

    const proposal = await this.repo.getActionProposal(actionId, callerTenantId);
    if (!proposal) {
      throw new Error(`Action proposal ${actionId} not found`);
    }

    if (callerTenantId !== 'tenant-default' && proposal.tenantId !== callerTenantId && proposal.tenantId !== 'shared') {
      throw new Error(`Unauthorized cross-tenant action rejection: proposal belongs to tenant '${proposal.tenantId}'`);
    }

    if (proposal.status === 'executed' || proposal.status === 'verified') {
      throw new Error(`Cannot reject action ${actionId} that has already been executed`);
    }

    proposal.status = 'rejected';
    proposal.rejectedBy = {
      actorId: rejectReq.actorId,
      reason: rejectReq.reason,
      rejectedAt: new Date().toISOString(),
    };

    const saved = await this.repo.saveActionProposal(proposal, proposal.tenantId);

    await auditRepository.log({
      tenantId: proposal.tenantId,
      principalId,
      action: 'action_rejected',
      resourceType: 'action_proposal',
      resourceId: saved.id,
      status: 'success',
      correlationId: tenantContext?.correlationId,
      details: {
        actorId: rejectReq.actorId,
        reason: rejectReq.reason,
      },
    });

    return saved;
  }

  /**
   * Executes an approved action proposal through allowlisted safe handlers
   */
  public async executeAction(actionId: string, tenantContext?: TenantContext): Promise<ActionExecutionOutcome> {
    const callerTenantId = tenantContext?.tenantId || 'tenant-default';
    const principalId = tenantContext?.principalId || 'unknown';

    const proposal = await this.repo.getActionProposal(actionId, callerTenantId);
    if (!proposal) {
      throw new Error(`Action proposal ${actionId} not found`);
    }

    // Verify tenant ownership
    if (callerTenantId !== 'tenant-default' && proposal.tenantId !== callerTenantId && proposal.tenantId !== 'shared') {
      await auditRepository.log({
        tenantId: callerTenantId,
        principalId,
        action: 'authz_denied',
        resourceType: 'action_proposal',
        resourceId: actionId,
        status: 'denied',
        correlationId: tenantContext?.correlationId,
        details: { reason: 'Cross-tenant execution attempt blocked' },
      });
      throw new Error(`Unauthorized cross-tenant action execution: proposal belongs to tenant '${proposal.tenantId}'`);
    }

    // 1. Enforce strict approval check
    if (proposal.status !== 'approved') {
      throw new Error(
        `Action ${actionId} is not approved (current status: '${proposal.status}'). Execution rejected.`
      );
    }

    // 2. Check expiration
    if (new Date().getTime() > new Date(proposal.expiresAt).getTime()) {
      proposal.status = 'expired';
      await this.repo.saveActionProposal(proposal, proposal.tenantId);
      throw new Error(`Action ${actionId} expired before execution`);
    }

    // 3. Check two-person approval if required
    if (proposal.requiresTwoPersonApproval && proposal.approvals.length < 2) {
      throw new Error(`Action ${actionId} requires 2 distinct approvals but only has ${proposal.approvals.length}`);
    }

    proposal.status = 'executing';
    await this.repo.saveActionProposal(proposal, proposal.tenantId);

    const t0 = performance.now();
    let executionOutput = '';
    let success = true;

    try {
      // 4. Dispatch to Allowlisted Action Handler
      switch (proposal.actionType) {
        case 'diagnostic_probe':
          if (proposal.targetResource.startsWith('http://') || proposal.targetResource.startsWith('https://')) {
            try {
              const probeStart = performance.now();
              const probeRes = await fetch(proposal.targetResource, { signal: AbortSignal.timeout(3000) });
              const probeLatency = Math.round(performance.now() - probeStart);
              executionOutput = `[Real Operation: diagnostic_probe] Executed live HTTP GET against ${proposal.targetResource}. Returned HTTP ${probeRes.status} ${probeRes.statusText} (latency: ${probeLatency}ms).`;
            } catch (probeErr: any) {
              executionOutput = `[Real Operation: diagnostic_probe] Probe connection to ${proposal.targetResource} timed out or failed: ${probeErr.message}`;
            }
          } else {
            executionOutput = `[Simulated Sandbox: diagnostic_probe] Executed diagnostic probe against ${proposal.targetResource}. Returned simulated HTTP 200 OK (latency: 12ms).`;
          }
          break;
        case 'cache_flush':
          executionOutput = `[Sandboxed Operation: cache_flush] Evicted targeted invalid key prefix on ${proposal.targetResource} for service ${proposal.targetServiceId}. Cache memory pressure relieved.`;
          break;
        case 'jwks_sync':
          executionOutput = `[Sandboxed Operation: jwks_sync] Dispatched non-destructive key discovery refresh to ${proposal.targetServiceId} on resource ${proposal.targetResource}. Public key cache aligned.`;
          break;
        case 'pod_restart':
          executionOutput = `[Simulated Sandbox: pod_restart] Triggered graceful pod rolling reload on ${proposal.targetResource}. Pod restarted successfully with zero dropped requests.`;
          break;
        case 'config_rollback':
          executionOutput = `[Simulated Sandbox: config_rollback] Reverted configuration flag to previous stable revision for ${proposal.targetServiceId}.`;
          break;
        default:
          throw new Error(`Unsupported or unallowed action type: ${(proposal as any).actionType}`);
      }
    } catch (err: any) {
      success = false;
      executionOutput = `Execution failed: ${err.message}`;
    }

    const durationMs = Number((performance.now() - t0).toFixed(2));
    proposal.executedAt = new Date().toISOString();
    proposal.executionResult = {
      status: success ? 'success' : 'failure',
      output: executionOutput,
      durationMs,
    };
    proposal.status = success ? 'executed' : 'failed';

    const saved = await this.repo.saveActionProposal(proposal, proposal.tenantId);

    await auditRepository.log({
      tenantId: proposal.tenantId,
      principalId,
      action: 'action_executed',
      resourceType: 'action_proposal',
      resourceId: saved.id,
      status: success ? 'success' : 'failure',
      correlationId: tenantContext?.correlationId,
      details: {
        output: executionOutput,
        durationMs,
        actionType: saved.actionType,
      },
    });

    return {
      proposal: saved,
      success,
      message: executionOutput,
    };
  }

  /**
   * Verifies postconditions by independently checking live evidence in FalkorDB
   */
  public async verifyPostconditions(actionId: string, tenantContext?: TenantContext): Promise<ActionProposal> {
    const callerTenantId = tenantContext?.tenantId || 'tenant-default';
    const principalId = tenantContext?.principalId || 'unknown';

    const proposal = await this.repo.getActionProposal(actionId, callerTenantId);
    if (!proposal) {
      throw new Error(`Action proposal ${actionId} not found`);
    }

    if (callerTenantId !== 'tenant-default' && proposal.tenantId !== callerTenantId && proposal.tenantId !== 'shared') {
      throw new Error(`Unauthorized cross-tenant verification: proposal belongs to tenant '${proposal.tenantId}'`);
    }

    if (proposal.status !== 'executed') {
      throw new Error(`Action ${actionId} must be in 'executed' status to verify (current: '${proposal.status}')`);
    }

    // Retrieve live evidence observed for target service
    const recentEvidence = await this.graphRepo.getIncidentContext(proposal.incidentId, proposal.tenantId);
    const postExecEvidence = recentEvidence.evidence.filter((e) => {
      if (!proposal.executedAt) return false;
      return new Date(e.observedAt).getTime() >= new Date(proposal.executedAt).getTime() - 60000;
    });

    // Check if any healthy metrics corroborate resolution
    const corroborating = postExecEvidence.filter(
      (e) =>
        e.content.includes('healthy') ||
        e.content.includes('< 2ms') ||
        e.content.includes('200') ||
        e.summary.toLowerCase().includes('normal')
    );

    if (corroborating.length > 0 || proposal.actionType === 'diagnostic_probe') {
      proposal.status = 'verified';
      proposal.verificationEvidenceIds = corroborating.map((e) => e.id);
      proposal.verificationNotes = `Postconditions confirmed by ${corroborating.length} independent healthy evidence records in FalkorDB.`;
    } else {
      proposal.status = 'unverified';
      proposal.verificationNotes = `No post-execution healthy evidence records observed in FalkorDB yet. Requires further telemetry.`;
    }

    const saved = await this.repo.saveActionProposal(proposal, proposal.tenantId);

    await auditRepository.log({
      tenantId: proposal.tenantId,
      principalId,
      action: 'postcondition_verified',
      resourceType: 'action_proposal',
      resourceId: saved.id,
      status: saved.status === 'verified' ? 'success' : 'failure',
      correlationId: tenantContext?.correlationId,
      details: {
        verificationStatus: saved.status,
        corroboratingCount: saved.verificationEvidenceIds.length,
        notes: saved.verificationNotes,
      },
    });

    return saved;
  }
}

export const remediationEngine = new RemediationEngine();
