/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let supabaseOrigin = '';
try { supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : ''; } catch (e) { /* URL inválida: sem origem extra */ }
const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');

// Política de conteúdo: o navegador só carrega o que o site realmente usa (limita estrago se algum texto malicioso passar)
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`, // Next usa scripts inline para iniciar a página
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${isDev ? ' ws://localhost:* http://localhost:*' : ''}`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// Cabeçalhos de segurança aplicados em todas as páginas
const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },                       // impede o site de ser embutido em outro (clickjacking)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // o service worker precisa sempre ser a versão mais nova
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
};

module.exports = nextConfig;
