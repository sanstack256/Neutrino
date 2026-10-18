import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  trend,
}) => {
  return (
    <div className="bg-neutrino-900/90 border border-neutrino-800 hover:border-neutrino-700/80 transition-all rounded-lg p-3.5 flex flex-col justify-between group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className="w-6 h-6 rounded-md bg-neutrino-850 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 transition-colors border border-neutrino-750">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between mt-1">
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-100">
            {value}
          </span>
          {badge && (
            <span className="text-[10px] font-mono uppercase bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.2 rounded font-medium">
              {badge}
            </span>
          )}
        </div>
        {trend && (
          <span
            className={`text-[11px] font-mono ${
              trend.isPositive ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-[11px] text-slate-500 mt-1.5 truncate font-mono">
          {subtitle}
        </p>
      )}
    </div>
  );
};
