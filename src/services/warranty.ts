import { supabase } from '@/lib/supabase';
import type { WarrantyLookup } from '@/types';

export async function lookupWarranty(code: string): Promise<WarrantyLookup> {
  const { data, error } = await supabase.rpc('lookup_warranty', { p_code: code });
  if (error) throw error;
  return data as WarrantyLookup;
}
