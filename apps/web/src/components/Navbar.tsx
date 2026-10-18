import React from 'react';
import { Database, Activity, ShieldCheck, Layers, GitGraph, History, AlertCircle, Brain } from 'lucide-react';
import { GraphHealthResponse } from '@neutrino/contracts';

interface NavbarProps {
  activeTab: 'overview' | 'incidents' | 'investigate' | 'memories' | 'telemetry' | 'remediation' | 'graph' | 'history' | 'audit';
  setActiveTab: (tab: 'overview' | 'incidents' | 'investigate' | 'memories' | 'telemetry' | 'remediation' | 'graph' | 'history' | 'audit') => void;
  graphHealth: GraphHealthResponse | null;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, graphHealth, loading }) => {
  return (
    <header className="border-b border-neutrino-800 bg-neutrino-900/90 backdrop-blur sticky top-0 z-50 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center shadow-md shadow-cyan-950/40">
            <GitGraph className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base text-slate-100 tracking-tight">NEUTRINO</span>
              <span className="text-[10px] font-mono uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded font-medium">
                Stage 5 Final
              </span>
            </div>
            <p className="text-xs text-slate-400">Graph-Native Investigation Platform</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 bg-neutrino-850 p-1 rounded-lg border border-neutrino-750">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-neutrino-750 text-cyan-300 border border-neutrino-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-neutrino-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'incidents'
                ? 'bg-neutrino-750 text-cyan-300 border border-neutrino-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-neutrino-800'
            }`}
          >
            Incidents
          </button>
          <button
            onClick={() => setActiveTab('investigate')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 ${
              activeTab === 'investigate'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-neutrino-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Investigate</span>
          </button>
          <button
            onClick={() => setActiveTab('memories')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 ${
              activeTab === 'memories'
                ? 'bg-neutrino-750 text-cyan-300 border border-neutrino-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-neutrino-800'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Memories</span>
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'telemetry'
                ? 'bg-neutrino-750 text-cyan-300 border border-neutrino-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-neutrino-800'
            }`}
          >
            Telemetry
          </button>
          <button
            onClick={() => setActiveTab('remediation')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'remediation'
                ? 'bg-neutrino-750 text-cyan-300 border border-neutrino-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-neutrino-800'
            }`}
          >
            Actions & Approvals
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'graph'
                ? 'bg-neutrino-750 text-cyan-300 border border-neutrino-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-neutrino-800'
            }`}
          >
            Graph Explorer
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-neutrino-750 text-cyan-300 border border-neutrino-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-neutrino-800'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 ${
              activeTab === 'audit'
                ? 'bg-neutrino-750 text-cyan-300 border border-neutrino-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-neutrino-800'
            }`}
          >
            <span>Audit & Health</span>
          </button>
        </nav>

        {/* FalkorDB Health Indicator */}
        <div className="flex items-center space-x-3">
          {graphHealth?.connected ? (
            <div className="flex items-center space-x-2 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-full text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-emerald-300">FalkorDB: Ready</span>
              <span className="text-emerald-500 text-[10px]">({graphHealth.latencyMs}ms)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-rose-950/40 border border-rose-800/60 px-3 py-1.5 rounded-full text-xs">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-mono text-rose-300">FalkorDB: Offline</span>
            </div>
          )}

          <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-400 bg-neutrino-800 px-2.5 py-1.5 rounded-md border border-neutrino-750 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Deterministic Mode</span>
          </div>
        </div>
      </div>
    </header>
  );
};
