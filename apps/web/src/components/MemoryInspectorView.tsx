'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Brain,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  History,
  FileCode,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  Database,
  RefreshCw,
} from 'lucide-react';

export const MemoryInspectorView: React.FC = () => {
  const [data, setData] = useState<{
    claims: any[];
    procedures: any[];
    episodes: any[];
    total: number;
  }>({ claims: [], procedures: [], episodes: [], total: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'semantic' | 'procedural' | 'episodic'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [selectedMemory, setSelectedMemory] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailData, setDetailData] = useState<any | null>(null);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const res = await api.getMemories({ status: statusFilter || undefined, limit: 50 });
      setData(res);
      if (res.claims.length > 0 && !selectedMemory) {
        handleSelectMemory(res.claims[0].id);
      }
    } catch (err) {
      console.error('Failed to load memories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, [statusFilter]);

  const handleSelectMemory = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await api.getMemoryDetail(id);
      setDetailData(detail);
      setSelectedMemory(id);
    } catch (err) {
      console.error('Failed to fetch memory detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const getInfluenceBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
            ACTIVE
          </span>
        );
      case 'superseded':
        return (
          <span className="bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
            SUPERSEDED
          </span>
        );
      case 'invalidated':
        return (
          <span className="bg-rose-950/80 text-rose-300 border border-rose-800/80 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
            INVALIDATED
          </span>
        );
      case 'candidate':
        return (
          <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
            CANDIDATE
          </span>
        );
      default:
        return (
          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 mb-1">
            <Brain className="w-5 h-5" />
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
              Persistent Graph Memory Subsystem
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            FalkorDB-native Episodic, Semantic, and Procedural memory records with source evidence grounding and explicit lifecycle transitions.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center space-x-3 text-xs">
          <select
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            className="bg-neutrino-900 border border-neutrino-700 text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="all">All Types</option>
            <option value="semantic">Semantic Knowledge Claims ({data.claims.length})</option>
            <option value="procedural">Diagnostic Procedures ({data.procedures.length})</option>
            <option value="episodic">Memory Episodes ({data.episodes.length})</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutrino-900 border border-neutrino-700 text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="active">Active Only</option>
            <option value="">All Statuses</option>
            <option value="superseded">Superseded</option>
            <option value="invalidated">Invalidated</option>
            <option value="candidate">Candidate</option>
          </select>

          <button
            onClick={loadMemories}
            className="bg-neutrino-800 hover:bg-neutrino-700 text-slate-300 p-2 rounded-lg border border-neutrino-700"
            title="Refresh memory store"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Two Column Layout: List and Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Memory List */}
        <div className="lg:col-span-5 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              Querying FalkorDB memory records...
            </div>
          ) : data.total === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs bg-neutrino-850 rounded-xl border border-neutrino-750">
              No memory records found matching filter.
            </div>
          ) : (
            <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
              {/* Claims */}
              {(filterType === 'all' || filterType === 'semantic') &&
                data.claims.map((claim) => (
                  <div
                    key={claim.id}
                    onClick={() => handleSelectMemory(claim.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedMemory === claim.id
                        ? 'bg-neutrino-800 border-cyan-500/80 shadow-sm shadow-cyan-950/20'
                        : 'bg-neutrino-850 border-neutrino-750 hover:border-neutrino-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono text-cyan-400 font-bold">
                        {claim.id}
                      </span>
                      {getInfluenceBadge(claim.status)}
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                      {claim.statement}
                    </p>
                    <div className="mt-2 pt-2 border-t border-neutrino-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Subject: {claim.subject}</span>
                      <span>Confidence: {Number(claim.confidence).toFixed(2)}</span>
                    </div>
                  </div>
                ))}

              {/* Procedures */}
              {(filterType === 'all' || filterType === 'procedural') &&
                data.procedures.map((proc) => (
                  <div
                    key={proc.id}
                    onClick={() => handleSelectMemory(proc.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedMemory === proc.id
                        ? 'bg-neutrino-800 border-cyan-500/80 shadow-sm shadow-cyan-950/20'
                        : 'bg-neutrino-850 border-neutrino-750 hover:border-neutrino-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        {proc.id}
                      </span>
                      {getInfluenceBadge(proc.status)}
                    </div>
                    <h4 className="text-xs font-bold text-slate-100">{proc.name}</h4>
                    <p className="text-xs text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                      {proc.purpose}
                    </p>
                    <div className="mt-2 pt-2 border-t border-neutrino-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Target: {proc.serviceId}</span>
                      <span>v{proc.version}</span>
                    </div>
                  </div>
                ))}

              {/* Episodes */}
              {(filterType === 'all' || filterType === 'episodic') &&
                data.episodes.map((ep) => (
                  <div
                    key={ep.id}
                    onClick={() => handleSelectMemory(ep.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedMemory === ep.id
                        ? 'bg-neutrino-800 border-cyan-500/80 shadow-sm shadow-cyan-950/20'
                        : 'bg-neutrino-850 border-neutrino-750 hover:border-neutrino-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono text-sky-400 font-bold">
                        {ep.id}
                      </span>
                      <span className="text-[10px] font-mono uppercase bg-sky-950/70 text-sky-300 px-1.5 py-0.5 rounded border border-sky-800/60 font-medium">
                        {ep.outcome}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {ep.summary}
                    </p>
                    <div className="mt-2 pt-2 border-t border-neutrino-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Incident: {ep.incidentId}</span>
                      <span>Services: {ep.serviceIds?.length}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Right Column: Detailed Memory Inspector */}
        <div className="lg:col-span-7">
          {detailLoading ? (
            <div className="bg-neutrino-850 border border-neutrino-750 p-8 rounded-xl text-center text-slate-400 text-xs font-mono">
              Loading memory details & grounded graph edges...
            </div>
          ) : detailData ? (
            <div className="bg-neutrino-850 border border-neutrino-750 p-6 rounded-xl shadow-lg space-y-6">
              {/* Header */}
              <div className="border-b border-neutrino-800 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm text-cyan-400 font-bold">
                      {detailData.item.id}
                    </span>
                    <span className="text-xs uppercase font-mono px-2 py-0.5 bg-neutrino-800 text-slate-300 rounded border border-neutrino-700">
                      {detailData.memoryType}
                    </span>
                  </div>
                  {getInfluenceBadge(detailData.item.status)}
                </div>
                <h3 className="text-sm font-bold text-slate-100">
                  {detailData.item.statement || detailData.item.name || detailData.item.summary}
                </h3>
              </div>

              {/* Provenance & Lifecycle metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutrino-900 border border-neutrino-800 p-4 rounded-xl text-xs font-mono">
                <div>
                  <span className="text-slate-500 block">Revision</span>
                  <span className="text-slate-200 font-bold">
                    {detailData.item.revision || detailData.item.version || 1}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Provenance</span>
                  <span className="text-cyan-300 font-bold truncate block">
                    {detailData.item.sourceProvenance || 'Investigation'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Confidence</span>
                  <span className="text-emerald-400 font-bold">
                    {detailData.item.confidence ? `${detailData.item.confidence * 100}%` : '100%'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Synthetic</span>
                  <span className="text-slate-400">
                    {detailData.item.synthetic ? 'true' : 'false'}
                  </span>
                </div>
              </div>

              {/* Procedural Steps (if procedural) */}
              {detailData.memoryType === 'procedural' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Diagnostic Procedure Steps
                  </h4>
                  <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 space-y-2">
                    {detailData.item.diagnosticSteps?.map((step: string, idx: number) => (
                      <div key={idx} className="flex items-start space-x-2 text-xs font-mono">
                        <span className="text-cyan-400 font-bold">{idx + 1}.</span>
                        <span className="text-slate-200">{step}</span>
                      </div>
                    ))}
                  </div>

                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4">
                    Expected Observations
                  </h4>
                  <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3">
                    <p className="text-xs font-mono text-emerald-300">
                      {detailData.item.expectedObservations?.join(', ') || 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              {/* Grounded Evidence Graph Edges */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Connected Evidence Records in FalkorDB (GROUNDED_IN)
                </h4>
                {detailData.connectedEntities?.groundedEvidence?.length > 0 ? (
                  <div className="space-y-2">
                    {detailData.connectedEntities.groundedEvidence.map((ev: any) => (
                      <div
                        key={ev.id}
                        className="bg-neutrino-900 border border-neutrino-800 p-3 rounded-lg text-xs font-mono"
                      >
                        <div className="flex items-center justify-between text-cyan-300">
                          <span className="font-bold">{ev.id}</span>
                          <span className="text-slate-500">{ev.sourceType}</span>
                        </div>
                        <p className="text-slate-300 mt-1">{ev.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-mono italic">
                    Derived from causal graph traversal and incident post-mortem analysis.
                  </p>
                )}
              </div>

              {/* Revisions history */}
              {detailData.revisions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Superseded Prior Revisions (SUPERSEDES)
                  </h4>
                  <div className="space-y-2">
                    {detailData.revisions.map((rev: any) => (
                      <div
                        key={rev.id}
                        className="bg-neutrino-900 border border-amber-900/50 p-3 rounded-lg text-xs font-mono"
                      >
                        <div className="flex items-center justify-between text-amber-400">
                          <span>{rev.id} (rev {rev.revision})</span>
                          <span className="text-slate-500">{rev.status}</span>
                        </div>
                        <p className="text-slate-300 mt-1">{rev.statement}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-neutrino-850 border border-neutrino-750 p-8 rounded-xl text-center text-slate-400 text-xs font-mono">
              Select a memory record on the left to inspect its FalkorDB graph relationships and evidence grounding.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
