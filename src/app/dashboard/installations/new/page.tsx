'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getMyCompanyId } from '@/lib/company';
import { todayISO } from '@/lib/format';
import { PageHeader, Loading } from '@/components/ui';

function NewInstallationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    client_id: params.get('client') || '',
    machine_type: '',
    machine_brand: '',
    model: '',
    serial_number: '',
    installation_date: todayISO(),
    installed_by: '',
    warranty_months: '12',
    installation_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name')
      .order('name')
      .then(({ data }) => setClients(data || []));
  }, []);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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

    // order_number fica vazio: o banco gera sozinho (ex: 2026-0001)
    const { error } = await supabase.from('installations').insert({
      ...form,
      warranty_months: Number(form.warranty_months) || 0,
      warranty_start_date: form.installation_date,
      company_id: companyId,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push('/dashboard/installations');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nova instalação" subtitle="O número da OS é gerado automaticamente" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="card space-y-5 p-5 md:p-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Cliente</h2>
          <div>
            <label className="label">Cliente *</label>
            <select className="input" value={form.client_id} onChange={set('client_id')} required>
              <option value="">Selecione...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Link href="/dashboard/clients/new" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-900">
              + Cadastrar cliente novo
            </Link>
          </div>
        </section>

        <section className="card space-y-5 p-5 md:p-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Equipamento</h2>
          <div>
            <label className="label">Equipamento *</label>
            <input className="input" value={form.machine_type} onChange={set('machine_type')}
              placeholder="Ex: Split 12.000 BTU" required />
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="label">Marca</label>
              <input className="input" value={form.machine_brand} onChange={set('machine_brand')} />
            </div>
            <div>
              <label className="label">Modelo</label>
              <input className="input" value={form.model} onChange={set('model')} />
            </div>
            <div>
              <label className="label">Nº de série</label>
              <input className="input" value={form.serial_number} onChange={set('serial_number')} />
            </div>
          </div>
        </section>

        <section className="card space-y-5 p-5 md:p-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Instalação e garantia</h2>
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="label">Data da instalação *</label>
              <input className="input" type="date" value={form.installation_date}
                onChange={set('installation_date')} required />
            </div>
            <div>
              <label className="label">Garantia (meses) *</label>
              <input className="input" type="number" min={0} inputMode="numeric" value={form.warranty_months}
                onChange={set('warranty_months')} required />
            </div>
            <div>
              <label className="label">Técnico</label>
              <input className="input" value={form.installed_by} onChange={set('installed_by')} />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={3} value={form.installation_notes}
              onChange={set('installation_notes')} />
          </div>
        </section>

        {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
          <Link href="/dashboard/installations" className="btn-ghost">Cancelar</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Salvando...' : 'Salvar OS'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewInstallationPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewInstallationForm />
    </Suspense>
  );
}
