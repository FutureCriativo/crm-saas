import { supabase } from '@/lib/supabase';
import type { ItemInput, RequestKind, ServiceTask, TaskStatus } from '@/types';

const LIST_COLS = 'id, order_number, kind, status, client_id, assigned_to, address, scheduled_date, done_on, warranty_expires_at, created_at, clients (id, name, phone, address, client_code), task_items (id, brand, model, btus, position)';

export async function listTasks(opts: { status?: TaskStatus; assignedTo?: string; clientId?: string } = {}): Promise<ServiceTask[]> {
  let q = supabase.from('service_tasks').select(LIST_COLS).limit(300);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.assignedTo) q = q.eq('assigned_to', opts.assignedTo);
  if (opts.clientId) q = q.eq('client_id', opts.clientId);
  q = opts.status === 'done' ? q.order('done_on', { ascending: false, nullsFirst: false }) : q.order('scheduled_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return (data as any[]) || [];
}

export async function getTask(id: string): Promise<ServiceTask | null> {
  const { data, error } = await supabase
    .from('service_tasks')
    .select('*, clients (id, name, phone, address, client_code), task_items (id, brand, model, btus, serial_number, location, position)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (data?.task_items) data.task_items.sort((a: any, b: any) => a.position - b.position);
  return (data as any) ?? null;
}

export type NewTaskInput = {
  clientId: string; kind: RequestKind; assignedTo: string | null; date: string | null;
  address: string; problem: string; notes: string; items: ItemInput[];
};

export async function createTask(i: NewTaskInput): Promise<{ id: string; order_number: string }> {
  const { data, error } = await supabase.rpc('create_task', {
    p_client: i.clientId, p_kind: i.kind, p_assigned: i.assignedTo || null, p_date: i.date || null,
    p_address: i.address, p_problem: i.problem, p_notes: i.notes, p_items: i.items,
  });
  if (error) throw error;
  return data as { id: string; order_number: string };
}

// Salva campos + aparelhos + (concluir | reabrir) numa operação só
export async function saveTask(id: string, fields: Record<string, any>, items: ItemInput[] | null, status: TaskStatus | null) {
  const { data, error } = await supabase.rpc('save_task', { p_task: id, p_fields: fields, p_items: items, p_status: status });
  if (error) throw error;
  return data as { id: string; status: TaskStatus; warranty_expires_at: string | null };
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('service_tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function taskCounters() {
  const today = new Date();
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const t0 = iso(today);
  const in30 = iso(new Date(today.getTime() + 30 * 86400000));
  const head = { count: 'exact' as const, head: true };
  const base = () => supabase.from('service_tasks').select('*', head);
  const [pending, active, expiring, expired] = await Promise.all([
    base().eq('status', 'pending'),
    base().eq('status', 'done').eq('kind', 'installation').gte('warranty_expires_at', t0),
    base().eq('status', 'done').eq('kind', 'installation').gte('warranty_expires_at', t0).lt('warranty_expires_at', in30),
    base().eq('status', 'done').eq('kind', 'installation').lt('warranty_expires_at', t0),
  ]);
  return { pending: pending.count || 0, active: active.count || 0, expiring: expiring.count || 0, expired: expired.count || 0 };
}
