import { supabase } from '@/lib/supabase';

// Descobre a empresa do usuário logado (tabela users).
export async function getMyCompanyId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', auth.user.id)
    .single();

  return data?.company_id ?? null;
}
