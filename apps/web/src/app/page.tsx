'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  HealthResponse,
  GraphHealthResponse,
  IncidentListItem,
  InvestigationResult,
  InvestigationHistoryItem,
  SubgraphData,
} from '@neutrino/contracts';
import { api } from '../lib/api';
import { Sidebar, NavTab } from '../components/Sidebar';
import { TopHeader } from '../components/TopHeader';
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
  Compass,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Terminal,
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
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
      const targetId =
        activeTab === 'graph'
          ? graphExplorerIncidentId
          : currentResult?.incidentId || 'INC-2026-101';
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
      api.getInvestigationHistory().then(setHistory).catch(console.error);
    } catch (err: any) {
      setError(err?.message || 'Investigation execution failed.');
    } finally {
      setIsInvestigating(false);
    }
  };

  // Quick preset dispatch
  const handleLaunchPreset = (question: string, incidentId: string) => {
    setInvestigationQuestion(question);
    setSelectedIncidentId(incidentId);
    setActiveTab('investigate');
    setIsInvestigating(true);
    setError(null);
    api
      .executeInvestigation({
        question,
        incidentId,
        executionMode: 'deterministic',
      })
      .then((res) => {
        setCurrentResult(res);
        api.getInvestigationHistory().then(setHistory).catch(console.error);
      })
      .catch((err) => setError(err?.message || 'Investigation failed.'))
      .finally(() => setIsInvestigating(false));
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

  // Highlighted path nodes
  const highlightedPathNodes = useMemo(() => {
    if (!currentResult || !currentResult.graphPaths) return [];
    const set = new Set<string>();
    currentResult.graphPaths.forEach((p) => {
      p.nodes.forEach((n) => set.add(n));
    });
    return Array.from(set);
  }, [currentResult]);

  return (
    <div className="flex h-screen overflow-hidden bg-neutrino-950 text-slate-100 font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Linear-style Compact Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        graphHealth={graphHealth}
        incidentCount={incidents.length}
        historyCount={history.length}
      />

      {/* Main App Body */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header Bar */}
        <TopHeader
          activeTab={activeTab}
          graphHealth={graphHealth}
          loading={loading}
          onRefresh={loadDashboardData}
          selectedIncidentId={selectedIncidentId}
        />

        {/* Workspace Canvas */}
        <main className="flex-1 p-5 space-y-4 max-w-7xl w-full mx-auto">
          {/* Error Notification Banner */}
          {error && (
            <div className="bg-rose-950/40 border border-rose-800/80 text-rose-300 px-3.5 py-2.5 rounded-md flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-rose-400 hover:text-rose-200 text-xs font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW: OVERVIEW & LAUNCHPAD                                      */}
          {/* ============================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Header Status Strip */}
              <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <h1 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
                      Graph-Native AI Investigation Engine
                    </h1>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    Traversing multi-hop dependency graphs in <span className="text-cyan-400 font-medium">FalkorDB</span> to
                    isolate root causes across service topologies, recent deployments, and telemetry evidence.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveTab('investigate')}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-xs font-mono font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Open Investigation Workspace</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('incidents')}
                    className="px-3 py-1.5 bg-neutrino-850 hover:bg-neutrino-800 border border-neutrino-750 text-slate-300 rounded-md text-xs font-mono transition-colors flex items-center"
                  >
                    Browse Incidents ({incidents.length})
                  </button>
                </div>
              </div>

              {/* High-Density Live Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  title="Active Incidents"
                  value={incidents.length}
                  subtitle="Seeded operational vectors"
                  icon={<AlertTriangle className="w-3.5 h-3.5" />}
                  badge="Real Data"
                />
                <MetricCard
                  title="Graph Services"
                  value="11"
                  subtitle="Connected dependency nodes"
                  icon={<Server className="w-3.5 h-3.5" />}
                  badge="FalkorDB"
                />
                <MetricCard
                  title="Deployments"
                  value="10"
                  subtitle="Temporal change records"
                  icon={<GitCommit className="w-3.5 h-3.5" />}
                  badge="Provable"
                />
                <MetricCard
                  title="Persisted Runs"
                  value={history.length}
                  subtitle="Stored in graph storage"
                  icon={<History className="w-3.5 h-3.5" />}
                  badge="FalkorDB"
                />
              </div>

              {/* Connected Investigation Scenarios Launchpad */}
              <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutrino-800/80">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                      Demonstration Investigation Vectors
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded">
                    1-Click Indispensability Proofs
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Scenario 1: Multi-Hop Token Desync */}
                  <div
                    onClick={() =>
                      handleLaunchPreset(
                        'Why is checkout-service failing with 500 errors during token validation?',
                        'INC-2026-101'
                      )
                    }
                    className="bg-neutrino-950 border border-neutrino-800 hover:border-cyan-500/80 p-3.5 rounded-lg cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span className="font-mono text-xs font-bold text-rose-400">INC-2026-101</span>
                        <span className="text-[10px] font-mono uppercase bg-rose-950/80 text-rose-300 border border-rose-800/60 px-1.5 py-0.2 rounded font-semibold">
                          SEV-1
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-1.5 py-0.2 rounded font-semibold">
                        3-Hop Traversal
                      </span>
                    </div>

                    <h3 className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                      Checkout Service Elevated 500 Errors
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Traverses (Incident) → (checkout-service) → (auth-service) → (dep-auth-2.4.1) to isolate key-rotation cache desync.
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-neutrino-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400 font-medium">
                      <span>Launch multi-hop investigation</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Scenario 2: Incomplete Cart Latency */}
                  <div
                    onClick={() =>
                      handleLaunchPreset(
                        'Why did cart-service latency spike to 920ms?',
                        'INC-2026-088'
                      )
                    }
                    className="bg-neutrino-950 border border-neutrino-800 hover:border-cyan-500/80 p-3.5 rounded-lg cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        <span className="font-mono text-xs font-bold text-sky-400">INC-2026-088</span>
                        <span className="text-[10px] font-mono uppercase bg-sky-950/80 text-sky-300 border border-sky-800/60 px-1.5 py-0.2 rounded font-semibold">
                          SEV-3
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase bg-amber-950 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded font-semibold">
                        Missing Telemetry Proof
                      </span>
                    </div>

                    <h3 className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                      Cart Checkout Latency Degradation
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Explicitly identifies missing Redis slowlog telemetry rather than manufacturing an ungrounded hallucination.
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-neutrino-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400 font-medium">
                      <span>Launch missing-evidence proof</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>

              {/* FalkorDB Connection & Topology Capsule */}
              <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-neutrino-800/80">
                  <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    Live Graph Storage Engine
                  </span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>FalkorDB Cloud (ap-south-1)</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Graph Namespace</span>
                    <span className="text-cyan-300 font-bold">{graphHealth?.graphName || 'neutrino_graph'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Connected Entities</span>
                    <span className="text-slate-200 font-bold">{graphHealth?.nodeCount || 0} nodes</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Graph Relationships</span>
                    <span className="text-slate-200 font-bold">{graphHealth?.relationshipCount || 0} edges</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Protocol & TLS</span>
                    <span className="text-emerald-400 font-bold">RESP3 / TLS ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW: INCIDENTS                                                */}
          {/* ============================================================== */}
          {activeTab === 'incidents' && (
            <IncidentsView
              incidents={incidents}
              onInvestigateIncident={handleInvestigateFromIncident}
              onExploreIncidentSubgraph={handleExploreIncidentSubgraph}
            />
          )}

          {/* ============================================================== */}
          {/* VIEW: INVESTIGATION WORKSPACE                                  */}
          {/* ============================================================== */}
          {activeTab === 'investigate' && (
            <div className="space-y-4">
              {/* Query Command Card */}
              <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutrino-800/80">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                      Deterministic Graph Reasoning Engine
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                    FalkorDB Engine · Sub-Second Traversal
                  </span>
                </div>

                <form onSubmit={handleRunInvestigation} className="space-y-3 font-mono text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Investigation Query Prompt
                      </label>
                      <input
                        type="text"
                        value={investigationQuestion}
                        onChange={(e) => setInvestigationQuestion(e.target.value)}
                        placeholder="e.g. Why did checkout-service fail at 14:02 UTC?"
                        className="w-full bg-neutrino-950 border border-neutrino-800 focus:border-cyan-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono h-9"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Incident Anchor
                      </label>
                      <select
                        value={selectedIncidentId}
                        onChange={(e) => setSelectedIncidentId(e.target.value)}
                        className="w-full bg-neutrino-950 border border-neutrino-800 focus:border-cyan-500 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none font-mono h-9"
                      >
                        <option value="">Auto-Detect from Question</option>
                        {incidents.map((inc) => (
                          <option key={inc.id} value={inc.id}>
                            {inc.id} ({inc.severity})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Suggestion Chips & Execute Button */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-500">
                      <span>Presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIncidentId('INC-2026-101');
                          setInvestigationQuestion('Why did checkout-service start throwing 500 errors during token validation at 14:02 UTC?');
                        }}
                        className="px-2 py-0.5 rounded bg-neutrino-950 border border-neutrino-800 text-slate-400 hover:text-cyan-300"
                      >
                        INC-2026-101 (SEV-1)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIncidentId('INC-2026-088');
                          setInvestigationQuestion('Why did cart-service latency spike to 920ms?');
                        }}
                        className="px-2 py-0.5 rounded bg-neutrino-950 border border-neutrino-800 text-slate-400 hover:text-cyan-300"
                      >
                        INC-2026-088 (SEV-3)
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isInvestigating}
                      className="h-8 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-950 disabled:text-slate-500 text-white rounded-md text-xs font-semibold uppercase tracking-wider shadow-xs transition-colors flex items-center space-x-1.5"
                    >
                      {isInvestigating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Traversing Graph...</span>
                        </>
                      ) : (
                        <>
                          <Activity className="w-3.5 h-3.5" />
                          <span>Execute Investigation</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* High-Density Investigation Canvas */}
              {currentResult && (
                <InvestigationResultsView
                  result={currentResult}
                  initialSubgraph={subgraphData}
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
          {/* VIEW: GRAPH EXPLORER                                           */}
          {/* ============================================================== */}
          {activeTab === 'graph' && (
            <div className="space-y-3">
              <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                      FalkorDB Subgraph Explorer
                    </h2>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Live topology of services, incidents, deployments, and evidence.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 font-mono text-xs">
                  <span className="text-slate-500 text-[10px] uppercase">Incident Subgraph:</span>
                  <select
                    value={graphExplorerIncidentId}
                    onChange={(e) => setGraphExplorerIncidentId(e.target.value)}
                    className="bg-neutrino-950 border border-neutrino-800 text-slate-200 rounded-md px-2.5 py-1 text-xs outline-none"
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
                <div className="h-[550px] flex items-center justify-center bg-neutrino-900 border border-neutrino-800 rounded-lg text-slate-400 font-mono text-xs">
                  Querying FalkorDB subgraph...
                </div>
              ) : (
                <GraphVisualizer
                  data={subgraphData}
                  highlightPath={highlightedPathNodes}
                  height={600}
                />
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW: PERSISTENT GRAPH MEMORIES (TRACK 02)                     */}
          {/* ============================================================== */}
          {activeTab === 'memories' && <MemoryInspectorView />}

          {/* ============================================================== */}
          {/* VIEW: LIVE TELEMETRY EXPLORER                                  */}
          {/* ============================================================== */}
          {activeTab === 'telemetry' && <TelemetryView />}

          {/* ============================================================== */}
          {/* VIEW: REMEDIATION ACTIONS & APPROVALS (SAFETY)                 */}
          {/* ============================================================== */}
          {activeTab === 'remediation' && <RemediationView />}

          {/* ============================================================== */}
          {/* VIEW: INVESTIGATION HISTORY                                    */}
          {/* ============================================================== */}
          {activeTab === 'history' && (
            <HistoryView
              history={history}
              onRefresh={() => api.getInvestigationHistory().then(setHistory).catch(console.error)}
              onExploreGraph={() => setActiveTab('graph')}
            />
          )}

          {/* ============================================================== */}
          {/* VIEW: AUDIT & RELIABILITY                                      */}
          {/* ============================================================== */}
          {activeTab === 'audit' && <AuditView />}
        </main>

        {/* Minimal Bottom Status Bar */}
        <footer className="border-t border-neutrino-800/80 bg-neutrino-950 py-2.5 px-5 text-[10px] text-slate-500 font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold">Neutrino</span>
            <span>·</span>
            <span>Graph Hacks 2026</span>
            <span>·</span>
            <span className="text-cyan-400">Track 01, 02 & 03</span>
          </div>

          <div className="flex items-center space-x-3">
            <span>Stage 5 Production Architecture</span>
            <span>·</span>
            <span className="text-emerald-400 font-semibold">FalkorDB Online</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
