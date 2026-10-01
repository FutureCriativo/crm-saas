'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader, Loading, Field, ErrorBox } from '@/components/ui';
import ItemsEditor, { ItemDraft, newItem, toPayload } from '@/components/forms/ItemsEditor';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/components/ui/Toast';
import { listClients } from '@/services/clients';
import { listTechnicians } from '@/services/technicians';
import { listModels } from '@/services/settings';
import { createTask } from '@/services/tasks';
import { friendlyError } from '@/lib/errors';
import { todayISO } from '@/lib/format';
import type { RequestKind } from '@/types';

function NewTaskForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const { data: clients } = useAsync(() => listClients(), []);
  const { data: techs } = useAsync(() => listTechnicians(), []);
  const { data: models } = useAsync(() => listModels(), []);
  const [f, setF] = useState({ clientId: params.get('client') || '', kind: 'installation' as RequestKind, tech: '', date: todayISO(), address: '', problem: '', notes: '' });
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Endereço vem do cadastro do cliente (pode editar)
  useEffect(() => {
    const c = (clients || []).find((x) => x.id === f.clientId);
    if (c) setF((p) => ({ ...p, address: c.address || '' }));
  }, [f.clientId, clients]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!f.clientId) return setError('Escolha o cliente.');
    setSaving(true);
    try {
      const r = await createTask({ clientId: f.clientId, kind: f.kind, assignedTo: f.tech || null, date: f.date || null, address: f.address, problem: f.problem, notes: f.notes, items: toPayload(items) });
      toast(`Tarefa ${r.order_number} criada.`);
      router.push(`/dashboard/tasks/${r.id}`);
    } catch (err) { setError(friendlyError(err)); setSaving(false); }
  };

  if (!clients || !techs || !models) return <Loading />;
  const catalog = models.filter((m) => m.active);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nova tarefa" subtitle="Cadastre antes e atribua ao técnico. O número da OS é gerado sozinho." />
      <form onSubmit={submit} className="space-y-5">
        <section className="card space-y-4 p-5">
          <Field label="Cliente *">
            <select className="input" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} aria-label="Cliente">
              <option value="">Selecione...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Link href="/dashboard/clients/new" className="mt-2 inline-block text-sm font-medium text-brand-700">+ Cadastrar cliente novo</Link>
          </Field>
          <div>
            <p className="label">Tipo de serviço</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de serviço">
              {(['installation', 'maintenance'] as RequestKind[]).map((k) => (
                <button type="button" key={k} role="radio" aria-checked={f.kind === k} onClick={() => setF({ ...f, kind: k })}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${f.kind === k ? 'border-brand-400 bg-brand-100 text-brand-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {k === 'installation' ? 'Instalação' : 'Manutenção'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Técnico">
              <select className="input" value={f.tech} onChange={(e) => setF({ ...f, tech: e.target.value })} aria-label="Técnico">
                <option value="">Escolher depois</option>
                {techs.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Data agendada"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <Field label="Endereço do serviço"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={200} /></Field>
          {f.kind === 'maintenance' && <Field label="Problema informado"><textarea className="input" rows={2} value={f.problem} onChange={(e) => setF({ ...f, problem: e.target.value })} maxLength={1000} /></Field>}
          <Field label="Observação para o técnico"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={2000} /></Field>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Aparelhos (opcional agora)</h2>
          <p className="text-sm text-slate-500">O técnico também pode incluir os aparelhos na hora do serviço.</p>
          <ItemsEditor items={items} onChange={setItems} catalog={catalog} max={20} minOne={false} addLabel="+ Aparelho" />
        </section>

        <ErrorBox text={error} />
        <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
          <Link href="/dashboard/tasks" className="btn-ghost">Cancelar</Link>
          <button type="submit" disabled={saving} className="btn-primary" data-testid="btn-create-task">{saving ? 'Criando...' : 'Criar tarefa'}</button>
        </div>
      </form>
    </div>
  );
}

export default function NewTaskPage() {
  return <Suspense fallback={<Loading />}><NewTaskForm /></Suspense>;
}
