import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, badge }) => {
  return (
    <div className="bg-neutrino-850 border border-neutrino-750 hover:border-neutrino-700 transition-colors p-5 rounded-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-neutrino-800 flex items-center justify-center text-indigo-400 border border-neutrino-700">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline space-x-2">
        <span className="text-3xl font-bold font-mono text-slate-100">{value}</span>
        {badge && (
          <span className="text-[10px] font-mono uppercase bg-indigo-950/60 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-400 mt-2">{subtitle}</p>}
    </div>
  );
};
