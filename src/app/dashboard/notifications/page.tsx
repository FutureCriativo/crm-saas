'use client';
import { useState } from 'react';
import { PageHeader, Loading, Empty, Badge, Field, ErrorBox } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { cancelNotification, countSubscriptions, createNotification, dispatchNow, listNotifications } from '@/services/notifications';
import { listClients } from '@/services/clients';
import { getProfile } from '@/lib/profile';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { IconBell } from '@/components/icons';
import type { NotificationAudience, NotificationStatus } from '@/types';

const AUDIENCE: Record<NotificationAudience, string> = {
  all: 'Todos os clientes com avisos ativos', client: 'Um cliente', warranty_expiring: 'Garantia vencendo (próximos 30 dias)', warranty_expired: 'Garantia vencida',
};
const STATUS: Record<NotificationStatus, { label: string; tone: string }> = {
  scheduled: { label: 'Agendada', tone: 'blue' }, sending: { label: 'Enviando', tone: 'amber' }, sent: { label: 'Enviada', tone: 'green' },
  failed: { label: 'Falhou', tone: 'rose' }, cancelled: { label: 'Cancelada', tone: 'slate' },
};
// Modelos prontos: o gestor escolhe, ajusta o texto e envia
const TEMPLATES: { name: string; title: string; body: string; audience: NotificationAudience }[] = [
  { name: 'Hora da manutenção', title: 'Hora da manutenção', body: 'Faça a revisão do seu ar-condicionado e mantenha o aparelho funcionando bem. Fale com a gente!', audience: 'all' },
  { name: 'Garantia vencendo', title: 'Sua garantia está perto de vencer', body: 'Consulte a data da sua garantia e, se precisar, agende uma revisão antes do vencimento.', audience: 'warranty_expiring' },
  { name: 'Garantia vencida', title: 'Que tal uma manutenção preventiva?', body: 'A garantia do seu aparelho venceu. Agende uma revisão preventiva e evite problemas.', audience: 'warranty_expired' },
  { name: 'Higienização', title: 'Higienização com condições especiais', body: 'Ar limpo o ano todo. Chame a gente no WhatsApp e agende a higienização do seu aparelho.', audience: 'all' },
];

export default function NotificationsPage() {
  const { toast } = useToast();
  const { data: list, loading, error, reload } = useAsync(() => listNotifications(), []);
  const { data: clients } = useAsync(() => listClients(), []);
  const { data: subs } = useAsync(() => countSubscriptions(), []);
  const [f, setF] = useState({ title: '', body: '', audience: 'all' as NotificationAudience, clientId: '', when: 'now' as 'now' | 'later', at: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!f.title.trim() || !f.body.trim()) return setFormError('Preencha o título e a mensagem.');
    if (f.audience === 'client' && !f.clientId) return setFormError('Escolha o cliente.');
    if (f.when === 'later' && (!f.at || new Date(f.at).getTime() < Date.now() + 60000)) return setFormError('Escolha uma data e hora no futuro.');
    setSaving(true);
    try {
      const p = await getProfile();
      if (!p) throw new Error('Sessão expirada.');
      const scheduledAt = f.when === 'later' ? new Date(f.at).toISOString() : new Date().toISOString();
      const id = await createNotification(p.company_id, { title: f.title, body: f.body, audience: f.audience, clientId: f.clientId || null, scheduledAt });
      if (f.when === 'now') {
        const r = await dispatchNow(id);
        toast(r.sent > 0 ? `Aviso enviado para ${r.sent} aparelho${r.sent > 1 ? 's' : ''}.` : 'Aviso processado, mas nenhum aparelho recebeu (ninguém com avisos ativos nesse público).');
      } else {
        toast('Aviso agendado.');
      }
      setF({ title: '', body: '', audience: 'all', clientId: '', when: 'now', at: '' });
      reload();
    } catch (err: any) {
      setFormError(err?.message || friendlyError(err));
      reload();
    } finally { setSaving(false); }
  };

  const sendExisting = async (id: string) => {
    try { const r = await dispatchNow(id); toast(`Enviado para ${r.sent} aparelho(s).`); } catch (err: any) { toast(err?.message || 'Falha ao enviar.', 'error'); }
    reload();
  };
  const cancel = async (id: string) => { try { await cancelNotification(id); toast('Aviso cancelado.'); reload(); } catch (err) { toast(friendlyError(err), 'error'); } };

  return (
    <>
      <PageHeader title="Avisos" subtitle="Notificações no celular dos clientes que ativaram os avisos" />
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
        <IconBell className="h-5 w-5 shrink-0" />
        <span><b data-testid="subs-count">{subs ?? 0}</b> aparelho{subs === 1 ? '' : 's'} com avisos ativos. O cliente ativa na tela “Consultar garantia”, usando o código dele.</span>
      </div>

      <form onSubmit={send} className="card mb-6 space-y-4 p-5" aria-label="Novo aviso">
        <div>
          <p className="label">Modelos prontos</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button type="button" key={t.name} onClick={() => setF({ ...f, title: t.title, body: t.body, audience: t.audience })} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-brand-300 hover:bg-brand-50">{t.name}</button>
            ))}
          </div>
        </div>
        <Field label="Título" hint={`${f.title.length}/60`}><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={60} /></Field>
        <Field label="Mensagem" hint={`${f.body.length}/200`}><textarea className="input" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={200} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Para quem">
            <select className="input" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as NotificationAudience })} aria-label="Público">
              {(Object.keys(AUDIENCE) as NotificationAudience[]).map((k) => <option key={k} value={k}>{AUDIENCE[k]}</option>)}
            </select>
          </Field>
          {f.audience === 'client' && (
            <Field label="Cliente">
              <select className="input" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} aria-label="Cliente">
                <option value="">Selecione...</option>
                {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div role="radiogroup" aria-label="Quando enviar" className="inline-flex rounded-xl bg-slate-100 p-1">
            {(['now', 'later'] as const).map((w) => (
              <button type="button" key={w} role="radio" aria-checked={f.when === w} onClick={() => setF({ ...f, when: w })} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${f.when === w ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{w === 'now' ? 'Enviar agora' : 'Agendar'}</button>
            ))}
          </div>
          {f.when === 'later' && <input className="input max-w-xs" type="datetime-local" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} aria-label="Data e hora do envio" />}
        </div>
        <ErrorBox text={formError} />
        <div className="flex justify-end"><button className="btn-primary" disabled={saving} data-testid="btn-send-notification">{saving ? 'Enviando...' : f.when === 'now' ? 'Enviar aviso' : 'Agendar aviso'}</button></div>
      </form>

      <h2 className="mb-3 font-semibold text-slate-900">Histórico</h2>
      <ErrorBox text={error} />
      {loading ? <Loading /> : !list || list.length === 0 ? <Empty text="Nenhum aviso ainda." /> : (
        <ul className="space-y-3">
          {list.map((n) => (
            <li key={n.id} className="card p-4" data-testid="notification-row">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS[n.status].tone}>{STATUS[n.status].label}</Badge>
                <span className="text-xs text-slate-400">{n.status === 'scheduled' ? `para ${formatDateTime(n.scheduled_at)}` : formatDateTime(n.sent_at || n.created_at)}</span>
              </div>
              <p className="mt-2 font-semibold text-slate-900">{n.title}</p>
              <p className="text-sm text-slate-600">{n.body}</p>
              <p className="mt-1 text-xs text-slate-400">Público: {n.audience === 'client' ? `cliente ${n.clients?.name || ''}` : AUDIENCE[n.audience]}{(n.status === 'sent' || n.status === 'failed') && ` · ${n.sent_count} enviado(s), ${n.failed_count} falha(s)`}</p>
              {n.error && <p className="mt-1 text-xs text-rose-600">{n.error}</p>}
              {n.status === 'scheduled' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => sendExisting(n.id)} className="btn-ghost border border-slate-200 text-sm">Enviar agora</button>
                  <button onClick={() => cancel(n.id)} className="btn-ghost text-sm text-rose-600">Cancelar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
