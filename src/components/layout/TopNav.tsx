'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '../Logo';

const GESTAO_PATHS = ['/gestao', '/login', '/dashboard', '/tecnico'];

// Menu superior do site: aba Gestão (time técnico e gestor) e aba Assistência (cliente)
export default function TopNav() {
  const path = usePathname() || '/';
  const inGestao = GESTAO_PATHS.some((p) => path === p || path.startsWith(p + '/'));
  const tab = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? 'bg-brand-300 text-brand-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" aria-label="Página inicial" className="min-w-0"><Logo /></Link>
        <nav className="flex shrink-0 items-center gap-1" aria-label="Menu principal">
          <Link href="/gestao" className={tab(inGestao)} aria-current={inGestao ? 'page' : undefined}>Gestão</Link>
          <Link href="/" className={tab(!inGestao)} aria-current={!inGestao ? 'page' : undefined}>Assistência</Link>
        </nav>
      </div>
    </header>
  );
}
