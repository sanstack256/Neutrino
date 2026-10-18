'use client';

import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, Send, CheckCircle2, AlertTriangle, ShieldAlert, Cpu } from 'lucide-react';
import { api } from '../lib/api';

export const TelemetryView: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  // Form state
  const [serviceId, setServiceId] = useState('auth-service');
  const [eventType, setEventType] = useState<'log' | 'metric' | 'trace'>('log');
  const [severity, setSeverity] = useState<'info' | 'warn' | 'error'>('error');
  const [summary, setSummary] = useState('JWKS endpoint connection timeout to IdP server');
  const [message, setMessage] = useState('Keycloak IdP returned HTTP 504 Gateway Timeout on /auth/realms/master/keys');

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const data = await api.getRecentTelemetry(30);
      setEvidenceList(data.evidence || []);
    } catch (err) {
      console.error('Failed to load telemetry evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngesting(true);
    setIngestStatus(null);
    try {
      const res = await api.ingestTelemetry([
        {
          source: 'ui-manual-injector',
          eventType,
          severity,
          serviceId,
          timestamp: new Date().toISOString(),
          summary,
          message,
          environment: 'production',
          synthetic: false,
        },
      ]);
      setIngestStatus(`Accepted: ${res.accepted}, Duplicated: ${res.duplicated}`);
      await fetchTelemetry();
    } catch (err: any) {
      setIngestStatus(`Error: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <span>Live Telemetry & Ingestion Subsystem</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time structured telemetry stream ingested into FalkorDB graph topology with automated redaction & deduplication.
          </p>
        </div>
        <button
          onClick={fetchTelemetry}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-neutrino-800 hover:bg-neutrino-700 text-slate-200 text-xs border border-neutrino-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Ingestion Panel & Live Records Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Manual Injector Card */}
        <div className="bg-neutrino-850 p-5 rounded-xl border border-neutrino-750">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2 mb-3">
            <Send className="w-4 h-4 text-emerald-400" />
            <span>Inject Telemetry Event</span>
          </h3>
          <form onSubmit={handleIngest} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Target Service</label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full bg-neutrino-900 border border-neutrino-700 text-xs rounded-lg p-2 text-slate-200"
              >
                <option value="checkout-service">checkout-service</option>
                <option value="auth-service">auth-service</option>
                <option value="payment-gateway">payment-gateway</option>
                <option value="inventory-service">inventory-service</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as any)}
                  className="w-full bg-neutrino-900 border border-neutrino-700 text-xs rounded-lg p-2 text-slate-200"
                >
                  <option value="log">Log</option>
                  <option value="metric">Metric</option>
                  <option value="trace">Trace</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="w-full bg-neutrino-900 border border-neutrino-700 text-xs rounded-lg p-2 text-slate-200"
                >
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Summary</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full bg-neutrino-900 border border-neutrino-700 text-xs rounded-lg p-2 text-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Payload / Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full bg-neutrino-900 border border-neutrino-700 text-xs rounded-lg p-2 text-slate-200 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={ingesting}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm"
            >
              {ingesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{ingesting ? 'Ingesting to FalkorDB...' : 'Ingest Event'}</span>
            </button>

            {ingestStatus && (
              <p className="text-xs font-mono p-2 bg-neutrino-900 border border-neutrino-700 rounded text-cyan-300">
                {ingestStatus}
              </p>
            )}
          </form>
        </div>

        {/* Live Evidence Feed */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Persisted Graph Evidence Records ({evidenceList.length})</span>
          </h3>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-neutrino-850 rounded-xl border border-neutrino-750">
              Loading FalkorDB telemetry evidence...
            </div>
          ) : evidenceList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-neutrino-850 rounded-xl border border-neutrino-750">
              No evidence records found in current graph namespace.
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {evidenceList.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-neutrino-850 p-3.5 rounded-lg border border-neutrino-750 hover:border-neutrino-600 transition"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-1.5 py-0.5 rounded uppercase font-mono text-[10px] font-semibold ${
                          ev.sourceType === 'log'
                            ? 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
                            : ev.sourceType === 'metric'
                            ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                            : 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60'
                        }`}
                      >
                        {ev.sourceType}
                      </span>
                      <span className="font-mono text-slate-300 font-medium">{ev.id}</span>
                      {ev.synthetic === false && (
                        <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-1 py-0.2 rounded text-[9px] uppercase font-mono">
                          Live Ingested
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {new Date(ev.observedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 font-medium">{ev.summary}</p>
                  {ev.content && (
                    <p className="text-[11px] text-slate-400 font-mono mt-1 bg-neutrino-900/60 p-2 rounded border border-neutrino-800 line-clamp-2">
                      {ev.content}
                    </p>
                  )}
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center space-x-3">
                    <span>Reliability: {ev.reliabilityClass}</span>
                    <span>Hash: {ev.contentHash?.slice(0, 10)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
