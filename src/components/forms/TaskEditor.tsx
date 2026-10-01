'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/components/ui/Toast';
import { getTask, saveTask, deleteTask } from '@/services/tasks';
import { listModels } from '@/services/settings';
import { listTechnicians } from '@/services/technicians';
import { friendlyError } from '@/lib/errors';
import { applianceLabel, formatDate, formatDateTime, formatPhone, todayISO } from '@/lib/format';
import { waToClient } from '@/lib/whatsapp';
import { Badge, ErrorBox, Field, Loading, Modal, WarrantyBadge } from '../ui';
import { warrantyStatus } from '@/lib/format';
import { IconChat, IconMap, IconPhone, IconTrash } from '../icons';
import ItemsEditor, { ItemDraft, fromTaskItems, newItem, toPayload } from './ItemsEditor';
import type { CatalogModel, ServiceTask } from '@/types';

type Props = { taskId: string; role: 'owner' | 'technician'; backHref: string };

// Editor de tarefa (OS): o técnico preenche e conclui; o gestor também ajusta técnico, data e garantia
export default function TaskEditor({ taskId, role, backHref }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const isOwner = role === 'owner';
  const { data: task, loading, error, reload } = useAsync(() => getTask(taskId), [taskId]);
  const { data: models } = useAsync(() => listModels(), []);
  const { data: techs } = useAsync(() => (isOwner ? listTechnicians() : Promise.resolve([])), [isOwner]);
  const catalog: CatalogModel[] = (models || []).filter((m) => m.active);

  const [f, setF] = useState({
    done_on: '', received_by: '', notes: '', diagnosis: '', service_done: '', parts_used: '', amount: '',
    address: '', problem: '', scheduled_date: '', warranty_months: '12', assigned_to: '',
  });
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');

  // Preenche o formulário quando a tarefa (e o catálogo) chegam
  useEffect(() => {
    if (!task || !models) return;
    const key = `${task.id}:${task.status}:${task.warranty_expires_at}:${task.reopened_count}`;
    if (key === loadedKey) return;
    setLoadedKey(key);
    setF({
      done_on: task.done_on || task.scheduled_date || todayISO(), received_by: task.received_by || '', notes: task.notes || '',
      diagnosis: task.diagnosis || '', service_done: task.service_done || '', parts_used: task.parts_used || '',
      amount: task.amount !== null && task.amount !== undefined ? String(task.amount).replace('.', ',') : '',
      address: task.address || task.clients?.address || '', problem: task.problem || '', scheduled_date: task.scheduled_date || '',
      warranty_months: String(task.warranty_months ?? 12), assigned_to: task.assigned_to || '',
    });
    const cat = (models || []).filter((m) => m.active);
    setItems(task.task_items && task.task_items.length ? fromTaskItems(task.task_items, cat) : [newItem()]);
  }, [task, models, loadedKey]);

  if (loading && !task) return <Loading />;
  if (error) return <ErrorBox text={error} />;
  if (!task) return <div className="card p-8 text-center text-slate-500">Tarefa não encontrada ou sem permissão para ver.</div>;

  const isInstall = task.kind === 'installation';
  const done = task.status === 'done';
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const kindLabel = isInstall ? 'Instalação' : 'Manutenção';

  const run = async (status: 'pending' | 'done' | null, okMsg: string) => {
    setFormError('');
    const payloadItems = toPayload(items);
    if (status === 'done' && isInstall && payloadItems.length === 0) return setFormError('Adicione pelo menos um aparelho antes de concluir a instalação.');
    if (status === 'done' && !f.done_on) return setFormError('Informe a data do serviço.');
    const amountNum = f.amount.trim() ? f.amount.replace(/\./g, '').replace(',', '.') : '';
    if (amountNum && isNaN(Number(amountNum))) return setFormError('Valor inválido. Use números, ex.: 150,00');

    const fields: Record<string, any> = { address: f.address, received_by: f.received_by, notes: f.notes, done_on: f.done_on };
    if (!isInstall) Object.assign(fields, { diagnosis: f.diagnosis, service_done: f.service_done, parts_used: f.parts_used, amount: amountNum });
    if (isOwner) Object.assign(fields, { problem: f.problem, scheduled_date: f.scheduled_date, warranty_months: Number(f.warranty_months) || 0, assigned_to: f.assigned_to });
    if (status === 'pending') delete fields.done_on; // reabrir não mexe na data

    setSaving(true);
    try {
      await saveTask(task.id, fields, payloadItems, status);
      toast(okMsg);
      await reload();
    } catch (e) {
      setFormError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try { await deleteTask(task.id); toast('Tarefa removida.'); router.replace(backHref); }
    catch (e) { setConfirmDelete(false); setFormError(friendlyError(e)); }
  };

  const c = task.clients;
  const wa = waToClient(c?.phone, `Olá ${c?.name?.split(' ')[0] || ''}! Sobre a ${kindLabel.toLowerCase()} (OS ${task.order_number}).`);
  const mapUrl = f.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}` : '';

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <Link href={backHref} className="text-sm text-slate-500 hover:text-slate-800">← Voltar</Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-sm font-semibold text-brand-800">OS {task.order_number}</span>
          <Badge tone={isInstall ? 'blue' : 'amber'}>{kindLabel}</Badge>
          <Badge tone={done ? 'green' : 'slate'}>{done ? 'Concluída' : 'Pendente'}</Badge>
          {task.reopened_count > 0 && <Badge tone="rose">Reaberta {task.reopened_count}x</Badge>}
        </div>
        {done && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="done-banner">
            <span>Concluída em {formatDateTime(task.completed_at)}.</span>
            {task.warranty_expires_at ? <><span>Garantia até <b>{formatDate(task.warranty_expires_at)}</b></span><WarrantyBadge status={warrantyStatus(task.warranty_expires_at)} /></> : <span>Sem garantia registrada.</span>}
          </div>
        )}
      </div>

      <section className="card space-y-3 p-5" aria-label="Cliente">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Cliente</h2>
        <div>
          <p className="text-lg font-semibold text-slate-900">{c?.name || '—'}</p>
          {c?.client_code && isOwner && <p className="text-xs text-slate-400">Código <span className="font-mono">{c.client_code}</span></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {c?.phone && <a href={`tel:${c.phone}`} className="btn-ghost border border-slate-200 text-sm"><IconPhone className="h-4 w-4" /> {formatPhone(c.phone)}</a>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost border border-slate-200 text-sm"><IconChat className="h-4 w-4" /> WhatsApp</a>}
          {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost border border-slate-200 text-sm"><IconMap className="h-4 w-4" /> Ver no mapa</a>}
        </div>
        <Field label="Endereço do serviço"><input className="input" value={f.address} onChange={set('address')} maxLength={200} /></Field>
        {task.problem && !isOwner && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Problema informado:</b> {task.problem}</div>}
      </section>

      {isOwner && (
        <section className="card space-y-4 p-5" aria-label="Atribuição">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Atribuição (gestor)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Técnico responsável">
              <select className="input" value={f.assigned_to} onChange={set('assigned_to')} aria-label="Técnico responsável">
                <option value="">Sem técnico por enquanto</option>
                {(techs || []).filter((t) => t.active || t.id === task.assigned_to).map((t) => <option key={t.id} value={t.id}>{t.name}{t.active ? '' : ' (desativado)'}</option>)}
              </select>
            </Field>
            <Field label="Data agendada"><input className="input" type="date" value={f.scheduled_date} onChange={set('scheduled_date')} /></Field>
            <Field label="Garantia (meses)"><input className="input" type="number" min={0} max={120} inputMode="numeric" value={f.warranty_months} onChange={set('warranty_months')} /></Field>
            {!isInstall && <Field label="Problema informado" className="sm:col-span-2"><textarea className="input" rows={2} value={f.problem} onChange={set('problem')} maxLength={1000} /></Field>}
          </div>
        </section>
      )}

      <section className="card space-y-3 p-5" aria-label="Aparelhos">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">{isInstall ? 'Aparelhos instalados' : 'Aparelho atendido'}</h2>
        <ItemsEditor items={items} onChange={setItems} catalog={catalog} detailed max={20} minOne={isInstall} addLabel="+ Aparelho" />
      </section>

      <section className="card space-y-4 p-5" aria-label="Serviço">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Serviço</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isInstall ? 'Data da instalação' : 'Data do serviço'}><input className="input" type="date" value={f.done_on} onChange={set('done_on')} /></Field>
          <Field label="Quem recebeu o serviço"><input className="input" value={f.received_by} onChange={set('received_by')} maxLength={120} placeholder="Nome de quem acompanhou" /></Field>
        </div>
        {!isInstall && (
          <>
            <Field label="Diagnóstico"><textarea className="input" rows={2} value={f.diagnosis} onChange={set('diagnosis')} maxLength={1000} /></Field>
            <Field label="Serviço realizado"><textarea className="input" rows={2} value={f.service_done} onChange={set('service_done')} maxLength={1000} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Peças trocadas"><input className="input" value={f.parts_used} onChange={set('parts_used')} maxLength={500} /></Field>
              <Field label="Valor cobrado (R$)"><input className="input" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0,00" /></Field>
            </div>
          </>
        )}
        <Field label="Observação"><textarea className="input" rows={3} value={f.notes} onChange={set('notes')} maxLength={2000} placeholder="Algo que a equipe precisa saber" /></Field>
      </section>

      <ErrorBox text={formError} />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {isOwner && <button type="button" onClick={() => setConfirmDelete(true)} className="btn-ghost border border-rose-200 text-rose-600 hover:bg-rose-50 sm:mr-auto"><IconTrash className="h-4 w-4" /> Excluir</button>}
        {done ? (
          <>
            <button type="button" disabled={saving} onClick={() => run('pending', 'Tarefa reaberta.')} className="btn-ghost border border-slate-200" data-testid="btn-reopen">Reabrir</button>
            <button type="button" disabled={saving} onClick={() => run(null, 'Alterações salvas.')} className="btn-primary" data-testid="btn-save">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
          </>
        ) : (
          <>
            <button type="button" disabled={saving} onClick={() => run(null, 'Rascunho salvo.')} className="btn-ghost border border-slate-200" data-testid="btn-save">Salvar</button>
            <button type="button" disabled={saving} onClick={() => run('done', `${kindLabel} concluída!`)} className="btn-primary bg-emerald-500 text-white hover:bg-emerald-600" data-testid="btn-complete">
              {saving ? 'Salvando...' : `Concluir ${isInstall ? 'instalação' : 'manutenção'}`}
            </button>
          </>
        )}
      </div>

      {confirmDelete && (
        <Modal title="Excluir esta tarefa?" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-slate-600">A OS {task.order_number} e seus aparelhos serão apagados. Isso não pode ser desfeito.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancelar</button>
            <button className="btn-primary bg-rose-600 text-white hover:bg-rose-700" onClick={remove}>Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
