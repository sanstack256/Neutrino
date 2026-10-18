'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  Database,
  Trash2,
  FileText,
  User,
  Filter,
} from 'lucide-react';
import { api, getTenantId, setTenantId } from '../lib/api';
import { ReadinessResponse, OperationalMetricsResponse } from '@neutrino/contracts';

export const AuditView: React.FC = () => {
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [metrics, setMetrics] = useState<OperationalMetricsResponse | null>(null);
  const [auditRecords, setAuditRecords] = useState<any[]>([]);
  const [lifecycleStats, setLifecycleStats] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [pruneResult, setPruneResult] = useState<any | null>(null);
  const [pruning, setPruning] = useState<boolean>(false);
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [category, setCategory] = useState<string>('all');
  const [olderThanDays, setOlderThanDays] = useState<number>(30);
  const [currentTenant, setCurrentTenant] = useState<string>(getTenantId());

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [ready, met, aud, life] = await Promise.all([
        api.getReadiness().catch(() => null),
        api.getMetrics().catch(() => null),
        api.getAuditRecords({ limit: 50 }).catch(() => ({ records: [] })),
        api.getLifecycleStats().catch(() => null),
      ]);
      setReadiness(ready);
      setMetrics(met);
      setAuditRecords(aud.records || []);
      setLifecycleStats(life);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentTenant]);

  const handleTenantChange = (tenant: string) => {
    setTenantId(tenant);
    setCurrentTenant(tenant);
  };

  const handleExecutePrune = async () => {
    setPruning(true);
    setPruneResult(null);
    try {
      const result = await api.pruneLifecycle({
        dryRun,
        category,
        olderThanDays,
        batchSize: 100,
      });
      setPruneResult(result);
      await fetchData();
    } catch (err: any) {
      alert(`Prune error: ${err.message}`);
    } finally {
      setPruning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span>Loading operational health and audit trails...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Tenant Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutrino-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-slate-100">Operational Reliability & Audit Trails</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Server-side tenant isolation, live readiness probes, operational metrics, and immutable audit logging.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-neutrino-800 border border-neutrino-700 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400">Tenant:</span>
            <select
              value={currentTenant}
              onChange={(e) => handleTenantChange(e.target.value)}
              className="bg-neutrino-900 text-cyan-300 font-mono font-medium rounded px-2 py-0.5 border border-neutrino-700 outline-none"
            >
              <option value="tenant-default">tenant-default (Dev)</option>
              <option value="org-finance-prod">org-finance-prod</option>
              <option value="org-security-core">org-security-core</option>
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutrino-800 hover:bg-neutrino-750 border border-neutrino-700 rounded-lg text-xs font-medium text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Grid: Health Probes & Operational Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Readiness Check */}
        <div className="bg-neutrino-850 border border-neutrino-750 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Readiness Probe</span>
            <div
              className={`w-2.5 h-2.5 rounded-full ${readiness?.ready ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}
            />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {readiness?.ready ? 'READY (200 OK)' : 'DEGRADED (503)'}
          </div>
          <div className="mt-2 text-xs text-slate-400 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Database Connected:</span>
              <span className={readiness?.checks.databaseConnected ? 'text-emerald-400' : 'text-rose-400'}>
                {String(readiness?.checks.databaseConnected)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Graph Schema & Indices:</span>
              <span className={readiness?.checks.indicesReady ? 'text-emerald-400' : 'text-amber-400'}>
                {String(readiness?.checks.indicesReady)}
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry Ingestion Metrics */}
        <div className="bg-neutrino-850 border border-neutrino-750 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Processing</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-300">
            {metrics?.ingestion.persisted || 0} <span className="text-xs text-slate-400">persisted</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Deduplicated:</span>
              <span className="text-slate-300">{metrics?.ingestion.duplicates || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Ingestion Latency:</span>
              <span className="text-cyan-400">{metrics?.ingestion.avgLatencyMs || 0}ms</span>
            </div>
          </div>
        </div>

        {/* Investigation Engine Performance */}
        <div className="bg-neutrino-850 border border-neutrino-750 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Investigation Engine</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-sky-300">
            {metrics?.investigations.total || 0} <span className="text-xs text-slate-400">runs</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Completed:</span>
              <span className="text-emerald-400">{metrics?.investigations.completed || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Duration:</span>
              <span className="text-sky-400">{metrics?.investigations.avgDurationMs || 0}ms</span>
            </div>
          </div>
        </div>

        {/* Graph Scale & Query Latency */}
        <div className="bg-neutrino-850 border border-neutrino-750 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Graph Query Health</span>
            <Database className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            {metrics?.graph.queriesExecuted || 0} <span className="text-xs text-slate-400">queries</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Avg Query Latency:</span>
              <span className="text-amber-400">{metrics?.graph.avgQueryLatencyMs || 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span className="text-slate-300">{metrics?.uptimeSeconds || 0}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Graph Lifecycle Management & Retention */}
      <div className="bg-neutrino-850 border border-neutrino-750 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <h3 className="font-semibold text-slate-100 text-sm">Graph Lifecycle & Data Retention Policy</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Tenant: {currentTenant}</span>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Categorized data retention protects active incidents, investigations, and memory provenance while safely
          pruning unreferenced stale telemetry in bounded batches.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-neutrino-900 p-3 rounded-lg border border-neutrino-750">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Live Evidence</span>
            <div className="text-lg font-bold font-mono text-slate-200">{lifecycleStats?.evidenceCount || 0}</div>
          </div>
          <div className="bg-neutrino-900 p-3 rounded-lg border border-neutrino-750">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Active Incidents (Protected)</span>
            <div className="text-lg font-bold font-mono text-emerald-400">{lifecycleStats?.activeIncidentsCount || 0}</div>
          </div>
          <div className="bg-neutrino-900 p-3 rounded-lg border border-neutrino-750">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Knowledge Claims</span>
            <div className="text-lg font-bold font-mono text-cyan-400">
              {Object.values(lifecycleStats?.knowledgeClaimCounts || {}).reduce((a: any, b: any) => a + b, 0) as number}
            </div>
          </div>
          <div className="bg-neutrino-900 p-3 rounded-lg border border-neutrino-750">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Superseded / Archived</span>
            <div className="text-lg font-bold font-mono text-amber-400">
              {Number(lifecycleStats?.knowledgeClaimCounts?.superseded || 0) +
                Number(lifecycleStats?.knowledgeClaimCounts?.archived || 0)}
            </div>
          </div>
        </div>

        {/* Maintenance Controls */}
        <div className="bg-neutrino-900 p-4 rounded-lg border border-neutrino-750 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Category:</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-neutrino-800 text-slate-200 border border-neutrino-700 rounded px-2 py-1"
            >
              <option value="all">All Categories</option>
              <option value="evidence">Stale Evidence</option>
              <option value="telemetry">Telemetry Records</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Older Than:</span>
            <input
              type="number"
              min={1}
              max={365}
              value={olderThanDays}
              onChange={(e) => setOlderThanDays(Number(e.target.value))}
              className="w-16 bg-neutrino-800 text-slate-200 border border-neutrino-700 rounded px-2 py-1 font-mono"
            />
            <span className="text-slate-400">days</span>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded bg-neutrino-800 border-neutrino-700 text-cyan-600 focus:ring-0"
            />
            <span className="text-slate-300 font-medium">Dry Run (Inspect Only)</span>
          </label>

          <button
            onClick={handleExecutePrune}
            disabled={pruning}
            className={`px-4 py-1.5 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 ${
              dryRun
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {pruning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>{dryRun ? 'Run Dry-Run Inspection' : 'Execute Prune'}</span>
          </button>
        </div>

        {/* Prune Result Outcome */}
        {pruneResult && (
          <div className="mt-4 p-3 bg-neutrino-900 border border-neutrino-700 rounded-lg text-xs font-mono space-y-1">
            <div className="text-cyan-400 font-semibold">
              Lifecycle Execution Outcome ({pruneResult.dryRun ? 'DRY-RUN' : 'LIVE'}):
            </div>
            <div className="text-slate-300">
              Candidates: {pruneResult.candidatesIdentified} | Pruned/Archived: {pruneResult.recordsPruned} | Preserved:{' '}
              {pruneResult.recordsPreserved}
            </div>
            <div className="text-slate-400 text-[11px]">
              Preserved Reasons: Active Incidents ({pruneResult.preservedReasons.active_incident || 0}), Investigation
              Refs ({pruneResult.preservedReasons.investigation_reference || 0}), Memory Provenance (
              {pruneResult.preservedReasons.memory_provenance || 0})
            </div>
          </div>
        )}
      </div>

      {/* Durable Audit Trail Table */}
      <div className="bg-neutrino-850 border border-neutrino-750 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutrino-750 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-sm">FalkorDB Immutable Audit Records</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Showing {auditRecords.length} records</span>
        </div>

        {auditRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No audit records recorded yet for tenant <span className="font-mono text-slate-300">{currentTenant}</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutrino-900 text-slate-400 font-mono uppercase text-[10px] border-b border-neutrino-750">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Resource</th>
                  <th className="py-2.5 px-4">Principal</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutrino-800 text-slate-300 font-mono">
                {auditRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-neutrino-800/40 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(rec.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 px-2 py-0.5 rounded font-semibold text-[11px]">
                        {rec.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {rec.resourceType}: <span className="text-slate-400">{rec.resourceId}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">{rec.principalId}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rec.status === 'success'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : rec.status === 'denied'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 max-w-xs truncate text-[11px]">
                      {JSON.stringify(rec.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
