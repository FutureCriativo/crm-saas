'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate, todayISO } from '@/lib/format';

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email || '');
      const today = todayISO();

      // head: true = só conta, não baixa as linhas
      const [total, active, expired, last] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('installations').select('*', { count: 'exact', head: true })
          .gte('warranty_expires_at', today),
        supabase.from('installations').select('*', { count: 'exact', head: true })
          .lt('warranty_expires_at', today),
        supabase.from('installations')
          .select('id, order_number, machine_type, installation_date, clients (name)')
          .order('installation_date', { ascending: false })
          .limit(5),
      ]);

      setStats({
        total: total.count || 0,
        active: active.count || 0,
        expired: expired.count || 0,
      });
      setRecent(last.data || []);
      setLoading(false);
    };

    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">CRM Serviços</h1>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-sm text-gray-600">{email}</span>
            <button onClick={handleLogout} className="text-red-600 hover:text-red-800 font-medium">
              Sair
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <div className="text-4xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-gray-600 mt-2">Total de clientes</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <div className="text-4xl font-bold text-green-600">{stats.active}</div>
            <div className="text-gray-600 mt-2">Instalações em garantia</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
            <div className="text-4xl font-bold text-red-600">{stats.expired}</div>
            <div className="text-gray-600 mt-2">Garantia vencida</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Ações rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/clients/new"
              className="block p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition">
              <div className="font-bold text-blue-700">+ Novo cliente</div>
              <div className="text-sm text-gray-600">Cadastro rápido</div>
            </Link>
            <Link href="/dashboard/installations/new"
              className="block p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition">
              <div className="font-bold text-green-700">+ Nova instalação</div>
              <div className="text-sm text-gray-600">Gera o número da OS</div>
            </Link>
            <Link href="/dashboard/installations"
              className="block p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition">
              <div className="font-bold text-gray-700">Buscar OS / cliente</div>
              <div className="text-sm text-gray-600">Lista e garantias</div>
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Últimas instalações</h2>
            <Link href="/dashboard/clients" className="text-sm text-blue-600 hover:underline">
              Ver clientes
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-gray-500">Nenhuma instalação ainda.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((r) => (
                <li key={r.id} className="py-3 flex justify-between gap-4">
                  <span>
                    <b className="text-blue-600">{r.order_number}</b> · {r.clients?.name} · {r.machine_type}
                  </span>
                  <span className="text-gray-500 whitespace-nowrap">{formatDate(r.installation_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
