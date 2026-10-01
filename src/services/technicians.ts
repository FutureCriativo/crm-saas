import { supabase } from '@/lib/supabase';
import { authedFetch } from './api';
import type { Technician } from '@/types';

export async function listTechnicians(): Promise<Technician[]> {
  const { data, error } = await supabase.from('users').select('id, name, username, active, email').eq('role', 'technician').order('name');
  if (error) throw error;
  return (data as Technician[]) || [];
}

// Criar/redefinir/ativar técnico exige a chave de servidor: por isso passa pela nossa rota /api
export const createTechnician = (input: { name: string; username: string; password: string }) =>
  authedFetch('/api/technicians', { method: 'POST', body: JSON.stringify(input) });
export const resetTechnicianPassword = (id: string, password: string) =>
  authedFetch(`/api/technicians/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'reset_password', password }) });
export const setTechnicianActive = (id: string, active: boolean) =>
  authedFetch(`/api/technicians/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'set_active', active }) });
