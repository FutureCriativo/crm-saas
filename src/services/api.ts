import { supabase } from '@/lib/supabase';

// Chamada às rotas do nosso servidor (/api/...) levando o token de login. O servidor confere quem é e se é gestor.
export async function authedFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* resposta vazia */ }
  if (!res.ok) throw new Error(body?.error || 'Não foi possível concluir. Tente novamente.');
  return body as T;
}
