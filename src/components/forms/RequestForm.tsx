'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSettings } from '@/hooks/useSettings';
import { getPublicCatalog } from '@/services/settings';
import { submitRequest } from '@/services/requests';
import { friendlyError } from '@/lib/errors';
import { isPhoneBR } from '@/lib/validation';
import { requestMessage, waLink } from '@/lib/whatsapp';
import { todayISO } from '@/lib/format';
import { Field, ErrorBox } from '../ui';
import { IconCheck, IconChat } from '../icons';
import ItemsEditor, { ItemDraft, newItem, toPayload } from './ItemsEditor';
import type { CatalogModel, RequestKind, Urgency } from '@/types';

const URGENCY: { value: Urgency; label: string }[] = [
  { value: 'low', label: 'Sem pressa' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Urgente' },
];

// Formulário da Assistência (instalação ou manutenção): grava o pedido no banco e abre o WhatsApp
export default function RequestForm({ kind }: { kind: RequestKind }) {
  const { settings } = useSettings();
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [f, setF] = useState({ name: '', phone: '', email: '', address: '', city: '', date: '', message: '', problem: '', urgency: 'normal' as Urgency, code: '' });
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);
  const [trap, setTrap] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ number: number; link: string } | null>(null);
  const isInstall = kind === 'installation';

  useEffect(() => { getPublicCatalog().then(setCatalog).catch(() => {}); }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (trap) { setDone({ number: 0, link: '' }); return; } // robô: finge que enviou
    const payloadItems = toPayload(items);
    if (f.name.trim().length < 2) return setError('Informe seu nome completo.');
    if (!isPhoneBR(f.phone)) return setError('Informe o WhatsApp com DDD. Ex.: (15) 99999-9999');
    if (f.address.trim().length < 5) return setError('Informe o endereço (rua, número e bairro).');
    if (isInstall && payloadItems.length === 0) return setError('Escolha o modelo de pelo menos um aparelho.');
    if (!isInstall && f.problem.trim().length < 3) return setError('Conte qual é o problema.');

    // Abre a janela do WhatsApp JÁ no clique (o navegador só permite assim) e preenche depois de salvar
    const wa = settings?.whatsapp || null;
    const win = wa ? window.open('', '_blank') : null;
    if (win) { try { win.opener = null; } catch { /* ignora */ } }

    setSending(true);
    try {
      const { number } = await submitRequest({
        kind, name: f.name, phone: f.phone, email: f.email, address: f.address, city: f.city, items: payloadItems,
        preferredDate: f.date || undefined, problem: f.problem, urgency: isInstall ? undefined : f.urgency, clientCode: f.code, message: f.message,
      });
      const link = waLink(wa, requestMessage({
        kind, number, name: f.name.trim(), address: f.address.trim(), items: payloadItems, preferredDate: f.date,
        problem: f.problem.trim(), urgency: f.urgency, message: f.message.trim(), code: f.code.trim().toUpperCase(),
      }));
      if (win && link) win.location.href = link; else if (win) win.close();
      setDone({ number, link });
    } catch (err) {
      if (win) win.close();
      setError(friendlyError(err, 'Não foi possível enviar agora. Tente de novo em instantes.'));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center" data-testid="request-done">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><IconCheck className="h-7 w-7" /></span>
        <h2 className="text-xl font-bold text-slate-900">{done.number ? `Pedido #${done.number} registrado!` : 'Pedido enviado!'}</h2>
        {done.link ? (
          <>
            <p className="text-slate-500">Abrimos o WhatsApp para você finalizar com a gente. Se a conversa não abriu, toque no botão abaixo.</p>
            <a href={done.link} target="_blank" rel="noopener noreferrer" className="btn-primary mt-2 w-full max-w-xs bg-emerald-500 text-white hover:bg-emerald-600">
              <IconChat className="h-5 w-5" /> Abrir WhatsApp
            </a>
          </>
        ) : (
          <p className="text-slate-500">Recebemos seu pedido e entraremos em contato em breve pelo número informado.</p>
        )}
        <Link href="/" className="mt-2 text-sm font-medium text-brand-700">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-5 md:p-7" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome completo *"><input className="input" value={f.name} onChange={set('name')} maxLength={120} autoComplete="name" /></Field>
        <Field label="WhatsApp (com DDD) *"><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} maxLength={20} placeholder="(15) 99999-9999" autoComplete="tel" /></Field>
        {isInstall && <Field label="E-mail" hint="Opcional"><input className="input" type="email" value={f.email} onChange={set('email')} maxLength={160} autoComplete="email" /></Field>}
        {!isInstall && <Field label="Código de cliente" hint="Se você já é cliente, informe para agilizar. Opcional."><input className="input uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} maxLength={6} placeholder="Ex.: K7M2QA" autoCapitalize="characters" /></Field>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={isInstall ? 'Endereço da instalação *' : 'Endereço do atendimento *'} className="md:col-span-2"><input className="input" value={f.address} onChange={set('address')} maxLength={200} placeholder="Rua, número, bairro" autoComplete="street-address" /></Field>
        <Field label="Cidade"><input className="input" value={f.city} onChange={set('city')} maxLength={100} /></Field>
      </div>

      <div>
        <p className="label">{isInstall ? 'Aparelhos a instalar *' : 'Aparelho com problema'}</p>
        <ItemsEditor items={items} onChange={setItems} catalog={catalog} max={isInstall ? 10 : 3} minOne addLabel={isInstall ? 'Adicionar outro aparelho' : 'Informar outro aparelho'} />
      </div>

      {!isInstall && (
        <>
          <Field label="Qual é o problema? *"><textarea className="input" rows={3} value={f.problem} onChange={set('problem')} maxLength={1000} placeholder="Ex.: não gela, pinga água, faz barulho..." /></Field>
          <div>
            <p className="label">Urgência</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Urgência">
              {URGENCY.map((u) => (
                <button type="button" key={u.value} role="radio" aria-checked={f.urgency === u.value} onClick={() => setF({ ...f, urgency: u.value })}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${f.urgency === u.value ? 'border-brand-400 bg-brand-100 text-brand-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{u.label}</button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Data desejada" hint="Opcional. Confirmamos a data com você no WhatsApp."><input className="input" type="date" min={todayISO()} value={f.date} onChange={set('date')} /></Field>
        <Field label="Observações"><textarea className="input" rows={2} value={f.message} onChange={set('message')} maxLength={1000} placeholder="Ponto de referência, horário preferido..." /></Field>
      </div>

      {/* Armadilha para robôs: invisível para pessoas */}
      <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" aria-hidden="true" name="website" />

      <ErrorBox text={error} />
      <button type="submit" disabled={sending} className="btn-primary w-full py-3.5 text-base">
        {sending ? 'Enviando...' : isInstall ? 'Enviar pedido e continuar no WhatsApp' : 'Enviar pedido e continuar no WhatsApp'}
      </button>
      <p className="text-center text-xs text-slate-400">Ao enviar, você concorda que usemos seus dados só para atender este pedido. <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline">Saiba mais</a>.</p>
    </form>
  );
}
