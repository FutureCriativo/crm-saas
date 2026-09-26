'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      setClients(data || []);
      setLoading(false);
    };

    fetchClients();
  }, []);

  const filteredClients = clients.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">👥 Clientes</h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/clients/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Novo cliente
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
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left font-bold text-gray-700">Nome</th>
              <th className="px-6 py-3 text-left font-bold text-gray-700">Telefone</th>
              <th className="px-6 py-3 text-left font-bold text-gray-700">Email</th>
              <th className="px-6 py-3 text-left font-bold text-gray-700">Endereço</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.id} className="border-b hover:bg-gray-50 transition">
                <td className="px-6 py-3 font-medium text-gray-800">{client.name}</td>
                <td className="px-6 py-3 text-gray-600">{client.phone || '-'}</td>
                <td className="px-6 py-3 text-gray-600">{client.email || '-'}</td>
                <td className="px-6 py-3 text-gray-600">{client.address || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhum cliente encontrado
        </div>
      )}
    </div>
  );
}
