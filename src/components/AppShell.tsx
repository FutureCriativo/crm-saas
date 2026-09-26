'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Logo from './Logo';
import { IconHome, IconUsers, IconWrench, IconPlus, IconLogout } from './icons';

const NAV = [
  { href: '/dashboard', label: 'Início', icon: IconHome },
  { href: '/dashboard/clients', label: 'Clientes', icon: IconUsers },
  { href: '/dashboard/installations', label: 'Instalações', icon: IconWrench },
];

function isActive(path: string, href: string) {
  if (href === '/dashboard') return path === '/dashboard';
  return path === href || path.startsWith(href + '/');
}

export default function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname() || '';
  const router = useRouter();

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen md:flex">
      {/* Menu lateral (computador) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 md:flex">
        <div className="px-2"><Logo /></div>

        <Link href="/dashboard/installations/new" className="btn-primary mt-8 w-full">
          <IconPlus className="h-5 w-5" /> Nova OS
        </Link>

        <nav className="mt-6 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active ? 'bg-brand-100 font-semibold text-brand-900' : 'text-slate-600 hover:bg-slate-100'
                }`}>
                <Icon className={`h-5 w-5 ${active ? 'text-brand-700' : 'text-slate-400'}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl bg-slate-50 p-3">
          <p className="truncate text-xs text-slate-500">Conectado como</p>
          <p className="truncate text-sm font-medium text-slate-800">{email}</p>
          <button onClick={logout} className="mt-2 flex items-center gap-2 text-sm font-medium text-rose-600 hover:text-rose-700">
            <IconLogout className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Topo (celular) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <button onClick={logout} aria-label="Sair" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <IconLogout className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 items-end">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? 'font-semibold text-brand-700' : 'text-slate-500'}`}>
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            );
          })}
          <Link href="/dashboard/installations/new" className="flex flex-col items-center gap-1 py-2 text-[11px] font-semibold text-brand-800">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-300 text-brand-900 shadow-md">
              <IconPlus className="h-6 w-6" />
            </span>
            Nova OS
          </Link>
        </div>
      </nav>
    </div>
  );
}
