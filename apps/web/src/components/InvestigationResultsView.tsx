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
              <span className="font-mono text-sm text-indigo-400">{result.investigationId}</span>
              <StatusBadge label={result.status} variant={result.status === 'completed' ? 'success' : 'warning'} />
              <span className="text-xs font-mono bg-neutrino-800 text-slate-400 px-2 py-0.5 rounded border border-neutrino-700">
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
              <span className="text-indigo-400 font-bold">{result.metrics.graphQueryCount}</span>
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
        <div className="mt-4 bg-indigo-950/30 border border-indigo-900/50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            <span>Recommended Next Diagnostic Step (Non-Destructive)</span>
          </div>
          <p className="text-xs text-indigo-200 font-mono leading-relaxed">{result.recommendedNextStep}</p>
        </div>
      </div>

      {/* Candidate Explanations (Hypotheses) */}
      <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <GitFork className="w-4 h-4 text-indigo-400" />
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
            <Database className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Discovered Multi-Hop Graph Paths ({result.graphPaths.length})
            </h3>
          </div>
          {onExploreGraph && (
            <button
              onClick={onExploreGraph}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
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
              <span className="text-indigo-300">{p.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Traceable Evidence Bundle */}
      <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileSearch className="w-4 h-4 text-indigo-400" />
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
                    <span className="font-mono text-xs font-bold text-indigo-400">{ev.id}</span>
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

      {/* Missing Information / Context Gaps */}
      {result.missingInformation.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-900/50 p-5 rounded-xl">
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <HelpCircle className="w-4 h-4" />
            <span>Identified Context Gaps & Missing Telemetry</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-amber-200 font-mono">
            {result.missingInformation.map((info, idx) => (
              <li key={idx}>{info}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
