'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AppShell from '@/components/AppShell';
import Logo from '@/components/Logo';

// Protege todas as telas /dashboard: sem login, volta para /login.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login');
      else setEmail(data.session.user.email || '');
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
