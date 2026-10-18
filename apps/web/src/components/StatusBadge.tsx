import React from 'react';

interface StatusBadgeProps {
  label: string;
  variant?: 'sev-1' | 'sev-2' | 'sev-3' | 'sev-4' | 'supported' | 'contradicted' | 'candidate' | 'unresolved' | 'success' | 'warning' | 'info' | 'neutral' | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, variant = 'neutral', size = 'sm' }) => {
  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  const v = variant.toLowerCase();
  if (v === 'sev-1' || v === 'contradicted' || v === 'failed') {
    colorClasses = 'bg-rose-950/60 text-rose-300 border-rose-800/80';
  } else if (v === 'sev-2' || v === 'warning') {
    colorClasses = 'bg-amber-950/60 text-amber-300 border-amber-800/80';
  } else if (v === 'sev-3' || v === 'candidate') {
    colorClasses = 'bg-sky-950/60 text-sky-300 border-sky-800/80';
  } else if (v === 'supported' || v === 'success' || v === 'resolved') {
    colorClasses = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
  } else if (v === 'unresolved' || v === 'investigating') {
    colorClasses = 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium font-mono uppercase tracking-wider rounded-md border ${sizeClasses} ${colorClasses}`}
    >
      {label}
    </span>
  );
};
