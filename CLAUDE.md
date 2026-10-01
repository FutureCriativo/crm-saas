# CLAUDE.md — CRM da ICE Multservice (contexto para o Claude Code)

Responda SEMPRE em português do Brasil. O dono (Matheus) não programa: frases curtas, visuais, diretas; detalhe só em passo a passo.

## O que é
CRM/site da ICE Multservice (ar-condicionado, Sorocaba). Next.js 15 (app router) + Tailwind + Supabase (Postgres/Auth) + Netlify. Repo: github.com/FutureCriativo/crm-saas. Site: futurecriativo-crm.netlify.app.

## Regras fixas do Matheus (valem para tudo)
- Nada de construir antes de ele dar o comando; mudanças grandes: proponha, espere OK.
- Fácil de escalar e de migrar para VPS/domínio próprio (nada exclusivo do Netlify; endereços só em .env/config).
- Segurança de dados primeiro: RLS em toda tabela, regras e cálculos no servidor/banco, nunca segredo no chat/GitHub/navegador.
- Ferramentas gratuitas (WhatsApp por link wa.me). Visual premium, cor azul-bebê #89CFF0 (tailwind `brand-*`).
- Só diga "pronto" depois de testar clicando. Relate com honestidade o que foi e não foi testado.

## Mapa do produto
- Menu superior: aba **Gestão** (`/gestao` → Time Técnico | Gestor → `/login?perfil=`) e aba **Assistência** (`/`).
- Assistência (pública): `/assistencia/instalacao`, `/assistencia/manutencao` (grava via RPC `submit_request` e abre WhatsApp), `/consulta` (código de cliente de 6 caracteres → aparelhos e garantia; ativar avisos push).
- Gestor (`/dashboard/*`): início, pedidos, tarefas (OS), clientes (código + enviar por WhatsApp), técnicos (usuário+senha), avisos (push agendado), configurações (nome, WhatsApp, logo, garantia padrão, catálogo de aparelhos).
- Técnico (`/tecnico`): só as tarefas dele; preenche aparelhos, quem recebeu, observação; Concluir / editar / reabrir.

## Estrutura do código
`src/types` tipos · `src/services` chamadas ao banco/API · `src/hooks` (useAsync, useProfile, useSettings) · `src/lib` (config, format, whatsapp, tech-login, validation/zod, errors, image) · `src/components` (ui, layout, forms, features) · `src/app` páginas e rotas · `src/server` SOMENTE servidor (chave service_role, web-push) · `src/app/api/*` rotas (técnicos, push/dispatch, cron/push) · `supabase/` SQL · `testes/`.

## Banco (ler `supabase/fix_04_arquitetura_v2.sql` e depois `fix_05_seguranca_extra.sql`, que SUBSTITUI `service_tasks_guard`, `lookup_warranty` e `save_push_subscription`)
Tabelas novas: company_settings, appliance_models, service_requests, service_tasks (= OS, número ANO-0001), task_items, push_subscriptions, notifications, rate_limits. `users` ganhou `username` e `active`. `clients` ganhou `client_code`. Tabelas antigas (installations, maintenance_*, leads) são LEGADO só-leitura: a OS 2026-0001 foi migrada.
Decisões: técnico = linha em `users` com role `technician` (não há tabela technicians); garantia calculada por trigger ao concluir; técnico só vê tarefas dele (RLS); funções públicas (`submit_request`, `lookup_warranty`, `save_push_subscription`) têm limite de tentativas por IP/telefone.
Técnico entra com usuário+senha: e-mail interno `tec-<usuario>-<slug>@<NEXT_PUBLIC_TECH_EMAIL_DOMAIN>` (nunca recebe e-mail). `src/lib/tech-login.ts` é usado no login E na criação.

## Variáveis de ambiente
Veja `.env.example`. Secretas só no servidor: SUPABASE_SERVICE_ROLE_KEY, VAPID_PRIVATE_KEY, CRON_SECRET. Chaves de push: abrir `gerar-chaves-push.html` no navegador (nada vai para a internet).

## Como rodar
`npm install` → copiar `.env.example` para `.env.local` e preencher → `npm run dev`. Antes de entregar: `npx tsc --noEmit`, `npm run build` e `npm run test:sql` (155 verificações do banco; roda em qualquer computador).

## Pendências conhecidas (não inventar que está pronto)
fix_04/05 ainda não rodados no banco REAL; fluxo clicado no navegador não repetido após Next 15; 2 avisos de audit do postcss embutido no Next; privacidade sem exclusão automática. Antigas: Fotos das visitas (precisa bucket privado com link temporário), envio de push real em aparelho (só testado em modo dry-run), e-mail interno do técnico aceito pelo Supabase real (verificar na 1ª criação), schema base real não versionado, `installations`/`leads` legados a remover depois de validar, backup antes do 1º cliente pagante.
