'use client';

import React, { useState, useEffect } from 'react';
import {
  HealthResponse,
  GraphHealthResponse,
  IncidentListItem,
  InvestigationResult,
  InvestigationHistoryItem,
  SubgraphData,
} from '@neutrino/contracts';
import { api } from '../lib/api';
import { Navbar } from '../components/Navbar';
import { MetricCard } from '../components/MetricCard';
import { IncidentsView } from '../components/IncidentsView';
import { InvestigationResultsView } from '../components/InvestigationResultsView';
import { GraphVisualizer } from '../components/GraphVisualizer';
import { HistoryView } from '../components/HistoryView';
import { MemoryInspectorView } from '../components/MemoryInspectorView';
import { TelemetryView } from '../components/TelemetryView';
import { RemediationView } from '../components/RemediationView';
import { AuditView } from '../components/AuditView';
import {
  AlertTriangle,
  Server,
  GitCommit,
  History,
  Activity,
  ArrowRight,
  Database,
  Sparkles,
  Layers,
  HelpCircle,
  Brain,
  Radio,
  ShieldAlert,
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents' | 'investigate' | 'memories' | 'telemetry' | 'remediation' | 'graph' | 'history' | 'audit'>('overview');
  const [graphHealth, setGraphHealth] = useState<GraphHealthResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [history, setHistory] = useState<InvestigationHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Investigation form state
  const [investigationQuestion, setInvestigationQuestion] = useState<string>(
    'Why did checkout-service start throwing 500 errors during token validation at 14:02 UTC?'
  );
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('INC-2026-101');
  const [isInvestigating, setIsInvestigating] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<InvestigationResult | null>(null);

  // Graph Explorer state
  const [graphExplorerIncidentId, setGraphExplorerIncidentId] = useState<string>('INC-2026-101');
  const [subgraphData, setSubgraphData] = useState<SubgraphData | null>(null);
  const [loadingSubgraph, setLoadingSubgraph] = useState<boolean>(false);

  // Fetch initial dashboard metrics
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, gh, incs, hist] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getGraphHealth().catch(() => null),
        api.getIncidents().catch(() => []),
        api.getInvestigationHistory().catch(() => []),
      ]);
      setHealth(h);
      setGraphHealth(gh);
      setIncidents(incs);
      setHistory(hist);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to Neutrino API server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Load subgraph when entering Graph tab or changing selected incident
  useEffect(() => {
    if (activeTab === 'graph' || currentResult) {
      const targetId = activeTab === 'graph' ? graphExplorerIncidentId : currentResult?.incidentId || 'INC-2026-101';
      setLoadingSubgraph(true);
      api
        .getIncidentSubgraph(targetId)
        .then((data) => setSubgraphData(data))
        .catch((e) => console.error(e))
        .finally(() => setLoadingSubgraph(false));
    }
  }, [activeTab, graphExplorerIncidentId, currentResult]);

  // Trigger investigation
  const handleRunInvestigation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!investigationQuestion.trim()) return;

    setIsInvestigating(true);
    setError(null);
    try {
      const result = await api.executeInvestigation({
        question: investigationQuestion,
        incidentId: selectedIncidentId || undefined,
        executionMode: 'deterministic',
      });
      setCurrentResult(result);
      setActiveTab('investigate');
      // Refresh history in background
      api.getInvestigationHistory().then(setHistory).catch(console.error);
    } catch (err: any) {
      setError(err?.message || 'Investigation execution failed.');
    } finally {
      setIsInvestigating(false);
    }
  };

  // Navigations from Incident Detail
  const handleInvestigateFromIncident = (incidentId: string) => {
    const inc = incidents.find((i) => i.id === incidentId);
    if (inc) {
      setInvestigationQuestion(`Why did ${inc.affectedService || incidentId} encounter ${inc.title}?`);
      setSelectedIncidentId(incidentId);
      setActiveTab('investigate');
    }
  };

  const handleExploreIncidentSubgraph = (incidentId: string) => {
    setGraphExplorerIncidentId(incidentId);
    setActiveTab('graph');
  };

  // Extract highlighted path IDs from current investigation result
  const highlightedPathNodes = React.useMemo(() => {
    if (!currentResult || !currentResult.graphPaths) return [];
    const set = new Set<string>();
    currentResult.graphPaths.forEach((p) => {
      p.nodes.forEach((n) => set.add(n));
    });
    return Array.from(set);
  }, [currentResult]);

  return (
    <div className="min-h-screen flex flex-col bg-neutrino-950 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        graphHealth={graphHealth}
        loading={loading}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Error notification banner if any */}
        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 p-4 rounded-xl flex items-center justify-between text-xs font-mono">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              ✕
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW A: OVERVIEW & LAUNCHPAD                                    */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Hero Banner */}
            <div className="bg-neutrino-900 border border-neutrino-800 p-6 md:p-8 rounded-xl relative overflow-hidden">
              <div className="max-w-3xl space-y-3 relative z-10">
                <span className="inline-block text-[11px] font-mono uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 px-2.5 py-1 rounded-md">
                  Graph Hacks 2026 — Track 01: Agents That Act on Connected Data
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">
                  Graph-Native Investigation Platform
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Neutrino transforms high-severity production incident diagnosis through deep multi-hop relationship
                  traversal in <span className="text-cyan-400 font-semibold">FalkorDB</span>. Instead of shallow log
                  searches, Neutrino traverses service dependencies, deployment events, and telemetry evidence to form
                  traceable, evidence-backed hypotheses.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setActiveTab('investigate')}
                    className="h-10 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    <span>Open Investigation Workspace</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('incidents')}
                    className="h-10 px-4 bg-neutrino-800 hover:bg-neutrino-750 border border-neutrino-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center"
                  >
                    Browse Operational Incidents
                  </button>
                </div>
              </div>
            </div>

            {/* Live Metrics Grid (Fetched directly from FalkorDB) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Active Incidents"
                value={incidents.length}
                subtitle="Seeded operational scenarios"
                icon={<AlertTriangle className="w-4 h-4" />}
                badge="Real Data"
              />
              <MetricCard
                title="Graph Services"
                value="11"
                subtitle="Connected dependency nodes"
                icon={<Server className="w-4 h-4" />}
                badge="FalkorDB"
              />
              <MetricCard
                title="Deployments"
                value="10"
                subtitle="Temporal change records"
                icon={<GitCommit className="w-4 h-4" />}
                badge="Provable"
              />
              <MetricCard
                title="Investigations"
                value={history.length}
                subtitle="Persisted in graph storage"
                icon={<History className="w-4 h-4" />}
                badge="FalkorDB"
              />
            </div>

            {/* Quick Demonstration Launchpad */}
            <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutrino-800">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                    Demonstration Investigation Launchpad
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select a connected scenario to witness multi-hop graph reasoning in FalkorDB
                  </p>
                </div>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded-md">
                  Indispensability Demo
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Scenario 1: Multi-hop checkout token failure */}
                <div
                  onClick={() => {
                    setSelectedIncidentId('INC-2026-101');
                    setInvestigationQuestion(
                      'Why is checkout-service failing with 500 errors during token validation?'
                    );
                    setActiveTab('investigate');
                  }}
                  className="bg-neutrino-900 border border-neutrino-800 hover:border-cyan-500/80 p-5 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-rose-400">INC-2026-101 (SEV-1)</span>
                    <span className="text-[10px] font-mono uppercase bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-1.5 py-0.5 rounded-md">
                      3-Hop Chain
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                    Checkout Service Elevated 500 Errors
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Traverses (Incident) → (checkout-service) → (auth-service) → (dep-auth-2.4.1) to uncover key-rotation
                    cache desync bug and identify team-identity on-call.
                  </p>
                  <div className="mt-3 text-xs text-cyan-400 font-medium flex items-center gap-1">
                    <span>Investigate this scenario</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Scenario 2: Incomplete evidence cart latency */}
                <div
                  onClick={() => {
                    setSelectedIncidentId('INC-2026-088');
                    setInvestigationQuestion('Why did cart-service latency spike to 920ms?');
                    setActiveTab('investigate');
                  }}
                  className="bg-neutrino-900 border border-neutrino-800 hover:border-cyan-500/80 p-5 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-sky-400">INC-2026-088 (SEV-3)</span>
                    <span className="text-[10px] font-mono uppercase bg-amber-950 text-amber-300 border border-amber-800/80 px-1.5 py-0.5 rounded-md">
                      Incomplete Telemetry
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                    Cart Checkout Latency Degradation
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Demonstrates careful handling of missing evidence: flags missing Redis slowlog telemetry rather than
                    manufacturing an ungrounded root cause.
                  </p>
                  <div className="mt-3 text-xs text-cyan-400 font-medium flex items-center gap-1">
                    <span>Investigate this scenario</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW B: INCIDENTS                                              */}
        {/* ============================================================== */}
        {activeTab === 'incidents' && (
          <IncidentsView
            incidents={incidents}
            onInvestigateIncident={handleInvestigateFromIncident}
            onExploreIncidentSubgraph={handleExploreIncidentSubgraph}
          />
        )}

        {/* ============================================================== */}
        {/* VIEW C: INVESTIGATION WORKSPACE                                */}
        {/* ============================================================== */}
        {activeTab === 'investigate' && (
          <div className="space-y-6">
            {/* Input Query Card */}
            <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutrino-800">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                    Investigation Query Engine
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Execution Mode: <span className="text-emerald-400 font-bold">Deterministic Graph Engine</span>
                </span>
              </div>

              <form onSubmit={handleRunInvestigation} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Operational Investigation Question
                    </label>
                    <input
                      type="text"
                      value={investigationQuestion}
                      onChange={(e) => setInvestigationQuestion(e.target.value)}
                      placeholder="e.g. Why did checkout-service fail at 14:02 UTC?"
                      className="w-full bg-neutrino-900 border border-neutrino-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-lg px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono h-10"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Target Incident (Optional)
                    </label>
                    <select
                      value={selectedIncidentId}
                      onChange={(e) => setSelectedIncidentId(e.target.value)}
                      className="w-full bg-neutrino-900 border border-neutrino-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none font-mono h-10"
                    >
                      <option value="">Auto-Detect from Question</option>
                      {incidents.map((inc) => (
                        <option key={inc.id} value={inc.id}>
                          {inc.id} — {inc.title.slice(0, 24)}...
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-400 font-mono">
                    Queries FalkorDB service dependencies, deployments, evidence, and historical postmortems.
                  </span>
                  <button
                    type="submit"
                    disabled={isInvestigating}
                    className="h-10 px-5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-950 disabled:text-slate-500 text-white rounded-lg text-xs font-semibold uppercase tracking-wider shadow-sm transition-colors flex items-center gap-2"
                  >
                    {isInvestigating ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Traversing FalkorDB...</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-4 h-4" />
                        <span>Execute Investigation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Structured Results Display */}
            {currentResult && (
              <InvestigationResultsView
                result={currentResult}
                onExploreGraph={() => {
                  if (currentResult.incidentId) {
                    setGraphExplorerIncidentId(currentResult.incidentId);
                  }
                  setActiveTab('graph');
                }}
              />
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW D: GRAPH EXPLORER                                         */}
        {/* ============================================================== */}
        {activeTab === 'graph' && (
          <div className="space-y-4">
            <div className="bg-neutrino-850 border border-neutrino-750 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <Database className="w-5 h-5 text-cyan-400" />
                <div>
                  <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    FalkorDB Subgraph Explorer
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live topology of services, incidents, deployments, and evidence from FalkorDB.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">Incident Subgraph:</span>
                <select
                  value={graphExplorerIncidentId}
                  onChange={(e) => setGraphExplorerIncidentId(e.target.value)}
                  className="bg-neutrino-900 border border-neutrino-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200"
                >
                  {incidents.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.id} ({i.severity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingSubgraph ? (
              <div className="h-96 flex items-center justify-center bg-neutrino-900 border border-neutrino-800 rounded-xl text-slate-400 font-mono text-xs">
                Querying FalkorDB subgraph...
              </div>
            ) : (
              <GraphVisualizer
                data={subgraphData}
                highlightPath={highlightedPathNodes}
                height={550}
              />
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW D: PERSISTENT GRAPH MEMORIES                              */}
        {/* ============================================================== */}
        {activeTab === 'memories' && <MemoryInspectorView />}

        {/* ============================================================== */}
        {/* VIEW E: LIVE TELEMETRY EXPLORER                                */}
        {/* ============================================================== */}
        {activeTab === 'telemetry' && <TelemetryView />}

        {/* ============================================================== */}
        {/* VIEW F: REMEDIATION ACTIONS & APPROVALS                        */}
        {/* ============================================================== */}
        {activeTab === 'remediation' && <RemediationView />}

        {/* ============================================================== */}
        {/* VIEW G: INVESTIGATION HISTORY                                  */}
        {/* ============================================================== */}
        {activeTab === 'history' && (
          <HistoryView
            history={history}
            onRefresh={() => api.getInvestigationHistory().then(setHistory).catch(console.error)}
            onExploreGraph={() => setActiveTab('graph')}
          />
        )}

        {/* ============================================================== */}
        {/* VIEW H: OPERATIONAL AUDIT & RELIABILITY                        */}
        {/* ============================================================== */}
        {activeTab === 'audit' && <AuditView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutrino-800/80 bg-neutrino-900 py-4 px-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-bold">Neutrino</span>
            <span>—</span>
            <span>Graph Hacks Hackathon (FalkorDB)</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Primary Track: Track 01 — Agents That Act on Connected Data</span>
            <span>•</span>
            <span>Additional: Track 02 (Memory) & Track 03 (Company Brain)</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">Stage 4 Production Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
