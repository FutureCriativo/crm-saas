'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { countNewRequests } from '@/services/requests';
import Logo from '../Logo';
import { IconHome, IconUsers, IconClipboard, IconInbox, IconBell, IconSettings, IconWrench, IconPlus, IconLogout, IconMore, IconX } from '../icons';

const NAV = [
  { href: '/dashboard', label: 'Início', icon: IconHome },
  { href: '/dashboard/requests', label: 'Pedidos', icon: IconInbox },
  { href: '/dashboard/tasks', label: 'Tarefas', icon: IconClipboard },
  { href: '/dashboard/clients', label: 'Clientes', icon: IconUsers },
  { href: '/dashboard/technicians', label: 'Técnicos', icon: IconWrench },
  { href: '/dashboard/notifications', label: 'Avisos', icon: IconBell },
  { href: '/dashboard/settings', label: 'Configurações', icon: IconSettings },
];
const BOTTOM = NAV.slice(0, 4);

function isActive(path: string, href: string) {
  if (href === '/dashboard') return path === '/dashboard';
  return path === href || path.startsWith(href + '/');
}

// Painel do gestor: menu lateral (computador) e barra inferior (celular)
export default function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname() || '';
  const router = useRouter();
  const [newCount, setNewCount] = useState(0);
  const [more, setMore] = useState(false);

  useEffect(() => { countNewRequests().then(setNewCount).catch(() => {}); }, [path]);
  useEffect(() => { setMore(false); }, [path]);

  const logout = async () => { await supabase.auth.signOut(); router.replace('/'); };
  const dot = (href: string) => href === '/dashboard/requests' && newCount > 0
    ? <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{newCount}</span> : null;

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 md:flex">
        <div className="px-2"><Link href="/"><Logo /></Link></div>
        <Link href="/dashboard/tasks/new" className="btn-primary mt-8 w-full"><IconPlus className="h-5 w-5" /> Nova tarefa</Link>
        <nav className="mt-6 space-y-1" aria-label="Painel do gestor">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-brand-100 font-semibold text-brand-900' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Icon className={`h-5 w-5 ${active ? 'text-brand-700' : 'text-slate-400'}`} />
                {label}
                {dot(href)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl bg-slate-50 p-3">
          <p className="truncate text-xs text-slate-500">Gestor conectado</p>
          <p className="truncate text-sm font-medium text-slate-800">{email}</p>
          <button onClick={logout} className="mt-2 flex items-center gap-2 text-sm font-medium text-rose-600 hover:text-rose-700">
            <IconLogout className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/"><Logo /></Link>
        <button onClick={logout} aria-label="Sair" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><IconLogout className="h-5 w-5" /></button>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {more && (
        <div className="fixed inset-0 z-30 bg-slate-900/30 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-24" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-2"><p className="font-semibold text-slate-900">Mais opções</p>
              <button onClick={() => setMore(false)} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400"><IconX className="h-5 w-5" /></button></div>
            {NAV.slice(4).map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-slate-700 hover:bg-slate-50"><Icon className="h-5 w-5 text-slate-400" /> {label}</Link>
            ))}
            <p className="mt-2 truncate px-3 text-xs text-slate-400">{email}</p>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Painel do gestor">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end">
          {BOTTOM.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? 'font-semibold text-brand-700' : 'text-slate-500'}`}>
                <Icon className="h-6 w-6" />
                {label}
                {href === '/dashboard/requests' && newCount > 0 && <span className="absolute right-4 top-1.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{newCount}</span>}
              </Link>
            );
          })}
          <button onClick={() => setMore(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-slate-500"><IconMore className="h-6 w-6" />Mais</button>
        </div>
      </nav>
    </div>
  );
}
