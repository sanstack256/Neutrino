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
      <div className="flex items-center justify-center py-20 text-slate-400 font-mono text-xs">
        <RefreshCw className="w-4 h-4 animate-spin mr-2 text-cyan-400" />
        <span>Querying operational health, readiness, and audit trails...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-slate-500 uppercase text-[10px]">Tenant Namespace:</span>
          <select
            value={currentTenant}
            onChange={(e) => handleTenantChange(e.target.value)}
            className="bg-neutrino-950 text-cyan-300 font-mono font-medium rounded-md px-2.5 py-1 border border-neutrino-800 outline-none text-xs"
          >
            <option value="tenant-default">tenant-default (Development)</option>
            <option value="org-finance-prod">org-finance-prod</option>
            <option value="org-security-core">org-security-core</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-slate-400">
            Readiness: <span className={readiness?.ready ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{readiness?.ready ? 'PASS (200)' : 'FAIL (503)'}</span>
          </span>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="p-1.5 rounded-md bg-neutrino-950 border border-neutrino-800 text-slate-400 hover:text-slate-200 hover:border-neutrino-700 transition"
            title="Refresh status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid: Health Probes & Operational Metrics (4 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Readiness Check */}
        <div className="bg-neutrino-900 border border-neutrino-800 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Readiness Probe
            </span>
            <div
              className={`w-2 h-2 rounded-full ${readiness?.ready ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}
            />
          </div>
          <div className="text-lg font-bold font-mono text-slate-100">
            {readiness?.ready ? 'READY (200 OK)' : 'DEGRADED'}
          </div>
          <div className="mt-2 text-[10px] text-slate-400 space-y-0.5 font-mono pt-1.5 border-t border-neutrino-800/60">
            <div className="flex justify-between">
              <span>Database:</span>
              <span className={readiness?.checks.databaseConnected ? 'text-emerald-400' : 'text-rose-400'}>
                {String(readiness?.checks.databaseConnected)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Graph Indices:</span>
              <span className={readiness?.checks.indicesReady ? 'text-emerald-400' : 'text-amber-400'}>
                {String(readiness?.checks.indicesReady)}
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry Ingestion Metrics */}
        <div className="bg-neutrino-900 border border-neutrino-800 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Event Processing
            </span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-bold font-mono text-cyan-300">
            {metrics?.ingestion.persisted || 0} <span className="text-[10px] text-slate-500 font-normal">persisted</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 space-y-0.5 font-mono pt-1.5 border-t border-neutrino-800/60">
            <div className="flex justify-between">
              <span>Deduplicated:</span>
              <span className="text-slate-300">{metrics?.ingestion.duplicates || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Latency:</span>
              <span className="text-cyan-400">{metrics?.ingestion.avgLatencyMs || 0}ms</span>
            </div>
          </div>
        </div>

        {/* Investigation Engine Performance */}
        <div className="bg-neutrino-900 border border-neutrino-800 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Investigation Engine
            </span>
            <Layers className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-lg font-bold font-mono text-sky-300">
            {metrics?.investigations.total || 0} <span className="text-[10px] text-slate-500 font-normal">runs</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 space-y-0.5 font-mono pt-1.5 border-t border-neutrino-800/60">
            <div className="flex justify-between">
              <span>Completed:</span>
              <span className="text-emerald-400">{metrics?.investigations.completed || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Latency:</span>
              <span className="text-sky-400">{metrics?.investigations.avgDurationMs || 0}ms</span>
            </div>
          </div>
        </div>

        {/* Graph Scale & Query Latency */}
        <div className="bg-neutrino-900 border border-neutrino-800 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              FalkorDB Queries
            </span>
            <Database className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold font-mono text-amber-300">
            {metrics?.graph.queriesExecuted || 0} <span className="text-[10px] text-slate-500 font-normal">queries</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 space-y-0.5 font-mono pt-1.5 border-t border-neutrino-800/60">
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
      <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-neutrino-800/80">
          <div className="flex items-center space-x-2">
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <h3 className="font-semibold text-slate-100 text-xs font-mono uppercase tracking-wider">
              Retention Policy & Lifecycle Workbench
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Isolated for {currentTenant}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs">
          <div className="bg-neutrino-950 p-2.5 rounded-md border border-neutrino-800">
            <span className="text-[10px] text-slate-500 uppercase">Live Evidence</span>
            <div className="text-base font-bold text-slate-200 mt-0.5">{lifecycleStats?.evidenceCount || 0}</div>
          </div>
          <div className="bg-neutrino-950 p-2.5 rounded-md border border-neutrino-800">
            <span className="text-[10px] text-slate-500 uppercase">Active Incidents</span>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{lifecycleStats?.activeIncidentsCount || 0}</div>
          </div>
          <div className="bg-neutrino-950 p-2.5 rounded-md border border-neutrino-800">
            <span className="text-[10px] text-slate-500 uppercase">Knowledge Claims</span>
            <div className="text-base font-bold text-cyan-400 mt-0.5">
              {Object.values(lifecycleStats?.knowledgeClaimCounts || {}).reduce((a: any, b: any) => a + b, 0) as number}
            </div>
          </div>
          <div className="bg-neutrino-950 p-2.5 rounded-md border border-neutrino-800">
            <span className="text-[10px] text-slate-500 uppercase">Archived Claims</span>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              {Number(lifecycleStats?.knowledgeClaimCounts?.superseded || 0) +
                Number(lifecycleStats?.knowledgeClaimCounts?.archived || 0)}
            </div>
          </div>
        </div>

        {/* Maintenance Controls */}
        <div className="bg-neutrino-950 p-3 rounded-md border border-neutrino-800 flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 text-[11px]">Category:</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-neutrino-900 text-slate-200 border border-neutrino-800 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Categories</option>
              <option value="evidence">Stale Evidence</option>
              <option value="telemetry">Telemetry Records</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 text-[11px]">Older Than:</span>
            <input
              type="number"
              min={1}
              max={365}
              value={olderThanDays}
              onChange={(e) => setOlderThanDays(Number(e.target.value))}
              className="w-14 bg-neutrino-900 text-slate-200 border border-neutrino-800 rounded px-2 py-1 text-xs font-mono"
            />
            <span className="text-slate-400 text-[11px]">days</span>
          </div>

          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded bg-neutrino-900 border-neutrino-800 text-cyan-600 focus:ring-0"
            />
            <span className="text-slate-300 text-[11px]">Dry Run Only</span>
          </label>

          <button
            onClick={handleExecutePrune}
            disabled={pruning}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center space-x-1.5 text-xs ${
              dryRun
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {pruning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>{dryRun ? 'Dry-Run Check' : 'Execute Prune'}</span>
          </button>
        </div>

        {/* Prune Result Outcome */}
        {pruneResult && (
          <div className="p-2.5 bg-neutrino-950 border border-neutrino-800 rounded-md text-xs font-mono space-y-1">
            <div className="text-cyan-400 font-semibold text-[11px]">
              Lifecycle Execution Outcome ({pruneResult.dryRun ? 'DRY-RUN' : 'LIVE'}):
            </div>
            <div className="text-slate-300 text-[11px]">
              Candidates: {pruneResult.candidatesIdentified} | Pruned/Archived: {pruneResult.recordsPruned} | Preserved:{' '}
              {pruneResult.recordsPreserved}
            </div>
          </div>
        )}
      </div>

      {/* Durable Audit Trail Table */}
      <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-neutrino-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-xs font-mono uppercase tracking-wider">
              Immutable FalkorDB Audit Stream
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{auditRecords.length} records</span>
        </div>

        {auditRecords.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-mono">
            No audit records recorded yet for tenant <span className="font-mono text-slate-300">{currentTenant}</span>.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutrino-950 text-slate-500 uppercase text-[10px] border-b border-neutrino-800 sticky top-0">
                <tr>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Resource</th>
                  <th className="py-2 px-3">Principal</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutrino-800/60 text-slate-300 text-[11px]">
                {auditRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-neutrino-850/60 transition-colors">
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(rec.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3">
                      <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                        {rec.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      {rec.resourceType}: <span className="text-slate-400">{rec.resourceId}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{rec.principalId}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
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
                    <td className="py-2 px-3 text-slate-400 max-w-xs truncate text-[10px]">
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
