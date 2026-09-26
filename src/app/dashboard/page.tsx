'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatDate, todayISO, addDaysISO, warrantyStatus } from '@/lib/format';
import { PageHeader, WarrantyBadge, Loading } from '@/components/ui';
import { IconUsers, IconShield, IconAlert, IconChevron, IconPlus } from '@/components/icons';

export default function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, active: 0, expiring: 0, expired: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = todayISO();
      const in30 = addDaysISO(30);

      // head: true = só conta, não baixa as linhas
      const [total, active, expiring, expired, last] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('installations').select('*', { count: 'exact', head: true })
          .gte('warranty_expires_at', today),
        supabase.from('installations').select('*', { count: 'exact', head: true })
          .gte('warranty_expires_at', today).lt('warranty_expires_at', in30),
        supabase.from('installations').select('*', { count: 'exact', head: true })
          .lt('warranty_expires_at', today),
        supabase.from('installations')
          .select('id, order_number, machine_type, installation_date, warranty_expires_at, clients (name)')
          .order('installation_date', { ascending: false })
          .limit(5),
      ]);

      setStats({
        total: total.count || 0,
        active: active.count || 0,
        expiring: expiring.count || 0,
        expired: expired.count || 0,
      });
      setRecent(last.data || []);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <Loading />;

  const cards = [
    { label: 'Clientes', value: stats.total, icon: IconUsers, tint: 'bg-brand-100 text-brand-700', href: '/dashboard/clients' },
    { label: 'Em garantia', value: stats.active, icon: IconShield, tint: 'bg-emerald-50 text-emerald-600', href: '/dashboard/installations' },
    { label: 'Vencem em 30 dias', value: stats.expiring, icon: IconAlert, tint: 'bg-amber-50 text-amber-600', href: '/dashboard/installations' },
    { label: 'Garantia vencida', value: stats.expired, icon: IconAlert, tint: 'bg-rose-50 text-rose-600', href: '/dashboard/installations' },
  ];

  return (
    <>
      <PageHeader title="Início" subtitle="Resumo dos seus clientes e garantias" />

      <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tint, href }) => (
          <Link key={label} href={href} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-md md:p-5">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
            <p className="mt-1 text-sm text-slate-500">{label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 md:gap-5">
        <Link href="/dashboard/clients/new"
          className="card group flex items-center gap-4 p-5 transition hover:border-brand-300">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-300 text-brand-900">
            <IconUsers className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-slate-900">Novo cliente</span>
            <span className="text-sm text-slate-500">Cadastro rápido em 1 minuto</span>
          </span>
          <IconChevron className="h-5 w-5 text-slate-300 group-hover:text-brand-600" />
        </Link>
        <Link href="/dashboard/installations/new"
          className="card group flex items-center gap-4 p-5 transition hover:border-brand-300">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-300 text-brand-900">
            <IconPlus className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-slate-900">Nova instalação</span>
            <span className="text-sm text-slate-500">O número da OS é gerado sozinho</span>
          </span>
          <IconChevron className="h-5 w-5 text-slate-300 group-hover:text-brand-600" />
        </Link>
      </div>

      <section className="card mt-6">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Últimas instalações</h2>
          <Link href="/dashboard/installations" className="text-sm font-medium text-brand-700 hover:text-brand-900">
            Ver todas
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-slate-500">Nenhuma instalação ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="hidden rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-xs font-semibold text-brand-800 sm:inline">
                  {r.order_number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{r.clients?.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    <span className="font-mono text-brand-800 sm:hidden">{r.order_number} · </span>
                    {r.machine_type} · {formatDate(r.installation_date)}
                  </p>
                </div>
                <WarrantyBadge status={warrantyStatus(r.warranty_expires_at)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
