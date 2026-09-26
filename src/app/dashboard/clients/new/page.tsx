'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getMyCompanyId } from '@/lib/company';

const input =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

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
      setError('Seu usuário não está ligado a uma empresa. Rode o fix_02 no Supabase.');
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
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Novo cliente</h1>
        <Link href="/dashboard/clients" className="text-gray-600 hover:underline">← Voltar</Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome *</label>
          <input className={input} value={form.name} onChange={set('name')} required />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Telefone / WhatsApp</label>
            <input className={input} value={form.phone} onChange={set('phone')} placeholder="(15) 99999-9999" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-mail</label>
            <input className={input} type="email" value={form.email} onChange={set('email')} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Endereço</label>
          <input className={input} value={form.address} onChange={set('address')} placeholder="Rua, número, bairro" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Cidade</label>
            <input className={input} value={form.city} onChange={set('city')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">UF</label>
            <input className={input} value={form.state} onChange={set('state')} maxLength={2} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea className={input} rows={3} value={form.notes} onChange={set('notes')} />
        </div>

        {error && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar e registrar instalação'}
        </button>
      </form>
    </div>
  );
}
