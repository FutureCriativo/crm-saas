import { WarrantyStatus, warrantyLabel } from '@/lib/format';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function WarrantyBadge({ status }: { status: WarrantyStatus }) {
  const l = warrantyLabel[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${l.css}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${l.dot}`} />
      {l.text}
    </span>
  );
}

export function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-slate-500">{text}</p>
      {action}
    </div>
  );
}
