'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';
import { getProfile, isStaff } from '@/lib/profile';
import { IconLogout } from '@/components/icons';

// Área do cliente final: vê só os próprios dados (garantido pelo banco, não pela tela)
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      if (!p) router.replace('/login?perfil=cliente');
      else if (isStaff(p)) router.replace('/dashboard');
      else setReady(true);
    });
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  if (!ready) {
    return <div className="grid min-h-screen place-items-center"><div className="animate-pulse"><Logo /></div></div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/"><Logo /></Link>
          <button onClick={logout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">
            <IconLogout className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
