import { supabase } from '@/lib/supabase';
import { authedFetch } from './api';
import type { AppNotification, NotificationAudience } from '@/types';

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications').select('*, clients (name)').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data as any[]) || [];
}

export async function createNotification(companyId: string, n: {
  title: string; body: string; audience: NotificationAudience; clientId?: string | null; scheduledAt: string; url?: string;
}): Promise<string> {
  const { data, error } = await supabase.from('notifications').insert({
    company_id: companyId, title: n.title.trim(), body: n.body.trim(), audience: n.audience,
    client_id: n.audience === 'client' ? n.clientId : null, scheduled_at: n.scheduledAt, url: n.url || '/consulta',
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function cancelNotification(id: string) {
  const { error } = await supabase.from('notifications').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}

// Pede ao servidor para enviar agora (o servidor tem a chave privada de envio)
export const dispatchNow = (id: string) =>
  authedFetch<{ sent: number; failed: number }>('/api/push/dispatch', { method: 'POST', body: JSON.stringify({ notification_id: id }) });

export async function countSubscriptions(): Promise<number> {
  const { count } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true });
  return count || 0;
}
