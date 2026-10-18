import { TelemetryEvent } from '@neutrino/contracts';

/**
 * OpenTelemetry Protocol (OTLP) JSON Parser
 * Converts OTLP trace, log, and metric payloads into normalized Neutrino TelemetryEvents.
 */
export class OtlpParser {
  /**
   * Parse OTLP Logs payload
   */
  public static parseLogs(payload: any): TelemetryEvent[] {
    const events: TelemetryEvent[] = [];
    if (!payload?.resourceLogs || !Array.isArray(payload.resourceLogs)) {
      return events;
    }

    for (const rLog of payload.resourceLogs) {
      const serviceName = this.extractAttribute(rLog.resource?.attributes, 'service.name') || 'unknown-service';
      const environment = this.extractAttribute(rLog.resource?.attributes, 'deployment.environment') || 'production';

      for (const scopeLog of rLog.scopeLogs || []) {
        for (const logRecord of scopeLog.logRecords || []) {
          const timestamp = logRecord.timeUnixNano
            ? new Date(Number(BigInt(logRecord.timeUnixNano) / 1000000n)).toISOString()
            : new Date().toISOString();

          const severityText = (logRecord.severityText || 'info').toLowerCase();
          let severity: TelemetryEvent['severity'] = 'info';
          if (severityText.includes('err') || severityText.includes('fatal')) severity = 'error';
          else if (severityText.includes('warn')) severity = 'warn';
          else if (severityText.includes('debug')) severity = 'debug';

          const bodyText = typeof logRecord.body === 'string'
            ? logRecord.body
            : logRecord.body?.stringValue || JSON.stringify(logRecord.body || {});

          events.push({
            id: logRecord.traceId ? `EV-OTEL-${logRecord.traceId.slice(0, 8)}-${logRecord.spanId?.slice(0, 6) || 'log'}` : undefined,
            source: 'otel-collector-logs',
            eventType: 'log',
            severity,
            timestamp,
            serviceId: serviceName,
            environment,
            traceId: logRecord.traceId,
            spanId: logRecord.spanId,
            summary: bodyText.slice(0, 160),
            content: bodyText,
            attributes: this.attributesToMap(logRecord.attributes),
            synthetic: false,
          });
        }
      }
    }

    return events;
  }

  /**
   * Parse OTLP Traces payload
   */
  public static parseTraces(payload: any): TelemetryEvent[] {
    const events: TelemetryEvent[] = [];
    if (!payload?.resourceSpans || !Array.isArray(payload.resourceSpans)) {
      return events;
    }

    for (const rSpan of payload.resourceSpans) {
      const serviceName = this.extractAttribute(rSpan.resource?.attributes, 'service.name') || 'unknown-service';
      const environment = this.extractAttribute(rSpan.resource?.attributes, 'deployment.environment') || 'production';

      for (const scopeSpan of rSpan.scopeSpans || []) {
        for (const span of scopeSpan.spans || []) {
          const timestamp = span.startTimeUnixNano
            ? new Date(Number(BigInt(span.startTimeUnixNano) / 1000000n)).toISOString()
            : new Date().toISOString();

          const isError = span.status?.code === 2 || span.status?.message;
          const severity: TelemetryEvent['severity'] = isError ? 'error' : 'info';
          const spanName = span.name || 'unnamed-span';
          const summary = `Span ${spanName} (${serviceName}) ${isError ? 'FAILED: ' + (span.status?.message || 'Error') : 'completed'}`;

          events.push({
            id: span.spanId ? `EV-SPAN-${span.spanId.slice(0, 12)}` : undefined,
            source: 'otel-collector-traces',
            eventType: 'trace',
            severity,
            timestamp,
            serviceId: serviceName,
            environment,
            traceId: span.traceId,
            spanId: span.spanId,
            summary,
            content: JSON.stringify({
              name: spanName,
              kind: span.kind,
              attributes: this.attributesToMap(span.attributes),
              events: span.events,
            }),
            attributes: this.attributesToMap(span.attributes),
            synthetic: false,
          });
        }
      }
    }

    return events;
  }

  /**
   * Parse OTLP Metrics payload
   */
  public static parseMetrics(payload: any): TelemetryEvent[] {
    const events: TelemetryEvent[] = [];
    if (!payload?.resourceMetrics || !Array.isArray(payload.resourceMetrics)) {
      return events;
    }

    for (const rMetric of payload.resourceMetrics) {
      const serviceName = this.extractAttribute(rMetric.resource?.attributes, 'service.name') || 'unknown-service';
      const environment = this.extractAttribute(rMetric.resource?.attributes, 'deployment.environment') || 'production';

      for (const scopeMetric of rMetric.scopeMetrics || []) {
        for (const metric of scopeMetric.metrics || []) {
          const metricName = metric.name || 'custom.metric';
          const unit = metric.unit || '';

          // Gauge or Sum points
          const dataPoints = metric.gauge?.dataPoints || metric.sum?.dataPoints || [];
          for (const dp of dataPoints) {
            const timestamp = dp.timeUnixNano
              ? new Date(Number(BigInt(dp.timeUnixNano) / 1000000n)).toISOString()
              : new Date().toISOString();

            const value = dp.asDouble ?? dp.asInt ?? 0;
            const summary = `Metric ${metricName}: ${value} ${unit} for ${serviceName}`;

            events.push({
              source: 'otel-collector-metrics',
              eventType: 'metric',
              severity: 'info',
              timestamp,
              serviceId: serviceName,
              environment,
              metricName,
              metricValue: Number(value),
              metricUnit: unit,
              summary,
              content: JSON.stringify(dp),
              attributes: this.attributesToMap(dp.attributes),
              synthetic: false,
            });
          }
        }
      }
    }

    return events;
  }

  private static extractAttribute(attributes: any[], key: string): string | null {
    if (!attributes || !Array.isArray(attributes)) return null;
    const found = attributes.find((a) => a.key === key);
    if (!found) return null;
    return found.value?.stringValue || found.value?.intValue || null;
  }

  private static attributesToMap(attributes: any[]): Record<string, any> {
    const map: Record<string, any> = {};
    if (!attributes || !Array.isArray(attributes)) return map;
    for (const a of attributes) {
      if (a.key && a.value) {
        map[a.key] = a.value.stringValue ?? a.value.intValue ?? a.value.boolValue ?? a.value;
      }
    }
    return map;
  }
}
