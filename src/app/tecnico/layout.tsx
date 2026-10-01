'use client';
import TechShell from '@/components/layout/TechShell';
import Logo from '@/components/Logo';
import { useRequireRole } from '@/hooks/useProfile';

export default function TecnicoLayout({ children }: { children: React.ReactNode }) {
  const profile = useRequireRole('technician');
  if (!profile) return <div className="grid min-h-screen place-items-center"><div className="animate-pulse"><Logo /></div></div>;
  return <TechShell name={profile.name || profile.username || 'técnico'}>{children}</TechShell>;
}
