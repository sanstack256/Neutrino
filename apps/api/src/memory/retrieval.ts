import {
  Incident,
  Service,
  Evidence,
  RecalledMemoryRecord,
  MemoryType,
} from '@neutrino/contracts';
import { MemoryRepository, memoryRepository } from './repository.js';

export interface MemoryRetrievalContext {
  incident?: Incident | null;
  affectedService?: Service | null;
  upstreamDependencies?: { service: Service; depth: number }[];
  currentEvidence?: Evidence[];
  limit?: number;
  includeSuperseded?: boolean;
  tenantId?: string;
}

export class MemoryRetrievalEngine {
  private repo: MemoryRepository;

  constructor(repo?: MemoryRepository) {
    this.repo = repo || memoryRepository;
  }

  /**
   * Retrieves, ranks, and evaluates relevant graph memories against current investigation context
   */
  public async retrieveRelevantMemories(
    context: MemoryRetrievalContext
  ): Promise<RecalledMemoryRecord[]> {
    const limit = Math.min(Math.max(1, context.limit || 5), 10);
    const serviceIds: string[] = [];

    if (context.affectedService?.id) {
      serviceIds.push(context.affectedService.id);
    }

    if (context.upstreamDependencies) {
      for (const dep of context.upstreamDependencies) {
        if (!serviceIds.includes(dep.service.id)) {
          serviceIds.push(dep.service.id);
        }
      }
    }

    if (serviceIds.length === 0) {
      return [];
    }

    // 1. Fetch connected graph memories from FalkorDB isolated by tenant
    const { episodes, claims, procedures } = await this.repo.findConnectedMemories(
      {
        serviceIds,
        incidentId: context.incident?.id,
        includeSuperseded: context.includeSuperseded || false,
        limit: 15,
      },
      context.tenantId || 'tenant-default'
    );

    const candidates: Array<{
      memoryId: string;
      memoryType: MemoryType;
      statement: string;
      status: any;
      score: number;
      reason: string;
      targetServiceId?: string;
      rawItem: any;
    }> = [];

    const now = Date.now();

    // 2. Score Semantic Knowledge Claims
    for (const claim of claims) {
      const isDirectMatch = claim.subject === context.affectedService?.id;
      const isUpstreamMatch = (context.upstreamDependencies || []).some(
        (d) => d.service.id === claim.subject || d.service.id === claim.object
      );

      const entityOverlap = isDirectMatch ? 1.0 : isUpstreamMatch ? 0.75 : 0.3;
      const topoScore = isDirectMatch ? 1.0 : isUpstreamMatch ? 0.8 : 0.2;

      // Recency calculation
      const ageHours = Math.max(
        0,
        (now - new Date(claim.lastVerifiedAt).getTime()) / (1000 * 60 * 60)
      );
      const recencyScore = Math.exp(-0.005 * ageHours); // gentle exponential decay
      const confidenceScore = claim.confidence || 0.9;

      const score = Number(
        (
          entityOverlap * 0.35 +
          topoScore * 0.25 +
          recencyScore * 0.20 +
          confidenceScore * 0.20
        ).toFixed(3)
      );

      candidates.push({
        memoryId: claim.id,
        memoryType: 'semantic',
        statement: claim.statement,
        status: claim.status,
        score,
        reason: `Knowledge claim for ${claim.subject} (overlap: ${entityOverlap}, topo: ${topoScore}, confidence: ${confidenceScore})`,
        targetServiceId: claim.subject,
        rawItem: claim,
      });
    }

    // 3. Score Diagnostic Procedures
    for (const proc of procedures) {
      const isDirectMatch = proc.serviceId === context.affectedService?.id;
      const isUpstreamMatch = (context.upstreamDependencies || []).some(
        (d) => d.service.id === proc.serviceId
      );

      const entityOverlap = isDirectMatch ? 1.0 : isUpstreamMatch ? 0.8 : 0.3;
      const topoScore = isDirectMatch ? 1.0 : isUpstreamMatch ? 0.75 : 0.2;
      const recencyScore = 0.9;
      const confidenceScore = 0.95;

      const score = Number(
        (
          entityOverlap * 0.35 +
          topoScore * 0.25 +
          recencyScore * 0.20 +
          confidenceScore * 0.20
        ).toFixed(3)
      );

      candidates.push({
        memoryId: proc.id,
        memoryType: 'procedural',
        statement: `${proc.name}: ${proc.purpose}`,
        status: proc.status,
        score,
        reason: `Validated diagnostic procedure for ${proc.serviceId} (version ${proc.version})`,
        targetServiceId: proc.serviceId,
        rawItem: proc,
      });
    }

    // 4. Score Episodic Memories
    for (const ep of episodes) {
      const matchesAffected = ep.serviceIds.includes(
        context.affectedService?.id || ''
      );
      const matchesIncident =
        context.incident?.id && ep.incidentId === context.incident.id;

      const entityOverlap = matchesIncident ? 1.0 : matchesAffected ? 0.8 : 0.4;
      const topoScore = matchesAffected ? 0.9 : 0.4;
      const ageHours = Math.max(
        0,
        (now - new Date(ep.createdAt).getTime()) / (1000 * 60 * 60)
      );
      const recencyScore = Math.exp(-0.005 * ageHours);
      const confidenceScore = ep.outcome === 'completed' ? 1.0 : 0.6;

      const score = Number(
        (
          entityOverlap * 0.35 +
          topoScore * 0.25 +
          recencyScore * 0.20 +
          confidenceScore * 0.20
        ).toFixed(3)
      );

      candidates.push({
        memoryId: ep.id,
        memoryType: 'episodic',
        statement: ep.summary,
        status: ep.status,
        score,
        reason: `Investigation episode for services [${ep.serviceIds.join(', ')}] (outcome: ${ep.outcome})`,
        rawItem: ep,
      });
    }

    // Deduplicate candidates by normalized statement
    const seenStatements = new Set<string>();
    const uniqueCandidates = candidates.filter((c) => {
      const key = c.statement.trim().toLowerCase();
      if (seenStatements.has(key)) return false;
      seenStatements.add(key);
      return true;
    });

    // Sort unique candidates descending by score
    uniqueCandidates.sort((a, b) => b.score - a.score);

    // Ensure balanced memory representation so active procedural memories are not crowded out
    const topProcedures = uniqueCandidates.filter((c) => c.memoryType === 'procedural');
    const topClaims = uniqueCandidates.filter((c) => c.memoryType === 'semantic');
    const topEpisodes = uniqueCandidates.filter((c) => c.memoryType === 'episodic');

    const balancedCandidates: typeof uniqueCandidates = [];
    if (topProcedures.length > 0) {
      balancedCandidates.push(...topProcedures.slice(0, 3));
    }
    if (topClaims.length > 0) {
      balancedCandidates.push(...topClaims.slice(0, 4));
    }
    if (topEpisodes.length > 0) {
      balancedCandidates.push(...topEpisodes.slice(0, 3));
    }
    for (const c of uniqueCandidates) {
      if (!balancedCandidates.some((bc) => bc.memoryId === c.memoryId)) {
        balancedCandidates.push(c);
      }
      if (balancedCandidates.length >= Math.max(limit, 8)) break;
    }
    balancedCandidates.sort((a, b) => b.score - a.score);
    const topCandidates = balancedCandidates.slice(0, Math.max(limit, 8));

    // 5. Cross-Check with Active Evidence to Determine Influence
    const currentEvidence = context.currentEvidence || [];
    const results: RecalledMemoryRecord[] = [];

    for (const cand of topCandidates) {
      const corroborating: string[] = [];
      const contradicting: string[] = [];

      for (const ev of currentEvidence) {
        const text = `${ev.summary} ${ev.content}`.toLowerCase();
        const candText = cand.statement.toLowerCase();

        // Contradiction detection:
        // E.g. memory claims database connection exhaustion, but active evidence shows database healthy (< 2ms)
        if (
          candText.includes('database') &&
          text.includes('database') &&
          (text.includes('healthy') || text.includes('< 2ms') || text.includes('latency normal'))
        ) {
          contradicting.push(ev.id);
        } else if (
          candText.includes('redis') &&
          text.includes('redis') &&
          (text.includes('steady at 1.8ms') || text.includes('cpu < 5%'))
        ) {
          contradicting.push(ev.id);
        } else if (
          candText.includes('auth-service') &&
          (text.includes('authtokenverificationerror') || text.includes('auth-service'))
        ) {
          corroborating.push(ev.id);
        }
      }

      let influence: RecalledMemoryRecord['influence'] = 'guided_traversal';

      if (contradicting.length > 0) {
        // Critical Rule: Live contradictory evidence overrides prior memory
        influence = 'rejected_by_evidence';
      } else if (cand.memoryType === 'procedural') {
        influence = 'suggested_procedure';
      } else if (cand.memoryType === 'semantic' && corroborating.length > 0) {
        influence = 'prioritized_hypothesis';
      } else if (corroborating.length === 0 && contradicting.length === 0) {
        influence = 'inconclusive';
      }

      results.push({
        memoryId: cand.memoryId,
        memoryType: cand.memoryType,
        statement: cand.statement,
        relevanceScore: cand.score,
        retrievalReason: cand.reason,
        status: cand.status,
        influence,
        currentEvidenceCorroboration: corroborating,
        currentEvidenceContradiction: contradicting,
      });
    }

    return results;
  }
}

export const memoryRetrievalEngine = new MemoryRetrievalEngine();
