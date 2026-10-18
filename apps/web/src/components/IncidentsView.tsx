'use client';

import React, { useState } from 'react';
import { IncidentListItem, IncidentDetailResponse } from '@neutrino/contracts';
import { StatusBadge } from './StatusBadge';
import { api } from '../lib/api';
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  Server,
  Shield,
  Activity,
  GitCommit,
  FileText,
  Search,
  Filter,
  Users,
  Database,
  ExternalLink,
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

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

  const filteredIncidents = incidents.filter((inc) => {
    const matchesQuery =
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.affectedService && inc.affectedService.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSeverity = severityFilter === 'all' || inc.severity.toLowerCase() === severityFilter.toLowerCase();
    return matchesQuery && matchesSeverity;
  });

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter incidents by title, service, ID..."
              className="w-full bg-neutrino-950 border border-neutrino-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-slate-500 text-[11px] uppercase">Severity:</span>
          {(['all', 'sev-1', 'sev-2', 'sev-3'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2 py-1 rounded text-[11px] uppercase transition-colors ${
                severityFilter === sev
                  ? 'bg-neutrino-800 text-cyan-300 border border-neutrino-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left List Pane (5 cols) */}
        <div className="lg:col-span-5 space-y-2">
          {filteredIncidents.length === 0 ? (
            <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-8 text-center text-slate-500 font-mono text-xs">
              No matching incidents found.
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const isSelected = selectedIncidentId === inc.id;
              return (
                <div
                  key={inc.id}
                  onClick={() => handleSelectIncident(inc.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-neutrino-850 border-cyan-500/80 shadow-xs'
                      : 'bg-neutrino-900 border-neutrino-800 hover:border-neutrino-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <StatusBadge label={inc.severity} variant={inc.severity as any} size="xs" />
                      <span className="font-mono text-xs text-slate-400 font-semibold">{inc.id}</span>
                    </div>
                    <StatusBadge label={inc.status} variant={inc.status as any} size="xs" />
                  </div>

                  <h3 className="text-xs font-semibold text-slate-100 leading-snug mb-2">
                    {inc.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-neutrino-800/60">
                    <div className="flex items-center space-x-1 truncate max-w-[200px]">
                      <Server className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      <span className="text-slate-300 truncate">{inc.affectedService || 'Unknown service'}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(inc.startedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Detail Pane (7 cols) */}
        <div className="lg:col-span-7">
          {loadingDetail ? (
            <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-10 flex items-center justify-center text-slate-400 font-mono text-xs">
              Traversing incident graph context in FalkorDB...
            </div>
          ) : detail ? (
            <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-4 space-y-4">
              {/* Header and Quick Actions */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-neutrino-800/80">
                <div>
                  <div className="flex items-center space-x-2 mb-1.5">
                    <span className="font-mono text-xs text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded">
                      {detail.incident.id}
                    </span>
                    <StatusBadge label={detail.incident.severity} variant={detail.incident.severity as any} size="xs" />
                    <StatusBadge label={detail.incident.status} variant={detail.incident.status as any} size="xs" />
                  </div>
                  <h2 className="text-base font-bold text-slate-100">{detail.incident.title}</h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{detail.incident.description}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onExploreIncidentSubgraph(detail.incident.id)}
                    className="px-3 py-1.5 bg-neutrino-800 hover:bg-neutrino-700 text-slate-200 border border-neutrino-700 rounded-md text-xs font-mono transition-colors flex items-center space-x-1.5"
                  >
                    <Database className="w-3 h-3 text-cyan-400" />
                    <span>Explore Subgraph</span>
                  </button>
                  <button
                    onClick={() => onInvestigateIncident(detail.incident.id)}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-xs font-mono font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Run Graph AI Investigation</span>
                  </button>
                </div>
              </div>

              {/* Service & Ownership Grid */}
              <div className="grid grid-cols-2 gap-3 bg-neutrino-950 border border-neutrino-800 p-3 rounded-md font-mono text-xs">
                <div>
                  <span className="text-slate-500 uppercase block text-[10px] mb-0.5">Affected Service</span>
                  <span className="text-cyan-300 font-bold text-xs">{detail.affectedService?.name || 'N/A'}</span>
                  <span className="text-slate-400 block text-[10px] mt-0.5">
                    Criticality: <span className="text-slate-200">{detail.affectedService?.criticality}</span>
                  </span>
                </div>
                <div className="border-l border-neutrino-800 pl-3">
                  <span className="text-slate-500 uppercase block text-[10px] mb-0.5">Owning Team & On-Call</span>
                  <span className="text-slate-200 font-bold text-xs">{detail.owningTeam?.name || 'N/A'}</span>
                  <span className="text-slate-400 block text-[10px] mt-0.5">
                    Contact: <span className="text-emerald-400">{detail.owningTeam?.onCallContact || 'None'}</span>
                  </span>
                </div>
              </div>

              {/* Connected Deployments */}
              <div className="space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
                  <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Connected Deployments in FalkorDB ({detail.recentDeployments.length})</span>
                </div>
                <div className="space-y-1.5">
                  {detail.recentDeployments.map((d) => (
                    <div
                      key={d.id}
                      className="bg-neutrino-950 border border-neutrino-800 p-2.5 rounded-md text-xs font-mono flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-cyan-300 font-bold">{d.serviceId}</span>
                          <span className="bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.2 rounded text-[10px]">
                            {d.version}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] mt-0.5 font-sans">{d.changeSummary}</p>
                      </div>
                      <span className="text-slate-500 text-[10px]">{new Date(d.deployedAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observed Evidence */}
              <div className="space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Seeded Telemetry Evidence ({detail.evidence.length})</span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {detail.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-neutrino-950 border border-neutrino-800 p-2.5 rounded-md text-xs font-mono"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-amber-400 font-bold text-[11px]">{ev.id}</span>
                        <span className="text-[10px] uppercase bg-neutrino-850 text-slate-400 px-1.5 py-0.2 rounded border border-neutrino-750">
                          {ev.sourceType}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] font-sans">{ev.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-10 text-center text-slate-500 text-xs font-mono">
              Select an incident on the left to inspect its graph topology context.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
