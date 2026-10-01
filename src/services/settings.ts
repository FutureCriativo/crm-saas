import { supabase } from '@/lib/supabase';
import { COMPANY_SLUG } from '@/lib/config';
import type { ApplianceModel, CatalogModel, CompanySettings, PublicSettings } from '@/types';

export async function getPublicSettings(): Promise<PublicSettings | null> {
  const { data } = await supabase.rpc('get_public_settings', { p_slug: COMPANY_SLUG });
  return (data as PublicSettings) ?? null;
}

export async function getPublicCatalog(): Promise<CatalogModel[]> {
  const { data } = await supabase.rpc('get_public_catalog', { p_slug: COMPANY_SLUG });
  return (data as CatalogModel[]) ?? [];
}

export async function getSettings(): Promise<CompanySettings | null> {
  const { data } = await supabase.from('company_settings').select('*').maybeSingle();
  return (data as CompanySettings) ?? null;
}

export async function updateSettings(companyId: string, patch: Partial<Omit<CompanySettings, 'company_id'>>) {
  const { error } = await supabase.from('company_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('company_id', companyId);
  if (error) throw error;
}

export async function listModels(): Promise<ApplianceModel[]> {
  const { data, error } = await supabase.from('appliance_models').select('id, brand, line, sort, active').order('sort').order('brand');
  if (error) throw error;
  return (data as ApplianceModel[]) || [];
}

export async function addModel(companyId: string, brand: string, line: string, sort: number) {
  const { error } = await supabase.from('appliance_models').insert({ company_id: companyId, brand: brand.trim(), line: line.trim(), sort });
  if (error) throw error;
}

export async function setModelActive(id: string, active: boolean) {
  const { error } = await supabase.from('appliance_models').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteModel(id: string) {
  const { error } = await supabase.from('appliance_models').delete().eq('id', id);
  if (error) throw error;
}
