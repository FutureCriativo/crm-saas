import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './http';

// Cliente com a chave de SERVIDOR (service_role): ignora as regras de acesso. Use sempre filtrando por empresa.
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ApiError(503, 'Servidor sem configuração (falta SUPABASE_SERVICE_ROLE_KEY).');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
