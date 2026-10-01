# PROJETO — ICE Multservice CRM (v2.1.0)

## Links e IDs
- Site: https://futurecriativo-crm.netlify.app · Repo: github.com/FutureCriativo/crm-saas
- Supabase projeto: `zvdxzjkufypuzkrkbtsu` · Empresa ICE: slug `ice`
- WhatsApp que recebe pedidos: +55 15 99696-6519 (fica em `company_settings.whatsapp`, editável em Configurações)

## Segredos (só o NOME; valores ficam no Netlify/Supabase)
`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` (secretas) · `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_COMPANY_SLUG`, `NEXT_PUBLIC_TECH_EMAIL_DOMAIN`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (públicas), `VAPID_SUBJECT`. Modelo em `.env.example`.

## Decisões
| Decisão | Motivo |
|---|---|
| Tarefa = OS (`service_tasks`), aparelhos em `task_items` | uma visita pode ter vários aparelhos; garantia por OS |
| Técnico é linha de `users` (role `technician`), sem tabela própria | menos peças; RLS já usa `users` |
| Técnico entra com usuário+senha (e-mail interno oculto) | técnico não precisa de e-mail |
| Cliente consulta por CÓDIGO de 6 caracteres, sem login | simples; resposta sem nome/telefone/endereço; limite de tentativas |
| Garantia calculada por trigger ao concluir | nunca aceitar data do navegador |
| Logo guardada como imagem pequena (PNG/JPG/WebP, SVG proibido) no banco | sem depender de storage do Netlify; migra com o dump |
| Push por Web Push (VAPID), grátis | sem serviço pago; agendador = GitHub Actions a cada 5 min |
| WhatsApp por link wa.me | grátis; janela abre no clique, botão de reserva na tela |
| Portal com login de cliente REMOVIDO | substituído pela consulta por código |

## Segurança — checklist
- [x] RLS em todas as tabelas novas; técnico só vê tarefas e clientes dele (testado com 2 técnicos + outra empresa, 138 verificações)
- [x] Visitante (anon) não lê nenhuma tabela; só chama 5 funções públicas com limite de tentativas
- [x] Preço/garantia/OS/status calculados no banco; `users` sem escrita pelo navegador
- [x] Chave `service_role` e VAPID privada só em `src/server` e rotas `/api` (teste confirmou 401 sem login e 403 para técnico)
- [x] Texto do usuário nunca vai em `innerHTML`; CSP e cabeçalhos de segurança no `next.config.js`
- [x] Técnico desativado perde acesso aos dados na hora (mesmo com token antigo) e não consegue entrar
- [ ] Desligar "Allow new users to sign up" no Supabase (Authentication > Providers/Sign In) — **você faz**
- [ ] Senha mínima: Supabase exige 6; técnicos usam 6+. Gestor: usar 8+ e ativar "leaked password protection" se disponível
- [x] LGPD: página `/privacidade` + aviso no formulário; pedido de correção/exclusão por WhatsApp (ainda não existe tela automática de exclusão)
- [x] Push só para serviços conhecidos (FCM, Mozilla, Apple, Windows), no banco e no servidor (evita SSRF)
- [x] Técnico só informa data de conclusão de hoje até 7 dias atrás (a data define a garantia)
- [x] Tabelas antigas (installations etc.): só o gestor lê
- [ ] `npm audit`: sobraram 2 avisos do `postcss` embutido no Next (só afeta o build, que processa o NOSSO CSS). Some ao migrar para Next 16 (mudança grande; fazer depois)
- [ ] Backup planejado antes do 1º cliente pagante
- [ ] Remover credenciais de teste: pasta `testes/` tem senha/JWT de EXEMPLO (não vai para produção; não use em nada real)

## Migrar para VPS / domínio próprio
1. Banco: `pg_dump` do Supabase → restaurar (ou manter Supabase e só mover o site).
2. Site: `npm ci && npm run build && npm start` (Node 20+; usamos 22), atrás de Nginx/Caddy com HTTPS. Nada depende do Netlify.
3. Trocar `NEXT_PUBLIC_SUPABASE_URL` e chaves. Dominio novo: atualizar o `SITE_URL` do GitHub Actions.
4. Agendador de avisos: trocar o GitHub Actions por `cron` da VPS chamando `POST /api/cron/push` com `Authorization: Bearer $CRON_SECRET`.
5. Subdomínio sugerido: `app.` (gestão/técnico) e raiz (Assistência) — mesmo código.
(Ver a VPS Contabo já contratada pelo Matheus.)

## Changelog
- **v2.1.0** — `supabase/fix_05_seguranca_extra.sql` (lista de push, consulta sem trava global, data do técnico limitada, legado só do gestor); página de privacidade; Next.js 14 → 15.5.27 (corrige falhas críticas/altas do Next 14); `AppShell` antigo removido; Node 22 no Netlify; teste SQL roda em qualquer computador (`npm run test:sql`).
- **v2.0.0** — Menu Gestão/Assistência; pedidos de instalação/manutenção → banco + WhatsApp; consulta de garantia por código; tarefas/OS com vários aparelhos; área do técnico; técnicos com usuário+senha; avisos push (agendados); configurações (logo, WhatsApp, garantia, catálogo); PWA instalável; migração da OS 2026-0001; CSP.
- v1.x — site + login + clientes + instalações (substituídos).

## Legado a remover depois de validar
`installations`, `maintenance_requests`, `maintenance_records`, `leads`, views `clients_with_warranty`/`upcoming_warranty_expirations`, coluna `clients.user_id` e regras `clients_self` (já removidas as regras de clients/users).

## O que foi testado (honesto)
- SQL: 155/155 (Postgres embutido/PGlite imitando o Supabase; schema base RECONSTRUÍDO, não o real). fix_04 e fix_05 rodam 2x sem quebrar. Rode: `npm run test:sql`.
- v2.1.0: `tsc` limpo, `npm run build` ok (Next 15.5.27), site de produção subiu e as rotas responderam certo (200/404), APIs sem login deram 401, cabeçalhos de segurança presentes. O fluxo clicado no Chrome (60 verificações) foi feito na v2.0.0 e **não foi repetido** depois da troca do Next.
- Site: `tsc` limpo e `npm run build` ok. Fluxo completo clicado no Chrome (celular 390x844 + painel no desktop), 60/60: pedido→WhatsApp, gestor, técnico, concluir/reabrir, garantia, brute-force, logo, catálogo, avisos, desativar técnico, redefinir senha. Sem erro de JavaScript.
- Chaves VAPID: gerador validado com a biblioteca web-push.
## O que NÃO foi testado / falta
- fix_04/fix_05 no banco REAL do Supabase (os testes usam uma reconstrução do schema). Por isso o passo 0 (copiar os dados) do PASSO-A-PASSO.
- Fluxo clicado no navegador depois da troca para Next 15 (refazer o teste de aceite do PASSO-A-PASSO no celular).
- Login real do Supabase (testado com login simulado): principalmente **aceitar o e-mail interno do técnico** (`example.com`). Se recusar na 1ª criação, troque `NEXT_PUBLIC_TECH_EMAIL_DOMAIN`.
- Push real em celular (inscrever, receber, tocar): sandbox sem serviço de push. Lógica testada em modo dry-run.
- iPhone (exige instalar na tela inicial), Windows (`INICIAR.bat`), deploy no Netlify.
- Fotos das visitas (Fase 2: bucket privado + link temporário).
- Pendências antigas do relatório de 25/09: "Make public" no repo/Netlify, login do pai, teste com 3–5 clientes.
