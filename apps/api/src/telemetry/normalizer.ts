import crypto from 'node:crypto';
import { TelemetryEvent, Evidence } from '@neutrino/contracts';
import { redactSensitiveData, redactObject } from './redaction.js';

export interface NormalizedEvidencePayload {
  evidence: Evidence;
  source: string;
  serviceId?: string;
  traceId?: string;
  spanId?: string;
  metricName?: string;
  metricValue?: number;
  environment: string;
}

export class TelemetryNormalizer {
  /**
   * Normalizes a raw TelemetryEvent into canonical Evidence properties with deduplication hash
   */
  public static normalize(event: TelemetryEvent): NormalizedEvidencePayload {
    // 1. Sanitize summary and content
    const summaryText =
      event.summary ||
      event.message ||
      (event.error ? (event.error as any).message : '') ||
      `${event.eventType} event on ${event.serviceId || 'unknown'}`;
    const sanitizedSummary = redactSensitiveData(summaryText.trim());
    const rawContent =
      event.content ||
      event.message ||
      JSON.stringify(event.error || event.attributes || {});
    const sanitizedContent = redactSensitiveData(rawContent);

    // 2. Generate deterministic content hash for duplicate identification
    // Hash key covers: tenantId + source + serviceId + eventType + normalized timestamp + summary
    const tenantId = event.tenantId || 'tenant-default';
    const hashPayload = [
      tenantId,
      event.source,
      event.serviceId || 'global',
      event.eventType,
      new Date(event.timestamp).toISOString(),
      sanitizedSummary,
    ].join('::');

    const contentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    // 3. Deterministic or supplied ID
    const evidenceId = event.id || `EV-INGEST-${contentHash.slice(0, 12)}`;

    // 4. Determine reliability class based on source
    let reliabilityClass: Evidence['reliabilityClass'] = 'medium';
    if (event.source.includes('otel') || event.source.includes('datadog') || event.source.includes('prometheus')) {
      reliabilityClass = 'high';
    } else if (event.source.includes('status') || event.source.includes('postmortem')) {
      reliabilityClass = 'authoritative';
    }

    const evidence: Evidence = {
      id: evidenceId,
      tenantId,
      sourceType: event.eventType,
      sourceRecordId: event.source,
      observedAt: new Date(event.timestamp).toISOString(),
      ingestedAt: new Date().toISOString(),
      summary: sanitizedSummary,
      content: sanitizedContent,
      contentHash,
      synthetic: event.synthetic || false,
      reliabilityClass,
    };

    return {
      evidence,
      source: event.source,
      serviceId: event.serviceId,
      traceId: event.traceId,
      spanId: event.spanId,
      metricName: event.metricName,
      metricValue: event.metricValue,
      environment: event.environment || 'production',
    };
  }
}
