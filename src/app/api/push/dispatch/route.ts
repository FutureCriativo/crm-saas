import { requireOwner } from '@/server/auth';
import { fail, ok, readJson, ApiError } from '@/server/http';
import { runDue, assertPushConfigured } from '@/server/push';
import { dispatchSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Gestor manda enviar um aviso agora. O envio usa a chave privada (só existe no servidor).
export async function POST(req: Request) {
  try {
    const { admin, companyId } = await requireOwner(req);
    const { notification_id } = dispatchSchema.parse(await readJson(req));
    assertPushConfigured();

    const { data: n } = await admin.from('notifications').select('id, status, company_id').eq('id', notification_id).maybeSingle();
    if (!n || n.company_id !== companyId) throw new ApiError(404, 'Aviso não encontrado.');
    if (n.status !== 'scheduled') throw new ApiError(409, 'Este aviso já foi enviado ou cancelado.');

    // "enviar agora": deixa o horário vencido (com folga para diferença de relógio) e reivindica só este aviso
    await admin.from('notifications').update({ scheduled_at: new Date(Date.now() - 5000).toISOString() }).eq('id', n.id).eq('status', 'scheduled');
    const r = await runDue(admin, n.id);
    return ok({ sent: r.sent, failed: r.failed });
  } catch (e) {
    return fail(e);
  }
}
