'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getMyCompanyId } from '@/lib/company';
import { todayISO } from '@/lib/format';

const input =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

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
      setError('Seu usuário não está ligado a uma empresa. Rode o fix_02 no Supabase.');
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
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Nova instalação (OS)</h1>
        <Link href="/dashboard/installations" className="text-gray-600 hover:underline">← Voltar</Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Cliente *</label>
          <select className={input} value={form.client_id} onChange={set('client_id')} required>
            <option value="">Selecione...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Link href="/dashboard/clients/new" className="text-sm text-blue-600 hover:underline">
            + Cadastrar cliente novo
          </Link>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Equipamento *</label>
          <input className={input} value={form.machine_type} onChange={set('machine_type')}
            placeholder="Ex: Split 12.000 BTU" required />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Marca</label>
            <input className={input} value={form.machine_brand} onChange={set('machine_brand')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Modelo</label>
            <input className={input} value={form.model} onChange={set('model')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nº de série</label>
            <input className={input} value={form.serial_number} onChange={set('serial_number')} />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Data da instalação *</label>
            <input className={input} type="date" value={form.installation_date}
              onChange={set('installation_date')} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Garantia (meses) *</label>
            <input className={input} type="number" min={0} value={form.warranty_months}
              onChange={set('warranty_months')} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Técnico</label>
            <input className={input} value={form.installed_by} onChange={set('installed_by')} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea className={input} rows={3} value={form.installation_notes}
            onChange={set('installation_notes')} />
        </div>

        {error && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar OS'}
        </button>
      </form>
    </div>
  );
}

export default function NewInstallationPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando...</div>}>
      <NewInstallationForm />
    </Suspense>
  );
}
