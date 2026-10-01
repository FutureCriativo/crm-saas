'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PageHeader, Loading, Empty, ErrorBox } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { listClients } from '@/services/clients';
import { useSettings } from '@/hooks/useSettings';
import { formatPhone } from '@/lib/format';
import { codeMessage, waToClient } from '@/lib/whatsapp';
import { APP_NAME } from '@/lib/brand';
import { IconChat, IconCopy, IconPlus, IconSearch } from '@/components/icons';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function ClientsPage() {
  const { data, loading, error } = useAsync(() => listClients(), []);
  const { settings } = useSettings();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const clients = data || [];
  const term = q.trim().toLowerCase();
  const filtered = clients.filter((c) => !term || c.name.toLowerCase().includes(term) || (c.phone || '').includes(q.replace(/\D/g, '') || '§') || c.client_code.toLowerCase() === term);

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast(`Código ${code} copiado.`); } catch { toast('Não foi possível copiar.', 'error'); }
  };

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${clients.length} cadastrado${clients.length === 1 ? '' : 's'}`}
        action={<Link href="/dashboard/clients/new" className="btn-primary"><IconPlus className="h-5 w-5" /> Novo cliente</Link>} />
      <div className="relative mb-5">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input className="input pl-11" placeholder="Buscar por nome, telefone ou código..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorBox text={error} />
      {loading ? <Loading /> : filtered.length === 0 ? (
        <Empty text={clients.length === 0 ? 'Você ainda não cadastrou clientes.' : 'Nenhum cliente encontrado.'} action={clients.length === 0 && <Link href="/dashboard/clients/new" className="btn-primary">Cadastrar o primeiro</Link>} />
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => {
            const wa = waToClient(c.phone, codeMessage(c.name, c.client_code, settings?.business_name || APP_NAME));
            return (
              <li key={c.id} className="card flex flex-wrap items-center gap-3 p-4" data-testid="client-row">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{initials(c.name)}</span>
                <Link href={`/dashboard/clients/${c.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{c.name}</p>
                  <p className="truncate text-sm text-slate-500">{[formatPhone(c.phone), c.city].filter(Boolean).join(' · ') || 'Sem contato'}</p>
                </Link>
                <button onClick={() => copy(c.client_code)} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold tracking-widest text-slate-700 hover:bg-slate-200" aria-label={`Copiar código ${c.client_code}`}>
                  {c.client_code} <IconCopy className="h-4 w-4 text-slate-400" />
                </button>
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost border border-slate-200 text-sm"><IconChat className="h-4 w-4" /> Enviar código</a>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
