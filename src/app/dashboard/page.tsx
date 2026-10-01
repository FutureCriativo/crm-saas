'use client';
import Link from 'next/link';
import { PageHeader, Loading, Badge, ErrorBox } from '@/components/ui';
import TaskCard from '@/components/features/TaskCard';
import { IconUsers, IconShield, IconAlert, IconInbox, IconClipboard, IconChevron, IconPlus } from '@/components/icons';
import { useAsync } from '@/hooks/useAsync';
import { listTasks, taskCounters } from '@/services/tasks';
import { listRequests } from '@/services/requests';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';

export default function DashboardPage() {
  const { data, loading, error } = useAsync(async () => {
    const [counters, requests, tasks, clients] = await Promise.all([
      taskCounters(), listRequests('new'), listTasks({ status: 'pending' }),
      supabase.from('clients').select('*', { count: 'exact', head: true }),
    ]);
    return { counters, requests, tasks, clients: clients.count || 0 };
  }, []);

  if (loading) return <Loading />;
  if (!data) return <ErrorBox text={error || 'Não foi possível carregar.'} />;
  const { counters: c, requests, tasks, clients } = data;

  const cards = [
    { label: 'Pedidos novos', value: requests.length, icon: IconInbox, tint: 'bg-rose-50 text-rose-600', href: '/dashboard/requests' },
    { label: 'Tarefas pendentes', value: c.pending, icon: IconClipboard, tint: 'bg-brand-100 text-brand-700', href: '/dashboard/tasks' },
    { label: 'Em garantia', value: c.active, icon: IconShield, tint: 'bg-emerald-50 text-emerald-600', href: '/dashboard/tasks' },
    { label: 'Vencem em 30 dias', value: c.expiring, icon: IconAlert, tint: 'bg-amber-50 text-amber-600', href: '/dashboard/tasks' },
    { label: 'Garantia vencida', value: c.expired, icon: IconAlert, tint: 'bg-slate-100 text-slate-600', href: '/dashboard/tasks' },
    { label: 'Clientes', value: clients, icon: IconUsers, tint: 'bg-brand-100 text-brand-700', href: '/dashboard/clients' },
  ];

  return (
    <>
      <PageHeader title="Início" subtitle="Resumo do seu dia" action={<Link href="/dashboard/tasks/new" className="btn-primary hidden md:inline-flex"><IconPlus className="h-5 w-5" /> Nova tarefa</Link>} />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tint, href }) => (
          <Link key={label} href={href} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-md md:p-5" data-testid={`stat-${label}`}>
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
            <p className="mt-0.5 text-sm text-slate-500">{label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Pedidos novos</h2>
            <Link href="/dashboard/requests" className="text-sm font-medium text-brand-700">Ver todos</Link>
          </div>
          {requests.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhum pedido novo.</p> : (
            <ul className="divide-y divide-slate-100">
              {requests.slice(0, 5).map((r) => (
                <li key={r.id}><Link href="/dashboard/requests" className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                  <span className="font-mono text-xs font-semibold text-brand-800">#{r.request_number}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-800">{r.name}</p><p className="truncate text-sm text-slate-500">{r.city || r.address}</p></div>
                  <Badge tone={r.kind === 'installation' ? 'blue' : 'amber'}>{r.kind === 'installation' ? 'Instalação' : 'Manutenção'}</Badge>
                  <IconChevron className="h-4 w-4 text-slate-300" />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Próximas tarefas</h2>
            <Link href="/dashboard/tasks" className="text-sm font-medium text-brand-700">Ver todas</Link>
          </div>
          {tasks.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma tarefa pendente.</p> : (
            <ul className="divide-y divide-slate-100">
              {tasks.slice(0, 5).map((t) => (
                <li key={t.id}><Link href={`/dashboard/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                  <span className="font-mono text-xs font-semibold text-brand-800">{t.order_number}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-800">{t.clients?.name}</p><p className="truncate text-sm text-slate-500">{t.kind === 'installation' ? 'Instalação' : 'Manutenção'} · {formatDate(t.scheduled_date)}</p></div>
                  <IconChevron className="h-4 w-4 text-slate-300" />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
