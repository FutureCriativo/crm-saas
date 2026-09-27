'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Logo from '@/components/Logo';
import { getProfile, isStaff } from '@/lib/profile';

// Painel do gestor: só dono e técnico. Cliente vai para /portal; sem login, volta para /login.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then((p) => {
      if (!p) router.replace('/login?perfil=gestor');
      else if (!isStaff(p)) router.replace('/portal');
      else setEmail(p.email);
    });
  }, [router]);

  if (email === null) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse"><Logo /></div>
      </div>
    );
  }

  return <AppShell email={email}>{children}</AppShell>;
}
