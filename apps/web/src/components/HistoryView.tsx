import React, { useState } from 'react';
import { InvestigationHistoryItem, InvestigationResult } from '@neutrino/contracts';
import { StatusBadge } from './StatusBadge';
import { api } from '../lib/api';
import { InvestigationResultsView } from './InvestigationResultsView';
import { History, Clock, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

interface HistoryViewProps {
  history: InvestigationHistoryItem[];
  onRefresh: () => void;
  onExploreGraph?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onRefresh, onExploreGraph }) => {
  const [selectedResult, setSelectedResult] = useState<InvestigationResult | null>(null);
  const [loadingResult, setLoadingResult] = useState<boolean>(false);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-neutrino-800">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <History className="w-5 h-5 text-cyan-400" />
            <span>Persisted Investigations in FalkorDB</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real investigation records persisted directly as graph entities and relationships.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3.5 py-2 bg-neutrino-800 hover:bg-neutrino-700 text-slate-200 border border-neutrino-700 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {selectedResult ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedResult(null)}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-medium"
          >
            <span>← Back to History List</span>
          </button>
          <InvestigationResultsView result={selectedResult} onExploreGraph={onExploreGraph} />
        </div>
      ) : (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="bg-neutrino-850 border border-neutrino-750 p-12 rounded-xl text-center text-slate-400 font-mono text-xs">
              No investigations persisted yet. Run an investigation from the Investigate tab!
            </div>
          ) : (
            history.map((inv) => (
              <div
                key={inv.id}
                onClick={() => handleSelectHistory(inv.id)}
                className="bg-neutrino-850 border border-neutrino-750 hover:border-cyan-500/60 p-5 rounded-xl cursor-pointer transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2 font-mono text-xs">
                    <span className="text-cyan-400 font-semibold">{inv.id}</span>
                    {inv.incidentId && (
                      <span className="bg-neutrino-800 text-slate-300 px-2 py-0.5 rounded border border-neutrino-700">
                        {inv.incidentId}
                      </span>
                    )}
                    <StatusBadge label={inv.status} variant={inv.status === 'completed' ? 'success' : 'warning'} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">{inv.question}</h3>
                  <p className="text-xs text-slate-400 line-clamp-1">{inv.summary}</p>
                </div>

                <div className="flex items-center space-x-4 text-xs font-mono text-slate-400 flex-shrink-0">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(inv.startedAt).toLocaleString()}</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutrino-800 flex items-center justify-center text-cyan-400 border border-neutrino-700">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
