import React from 'react';

interface StatusBadgeProps {
  label: string;
  variant?: 'sev-1' | 'sev-2' | 'sev-3' | 'sev-4' | 'supported' | 'contradicted' | 'candidate' | 'unresolved' | 'success' | 'warning' | 'info' | 'neutral' | string;
  size?: 'xs' | 'sm' | 'md';
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'sm',
  showDot = true,
}) => {
  let colorClasses = 'bg-slate-900/80 text-slate-300 border-slate-800';
  let dotColor = 'bg-slate-400';

  const v = variant.toLowerCase();
  if (v === 'sev-1' || v === 'contradicted' || v === 'failed' || v === 'rejected') {
    colorClasses = 'bg-rose-950/40 text-rose-300 border-rose-800/60';
    dotColor = 'bg-rose-400';
  } else if (v === 'sev-2' || v === 'warning' || v === 'superseded') {
    colorClasses = 'bg-amber-950/40 text-amber-300 border-amber-800/60';
    dotColor = 'bg-amber-400';
  } else if (v === 'sev-3' || v === 'candidate') {
    colorClasses = 'bg-sky-950/40 text-sky-300 border-sky-800/60';
    dotColor = 'bg-sky-400';
  } else if (v === 'supported' || v === 'success' || v === 'resolved' || v === 'active') {
    colorClasses = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60';
    dotColor = 'bg-emerald-400';
  } else if (v === 'unresolved' || v === 'investigating' || v === 'in_progress') {
    colorClasses = 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60';
    dotColor = 'bg-cyan-400 animate-pulse';
  }

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : size === 'sm'
      ? 'px-2 py-0.5 text-[11px]'
      : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium font-mono uppercase tracking-wider rounded-md border ${sizeClasses} ${colorClasses} transition-colors`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      <span>{label}</span>
    </span>
  );
};
