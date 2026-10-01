// Endereços, chaves públicas e listas fixas. Tudo que muda de empresa/ambiente fica aqui ou no .env
export const COMPANY_SLUG = (process.env.NEXT_PUBLIC_COMPANY_SLUG || 'ice').toLowerCase();
export const TECH_EMAIL_DOMAIN = (process.env.NEXT_PUBLIC_TECH_EMAIL_DOMAIN || 'example.com').toLowerCase();
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

// Potências (BTUs) mais comuns em split residencial/comercial pequeno
export const BTU_OPTIONS = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000];
