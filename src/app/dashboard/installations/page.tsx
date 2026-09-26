'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { formatDate, warrantyStatus, warrantyLabel } from '@/lib/format';

export default function InstallationsPage() {
  const [installations, setInstallations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInstallations = async () => {
      const { data } = await supabase
        .from('installations')
        .select(`
          id,
          order_number,
          machine_type,
          installation_date,
          warranty_expires_at,
          warranty_status,
          clients (name, phone)
        `)
        .order('created_at', { ascending: false });

      setInstallations(data || []);
      setLoading(false);
    };

    fetchInstallations();
  }, []);

  const filteredInstallations = installations.filter(i =>
    (i.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.clients?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">🔧 Instalações</h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/installations/new"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + Nova OS
          </Link>
          <Link
            href="/dashboard"
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            ← Voltar
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por OS ou cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left font-bold text-gray-700">OS</th>
              <th className="px-6 py-3 text-left font-bold text-gray-700">Cliente</th>
              <th className="px-6 py-3 text-left font-bold text-gray-700">Máquina</th>
              <th className="px-6 py-3 text-left font-bold text-gray-700">Data Instal.</th>
              <th className="px-6 py-3 text-left font-bold text-gray-700">Garantia</th>
              <th className="px-6 py-3 text-left font-bold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredInstallations.map((inst) => (
              <tr key={inst.id} className="border-b hover:bg-gray-50 transition">
                <td className="px-6 py-3 font-bold text-blue-600">{inst.order_number}</td>
                <td className="px-6 py-3 text-gray-800">{inst.clients?.name}</td>
                <td className="px-6 py-3 text-gray-600">{inst.machine_type}</td>
                <td className="px-6 py-3 text-gray-600">
                  {formatDate(inst.installation_date)}
                </td>
                <td className="px-6 py-3 text-gray-600">
                  {formatDate(inst.warranty_expires_at)}
                </td>
                <td className="px-6 py-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${warrantyLabel[warrantyStatus(inst.warranty_expires_at)].css}`}>
                    {warrantyLabel[warrantyStatus(inst.warranty_expires_at)].text}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredInstallations.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhuma instalação encontrada
        </div>
      )}
    </div>
  );
}
