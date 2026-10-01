import { supabase } from '@/lib/supabase';
import type { Client } from '@/types';

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Client[]) || [];
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Client) ?? null;
}

export type ClientInput = { name: string; phone: string; email: string; address: string; city: string; state: string; notes: string };

const clean = (c: ClientInput) => ({
  name: c.name.trim(), phone: c.phone.replace(/\D/g, '') || null, email: c.email.trim() || null, address: c.address.trim() || null,
  city: c.city.trim() || null, state: c.state.trim().toUpperCase() || null, notes: c.notes.trim() || null,
});

export async function createClient(companyId: string, c: ClientInput): Promise<string> {
  const { data, error } = await supabase.from('clients').insert({ ...clean(c), company_id: companyId }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function updateClient(id: string, c: ClientInput) {
  const { error } = await supabase.from('clients').update(clean(c)).eq('id', id);
  if (error) throw error;
}
