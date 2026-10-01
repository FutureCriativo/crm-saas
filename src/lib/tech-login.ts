import { COMPANY_SLUG, TECH_EMAIL_DOMAIN } from './config';

// O técnico entra com USUÁRIO + SENHA. Por trás, o Supabase exige um e-mail: montamos um e-mail interno
// (nunca recebe mensagem de verdade). Login e cadastro usam esta MESMA função.
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export function normalizeUsername(v: string): string {
  return (v || '').trim().toLowerCase();
}

export function techEmail(username: string, slug: string = COMPANY_SLUG, domain: string = TECH_EMAIL_DOMAIN): string {
  return `tec-${normalizeUsername(username)}-${slug}@${domain}`;
}
