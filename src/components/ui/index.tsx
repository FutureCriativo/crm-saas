'use client';
import { Children, cloneElement, isValidElement, useId } from 'react';
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

const TONES: Record<string, string> = {
  blue: 'bg-brand-100 text-brand-800',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-600',
};
export function Badge({ tone = 'slate', children }: { tone?: keyof typeof TONES | string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone] || TONES.slate}`}>{children}</span>;
}

export function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando">
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

export function ErrorBox({ text }: { text: string }) {
  if (!text) return null;
  return <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{text}</div>;
}

export function Field({ label, children, hint, className = '' }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  const id = useId();
  // liga o rótulo ao primeiro campo (input/select/textarea) que ainda não tem id
  let linked = false;
  const kids = Children.map(children, (c) => {
    if (!linked && isValidElement(c) && typeof c.type === 'string' && ['input', 'select', 'textarea'].includes(c.type) && !(c.props as any).id) {
      linked = true;
      return cloneElement(c as React.ReactElement<any>, { id });
    }
    return c;
  });
  return (
    <div className={className}>
      <label className="label" htmlFor={linked ? id : undefined}>{label}</label>
      {kids}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Segmented({ value, onChange, options }: { value: string; onChange: (v: any) => void; options: { value: string; label: string; count?: number }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          {o.label}{typeof o.count === 'number' ? <span className="ml-1.5 text-xs text-slate-400">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
