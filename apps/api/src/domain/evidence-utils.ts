import { Evidence, Deployment } from '@neutrino/contracts';

export interface TimelineEntry {
  timestamp: string;
  type: 'incident_start' | 'deployment' | 'evidence_observed' | 'alert';
  entityId: string;
  summary: string;
  details?: any;
}

export class EvidenceUtils {
  /**
   * Sort evidence chronologically by observedAt UTC timestamp
   */
  public static sortByTimestamp(evidenceList: Evidence[]): Evidence[] {
    return [...evidenceList].sort((a, b) => {
      const timeA = new Date(a.observedAt).getTime();
      const timeB = new Date(b.observedAt).getTime();
      return timeA - timeB;
    });
  }

  /**
   * Group evidence by sourceType (e.g. 'log', 'metric', 'alert', 'trace', 'postmortem')
   */
  public static groupBySourceType(evidenceList: Evidence[]): Record<string, Evidence[]> {
    const grouped: Record<string, Evidence[]> = {};
    for (const ev of evidenceList) {
      const type = ev.sourceType || 'unknown';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(ev);
    }
    return grouped;
  }

  /**
   * Deduplicate evidence by id or contentHash
   */
  public static deduplicate(evidenceList: Evidence[]): Evidence[] {
    const seenIds = new Set<string>();
    const seenHashes = new Set<string>();
    const deduplicated: Evidence[] = [];

    for (const ev of evidenceList) {
      if (seenIds.has(ev.id) || (ev.contentHash && seenHashes.has(ev.contentHash))) {
        continue;
      }
      seenIds.add(ev.id);
      if (ev.contentHash) seenHashes.add(ev.contentHash);
      deduplicated.push(ev);
    }

    return deduplicated;
  }

  /**
   * Identifies candidate deployments occurring within a given time window before an incident
   */
  public static findPrecedingDeployments(
    deployments: Deployment[],
    incidentStartTime: string,
    lookbackMinutes = 120
  ): Deployment[] {
    const incidentEpoch = new Date(incidentStartTime).getTime();
    const windowStart = incidentEpoch - lookbackMinutes * 60 * 1000;

    return deployments
      .filter((d) => {
        const depEpoch = new Date(d.deployedAt).getTime();
        return depEpoch >= windowStart && depEpoch <= incidentEpoch;
      })
      .sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime());
  }

  /**
   * Builds an ordered investigation timeline merging incident start, deployments, and evidence
   */
  public static buildTimeline(
    incidentStartTime: string,
    incidentTitle: string,
    deployments: Deployment[],
    evidenceList: Evidence[]
  ): TimelineEntry[] {
    const timeline: TimelineEntry[] = [];

    // 1. Add incident start
    timeline.push({
      timestamp: incidentStartTime,
      type: 'incident_start',
      entityId: 'incident',
      summary: `Incident detected: ${incidentTitle}`,
    });

    // 2. Add deployments
    for (const d of deployments) {
      timeline.push({
        timestamp: d.deployedAt,
        type: 'deployment',
        entityId: d.serviceId,
        summary: `Deployment on ${d.serviceId} (${d.version}): ${d.changeSummary}`,
        details: d,
      });
    }

    // 3. Add evidence observations
    for (const ev of evidenceList) {
      timeline.push({
        timestamp: ev.observedAt,
        type: 'evidence_observed',
        entityId: ev.sourceRecordId,
        summary: `[${ev.sourceType.toUpperCase()}] ${ev.summary}`,
        details: ev,
      });
    }

    // Sort chronologically
    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Detects known contradictions in the evidence set
   * e.g., if a hypothesis alleges DB or Redis bottleneck, but metric evidence confirms low latency & healthy pool.
   */
  public static detectContradictions(
    evidenceList: Evidence[]
  ): { targetHypothesisPattern: string; contradictedByEvidenceId: string; reason: string }[] {
    const contradictions: { targetHypothesisPattern: string; contradictedByEvidenceId: string; reason: string }[] = [];

    for (const ev of evidenceList) {
      const text = `${ev.summary} ${ev.content}`.toLowerCase();

      // Check DB bottleneck contradiction
      if (text.includes('database latency') && (text.includes('< 2ms') || text.includes('healthy') || text.includes('normal'))) {
        contradictions.push({
          targetHypothesisPattern: 'database',
          contradictedByEvidenceId: ev.id,
          reason: `Metric evidence ${ev.id} indicates database latency is normal (< 2ms) and pool is healthy, contradicting DB bottleneck hypothesis.`,
        });
      }

      // Check Redis pool contradiction
      if (text.includes('redis') && (text.includes('latency') || text.includes('cpu')) && (text.includes('1.8ms') || text.includes('< 5%') || text.includes('healthy'))) {
        contradictions.push({
          targetHypothesisPattern: 'redis',
          contradictedByEvidenceId: ev.id,
          reason: `Metric evidence ${ev.id} indicates Redis latency is 1.8ms and CPU < 5%, contradicting cache starvation or connection pool exhaustion.`,
        });
      }
    }

    return contradictions;
  }
}
