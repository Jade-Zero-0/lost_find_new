import type { ReactNode } from 'react';

export default function EmptyState({
  icon = '🔍',
  title,
  desc,
  action,
}: {
  icon?: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-3xl">{icon}</div>
      <h3 className="mt-4 font-semibold text-slate-700">{title}</h3>
      {desc && <p className="mt-1 max-w-sm text-sm text-slate-500">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
