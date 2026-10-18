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
  GitCommit,
  FileText,
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMemory, setSelectedMemory] = useState<string | null>(null);
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
    setSelectedMemory(id);
    setDetailLoading(true);
    try {
      const detail = await api.getMemoryDetail(id);
      setDetailData(detail);
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
          <span className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium">
            ACTIVE
          </span>
        );
      case 'superseded':
        return (
          <span className="bg-amber-950/60 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium">
            SUPERSEDED
          </span>
        );
      case 'invalidated':
        return (
          <span className="bg-rose-950/60 text-rose-300 border border-rose-800/60 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium">
            INVALIDATED
          </span>
        );
      case 'candidate':
        return (
          <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium">
            CANDIDATE
          </span>
        );
      default:
        return (
          <span className="bg-neutrino-800 text-slate-300 px-1.5 py-0.2 rounded text-[10px] font-mono">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search claims, procedures, episodes..."
              className="w-full bg-neutrino-950 border border-neutrino-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 font-mono"
            />
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          <select
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            className="bg-neutrino-950 border border-neutrino-800 text-slate-200 px-2.5 py-1.5 rounded-md focus:outline-none text-[11px]"
          >
            <option value="all">All Types ({data.total || data.claims.length + data.procedures.length + data.episodes.length})</option>
            <option value="semantic">Semantic Claims ({data.claims.length})</option>
            <option value="procedural">Diagnostic Procedures ({data.procedures.length})</option>
            <option value="episodic">Memory Episodes ({data.episodes.length})</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutrino-950 border border-neutrino-800 text-slate-200 px-2.5 py-1.5 rounded-md focus:outline-none text-[11px]"
          >
            <option value="active">Active Only</option>
            <option value="">All Statuses</option>
            <option value="superseded">Superseded</option>
            <option value="invalidated">Invalidated</option>
            <option value="candidate">Candidate</option>
          </select>

          <button
            onClick={loadMemories}
            className="p-1.5 rounded-md bg-neutrino-950 border border-neutrino-800 text-slate-400 hover:text-slate-200 hover:border-neutrino-700 transition"
            title="Refresh memory store"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Memory List (5 cols) */}
        <div className="lg:col-span-5 space-y-2">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs bg-neutrino-900 rounded-lg border border-neutrino-800">
              Querying FalkorDB memory store...
            </div>
          ) : data.total === 0 && data.claims.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs bg-neutrino-900 rounded-lg border border-neutrino-800">
              No memory records found matching filter.
            </div>
          ) : (
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {/* Claims */}
              {(filterType === 'all' || filterType === 'semantic') &&
                data.claims
                  .filter((c) => !searchQuery || c.statement.toLowerCase().includes(searchQuery.toLowerCase()) || c.id.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((claim) => (
                    <div
                      key={claim.id}
                      onClick={() => handleSelectMemory(claim.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedMemory === claim.id
                          ? 'bg-neutrino-850 border-cyan-500/80 shadow-xs'
                          : 'bg-neutrino-900 border-neutrino-800 hover:border-neutrino-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono text-cyan-400 font-bold">
                          {claim.id}
                        </span>
                        {getInfluenceBadge(claim.status)}
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-2 leading-snug font-sans">
                        {claim.statement}
                      </p>
                      <div className="mt-2 pt-1.5 border-t border-neutrino-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span className="truncate max-w-[180px]">Subject: {claim.subject}</span>
                        <span>Confidence: {Number(claim.confidence).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}

              {/* Procedures */}
              {(filterType === 'all' || filterType === 'procedural') &&
                data.procedures
                  .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((proc) => (
                    <div
                      key={proc.id}
                      onClick={() => handleSelectMemory(proc.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedMemory === proc.id
                          ? 'bg-neutrino-850 border-cyan-500/80 shadow-xs'
                          : 'bg-neutrino-900 border-neutrino-800 hover:border-neutrino-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">
                          {proc.id}
                        </span>
                        {getInfluenceBadge(proc.status)}
                      </div>
                      <h4 className="text-xs font-semibold text-slate-100 font-sans">{proc.name}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug font-sans">
                        {proc.purpose}
                      </p>
                      <div className="mt-2 pt-1.5 border-t border-neutrino-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Target: {proc.serviceId}</span>
                        <span>v{proc.version}</span>
                      </div>
                    </div>
                  ))}

              {/* Episodes */}
              {(filterType === 'all' || filterType === 'episodic') &&
                data.episodes
                  .filter((e) => !searchQuery || e.summary.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((ep) => (
                    <div
                      key={ep.id}
                      onClick={() => handleSelectMemory(ep.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedMemory === ep.id
                          ? 'bg-neutrino-850 border-cyan-500/80 shadow-xs'
                          : 'bg-neutrino-900 border-neutrino-800 hover:border-neutrino-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono text-sky-400 font-bold">
                          {ep.id}
                        </span>
                        <span className="text-[10px] font-mono uppercase bg-sky-950/70 text-sky-300 px-1.5 py-0.2 rounded border border-sky-800/60 font-medium">
                          {ep.outcome}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2 leading-snug font-sans">
                        {ep.summary}
                      </p>
                      <div className="mt-2 pt-1.5 border-t border-neutrino-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Incident: {ep.incidentId}</span>
                        <span>Services: {ep.serviceIds?.length}</span>
                      </div>
                    </div>
                  ))}
            </div>
          )}
        </div>

        {/* Right Column: Detailed Memory Inspector (7 cols) */}
        <div className="lg:col-span-7">
          {detailLoading ? (
            <div className="bg-neutrino-900 border border-neutrino-800 p-8 rounded-lg text-center text-slate-400 text-xs font-mono">
              Loading memory details & grounded graph edges from FalkorDB...
            </div>
          ) : detailData ? (
            <div className="bg-neutrino-900 border border-neutrino-800 p-4 rounded-lg space-y-4">
              {/* Header */}
              <div className="border-b border-neutrino-800/80 pb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded">
                      {detailData.item.id}
                    </span>
                    <span className="text-[11px] uppercase font-mono px-1.5 py-0.2 bg-neutrino-800 text-slate-300 rounded border border-neutrino-700">
                      {detailData.memoryType}
                    </span>
                  </div>
                  {getInfluenceBadge(detailData.item.status)}
                </div>
                <h3 className="text-sm font-semibold text-slate-100 font-sans">
                  {detailData.item.statement || detailData.item.name || detailData.item.summary}
                </h3>
              </div>

              {/* Provenance & Lifecycle metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-neutrino-950 border border-neutrino-800 p-3 rounded-md text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">Revision</span>
                  <span className="text-slate-200 font-bold">
                    {detailData.item.revision || detailData.item.version || 1}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Provenance</span>
                  <span className="text-cyan-300 font-bold truncate block">
                    {detailData.item.sourceProvenance || 'Investigation'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Confidence</span>
                  <span className="text-emerald-400 font-bold">
                    {detailData.item.confidence ? `${(detailData.item.confidence * 100).toFixed(0)}%` : '100%'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Synthetic</span>
                  <span className="text-slate-400">
                    {detailData.item.synthetic ? 'true' : 'false'}
                  </span>
                </div>
              </div>

              {/* Procedural Steps */}
              {detailData.memoryType === 'procedural' && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    Diagnostic Procedure Steps
                  </h4>
                  <div className="bg-neutrino-950 border border-neutrino-800 rounded-md p-3 space-y-1.5">
                    {detailData.item.diagnosticSteps?.map((step: string, idx: number) => (
                      <div key={idx} className="flex items-start space-x-2 text-xs font-mono">
                        <span className="text-cyan-400 font-bold">{idx + 1}.</span>
                        <span className="text-slate-200 font-sans">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grounded Evidence Graph Edges */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Grounded Evidence Records (GROUNDED_IN)
                </h4>
                {detailData.connectedEntities?.groundedEvidence?.length > 0 ? (
                  <div className="space-y-1.5">
                    {detailData.connectedEntities.groundedEvidence.map((ev: any) => (
                      <div
                        key={ev.id}
                        className="bg-neutrino-950 border border-neutrino-800 p-2.5 rounded-md text-xs font-mono"
                      >
                        <div className="flex items-center justify-between text-cyan-300">
                          <span className="font-bold">{ev.id}</span>
                          <span className="text-slate-500 text-[10px]">{ev.sourceType}</span>
                        </div>
                        <p className="text-slate-300 mt-1 font-sans text-[11px]">{ev.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-mono italic bg-neutrino-950 p-2.5 rounded border border-neutrino-800">
                    Derived from causal graph traversal and incident post-mortem analysis in FalkorDB.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-neutrino-900 border border-neutrino-800 p-8 rounded-lg text-center text-slate-500 text-xs font-mono">
              Select a memory record on the left to inspect its FalkorDB graph relationships.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
