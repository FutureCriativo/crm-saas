'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PageHeader, Loading, Empty } from '@/components/ui';
import { IconPlus, IconSearch } from '@/components/icons';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClients(data || []);
        setLoading(false);
      });
  }, []);

  const q = searchTerm.toLowerCase();
  const filtered = clients.filter((c) =>
    (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(searchTerm)
  );

  if (loading) return <Loading />;

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${clients.length} cadastrado${clients.length === 1 ? '' : 's'}`}
        action={
          <Link href="/dashboard/clients/new" className="btn-primary">
            <IconPlus className="h-5 w-5" /> Novo cliente
          </Link>
        }
      />

      <div className="relative mb-5">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-11"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty
          text={clients.length === 0 ? 'Você ainda não cadastrou clientes.' : 'Nenhum cliente encontrado.'}
          action={clients.length === 0 && <Link href="/dashboard/clients/new" className="btn-primary">Cadastrar o primeiro</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          {/* Tabela (computador) */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">Telefone</th>
                <th className="px-5 py-3 font-semibold">Cidade</th>
                <th className="px-5 py-3 font-semibold">Endereço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="transition hover:bg-brand-50/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                        {initials(c.name || '?')}
                      </span>
                      <div>
                        <p className="font-medium text-slate-900">{c.name}</p>
                        {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{c.phone || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600">{c.city ? `${c.city}${c.state ? '/' + c.state : ''}` : '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600">{c.address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Lista (celular) */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
                  {initials(c.name || '?')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{c.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {[c.phone, c.city].filter(Boolean).join(' · ') || 'Sem contato'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
