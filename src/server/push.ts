import webpush from 'web-push';
import { appendFileSync } from 'fs';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './http';

type Target = { subscription_id: string; endpoint: string; p256dh: string; auth: string };
type Notif = { id: string; title: string; body: string; url: string };
type Outcome = { ok: boolean; gone: boolean };

const isDryRun = () => process.env.PUSH_TRANSPORT === 'dry-run';

let configured = false;
export function assertPushConfigured() {
  if (isDryRun() || configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) throw new ApiError(503, 'Avisos ainda não configurados no servidor (chaves VAPID).');
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

// Só enviamos para serviços de push conhecidos (defesa dupla: o banco também confere). Evita o servidor chamar endereços internos.
const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/;
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.username && !u.password && (u.port === '' || u.port === '443') && PUSH_HOSTS.test(u.hostname);
  } catch {
    return false;
  }
}

// Envio de 1 aparelho. "dry-run" só registra (para testes e desenvolvimento, sem mandar nada de verdade).
async function sendOne(t: Target, payload: string): Promise<Outcome> {
  if (isDryRun()) {
    if (process.env.PUSH_DRY_RUN_FILE) appendFileSync(process.env.PUSH_DRY_RUN_FILE, JSON.stringify({ endpoint: t.endpoint, payload: JSON.parse(payload) }) + '\n');
    if (t.endpoint.includes('/gone')) return { ok: false, gone: true };
    if (t.endpoint.includes('/fail')) return { ok: false, gone: false };
    return { ok: true, gone: false };
  }
  if (!isAllowedPushEndpoint(t.endpoint)) return { ok: false, gone: true }; // endereço estranho: descarta a inscrição
  try {
    await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 60 * 60 * 24 });
    return { ok: true, gone: false };
  } catch (e: any) {
    // 404/410 = o aparelho removeu a permissão: apagamos a inscrição
    return { ok: false, gone: e?.statusCode === 404 || e?.statusCode === 410 };
  }
}

async function processNotification(admin: SupabaseClient, n: Notif) {
  const { data: targets, error } = await admin.rpc('notification_targets', { p_id: n.id });
  if (error) throw new Error('falha ao buscar destinatários');
  const list = (targets as Target[]) || [];
  const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url });

  let sent = 0, failed = 0;
  const dead: string[] = [];
  for (let i = 0; i < list.length; i += 25) {
    const results = await Promise.all(list.slice(i, i + 25).map((t) => sendOne(t, payload)));
    results.forEach((r, idx) => {
      if (r.ok) sent++; else { failed++; if (r.gone) dead.push(list[i + idx].subscription_id); }
    });
  }
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);

  const allFailed = list.length > 0 && sent === 0;
  await admin.from('notifications').update({
    status: allFailed ? 'failed' : 'sent', sent_at: new Date().toISOString(), sent_count: sent, failed_count: failed,
    error: allFailed ? 'Nenhum aparelho recebeu (inscrições inválidas ou serviço de envio indisponível).' : null,
  }).eq('id', n.id);
  return { sent, failed };
}

// Pega as notificações vencidas (ou uma específica) e envia. Cada uma só é processada por uma chamada (reivindicação no banco).
export async function runDue(admin: SupabaseClient, onlyId?: string) {
  assertPushConfigured();
  const { data: claimed, error } = await admin.rpc('claim_notifications', { p_id: onlyId ?? null });
  if (error) throw new ApiError(500, 'Não foi possível iniciar o envio.');
  const list = (claimed as Notif[]) || [];
  let sent = 0, failed = 0;
  for (const n of list) {
    try {
      const r = await processNotification(admin, n);
      sent += r.sent; failed += r.failed;
    } catch (e) {
      await admin.from('notifications').update({ status: 'failed', error: 'Falha ao enviar. Tente de novo.', sent_at: new Date().toISOString() }).eq('id', n.id);
    }
  }
  return { processed: list.length, sent, failed };
}
