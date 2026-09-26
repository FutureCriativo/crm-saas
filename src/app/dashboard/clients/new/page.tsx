'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getMyCompanyId } from '@/lib/company';
import { PageHeader } from '@/components/ui';

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', city: '', state: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const companyId = await getMyCompanyId();
    if (!companyId) {
      setError('Seu usuário não está ligado a uma empresa. Fale com o administrador.');
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({ ...form, state: form.state.toUpperCase() || null, company_id: companyId })
      .select('id')
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    // Já leva para registrar a instalação desse cliente
    router.push(`/dashboard/installations/new?client=${data.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Novo cliente" subtitle="Depois de salvar, você já registra a instalação" />

      <form onSubmit={handleSubmit} className="card space-y-5 p-5 md:p-7">
        <div>
          <label className="label">Nome *</label>
          <input className="input" value={form.name} onChange={set('name')} placeholder="Nome completo ou empresa" required />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="label">Telefone / WhatsApp</label>
            <input className="input" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="(15) 99999-9999" />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="opcional" />
          </div>
        </div>
        <div>
          <label className="label">Endereço</label>
          <input className="input" value={form.address} onChange={set('address')} placeholder="Rua, número, bairro" />
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <label className="label">Cidade</label>
            <input className="input" value={form.city} onChange={set('city')} />
          </div>
          <div>
            <label className="label">UF</label>
            <input className="input uppercase" value={form.state} onChange={set('state')} maxLength={2} placeholder="SP" />
          </div>
        </div>
        <div>
          <label className="label">Observações</label>
          <textarea className="input" rows={3} value={form.notes} onChange={set('notes')} placeholder="Ponto de referência, horário preferido..." />
        </div>

        {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
          <Link href="/dashboard/clients" className="btn-ghost">Cancelar</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Salvando...' : 'Salvar e registrar instalação'}
          </button>
        </div>
      </form>
    </div>
  );
}
