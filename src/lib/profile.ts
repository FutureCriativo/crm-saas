import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

// Lê o perfil (papel + empresa) de quem está logado. null = sem login, sem acesso liberado ou desativado.
export async function getProfile(): Promise<Profile | null> {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('id, email, role, company_id, name, username, active')
    .eq('id', user.id)
    .maybeSingle();

  const p = data as Profile | null;
  if (!p || !p.active || (p.role !== 'owner' && p.role !== 'technician')) return null;
  return p;
}

// Para onde cada perfil vai depois do login
export const homeFor = (p: Profile | null) => (!p ? '/login' : p.role === 'owner' ? '/dashboard' : '/tecnico');
