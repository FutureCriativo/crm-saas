import { supabase } from '@/lib/supabase';

export type Role = 'owner' | 'technician' | 'client';
export type Profile = { id: string; email: string; role: Role; company_id: string };

// Lê o perfil (papel + empresa) do usuário logado. null = sem login ou sem acesso liberado.
export async function getProfile(): Promise<Profile | null> {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('id, email, role, company_id')
    .eq('id', user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
}

export const isStaff = (p: Profile | null) => !!p && (p.role === 'owner' || p.role === 'technician');

// Para onde cada perfil vai depois do login
export const homeFor = (p: Profile | null) => (p ? (isStaff(p) ? '/dashboard' : '/portal') : '/login');
