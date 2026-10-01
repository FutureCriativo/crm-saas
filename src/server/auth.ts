import { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from './admin';
import { ApiError } from './http';

export type OwnerContext = { admin: SupabaseClient; userId: string; companyId: string; slug: string };

// Confere o token de quem chamou e exige que seja GESTOR ativo. Devolve a empresa dele.
export async function requireOwner(req: Request): Promise<OwnerContext> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new ApiError(401, 'Faça login para continuar.');

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'Sessão inválida. Entre novamente.');

  const { data: profile } = await admin.from('users').select('id, company_id, role, active').eq('id', data.user.id).maybeSingle();
  if (!profile || profile.role !== 'owner' || !profile.active) throw new ApiError(403, 'Apenas o gestor pode fazer isso.');

  const { data: company } = await admin.from('companies').select('slug').eq('id', profile.company_id).maybeSingle();
  if (!company?.slug) throw new ApiError(500, 'Empresa sem endereço curto (slug). Rode o fix_04 no banco.');

  return { admin, userId: profile.id, companyId: profile.company_id, slug: company.slug };
}
