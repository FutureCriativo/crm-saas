'use client';
import AppShell from '@/components/layout/AppShell';
import Logo from '@/components/Logo';
import { useRequireRole } from '@/hooks/useProfile';

// Painel do gestor (dono). Técnico vai para /tecnico; sem login, volta para /login.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = useRequireRole('owner');
  if (!profile) return <div className="grid min-h-screen place-items-center"><div className="animate-pulse"><Logo /></div></div>;
  return <AppShell email={profile.email}>{children}</AppShell>;
}
