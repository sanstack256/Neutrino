'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  InvestigationResult,
  CandidateExplanation,
  Evidence,
  SubgraphData,
} from '@neutrino/contracts';
import { StatusBadge } from './StatusBadge';
import { GraphVisualizer } from './GraphVisualizer';
import { api } from '../lib/api';
import {
  ShieldAlert,
  GitFork,
  FileSearch,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Database,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Brain,
  Layers,
  Sparkles,
  Terminal,
  Activity,
  Columns,
  List,
} from 'lucide-react';

interface InvestigationResultsViewProps {
  result: InvestigationResult;
  onExploreGraph?: () => void;
  initialSubgraph?: SubgraphData | null;
}

export const InvestigationResultsView: React.FC<InvestigationResultsViewProps> = ({
  result,
  onExploreGraph,
  initialSubgraph = null,
}) => {
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [subgraph, setSubgraph] = useState<SubgraphData | null>(initialSubgraph);
  const [loadingSubgraph, setLoadingSubgraph] = useState<boolean>(false);
  const [workspaceLayout, setWorkspaceLayout] = useState<'split' | 'evidence' | 'graph'>('split');
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'logs' | 'metrics' | 'deployments'>('all');

  // Load subgraph for this incident if not provided
  useEffect(() => {
    if (result.incidentId && (!subgraph || subgraph.nodes.length === 0)) {
      setLoadingSubgraph(true);
      api
        .getIncidentSubgraph(result.incidentId)
        .then((data) => setSubgraph(data))
        .catch((err) => console.error('Failed to load incident subgraph:', err))
        .finally(() => setLoadingSubgraph(false));
    }
  }, [result.incidentId]);

  const toggleEvidence = (id: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Traversed path node IDs
  const highlightedNodes = useMemo(() => {
    if (!result.graphPaths) return [];
    const set = new Set<string>();
    result.graphPaths.forEach((p) => {
      p.nodes.forEach((n) => set.add(n));
    });
    return Array.from(set);
  }, [result.graphPaths]);

  // Filter evidence records
  const filteredEvidence = useMemo(() => {
    if (!result.evidenceBundle) return [];
    if (evidenceFilter === 'all') return result.evidenceBundle;
    if (evidenceFilter === 'logs') {
      return result.evidenceBundle.filter((e) => e.sourceType?.toLowerCase().includes('log') || !e.sourceType);
    }
    if (evidenceFilter === 'metrics') {
      return result.evidenceBundle.filter((e) => e.sourceType?.toLowerCase().includes('metric') || e.sourceType?.toLowerCase().includes('telemetry'));
    }
    if (evidenceFilter === 'deployments') {
      return result.evidenceBundle.filter((e) => e.sourceType?.toLowerCase().includes('deploy') || e.sourceRecordId?.toLowerCase().includes('git'));
    }
    return result.evidenceBundle;
  }, [result.evidenceBundle, evidenceFilter]);

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutrino-800/80">
          <div className="flex items-center space-x-2.5">
            <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded">
              {result.investigationId}
            </span>
            {result.incidentId && (
              <span className="font-mono text-xs text-slate-300 bg-neutrino-800 border border-neutrino-700 px-2 py-0.5 rounded">
                Incident: <span className="text-white font-semibold">{result.incidentId}</span>
              </span>
            )}
            <StatusBadge label={result.status} variant={result.status === 'completed' ? 'success' : 'warning'} />
            <span className="text-[11px] font-mono text-slate-400">
              Mode: <span className="text-emerald-400 font-semibold">{result.executionMode}</span>
            </span>
          </div>

          {/* Linear-grade Metrics Strip */}
          <div className="flex items-center space-x-3 bg-neutrino-950 px-3 py-1.5 rounded-md border border-neutrino-800 font-mono text-xs">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Latency:</span>
              <span className="text-emerald-400 font-bold">{result.metrics.durationMs}ms</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Queries:</span>
              <span className="text-cyan-400 font-bold">{result.metrics.graphQueryCount}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Evaluated:</span>
              <span className="text-slate-200 font-bold">
                {result.metrics.nodesEvaluated}n · {result.metrics.relationshipsEvaluated}r
              </span>
            </div>
          </div>
        </div>

        {/* Question Title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-0.5">
              Investigated Query
            </span>
            <h2 className="text-base font-semibold text-slate-100 leading-snug">{result.question}</h2>
          </div>

          {/* View Mode Controls */}
          <div className="flex items-center space-x-1 bg-neutrino-950 p-1 rounded-md border border-neutrino-800 font-mono text-xs flex-shrink-0">
            <button
              onClick={() => setWorkspaceLayout('split')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                workspaceLayout === 'split'
                  ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>Split Canvas</span>
            </button>
            <button
              onClick={() => setWorkspaceLayout('evidence')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                workspaceLayout === 'evidence'
                  ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3 h-3" />
              <span>Evidence Only</span>
            </button>
            <button
              onClick={() => setWorkspaceLayout('graph')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                workspaceLayout === 'graph'
                  ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3 h-3" />
              <span>Graph Focused</span>
            </button>
          </div>
        </div>

        {/* Executive Summary Box */}
        <div className="pt-2">
          <div className="bg-neutrino-950/80 border border-neutrino-800/80 rounded-md p-3 text-xs text-slate-200 leading-relaxed font-sans">
            <span className="font-semibold text-cyan-300 font-mono uppercase text-[10px] tracking-wider mr-2">
              Root Cause Verdict:
            </span>
            {result.summary}
          </div>
        </div>

        {/* Non-Destructive Recommended Step */}
        {result.recommendedNextStep && (
          <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-md p-2.5 flex items-start space-x-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-mono font-semibold text-cyan-300 uppercase text-[10px] tracking-wider block">
                Recommended Next Step (Non-Destructive)
              </span>
              <p className="text-cyan-100 font-mono text-[11px] mt-0.5">{result.recommendedNextStep}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace Layout */}
      <div
        className={`grid gap-4 ${
          workspaceLayout === 'split'
            ? 'grid-cols-1 xl:grid-cols-12'
            : workspaceLayout === 'graph'
            ? 'grid-cols-1'
            : 'grid-cols-1'
        }`}
      >
        {/* Left Column: Hypotheses, Traversal Path & Evidence Timeline */}
        {(workspaceLayout === 'split' || workspaceLayout === 'evidence') && (
          <div
            className={`space-y-4 ${
              workspaceLayout === 'split' ? 'xl:col-span-7' : 'col-span-12'
            }`}
          >
            {/* Candidate Hypotheses */}
            <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutrino-800/80">
                <div className="flex items-center space-x-2">
                  <GitFork className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                    Candidate Hypotheses ({result.candidateExplanations.length})
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Ranked by FalkorDB graph corroboration
                </span>
              </div>

              <div className="space-y-2.5">
                {result.candidateExplanations.map((hyp: CandidateExplanation) => {
                  const isSupported = hyp.status === 'supported';
                  const isContradicted = hyp.status === 'contradicted';

                  return (
                    <div
                      key={hyp.id}
                      className={`p-3 rounded-md border transition-all text-xs ${
                        isSupported
                          ? 'bg-emerald-950/20 border-emerald-800/60 text-slate-200'
                          : isContradicted
                          ? 'bg-rose-950/15 border-rose-900/40 text-slate-300'
                          : 'bg-neutrino-950/60 border-neutrino-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          <StatusBadge label={hyp.status} variant={hyp.status as any} size="xs" />
                          <span className="font-mono text-[11px] text-slate-400">{hyp.id}</span>
                        </div>
                      </div>

                      <p className="font-medium text-slate-100 text-xs mb-1.5">{hyp.statement}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{hyp.explanation}</p>

                      {/* Evidence citation chips */}
                      <div className="mt-2.5 pt-2 border-t border-neutrino-800/60 flex flex-wrap items-center gap-2 text-[10px] font-mono">
                        {hyp.supportingEvidenceIds.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <span className="text-emerald-400">Corroborated by:</span>
                            {hyp.supportingEvidenceIds.map((evId) => (
                              <span
                                key={evId}
                                className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-1.5 py-0.2 rounded"
                              >
                                {evId}
                              </span>
                            ))}
                          </div>
                        )}

                        {hyp.contradictoryEvidenceIds.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <span className="text-rose-400">Contradicted by:</span>
                            {hyp.contradictoryEvidenceIds.map((evId) => (
                              <span
                                key={evId}
                                className="bg-rose-950/80 text-rose-300 border border-rose-800/80 px-1.5 py-0.2 rounded"
                              >
                                {evId}
                              </span>
                            ))}
                          </div>
                        )}

                        {hyp.missingEvidence.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <span className="text-amber-400">Missing Telemetry:</span>
                            {hyp.missingEvidence.map((m) => (
                              <span
                                key={m}
                                className="bg-amber-950/80 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Traversed Multi-Hop Graph Paths */}
            {result.graphPaths && result.graphPaths.length > 0 && (
              <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutrino-800/80">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                      Multi-Hop Traversal Chains ({result.graphPaths.length})
                    </h3>
                  </div>
                  {onExploreGraph && (
                    <button
                      onClick={onExploreGraph}
                      className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                    >
                      <span>Explore In Full Graph</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {result.graphPaths.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-neutrino-950 border border-neutrino-800 p-2.5 rounded-md font-mono text-[11px] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-400 font-semibold">Hop Chain #{idx + 1}</span>
                        <span className="text-slate-500 text-[10px]">{p.nodes.length} entities</span>
                      </div>
                      <p className="text-slate-300 font-sans text-xs">{p.description}</p>
                      <div className="flex items-center space-x-1 overflow-x-auto pt-1 text-[10px]">
                        {p.nodes.map((nodeId, nIdx) => (
                          <React.Fragment key={nodeId}>
                            <span className="bg-neutrino-850 text-cyan-300 border border-neutrino-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                              {nodeId}
                            </span>
                            {nIdx < p.nodes.length - 1 && (
                              <span className="text-slate-600 font-bold">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recalled Graph Memories (Track 02 Persistent Memory) */}
            {result.recalledMemories && result.recalledMemories.length > 0 && (
              <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutrino-800/80">
                  <div className="flex items-center space-x-2">
                    <Brain className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                      Recalled Graph Memories ({result.recalledMemories.length})
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Multi-signal FalkorDB recall
                  </span>
                </div>

                <div className="space-y-2">
                  {result.recalledMemories.map((mem) => {
                    const isRejected = mem.influence === 'rejected_by_evidence';
                    const isSuggested = mem.influence === 'suggested_procedure';
                    const isPrioritized = mem.influence === 'prioritized_hypothesis';

                    return (
                      <div
                        key={mem.memoryId}
                        className={`p-3 rounded-md border text-xs font-mono ${
                          isRejected
                            ? 'bg-rose-950/20 border-rose-900/40 text-slate-300'
                            : isSuggested
                            ? 'bg-cyan-950/20 border-cyan-800/60 text-slate-200'
                            : isPrioritized
                            ? 'bg-emerald-950/20 border-emerald-800/50 text-slate-200'
                            : 'bg-neutrino-950 border-neutrino-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-cyan-400">{mem.memoryId}</span>
                            <span className="text-[9px] uppercase bg-neutrino-800 text-slate-300 px-1 py-0.2 rounded border border-neutrino-700">
                              {mem.memoryType}
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              score: {mem.relevanceScore.toFixed(3)}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase border ${
                              isRejected
                                ? 'bg-rose-900/60 text-rose-300 border-rose-700'
                                : isSuggested
                                ? 'bg-cyan-900/60 text-cyan-300 border-cyan-700'
                                : isPrioritized
                                ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {mem.influence}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-200 mb-1 leading-snug">{mem.statement}</p>
                        <p className="text-[10px] text-slate-400">
                          <span className="text-slate-500">Reason:</span> {mem.retrievalReason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Traceable Evidence Timeline Bundle */}
            <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutrino-800/80">
                <div className="flex items-center space-x-2">
                  <FileSearch className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                    Evidence Timeline ({filteredEvidence.length})
                  </h3>
                </div>

                {/* Evidence Filter Tabs */}
                <div className="flex items-center space-x-1 bg-neutrino-950 p-0.5 rounded border border-neutrino-800 font-mono text-[10px]">
                  {(['all', 'logs', 'metrics', 'deployments'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setEvidenceFilter(filter)}
                      className={`px-2 py-0.5 rounded uppercase font-medium transition-colors ${
                        evidenceFilter === filter
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredEvidence.map((ev: Evidence) => {
                  const isExpanded = expandedEvidence[ev.id];
                  return (
                    <div
                      key={ev.id}
                      className="bg-neutrino-950 border border-neutrino-800 rounded-md p-3 text-xs font-mono space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-cyan-400 font-semibold">{ev.id}</span>
                          <span className="bg-neutrino-850 text-slate-300 px-1.5 py-0.2 rounded text-[10px] border border-neutrino-750">
                            {ev.sourceType || 'Telemetry'}
                          </span>
                          <span className="text-slate-500 text-[10px] truncate max-w-[140px]">{ev.sourceRecordId}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                          <span>{new Date(ev.observedAt).toLocaleTimeString()}</span>
                          <button
                            onClick={() => toggleEvidence(ev.id)}
                            className="p-1 rounded hover:bg-neutrino-800 text-slate-400 hover:text-slate-200"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <p className="text-slate-200 font-sans text-xs">{ev.summary}</p>

                      {isExpanded && (
                        <div className="pt-2 border-t border-neutrino-800/80 space-y-2 text-[11px]">
                          {ev.content && (
                            <div className="bg-neutrino-900 p-2.5 rounded border border-neutrino-800 overflow-x-auto text-slate-300">
                              <pre className="text-[10px] font-mono whitespace-pre-wrap">
                                {ev.content}
                              </pre>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Reliability: <span className="text-slate-400">{ev.reliabilityClass}</span></span>
                            <span>Hash: <span className="text-slate-400">{ev.contentHash?.slice(0, 12)}...</span></span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Embedded Interactive Subgraph Explorer */}
        {(workspaceLayout === 'split' || workspaceLayout === 'graph') && (
          <div
            className={`space-y-3 ${
              workspaceLayout === 'split' ? 'xl:col-span-5' : 'col-span-12'
            }`}
          >
            <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 space-y-3 sticky top-16">
              <div className="flex items-center justify-between pb-2 border-b border-neutrino-800/80">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                    Incident Subgraph Topology
                  </h3>
                </div>
                <div className="flex items-center space-x-2 font-mono text-[11px]">
                  <span className="text-slate-400">
                    Traversed Path Highlight: <span className="text-cyan-400 font-bold">{highlightedNodes.length} nodes</span>
                  </span>
                  {onExploreGraph && (
                    <button
                      onClick={onExploreGraph}
                      title="Open full screen in Graph Explorer"
                      className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-neutrino-800"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {loadingSubgraph ? (
                <div className="h-[480px] flex items-center justify-center bg-neutrino-950 border border-neutrino-800 rounded-md text-slate-400 font-mono text-xs">
                  Loading incident subgraph from FalkorDB...
                </div>
              ) : subgraph ? (
                <GraphVisualizer
                  data={subgraph}
                  highlightPath={highlightedNodes}
                  height={workspaceLayout === 'split' ? 520 : 620}
                />
              ) : (
                <div className="h-[480px] flex items-center justify-center bg-neutrino-950 border border-neutrino-800 rounded-md text-slate-500 font-mono text-xs">
                  No subgraph context available.
                </div>
              )}

              {/* Subgraph Quick Hint */}
              <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-1">
                <span>Cyan-highlighted nodes denote the multi-hop causal trail</span>
                <span className="text-cyan-400">Click any node to inspect properties</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
