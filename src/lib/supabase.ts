import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sem-chave';

// Chave "anon" é pública por natureza: quem protege os dados é o banco (RLS), não o segredo da chave.
export const supabase = createClient(supabaseUrl, supabaseKey);
