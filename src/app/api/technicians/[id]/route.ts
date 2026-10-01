import { requireOwner } from '@/server/auth';
import { fail, ok, readJson, ApiError } from '@/server/http';
import { technicianPatchSchema } from '@/lib/validation';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Gestor redefine a senha ou ativa/desativa um técnico DA EMPRESA DELE
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin, companyId } = await requireOwner(req);
    const id = z.string().uuid('Técnico inválido.').parse((await params).id);
    const input = technicianPatchSchema.parse(await readJson(req));

    const { data: target } = await admin.from('users').select('id, role, company_id').eq('id', id).maybeSingle();
    if (!target || target.company_id !== companyId || target.role !== 'technician') throw new ApiError(404, 'Técnico não encontrado.');

    if (input.action === 'reset_password') {
      const { error } = await admin.auth.admin.updateUserById(id, { password: input.password });
      if (error) throw new ApiError(400, 'Senha recusada pelo sistema. Tente outra.');
      return ok({ ok: true });
    }

    // Desativar: bloqueia o login E tira o acesso aos dados (users.active = false)
    const { error: e1 } = await admin.from('users').update({ active: input.active }).eq('id', id).eq('company_id', companyId);
    if (e1) throw new ApiError(500, 'Não foi possível alterar o técnico.');
    const { error: e2 } = await admin.auth.admin.updateUserById(id, { ban_duration: input.active ? 'none' : '876000h' });
    if (e2) throw new ApiError(502, 'Acesso dos dados foi alterado, mas o bloqueio de login falhou. Tente de novo.');
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
