'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Logo from '../Logo';
import { IconLogout } from '../icons';

// Área do técnico: simples, feita para o celular
export default function TechShell({ name, children }: { name: string; children: React.ReactNode }) {
  const router = useRouter();
  const logout = async () => { await supabase.auth.signOut(); router.replace('/'); };
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/tecnico"><Logo /></Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">Olá, {name.split(' ')[0]}</span>
            <button onClick={logout} aria-label="Sair" className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-100"><IconLogout className="h-4 w-4" /> Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">{children}</main>
    </div>
  );
}
