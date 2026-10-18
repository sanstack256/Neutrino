'use client';

import React, { useState } from 'react';
import { InvestigationHistoryItem, InvestigationResult } from '@neutrino/contracts';
import { StatusBadge } from './StatusBadge';
import { api } from '../lib/api';
import { InvestigationResultsView } from './InvestigationResultsView';
import {
  History,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Search,
  ArrowLeft,
  Database,
} from 'lucide-react';

interface HistoryViewProps {
  history: InvestigationHistoryItem[];
  onRefresh: () => void;
  onExploreGraph?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onRefresh, onExploreGraph }) => {
  const [selectedResult, setSelectedResult] = useState<InvestigationResult | null>(null);
  const [loadingResult, setLoadingResult] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState('');

  const handleSelectHistory = async (id: string) => {
    setLoadingResult(true);
    try {
      const res = await api.getInvestigation(id);
      setSelectedResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingResult(false);
    }
  };

  const filteredHistory = history.filter((inv) => {
    if (!searchFilter) return true;
    return (
      inv.question.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inv.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (inv.incidentId && inv.incidentId.toLowerCase().includes(searchFilter.toLowerCase()))
    );
  });

  return (
    <div className="space-y-4">
      {selectedResult ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-neutrino-900 border border-neutrino-800 p-2.5 rounded-lg">
            <button
              onClick={() => setSelectedResult(null)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center space-x-1.5 font-medium px-2 py-1 rounded hover:bg-neutrino-850 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Investigation Log</span>
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              Viewing Persisted Run: <span className="text-slate-200 font-bold">{selectedResult.investigationId}</span>
            </span>
          </div>
          <InvestigationResultsView result={selectedResult} onExploreGraph={onExploreGraph} />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Top Controls Bar */}
          <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search historical investigations by question, incident..."
                  className="w-full bg-neutrino-950 border border-neutrino-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 font-mono text-xs">
              <span className="text-slate-400">
                Total Runs: <span className="text-slate-200 font-bold">{history.length}</span>
              </span>
              <button
                onClick={onRefresh}
                className="p-1.5 rounded-md bg-neutrino-950 border border-neutrino-800 text-slate-400 hover:text-slate-200 hover:border-neutrino-700 transition"
                title="Refresh history"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* History List */}
          {loadingResult ? (
            <div className="bg-neutrino-900 border border-neutrino-800 p-8 rounded-lg text-center text-slate-400 font-mono text-xs">
              Loading investigation record from FalkorDB...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-neutrino-900 border border-neutrino-800 p-8 rounded-lg text-center text-slate-500 font-mono text-xs">
              No persisted investigations found. Run an investigation from the Investigate tab!
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => handleSelectHistory(inv.id)}
                  className="bg-neutrino-900 border border-neutrino-800 hover:border-cyan-500/80 p-3.5 rounded-lg cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 font-mono text-xs">
                      <span className="text-cyan-400 font-semibold">{inv.id}</span>
                      {inv.incidentId && (
                        <span className="bg-neutrino-800 text-slate-300 px-1.5 py-0.2 rounded text-[10px] border border-neutrino-700">
                          {inv.incidentId}
                        </span>
                      )}
                      <StatusBadge label={inv.status} variant={inv.status === 'completed' ? 'success' : 'warning'} size="xs" />
                    </div>
                    <h3 className="text-xs font-semibold text-slate-100 font-sans group-hover:text-cyan-300 transition-colors">
                      {inv.question}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-sans line-clamp-1">{inv.summary}</p>
                  </div>

                  <div className="flex items-center space-x-3 text-xs font-mono text-slate-400 flex-shrink-0">
                    <div className="flex items-center space-x-1 text-[11px] text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(inv.startedAt).toLocaleString()}</span>
                    </div>
                    <div className="w-6 h-6 rounded-md bg-neutrino-850 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 border border-neutrino-750 transition-colors">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
