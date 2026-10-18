import React, { useState } from 'react';
import { InvestigationResult, CandidateExplanation, Evidence } from '@neutrino/contracts';
import { StatusBadge } from './StatusBadge';
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
} from 'lucide-react';

interface InvestigationResultsViewProps {
  result: InvestigationResult;
  onExploreGraph?: () => void;
}

export const InvestigationResultsView: React.FC<InvestigationResultsViewProps> = ({ result, onExploreGraph }) => {
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  const toggleEvidence = (id: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Overview Header Banner */}
      <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutrino-800">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="font-mono text-sm text-cyan-400 font-semibold">{result.investigationId}</span>
              <StatusBadge label={result.status} variant={result.status === 'completed' ? 'success' : 'warning'} />
              <span className="text-xs font-mono bg-neutrino-800 text-slate-300 px-2 py-0.5 rounded border border-neutrino-700">
                {result.executionMode}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{result.question}</h2>
          </div>

          {/* Metrics Pill */}
          <div className="flex items-center space-x-4 bg-neutrino-900 border border-neutrino-800 px-4 py-2 rounded-lg text-xs font-mono">
            <div>
              <span className="text-slate-500 block">Duration</span>
              <span className="text-emerald-400 font-bold">{result.metrics.durationMs}ms</span>
            </div>
            <div className="border-l border-neutrino-800 pl-3">
              <span className="text-slate-500 block">Graph Queries</span>
              <span className="text-cyan-400 font-bold">{result.metrics.graphQueryCount}</span>
            </div>
            <div className="border-l border-neutrino-800 pl-3">
              <span className="text-slate-500 block">Nodes Evaluated</span>
              <span className="text-slate-200 font-bold">{result.metrics.nodesEvaluated}</span>
            </div>
            <div className="border-l border-neutrino-800 pl-3">
              <span className="text-slate-500 block">Relationships</span>
              <span className="text-slate-200 font-bold">{result.metrics.relationshipsEvaluated}</span>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Executive Summary</h3>
          <p className="text-sm text-slate-200 bg-neutrino-900/60 p-4 rounded-lg border border-neutrino-800/80 leading-relaxed">
            {result.summary}
          </p>
        </div>

        {/* Recommended Diagnostic Step */}
        <div className="mt-4 bg-cyan-950/20 border border-cyan-800/50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>Recommended Next Diagnostic Step (Non-Destructive)</span>
          </div>
          <p className="text-xs text-cyan-200 font-mono leading-relaxed">{result.recommendedNextStep}</p>
        </div>
      </div>

      {/* Recalled Graph Memories (Stage 2 Persistent Memory) */}
      {result.recalledMemories && result.recalledMemories.length > 0 && (
        <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Recalled Graph Memories ({result.recalledMemories.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Multi-signal FalkorDB recall (entity overlap + topology + recency)
            </span>
          </div>

          <div className="space-y-3">
            {result.recalledMemories.map((mem) => {
              const isRejected = mem.influence === 'rejected_by_evidence';
              const isSuggested = mem.influence === 'suggested_procedure';
              const isPrioritized = mem.influence === 'prioritized_hypothesis';

              return (
                <div
                  key={mem.memoryId}
                  className={`p-4 rounded-xl border text-xs font-mono transition-all ${
                    isRejected
                      ? 'bg-rose-950/20 border-rose-900/40 text-slate-300'
                      : isSuggested
                      ? 'bg-cyan-950/30 border-cyan-800/60 text-slate-200'
                      : isPrioritized
                      ? 'bg-emerald-950/20 border-emerald-800/50 text-slate-200'
                      : 'bg-neutrino-900 border-neutrino-800 text-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-neutrino-800/60">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-cyan-400">{mem.memoryId}</span>
                      <span className="text-[10px] uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                        {mem.memoryType}
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="text-slate-400">Score: {mem.relevanceScore.toFixed(3)}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
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
                  </div>

                  <p className="text-xs text-slate-200 mb-2 leading-relaxed">{mem.statement}</p>

                  <div className="text-[11px] text-slate-400 space-y-1 bg-neutrino-950/50 p-2.5 rounded border border-neutrino-800/60">
                    <div>
                      <span className="text-slate-500">Retrieval Reason:</span> {mem.retrievalReason}
                    </div>
                    {mem.currentEvidenceCorroboration.length > 0 && (
                      <div className="text-emerald-400">
                        <span>Corroborated by live evidence:</span>{' '}
                        {mem.currentEvidenceCorroboration.join(', ')}
                      </div>
                    )}
                    {mem.currentEvidenceContradiction.length > 0 && (
                      <div className="text-rose-400 font-bold">
                        <span>Contradicted by live evidence (Rejected):</span>{' '}
                        {mem.currentEvidenceContradiction.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidate Explanations (Hypotheses) */}
      <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <GitFork className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Candidate Hypotheses ({result.candidateExplanations.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">Evaluated against multi-hop graph context</span>
        </div>

        <div className="space-y-4">
          {result.candidateExplanations.map((hyp: CandidateExplanation) => {
            const isSupported = hyp.status === 'supported';
            const isContradicted = hyp.status === 'contradicted';

            return (
              <div
                key={hyp.id}
                className={`p-4 rounded-xl border transition-all ${
                  isSupported
                    ? 'bg-emerald-950/20 border-emerald-800/60'
                    : isContradicted
                    ? 'bg-rose-950/10 border-rose-900/40 opacity-80'
                    : 'bg-neutrino-900 border-neutrino-800'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-1.5">
                      <StatusBadge label={hyp.status} variant={hyp.status as any} />
                      <span className="text-xs font-mono text-slate-400">{hyp.id}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">{hyp.statement}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{hyp.explanation}</p>

                {/* Evidence references */}
                <div className="mt-3 pt-3 border-t border-neutrino-800/60 flex flex-wrap items-center gap-2 text-xs">
                  {hyp.supportingEvidenceIds.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="text-[11px] text-emerald-400 font-mono">Supported by:</span>
                      {hyp.supportingEvidenceIds.map((evId) => (
                        <span
                          key={evId}
                          className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 px-1.5 py-0.5 rounded text-[10px] font-mono"
                        >
                          {evId}
                        </span>
                      ))}
                    </div>
                  )}

                  {hyp.contradictoryEvidenceIds.length > 0 && (
                    <div className="flex items-center space-x-1 ml-3">
                      <span className="text-[11px] text-rose-400 font-mono">Contradicted by:</span>
                      {hyp.contradictoryEvidenceIds.map((evId) => (
                        <span
                          key={evId}
                          className="bg-rose-950/60 text-rose-300 border border-rose-800/80 px-1.5 py-0.5 rounded text-[10px] font-mono"
                        >
                          {evId}
                        </span>
                      ))}
                    </div>
                  )}

                  {hyp.missingEvidence.length > 0 && (
                    <div className="flex items-center space-x-1 ml-3">
                      <span className="text-[11px] text-amber-400 font-mono">Missing:</span>
                      {hyp.missingEvidence.map((m) => (
                        <span
                          key={m}
                          className="bg-amber-950/60 text-amber-300 border border-amber-800/80 px-1.5 py-0.5 rounded text-[10px] font-mono"
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

      {/* Multi-Hop Graph Paths */}
      <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Discovered Multi-Hop Graph Paths ({result.graphPaths.length})
            </h3>
          </div>
          {onExploreGraph && (
            <button
              onClick={onExploreGraph}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1"
            >
              <span>Inspect in Graph Explorer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-2">
          {result.graphPaths.map((p, idx) => (
            <div
              key={idx}
              className="bg-neutrino-900 border border-neutrino-800 px-4 py-2.5 rounded-lg flex items-center space-x-2 text-xs font-mono overflow-x-auto"
            >
              <span className="text-slate-500 mr-2">#{idx + 1}</span>
              <span className="text-cyan-300">{p.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Traceable Evidence Bundle */}
      <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileSearch className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Evidence Bundle ({result.evidenceBundle.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Deduplicated & Chronologically Ordered</span>
        </div>

        <div className="space-y-3">
          {result.evidenceBundle.map((ev: Evidence) => {
            const isExpanded = !!expandedEvidence[ev.id];
            return (
              <div
                key={ev.id}
                className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 hover:border-neutrino-700 transition-colors"
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleEvidence(ev.id)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-cyan-400">{ev.id}</span>
                    <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                      {ev.sourceType}
                    </span>
                    <span className="text-xs text-slate-200">{ev.summary}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <span className="font-mono text-[11px]">{new Date(ev.observedAt).toLocaleTimeString()}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-neutrino-800 text-xs font-mono space-y-2">
                    <p className="text-slate-400">
                      <span className="text-slate-500">Source Record:</span> {ev.sourceRecordId} |{' '}
                      <span className="text-slate-500">Hash:</span> {ev.contentHash} |{' '}
                      <span className="text-slate-500">Reliability:</span> {ev.reliabilityClass}
                    </p>
                    <div className="bg-neutrino-950 p-3 rounded border border-neutrino-800/80 text-emerald-300 overflow-x-auto">
                      <code>{ev.content}</code>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage 3 Failure Domain & Graph Intelligence */}
      {result.failureDomain && (
        <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Graph Failure Domain & Blast Radius Intelligence
              </h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              Blast Radius: {(result.failureDomain.blastRadiusScore * 100).toFixed(0)}%
            </span>
          </div>

          <div className="bg-neutrino-900 border border-neutrino-800 p-4 rounded-xl text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Domain Name:</span>
              <span className="text-slate-200 font-semibold">{result.failureDomain.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Community ID:</span>
              <span className="text-cyan-400 font-mono">{result.failureDomain.communityId}</span>
            </div>
            <div>
              <span className="text-slate-400 font-mono block mb-1">Clustered Services:</span>
              <div className="flex flex-wrap gap-1.5">
                {result.failureDomain.serviceIds.map((sid: string) => (
                  <span
                    key={sid}
                    className="px-2 py-0.5 rounded bg-neutrino-800 border border-neutrino-700 text-slate-200 font-mono text-[11px]"
                  >
                    {sid}
                  </span>
                ))}
              </div>
            </div>
            {result.failureDomain.sharedInfrastructure && result.failureDomain.sharedInfrastructure.length > 0 && (
              <div>
                <span className="text-slate-400 font-mono block mb-1">Shared Infrastructure Dependencies:</span>
                <div className="flex flex-wrap gap-1.5">
                  {result.failureDomain.sharedInfrastructure.map((infra: string) => (
                    <span
                      key={infra}
                      className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300 font-mono text-[11px]"
                    >
                      {infra}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400 italic pt-1 border-t border-neutrino-800">
              {result.failureDomain.rationale}
            </p>
          </div>
        </div>
      )}

      {/* Stage 3 Proposed Action Proposal */}
      {/* Stage 3 Proposed Action Proposal */}
      {result.actionProposal && (
        <div className="bg-neutrino-850 border border-amber-800/60 p-6 rounded-xl shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-amber-200 uppercase tracking-wider">
                Proposed Remediation Action ({result.actionProposal.actionType})
              </h3>
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                result.actionProposal.riskLevel === 'high'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              Risk: {result.actionProposal.riskLevel}
            </span>
          </div>

          <div className="bg-neutrino-900/90 border border-neutrino-800 p-4 rounded-xl text-xs space-y-2">
            <p className="text-slate-200 font-medium">{result.actionProposal.explanation}</p>
            <div className="flex flex-wrap items-center gap-4 text-slate-400 font-mono pt-1 text-[11px]">
              <span>ID: <strong className="text-cyan-400">{result.actionProposal.id}</strong></span>
              <span>Target: <strong className="text-slate-200">{result.actionProposal.targetServiceId}</strong></span>
              <span>Status: <strong className="text-amber-400 uppercase">{result.actionProposal.status}</strong></span>
              <span>Approvals: <strong className="text-amber-300">{result.actionProposal.requiresTwoPersonApproval ? '2-Person Required' : '1 Approver'}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Newly Extracted & Persisted Memories */}
      {result.generatedMemories && (
        <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Persisted Graph Memories Generated from this Investigation
              </h3>
            </div>
            <span className="text-xs text-emerald-400 font-mono">Saved to FalkorDB</span>
          </div>

          <div className="bg-neutrino-900 border border-neutrino-800 p-4 rounded-xl text-xs font-mono space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Memory Episode:</span>
              <span className="text-sky-300 font-bold">{result.generatedMemories.episodeId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Extracted Semantic Claims:</span>
              <span className="text-cyan-300 font-bold">
                {result.generatedMemories.claimIds.length > 0
                  ? result.generatedMemories.claimIds.join(', ')
                  : 'None'}
              </span>
            </div>
            {result.generatedMemories.procedureIds && result.generatedMemories.procedureIds.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Validated Diagnostic Procedures:</span>
                <span className="text-emerald-300 font-bold">
                  {result.generatedMemories.procedureIds.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Investigation Event Trace & Planner Bounding */}
      {result.events && result.events.length > 0 && (
        <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Bounded Planner Event Trace ({result.events.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Allowlisted Graph Tools & Request-Scoped Cache
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {result.events.map((evt) => (
              <div
                key={evt.id}
                className="bg-neutrino-900 border border-neutrino-800 px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/60">
                    {evt.phase}
                  </span>
                  <span className="text-slate-200">{evt.action}</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
                  {evt.durationMs !== undefined && (
                    <span className="text-emerald-400">{evt.durationMs.toFixed(1)}ms</span>
                  )}
                  <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
