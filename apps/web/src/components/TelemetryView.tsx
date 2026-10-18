'use client';

import React, { useState, useEffect } from 'react';
import {
  Radio,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Cpu,
  Search,
  Filter,
  Terminal,
  Clock,
  Layers,
} from 'lucide-react';
import { api } from '../lib/api';

export const TelemetryView: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form state
  const [serviceId, setServiceId] = useState('auth-service');
  const [eventType, setEventType] = useState<'log' | 'metric' | 'trace'>('log');
  const [severity, setSeverity] = useState<'info' | 'warn' | 'error'>('error');
  const [summary, setSummary] = useState('JWKS endpoint connection timeout to IdP server');
  const [message, setMessage] = useState('Keycloak IdP returned HTTP 504 Gateway Timeout on /auth/realms/master/keys');

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const data = await api.getRecentTelemetry(50);
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

  const filteredEvidence = evidenceList.filter((ev) => {
    const matchesSearch =
      !searchFilter ||
      ev.summary?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      ev.id?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      ev.content?.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesType = typeFilter === 'all' || ev.sourceType?.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search telemetry payload, hash, ID..."
              className="w-full bg-neutrino-950 border border-neutrino-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-slate-500 text-[11px] uppercase">Type:</span>
          {(['all', 'log', 'metric', 'trace'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-1 rounded text-[11px] uppercase transition-colors ${
                typeFilter === t
                  ? 'bg-neutrino-800 text-cyan-300 border border-neutrino-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t}
            </button>
          ))}

          <button
            onClick={fetchTelemetry}
            disabled={loading}
            className="p-1.5 rounded-md bg-neutrino-950 border border-neutrino-800 text-slate-400 hover:text-slate-200 hover:border-neutrino-700 transition"
            title="Refresh stream"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Stream Feed (Left 8) + Ingestion Workbench (Right 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Stream Feed (8 cols) */}
        <div className="lg:col-span-8 space-y-2">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs bg-neutrino-900 rounded-lg border border-neutrino-800">
              Querying live FalkorDB telemetry evidence...
            </div>
          ) : filteredEvidence.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs bg-neutrino-900 rounded-lg border border-neutrino-800">
              No telemetry events match current filters.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[720px] overflow-y-auto pr-1">
              {filteredEvidence.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-neutrino-900 p-3 rounded-lg border border-neutrino-800 hover:border-neutrino-700 transition-colors text-xs font-mono"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-1.5 py-0.2 rounded uppercase text-[10px] font-semibold border ${
                          ev.sourceType === 'log'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                            : ev.sourceType === 'metric'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                            : 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
                        }`}
                      >
                        {ev.sourceType}
                      </span>
                      <span className="font-bold text-slate-200">{ev.id}</span>
                      {ev.synthetic === false && (
                        <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1 py-0.2 rounded text-[9px] uppercase font-mono">
                          Live Ingested
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 text-[10px]">
                      {new Date(ev.observedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-slate-200 font-sans text-xs leading-snug">{ev.summary}</p>

                  {ev.content && (
                    <div className="mt-2 text-[10px] text-slate-300 bg-neutrino-950 p-2 rounded border border-neutrino-800 overflow-x-auto">
                      <pre className="font-mono">{ev.content}</pre>
                    </div>
                  )}

                  <div className="mt-2 pt-1.5 border-t border-neutrino-800/60 text-[10px] text-slate-500 flex items-center justify-between">
                    <span>Reliability: <span className="text-slate-400">{ev.reliabilityClass}</span></span>
                    <span>Hash: <span className="text-slate-400">{ev.contentHash?.slice(0, 12)}...</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ingestion Panel (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-3 sticky top-16">
            <div className="flex items-center space-x-2 pb-2 border-b border-neutrino-800/80">
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Manual Event Ingest Workbench
              </h3>
            </div>

            <form onSubmit={handleIngest} className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">
                  Target Service
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full bg-neutrino-950 border border-neutrino-800 rounded-md p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="checkout-service">checkout-service</option>
                  <option value="auth-service">auth-service</option>
                  <option value="payment-gateway">payment-gateway</option>
                  <option value="inventory-service">inventory-service</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">
                    Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="w-full bg-neutrino-950 border border-neutrino-800 rounded-md p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="log">Log</option>
                    <option value="metric">Metric</option>
                    <option value="trace">Trace</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full bg-neutrino-950 border border-neutrino-800 rounded-md p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">
                  Summary
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full bg-neutrino-950 border border-neutrino-800 rounded-md p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">
                  Payload Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-neutrino-950 border border-neutrino-800 rounded-md p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={ingesting}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-xs uppercase tracking-wider"
              >
                {ingesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{ingesting ? 'Ingesting to FalkorDB...' : 'Ingest to Topology'}</span>
              </button>

              {ingestStatus && (
                <p className="text-[10px] font-mono p-2 bg-neutrino-950 border border-neutrino-800 rounded text-cyan-300">
                  {ingestStatus}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
