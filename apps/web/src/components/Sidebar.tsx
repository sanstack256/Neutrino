'use client';

import React from 'react';
import {
  Compass,
  AlertTriangle,
  Activity,
  Database,
  Brain,
  Radio,
  ShieldAlert,
  History,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Server,
  Layers,
  Terminal,
} from 'lucide-react';
import { GraphHealthResponse } from '@neutrino/contracts';

export type NavTab =
  | 'overview'
  | 'incidents'
  | 'investigate'
  | 'graph'
  | 'memories'
  | 'telemetry'
  | 'remediation'
  | 'history'
  | 'audit';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  graphHealth: GraphHealthResponse | null;
  incidentCount?: number;
  historyCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  graphHealth,
  incidentCount = 0,
  historyCount = 0,
}) => {
  const navSections = [
    {
      label: 'Operations',
      items: [
        {
          id: 'overview' as NavTab,
          label: 'Overview',
          icon: <Compass className="w-4 h-4" />,
          badge: null,
        },
        {
          id: 'incidents' as NavTab,
          label: 'Incidents',
          icon: <AlertTriangle className="w-4 h-4" />,
          badge: incidentCount > 0 ? `${incidentCount}` : null,
          badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
        },
        {
          id: 'investigate' as NavTab,
          label: 'Investigate',
          icon: <Activity className="w-4 h-4" />,
          badge: 'Engine',
          badgeColor: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
          highlight: true,
        },
      ],
    },
    {
      label: 'Graph Intelligence',
      items: [
        {
          id: 'graph' as NavTab,
          label: 'Graph Explorer',
          icon: <Database className="w-4 h-4" />,
          badge: graphHealth?.nodeCount ? `${graphHealth.nodeCount}n` : null,
        },
        {
          id: 'memories' as NavTab,
          label: 'Graph Memories',
          icon: <Brain className="w-4 h-4" />,
          badge: 'Track 02',
          badgeColor: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
        },
      ],
    },
    {
      label: 'Platform & Safety',
      items: [
        {
          id: 'telemetry' as NavTab,
          label: 'Telemetry Stream',
          icon: <Radio className="w-4 h-4" />,
          badge: 'Live',
          badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
        },
        {
          id: 'remediation' as NavTab,
          label: 'Actions & Safety',
          icon: <ShieldAlert className="w-4 h-4" />,
          badge: '2-Person',
          badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        },
        {
          id: 'history' as NavTab,
          label: 'Investigation Log',
          icon: <History className="w-4 h-4" />,
          badge: historyCount > 0 ? `${historyCount}` : null,
        },
        {
          id: 'audit' as NavTab,
          label: 'Audit & Readiness',
          icon: <ShieldCheck className="w-4 h-4" />,
          badge: null,
        },
      ],
    },
  ];

  return (
    <aside className="w-60 flex-shrink-0 bg-neutrino-950 border-r border-neutrino-800/80 flex flex-col justify-between h-screen sticky top-0 select-none z-30">
      {/* Top Workspace & Brand header */}
      <div>
        <div className="p-3.5 border-b border-neutrino-800/80">
          <div
            onClick={() => setActiveTab('overview')}
            className="flex items-center space-x-2.5 cursor-pointer group p-1 -m-1 rounded-md hover:bg-neutrino-900/60 transition-colors"
          >
            <div className="w-7 h-7 rounded-md overflow-hidden flex items-center justify-center border border-neutrino-700/80 bg-neutrino-900 shadow-sm flex-shrink-0">
              <img src="/logo.png" alt="Neutrino" width={28} height={28} style={{ width: '28px', height: '28px' }} className="w-full h-full object-contain p-0.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-xs tracking-wider text-slate-100 group-hover:text-cyan-300 transition-colors">
                  NEUTRINO
                </span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                  v0.9
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="truncate">falkordb · online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Launchpad search pill (Linear style) */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setActiveTab('investigate')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-neutrino-900/80 border border-neutrino-800 text-[11px] text-slate-400 hover:text-slate-200 hover:border-neutrino-700 transition-all font-mono group"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Query Graph Engine</span>
            </div>
            <kbd className="text-[9px] bg-neutrino-850 px-1.5 py-0.5 rounded border border-neutrino-750 text-slate-500 group-hover:text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="px-2 py-2 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
          {navSections.map((section) => (
            <div key={section.label} className="space-y-0.5">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
                {section.label}
              </div>
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-all group ${
                      isActive
                        ? 'bg-neutrino-850 text-cyan-300 border border-neutrino-750/80 shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-neutrino-900/70 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <span
                        className={`transition-colors ${
                          isActive
                            ? 'text-cyan-400'
                            : 'text-slate-400 group-hover:text-slate-300'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                          item.badgeColor ||
                          'bg-neutrino-800 text-slate-400 border-neutrino-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Infrastructure Info Widget */}
      <div className="p-3 border-t border-neutrino-800/80 bg-neutrino-950/80">
        <div className="bg-neutrino-900/90 border border-neutrino-800 rounded-md p-2 space-y-1.5 font-mono text-[10px]">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-slate-500 flex items-center gap-1">
              <Server className="w-3 h-3 text-cyan-400" />
              <span>Storage</span>
            </span>
            <span className="text-slate-300 font-semibold truncate max-w-[100px]">
              {graphHealth?.connected ? 'FalkorDB Cloud' : 'FalkorDB'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="text-slate-500">Graph</span>
            <span className="text-cyan-400 font-mono truncate max-w-[100px]">
              {graphHealth?.graphName || 'neutrino_graph'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-neutrino-800/60">
            <span className="text-slate-500">Topology</span>
            <span className="text-slate-300">
              {graphHealth?.nodeCount || 0} nodes · {graphHealth?.relationshipCount || 0} edges
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
