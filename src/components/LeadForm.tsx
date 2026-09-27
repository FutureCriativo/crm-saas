'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SITE } from '@/config/site';
import { IconCheck } from './icons';

// Formulário de orçamento: grava na tabela leads (visitante só consegue ENVIAR, não ler)
export default function LeadForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', service: '', message: '' });
  const [trap, setTrap] = useState(''); // campo escondido contra robôs
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trap) { setStatus('done'); return; } // robô: finge que enviou
    const phone = form.phone.replace(/\D/g, '');
    if (phone.length < 10) { setError('Informe um telefone com DDD.'); return; }

    setStatus('sending');
    setError('');
    const { error } = await supabase.from('leads').insert({
      name: form.name.trim().slice(0, 120),
      phone,
      email: form.email.trim().slice(0, 160) || null,
      city: form.city.trim().slice(0, 100) || null,
      service: form.service || null,
      message: form.message.trim().slice(0, 1000) || null,
    });

    if (error) {
      setStatus('error');
      setError('Não foi possível enviar agora. Tente de novo ou fale por e-mail.');
      return;
    }
    setStatus('done');
  };

  if (status === 'done') {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <IconCheck className="h-7 w-7" />
        </span>
        <h3 className="text-xl font-bold text-slate-900">Pedido enviado!</h3>
        <p className="text-slate-500">Entraremos em contato em breve pelo telefone informado.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6 md:p-8">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Nome *</label>
          <input className="input" value={form.name} onChange={set('name')} maxLength={120} required />
        </div>
        <div>
          <label className="label">Telefone / WhatsApp *</label>
          <input className="input" inputMode="tel" value={form.phone} onChange={set('phone')} maxLength={30}
            placeholder="(15) 99999-9999" required />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} maxLength={160} placeholder="opcional" />
        </div>
        <div>
          <label className="label">Cidade</label>
          <input className="input" value={form.city} onChange={set('city')} maxLength={100} />
        </div>
      </div>
      <div>
        <label className="label">Serviço</label>
        <select className="input" value={form.service} onChange={set('service')}>
          <option value="">Selecione...</option>
          {SITE.services.map((s) => <option key={s.title} value={s.title}>{s.title}</option>)}
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div>
        <label className="label">Conte o que precisa</label>
        <textarea className="input" rows={3} value={form.message} onChange={set('message')} maxLength={1000}
          placeholder="Ex.: instalar 2 splits de 12.000 BTU em apartamento" />
      </div>
      {/* Armadilha para robôs: invisível para pessoas */}
      <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)}
        className="hidden" aria-hidden="true" name="website" />

      {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <button type="submit" disabled={status === 'sending'} className="btn-primary w-full py-3">
        {status === 'sending' ? 'Enviando...' : 'Pedir orçamento grátis'}
      </button>
      <p className="text-center text-xs text-slate-400">
        Seus dados são usados só para responder este pedido.
      </p>
    </form>
  );
}
