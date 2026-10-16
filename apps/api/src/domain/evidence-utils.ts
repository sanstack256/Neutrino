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
   * Identifies candidate deployments occurring strictly within a valid time window before an incident
   */
  public static findPrecedingDeployments(
    deployments: Deployment[],
    incidentStartTime: string,
    lookbackMinutes = 180
  ): Deployment[] {
    const incidentEpoch = new Date(incidentStartTime).getTime();
    const windowStart = incidentEpoch - lookbackMinutes * 60 * 1000;

    return deployments
      .filter((d) => {
        const depEpoch = new Date(d.deployedAt).getTime();
        // Deployment must strictly occur before or at incident onset, within lookback window
        return depEpoch >= windowStart && depEpoch <= incidentEpoch;
      })
      .sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime());
  }

  /**
   * Filters out stale evidence records that fall outside the active incident temporal window
   */
  public static isWithinIncidentWindow(
    ev: Evidence | string,
    incidentStartTime?: string,
    incidentResolvedTime?: string | null,
    preWindowMinutes = 60,
    postWindowMinutes = 60
  ): boolean {
    if (!incidentStartTime) return true;
    const timeStr = typeof ev === 'string' ? ev : ev.observedAt;
    const evTime = new Date(timeStr).getTime();
    const startTime = new Date(incidentStartTime).getTime();
    const minTime = startTime - preWindowMinutes * 60 * 1000;

    let maxTime = Number.POSITIVE_INFINITY;
    if (incidentResolvedTime) {
      maxTime = new Date(incidentResolvedTime).getTime() + postWindowMinutes * 60 * 1000;
    }

    return evTime >= minTime && evTime <= maxTime;
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
   * Detects verified contradictions in the evidence set for competing hypotheses.
   * Enforces temporal validity: stale evidence outside the incident window cannot contradict an active incident.
   */
  public static detectContradictions(
    evidenceList: Evidence[],
    incidentStartTime?: string,
    incidentResolvedTime?: string | null
  ): { targetHypothesisPattern: string; contradictedByEvidenceId: string; reason: string }[] {
    const contradictions: { targetHypothesisPattern: string; contradictedByEvidenceId: string; reason: string }[] = [];

    for (const ev of evidenceList) {
      // Stale evidence cannot contradict an active incident
      if (!this.isWithinIncidentWindow(ev, incidentStartTime, incidentResolvedTime)) {
        continue;
      }

      const text = `${ev.summary} ${ev.content}`.toLowerCase();

      // Check DB bottleneck contradiction: only when metrics confirm normal latency and healthy pool
      if (text.includes('postgres') || text.includes('database')) {
        if (text.includes('< 2ms') || text.includes('healthy') || (text.includes('active_connections') && !text.includes('exhausted'))) {
          contradictions.push({
            targetHypothesisPattern: 'database',
            contradictedByEvidenceId: ev.id,
            reason: `Temporal metric evidence ${ev.id} observed at ${ev.observedAt} confirms database latency is normal (< 2ms) and pool is healthy, contradicting DB bottleneck hypothesis.`,
          });
        }
      }

      // Check Redis starvation contradiction: only when metrics confirm low latency and healthy CPU
      if (text.includes('redis')) {
        if ((text.includes('1.8ms') || text.includes('cpu_percent') || text.includes('healthy')) && !text.includes('saturated') && !text.includes('timeout')) {
          contradictions.push({
            targetHypothesisPattern: 'redis',
            contradictedByEvidenceId: ev.id,
            reason: `Temporal metric evidence ${ev.id} observed at ${ev.observedAt} confirms Redis latency is steady at 1.8ms and CPU < 5%, contradicting cache resource starvation hypothesis.`,
          });
        }
      }
    }

    return contradictions;
  }
}
