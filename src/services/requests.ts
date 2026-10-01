import { supabase } from '@/lib/supabase';
import { COMPANY_SLUG } from '@/lib/config';
import type { ItemInput, RequestKind, RequestStatus, ServiceRequest, Urgency } from '@/types';

export type SubmitRequestInput = {
  kind: RequestKind; name: string; phone: string; email?: string; address: string; city?: string;
  items: ItemInput[]; preferredDate?: string; problem?: string; urgency?: Urgency; clientCode?: string; message?: string;
};

// Única porta de entrada do visitante: a função do banco valida e limita tentativas
export async function submitRequest(i: SubmitRequestInput): Promise<{ number: number }> {
  const { data, error } = await supabase.rpc('submit_request', {
    p_slug: COMPANY_SLUG, p_kind: i.kind, p_name: i.name, p_phone: i.phone, p_email: i.email || null,
    p_address: i.address, p_city: i.city || null, p_items: i.items, p_preferred_date: i.preferredDate || null,
    p_problem: i.problem || null, p_urgency: i.urgency || null, p_client_code: i.clientCode || null, p_message: i.message || null,
  });
  if (error) throw error;
  return data as { number: number };
}

export async function listRequests(status?: RequestStatus | 'open'): Promise<ServiceRequest[]> {
  let q = supabase.from('service_requests').select('*').order('created_at', { ascending: false }).limit(200);
  if (status === 'open') q = q.in('status', ['new', 'contacted']);
  else if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data as ServiceRequest[]) || [];
}

export async function countNewRequests(): Promise<number> {
  const { count } = await supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('status', 'new');
  return count || 0;
}

export async function setRequestStatus(id: string, status: RequestStatus) {
  const { error } = await supabase.from('service_requests').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function createTaskFromRequest(requestId: string, technicianId: string | null, date: string | null) {
  const { data, error } = await supabase.rpc('create_task_from_request', { p_request: requestId, p_assigned: technicianId || null, p_date: date || null });
  if (error) throw error;
  return data as { task_id: string; order_number: string };
}
