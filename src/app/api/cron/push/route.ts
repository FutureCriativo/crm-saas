import { timingSafeEqual } from 'crypto';
import { adminClient } from '@/server/admin';
import { fail, ok, ApiError } from '@/server/http';
import { runDue } from '@/server/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) throw new ApiError(503, 'Agendador não configurado (CRON_SECRET).');
  const header = req.headers.get('authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Chamada por um agendador (GitHub Actions, cron da VPS...) a cada poucos minutos: envia os avisos agendados que já venceram
async function handle(req: Request) {
  try {
    if (!authorized(req)) throw new ApiError(401, 'Não autorizado.');
    return ok(await runDue(adminClient()));
  } catch (e) {
    return fail(e);
  }
}
export const GET = handle;
export const POST = handle;
