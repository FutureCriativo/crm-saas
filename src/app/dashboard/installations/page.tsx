'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatDate, warrantyStatus } from '@/lib/format';
import { PageHeader, WarrantyBadge, Loading, Empty } from '@/components/ui';
import { IconPlus, IconSearch } from '@/components/icons';

export default function InstallationsPage() {
  const [installations, setInstallations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('installations')
      .select('id, order_number, machine_type, machine_brand, installation_date, warranty_expires_at, installed_by, clients (name, phone)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInstallations(data || []);
        setLoading(false);
      });
  }, []);

  const q = searchTerm.toLowerCase();
  const filtered = installations.filter((i) =>
    (i.order_number || '').toLowerCase().includes(q) ||
    (i.clients?.name || '').toLowerCase().includes(q)
  );

  if (loading) return <Loading />;

  return (
    <>
      <PageHeader
        title="Instalações"
        subtitle="Ordens de serviço e garantias"
        action={
          <Link href="/dashboard/installations/new" className="btn-primary">
            <IconPlus className="h-5 w-5" /> Nova OS
          </Link>
        }
      />

      <div className="relative mb-5">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por número da OS ou cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-11"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty
          text={installations.length === 0 ? 'Nenhuma instalação registrada ainda.' : 'Nenhuma OS encontrada.'}
          action={installations.length === 0 && <Link href="/dashboard/installations/new" className="btn-primary">Registrar a primeira</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          {/* Tabela (computador) */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">OS</th>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">Equipamento</th>
                <th className="px-5 py-3 font-semibold">Instalação</th>
                <th className="px-5 py-3 font-semibold">Garantia até</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((i) => (
                <tr key={i.id} className="transition hover:bg-brand-50/60">
                  <td className="px-5 py-3.5">
                    <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-xs font-semibold text-brand-800">
                      {i.order_number}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-900">{i.clients?.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {i.machine_type}
                    {i.machine_brand && <span className="text-slate-400"> · {i.machine_brand}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{formatDate(i.installation_date)}</td>
                  <td className="px-5 py-3.5 text-slate-600">{formatDate(i.warranty_expires_at)}</td>
                  <td className="px-5 py-3.5"><WarrantyBadge status={warrantyStatus(i.warranty_expires_at)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cartões (celular) */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {filtered.map((i) => (
              <li key={i.id} className="px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-xs font-semibold text-brand-800">
                    {i.order_number}
                  </span>
                  <WarrantyBadge status={warrantyStatus(i.warranty_expires_at)} />
                </div>
                <p className="mt-2 font-medium text-slate-900">{i.clients?.name}</p>
                <p className="text-sm text-slate-500">{i.machine_type}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Instalado {formatDate(i.installation_date)} · Garantia até {formatDate(i.warranty_expires_at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
