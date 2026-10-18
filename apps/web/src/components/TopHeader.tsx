'use client';

import React from 'react';
import {
  RefreshCw,
  Server,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Database,
  Radio,
} from 'lucide-react';
import { GraphHealthResponse } from '@neutrino/contracts';
import { NavTab } from './Sidebar';

interface TopHeaderProps {
  activeTab: NavTab;
  graphHealth: GraphHealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
  selectedIncidentId?: string | null;
}

const TAB_TITLES: Record<NavTab, { title: string; category: string; description: string }> = {
  overview: {
    title: 'Operational Overview',
    category: 'Operations',
    description: 'System health, key connected incident vectors, and multi-hop traversal launchpad',
  },
  incidents: {
    title: 'Incidents & Scenarios',
    category: 'Operations',
    description: 'Operational incidents seeded in FalkorDB with multi-hop dependency chains',
  },
  investigate: {
    title: 'Investigation Workspace',
    category: 'Operations',
    description: 'High-density multi-hop root cause analysis with interactive graph & evidence timeline',
  },
  graph: {
    title: 'Subgraph Explorer',
    category: 'Graph Intelligence',
    description: 'Interactive topology visualizer of services, deployments, incidents, and evidence',
  },
  memories: {
    title: 'Graph Memories',
    category: 'Graph Intelligence',
    description: 'Persistent operational claims, diagnostic procedures, and multi-signal recall',
  },
  telemetry: {
    title: 'Live Telemetry Stream',
    category: 'Platform & Safety',
    description: 'Real-time telemetry records ingested into FalkorDB graph topology with redaction',
  },
  remediation: {
    title: 'Remediation & Actions',
    category: 'Platform & Safety',
    description: 'Two-person approval boundary for consequential diagnostic and mitigation actions',
  },
  history: {
    title: 'Investigation Log',
    category: 'Platform & Safety',
    description: 'Persisted investigation records with full evidence graph trajectories',
  },
  audit: {
    title: 'Audit & Reliability',
    category: 'Platform & Safety',
    description: 'Tenant isolation, production readiness, retention lifecycle, and latency SLA metrics',
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  graphHealth,
  loading,
  onRefresh,
  selectedIncidentId,
}) => {
  const currentTab = TAB_TITLES[activeTab] || {
    title: 'Dashboard',
    category: 'Neutrino',
    description: '',
  };

  return (
    <header className="h-13 bg-neutrino-950/90 backdrop-blur border-b border-neutrino-800/80 px-5 flex items-center justify-between sticky top-0 z-20 select-none">
      {/* Left: Breadcrumbs & Page Context */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="text-slate-500 font-medium">{currentTab.category}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-slate-200 font-semibold">{currentTab.title}</span>
        {activeTab === 'investigate' && selectedIncidentId && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.2 rounded text-[11px]">
              {selectedIncidentId}
            </span>
          </>
        )}
      </div>

      {/* Right: Live Engine Indicator & Controls */}
      <div className="flex items-center space-x-3">
        {/* FalkorDB Live Status Capsule */}
        <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-md bg-neutrino-900 border border-neutrino-800 text-[11px] font-mono">
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                graphHealth?.connected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300 font-medium">FalkorDB</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            {graphHealth?.connected ? (
              <span className="text-cyan-400 font-semibold">{graphHealth.nodeCount} nodes</span>
            ) : (
              'connecting'
            )}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 text-[10px] font-semibold">TLS ACTIVE</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh dashboard state"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-neutrino-850 border border-neutrino-800 hover:border-neutrino-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>

        {/* Tenant Environment Badge */}
        <div className="text-[10px] font-mono bg-neutrino-850 text-slate-300 px-2 py-1 rounded-md border border-neutrino-750">
          <span className="text-slate-500 mr-1">env:</span>production
        </div>
      </div>
    </header>
  );
};
