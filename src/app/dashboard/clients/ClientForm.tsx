'use client';
import { useState } from 'react';
import { Field, ErrorBox } from '@/components/ui';
import type { Client } from '@/types';
import type { ClientInput } from '@/services/clients';
import { friendlyError } from '@/lib/errors';

export default function ClientForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial?: Client | null; submitLabel: string; onSubmit: (c: ClientInput) => Promise<void>; onCancel?: () => void;
}) {
  const [f, setF] = useState<ClientInput>({
    name: initial?.name || '', phone: initial?.phone || '', email: initial?.email || '', address: initial?.address || '',
    city: initial?.city || '', state: initial?.state || '', notes: initial?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof ClientInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (f.name.trim().length < 2) return setError('Informe o nome do cliente.');
    setSaving(true);
    try { await onSubmit(f); } catch (err) { setError(friendlyError(err)); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="card space-y-5 p-5 md:p-7">
      <Field label="Nome *"><input className="input" value={f.name} onChange={set('name')} maxLength={200} placeholder="Nome completo ou empresa" /></Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Telefone / WhatsApp"><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} maxLength={30} placeholder="(15) 99999-9999" /></Field>
        <Field label="E-mail"><input className="input" type="email" value={f.email} onChange={set('email')} maxLength={200} placeholder="opcional" /></Field>
      </div>
      <Field label="Endereço"><input className="input" value={f.address} onChange={set('address')} placeholder="Rua, número, bairro" /></Field>
      <div className="grid grid-cols-3 gap-5">
        <Field label="Cidade" className="col-span-2"><input className="input" value={f.city} onChange={set('city')} maxLength={100} /></Field>
        <Field label="UF"><input className="input uppercase" value={f.state} onChange={set('state')} maxLength={2} placeholder="SP" /></Field>
      </div>
      <Field label="Observações"><textarea className="input" rows={3} value={f.notes} onChange={set('notes')} placeholder="Ponto de referência, horário preferido..." /></Field>
      <ErrorBox text={error} />
      <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
        {onCancel && <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>}
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Salvando...' : submitLabel}</button>
      </div>
    </form>
  );
}
