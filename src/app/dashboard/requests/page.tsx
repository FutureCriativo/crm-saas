'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Loading, Empty, Badge, Segmented, ErrorBox, Field } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { createTaskFromRequest, listRequests, setRequestStatus } from '@/services/requests';
import { listTechnicians } from '@/services/technicians';
import { friendlyError } from '@/lib/errors';
import { applianceLabel, formatDate, formatDateTime, formatPhone, todayISO } from '@/lib/format';
import { waToClient } from '@/lib/whatsapp';
import { IconChat } from '@/components/icons';
import type { RequestStatus, ServiceRequest } from '@/types';

const STATUS: Record<RequestStatus, { label: string; tone: string }> = {
  new: { label: 'Novo', tone: 'rose' }, contacted: { label: 'Em contato', tone: 'amber' }, scheduled: { label: 'Virou tarefa', tone: 'green' },
  done: { label: 'Finalizado', tone: 'slate' }, discarded: { label: 'Descartado', tone: 'slate' },
};

type Filter = 'open' | 'scheduled' | 'discarded' | 'all';

export default function RequestsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('open');
  const { data, loading, error, reload } = useAsync(() => listRequests(filter === 'all' ? undefined : (filter as any)), [filter]);
  const { data: techs } = useAsync(() => listTechnicians(), []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tech, setTech] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const changeStatus = async (r: ServiceRequest, s: RequestStatus) => {
    try { await setRequestStatus(r.id, s); toast('Pedido atualizado.'); reload(); } catch (e) { toast(friendlyError(e), 'error'); }
  };

  const makeTask = async (r: ServiceRequest) => {
    setBusy(true); setErr('');
    try {
      const res = await createTaskFromRequest(r.id, tech || null, date || r.preferred_date);
      toast(`Tarefa ${res.order_number} criada.`);
      router.push(`/dashboard/tasks/${res.task_id}`);
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  };

  const list = data || [];
  return (
    <>
      <PageHeader title="Pedidos" subtitle="Pedidos que chegaram pela Assistência do site" />
      <div className="mb-4 overflow-x-auto"><Segmented value={filter} onChange={setFilter} options={[
        { value: 'open', label: 'Abertos' }, { value: 'scheduled', label: 'Viraram tarefa' }, { value: 'discarded', label: 'Descartados' }, { value: 'all', label: 'Todos' }]} /></div>
      <ErrorBox text={error} />
      {loading ? <Loading /> : list.length === 0 ? <Empty text="Nenhum pedido aqui." /> : (
        <ul className="space-y-3">
          {list.map((r) => {
            const open = openId === r.id;
            const wa = waToClient(r.phone, `Olá ${r.name.split(' ')[0]}! Recebemos seu pedido #${r.request_number} de ${r.kind === 'installation' ? 'instalação' : 'manutenção'}.`);
            return (
              <li key={r.id} className="card p-4" data-testid="request-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-brand-800">#{r.request_number}</span>
                  <Badge tone={r.kind === 'installation' ? 'blue' : 'amber'}>{r.kind === 'installation' ? 'Instalação' : 'Manutenção'}</Badge>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  {r.urgency === 'high' && <Badge tone="rose">Urgente</Badge>}
                  <span className="ml-auto text-xs text-slate-400">{formatDateTime(r.created_at)}</span>
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-900">{r.name}</p>
                <p className="text-sm text-slate-500">{formatPhone(r.phone)} · {r.address}{r.city ? ` · ${r.city}` : ''}</p>
                {r.client_code && <p className="text-xs text-slate-400">Informou o código <span className="font-mono">{r.client_code}</span></p>}
                {r.items.length > 0 && <p className="mt-1 text-sm text-slate-600">Aparelhos: {r.items.map(applianceLabel).join(' · ')}</p>}
                {r.problem && <p className="mt-1 text-sm text-slate-600">Problema: {r.problem}</p>}
                {r.message && <p className="mt-1 text-sm text-slate-600">Obs.: {r.message}</p>}
                {r.preferred_date && <p className="mt-1 text-sm text-slate-600">Data desejada: {formatDate(r.preferred_date)}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost border border-slate-200 text-sm"><IconChat className="h-4 w-4" /> WhatsApp</a>}
                  {!r.task_id && r.status !== 'discarded' && <button onClick={() => { setOpenId(open ? null : r.id); setDate(r.preferred_date || ''); setTech(''); setErr(''); }} className="btn-primary text-sm" data-testid="btn-make-task">Criar tarefa</button>}
                  {r.task_id && <a href={`/dashboard/tasks/${r.task_id}`} className="btn-ghost border border-slate-200 text-sm">Abrir tarefa</a>}
                  {r.status === 'new' && <button onClick={() => changeStatus(r, 'contacted')} className="btn-ghost text-sm">Marcar em contato</button>}
                  {r.status !== 'discarded' && !r.task_id && <button onClick={() => changeStatus(r, 'discarded')} className="btn-ghost text-sm text-rose-600">Descartar</button>}
                  {r.status === 'discarded' && <button onClick={() => changeStatus(r, 'new')} className="btn-ghost text-sm">Reabrir pedido</button>}
                </div>

                {open && (
                  <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-700">Criar tarefa a partir deste pedido</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Técnico">
                        <select className="input" value={tech} onChange={(e) => setTech(e.target.value)} aria-label="Técnico">
                          <option value="">Escolher depois</option>
                          {(techs || []).filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Data agendada"><input className="input" type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                    </div>
                    <ErrorBox text={err} />
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost" onClick={() => setOpenId(null)}>Cancelar</button>
                      <button className="btn-primary" disabled={busy} onClick={() => makeTask(r)} data-testid="btn-confirm-task">{busy ? 'Criando...' : 'Criar tarefa'}</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
