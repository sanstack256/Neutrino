import React, { useState } from 'react';
import { IncidentListItem, IncidentDetailResponse } from '@neutrino/contracts';
import { StatusBadge } from './StatusBadge';
import { api } from '../lib/api';
import { AlertTriangle, Clock, ArrowRight, Server, Shield, Activity, GitCommit, FileText } from 'lucide-react';

interface IncidentsViewProps {
  incidents: IncidentListItem[];
  onInvestigateIncident: (incidentId: string) => void;
  onExploreIncidentSubgraph: (incidentId: string) => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  onInvestigateIncident,
  onExploreIncidentSubgraph,
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(incidents[0]?.id || null);
  const [detail, setDetail] = useState<IncidentDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const handleSelectIncident = async (id: string) => {
    setSelectedIncidentId(id);
    setLoadingDetail(true);
    try {
      const data = await api.getIncidentDetail(id);
      setDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Load first incident detail on mount
  React.useEffect(() => {
    if (selectedIncidentId && !detail) {
      handleSelectIncident(selectedIncidentId);
    }
  }, [selectedIncidentId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Incidents List (Left 5 cols) */}
      <div className="lg:col-span-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-neutrino-800">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Active Incidents ({incidents.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">FalkorDB Seeded</span>
        </div>

        <div className="space-y-2.5">
          {incidents.map((inc) => {
            const isSelected = selectedIncidentId === inc.id;
            return (
              <div
                key={inc.id}
                onClick={() => handleSelectIncident(inc.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-neutrino-800 border-indigo-500/80 shadow-md shadow-indigo-950/20'
                    : 'bg-neutrino-850 border-neutrino-750 hover:border-neutrino-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <StatusBadge label={inc.severity} variant={inc.severity as any} />
                    <span className="font-mono text-xs text-slate-400">{inc.id}</span>
                  </div>
                  <StatusBadge label={inc.status} variant={inc.status as any} />
                </div>

                <h3 className="text-sm font-bold text-slate-100 leading-snug mb-2">{inc.title}</h3>

                <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-2 border-t border-neutrino-800">
                  <div className="flex items-center space-x-1 truncate max-w-[180px]">
                    <Server className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{inc.affectedService || 'Unknown service'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(inc.startedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incident Detail Inspection (Right 7 cols) */}
      <div className="lg:col-span-7">
        {loadingDetail ? (
          <div className="bg-neutrino-850 border border-neutrino-750 rounded-xl p-8 flex items-center justify-center text-slate-400 font-mono text-xs">
            Loading graph context from FalkorDB...
          </div>
        ) : detail ? (
          <div className="bg-neutrino-850 border border-neutrino-750 rounded-xl p-6 space-y-6 shadow-xl">
            {/* Header and Quick Actions */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-neutrino-800">
              <div>
                <div className="flex items-center space-x-2 mb-1.5">
                  <span className="font-mono text-xs text-indigo-400 font-bold">{detail.incident.id}</span>
                  <StatusBadge label={detail.incident.severity} variant={detail.incident.severity as any} />
                  <StatusBadge label={detail.incident.status} variant={detail.incident.status as any} />
                </div>
                <h2 className="text-lg font-bold text-slate-100">{detail.incident.title}</h2>
                <p className="text-xs text-slate-400 mt-1">{detail.incident.description}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onExploreIncidentSubgraph(detail.incident.id)}
                  className="px-3 py-1.5 bg-neutrino-800 hover:bg-neutrino-700 text-slate-200 border border-neutrino-700 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                >
                  <span>Explore Subgraph</span>
                </button>
                <button
                  onClick={() => onInvestigateIncident(detail.incident.id)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition-colors flex items-center space-x-1.5"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Investigate Incident</span>
                </button>
              </div>
            </div>

            {/* Service & Ownership Card */}
            <div className="grid grid-cols-2 gap-4 bg-neutrino-900 border border-neutrino-800 p-4 rounded-xl text-xs font-mono">
              <div>
                <span className="text-slate-500 uppercase block text-[10px]">Affected Service</span>
                <span className="text-slate-100 font-bold text-sm">{detail.affectedService?.name || 'N/A'}</span>
                <span className="text-slate-400 block text-[11px] mt-0.5">
                  Criticality: <span className="text-indigo-400">{detail.affectedService?.criticality}</span>
                </span>
              </div>
              <div className="border-l border-neutrino-800 pl-4">
                <span className="text-slate-500 uppercase block text-[10px]">Owning Engineering Team</span>
                <span className="text-slate-100 font-bold text-sm">{detail.owningTeam?.name || 'N/A'}</span>
                <span className="text-slate-400 block text-[11px] mt-0.5">
                  On-Call: <span className="text-emerald-400">{detail.owningTeam?.onCallContact || 'None'}</span>
                </span>
              </div>
            </div>

            {/* Connected Deployments */}
            <div>
              <div className="flex items-center space-x-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <GitCommit className="w-3.5 h-3.5 text-purple-400" />
                <span>Connected Service Deployments ({detail.recentDeployments.length})</span>
              </div>
              <div className="space-y-2">
                {detail.recentDeployments.map((d) => (
                  <div
                    key={d.id}
                    className="bg-neutrino-900 border border-neutrino-800 p-3 rounded-lg text-xs font-mono flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-purple-300 font-bold">{d.serviceId}</span>
                        <span className="bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.2 rounded text-[10px]">
                          {d.version}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] mt-1">{d.changeSummary}</p>
                    </div>
                    <span className="text-slate-500 text-[11px]">{new Date(d.deployedAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connected Evidence Records */}
            <div>
              <div className="flex items-center space-x-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Observed Evidence Records ({detail.evidence.length})</span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {detail.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-neutrino-900 border border-neutrino-800 p-3 rounded-lg text-xs font-mono"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-amber-300 font-bold">{ev.id}</span>
                      <span className="text-[10px] uppercase bg-slate-800 text-slate-400 px-1.5 rounded">
                        {ev.sourceType}
                      </span>
                    </div>
                    <p className="text-slate-200 text-[11px]">{ev.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-neutrino-850 border border-neutrino-750 rounded-xl p-8 text-center text-slate-500 text-xs font-mono">
            Select an incident on the left to inspect its graph context.
          </div>
        )}
      </div>
    </div>
  );
};
