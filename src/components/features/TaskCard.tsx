import Link from 'next/link';
import { Badge } from '../ui';
import { applianceLabel, formatDate } from '@/lib/format';
import type { ServiceTask } from '@/types';
import { IconMap } from '../icons';

// Cartão de tarefa (lista do gestor e do técnico)
export default function TaskCard({ task, href, techName, showWarranty }: { task: ServiceTask; href: string; techName?: string; showWarranty?: boolean }) {
  const items = task.task_items || [];
  const isInstall = task.kind === 'installation';
  return (
    <Link href={href} className="card block p-4 transition hover:border-brand-300 hover:shadow-md" data-testid="task-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand-800">{task.order_number}</span>
        <Badge tone={isInstall ? 'blue' : 'amber'}>{isInstall ? 'Instalação' : 'Manutenção'}</Badge>
        {task.status === 'done' ? <Badge tone="green">Concluída</Badge> : <Badge>Pendente</Badge>}
        {task.scheduled_date && task.status === 'pending' && <span className="ml-auto text-xs font-medium text-slate-500">{formatDate(task.scheduled_date)}</span>}
        {task.status === 'done' && task.done_on && <span className="ml-auto text-xs font-medium text-slate-500">{formatDate(task.done_on)}</span>}
      </div>
      <p className="mt-2 font-semibold text-slate-900">{task.clients?.name || '—'}</p>
      {(task.address || task.clients?.address) && <p className="mt-0.5 flex items-start gap-1 text-sm text-slate-500"><IconMap className="mt-0.5 h-4 w-4 shrink-0" /> {task.address || task.clients?.address}</p>}
      {items.length > 0 && <p className="mt-1 text-sm text-slate-500">{items.length} aparelho{items.length > 1 ? 's' : ''}: {items.slice(0, 2).map(applianceLabel).join(' · ')}{items.length > 2 ? ' …' : ''}</p>}
      {techName !== undefined && <p className="mt-1 text-xs text-slate-400">Técnico: {techName || 'sem técnico'}</p>}
      {showWarranty && task.warranty_expires_at && <p className="mt-1 text-xs text-slate-400">Garantia até {formatDate(task.warranty_expires_at)}</p>}
    </Link>
  );
}
