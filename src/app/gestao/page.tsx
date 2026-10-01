'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import TopNav from '@/components/layout/TopNav';
import PublicFooter from '@/components/layout/PublicFooter';
import { IconUsers, IconWrench, IconChevron } from '@/components/icons';
import { getProfile, homeFor } from '@/lib/profile';
import type { Profile } from '@/types';

// Aba "Gestão": escolhe Time Técnico ou Gestor
export default function GestaoPage() {
  const [me, setMe] = useState<Profile | null>(null);
  useEffect(() => { getProfile().then(setMe).catch(() => {}); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto max-w-3xl px-4 pt-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Área da equipe</h1>
        <p className="mb-6 mt-2 text-slate-500">Escolha como você vai entrar.</p>

        {me && (
          <Link href={homeFor(me)} className="mb-4 flex items-center justify-between rounded-2xl bg-brand-100 px-5 py-4 font-semibold text-brand-900 hover:bg-brand-200">
            Continuar como {me.name || me.email} <IconChevron className="h-5 w-5" />
          </Link>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/login?perfil=tecnico" className="card group flex flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-300 text-brand-900"><IconWrench className="h-6 w-6" /></span>
            <span className="text-lg font-semibold text-slate-900">Time Técnico</span>
            <span className="flex-1 text-sm text-slate-500">Veja suas tarefas, registre a instalação e conclua o serviço.</span>
            <span className="text-sm font-semibold text-brand-700">Entrar com usuário e senha →</span>
          </Link>
          <Link href="/login?perfil=gestor" className="card group flex flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-300 text-brand-900"><IconUsers className="h-6 w-6" /></span>
            <span className="text-lg font-semibold text-slate-900">Gestor</span>
            <span className="flex-1 text-sm text-slate-500">Pedidos, tarefas, clientes, técnicos, avisos e configurações.</span>
            <span className="text-sm font-semibold text-brand-700">Entrar com e-mail e senha →</span>
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
