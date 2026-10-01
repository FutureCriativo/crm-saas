import { requireOwner } from '@/server/auth';
import { fail, ok, readJson, ApiError } from '@/server/http';
import { technicianCreateSchema } from '@/lib/validation';
import { techEmail } from '@/lib/tech-login';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Gestor cria técnico (usuário + senha). Precisa da chave de servidor, por isso não roda no navegador.
export async function POST(req: Request) {
  try {
    const { admin, companyId, slug } = await requireOwner(req);
    const input = technicianCreateSchema.parse(await readJson(req));

    const { data: taken } = await admin.from('users').select('id').eq('company_id', companyId).eq('username', input.username).maybeSingle();
    if (taken) throw new ApiError(409, 'Já existe um técnico com este usuário.');

    const email = techEmail(input.username, slug);
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password: input.password, email_confirm: true, user_metadata: { name: input.name, username: input.username, kind: 'technician' },
    });
    if (error || !created.user) {
      const msg = error?.message || '';
      if (/already|registered|exists/i.test(msg)) throw new ApiError(409, 'Já existe um técnico com este usuário.');
      if (/password/i.test(msg)) throw new ApiError(400, 'Senha recusada pelo sistema. Tente uma senha mais longa.');
      if (/email/i.test(msg)) throw new ApiError(502, 'O sistema de login recusou o usuário (e-mail interno). Veja o PROJETO.md: ajuste NEXT_PUBLIC_TECH_EMAIL_DOMAIN.');
      throw new ApiError(502, 'Não foi possível criar o acesso agora.');
    }

    const { error: insertError } = await admin.from('users').insert({
      id: created.user.id, company_id: companyId, email, role: 'technician', name: input.name, username: input.username, active: true,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id); // desfaz para não sobrar login sem perfil
      throw new ApiError(500, 'Não foi possível salvar o técnico.');
    }
    return ok({ id: created.user.id, username: input.username }, 201);
  } catch (e) {
    return fail(e);
  }
}
