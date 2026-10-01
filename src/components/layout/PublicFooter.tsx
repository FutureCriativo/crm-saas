'use client';
import Link from 'next/link';
import Logo from '../Logo';
import { useSettings } from '@/hooks/useSettings';
import { APP_NAME } from '@/lib/brand';
import { IconLock } from '../icons';

export default function PublicFooter() {
  const { settings } = useSettings();
  return (
    <footer className="mt-16 border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 md:flex-row">
        <Logo />
        <p className="flex items-center gap-2 text-center">
          <IconLock className="h-4 w-4" /> Usamos seus dados só para atender seu pedido · © {new Date().getFullYear()} {settings?.business_name || APP_NAME} · <Link href="/privacidade" className="underline hover:text-brand-700">Privacidade</Link>
        </p>
      </div>
    </footer>
  );
}
