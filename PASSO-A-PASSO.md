# Passo a passo para colocar no ar (nessa ordem)

Tudo que o Claude já conferiu está em **PROJETO.md** ("O que foi testado"). Aqui é só o que **você** faz.

## 0. Antes de tudo: guarde uma cópia dos dados — 5 min
O plano grátis do Supabase não tem backup para baixar. Então:
1. Supabase → **Table Editor**. Para cada tabela `companies`, `users`, `clients`, `installations`: abra → botão **Export** → **CSV**.
2. Guarde os 4 arquivos numa pasta no seu computador (não suba no GitHub).

## 1. Banco (Supabase) — 10 min
1. Supabase → **SQL Editor** → New query.
2. Cole TODO o conteúdo de `supabase/fix_04_arquitetura_v2.sql` → **Run**.
   No fim aparece uma tabela de conferência: `empresas_com_slug = 1`, `funcao_pedidos = true`, `funcao_garantia = true`, `whatsapp_config = 5515996966519`.
   Se `empresas_com_slug = 0`, rode: `update companies set slug='ice' where name ilike '%ice%';` e depois rode o fix_04 de novo.
3. New query de novo. Cole TODO o `supabase/fix_05_seguranca_extra.sql` → **Run**.
   Conferência esperada: `lista_push_ativa = true` e `regras_legado = 3`.
4. Authentication → Sign In / Providers → **desligue "Allow new users to sign up"**.
5. Authentication → senha mínima **8** e, se existir, ligue **"Leaked password protection"**.
6. Settings → API: copie a **URL**, a chave **anon** e a chave **service_role** (guarde; não cole no chat).

Se aparecer erro vermelho em algum Run: **pare e me mande só a mensagem do erro** (não rode o próximo).

## 2. Chaves de aviso — 2 min
1. Dê duplo clique em `gerar-chaves-push.html` (abre no navegador) → **Gerar chaves novas**.
2. Copie cada valor direto para o Netlify (passo 3). Nunca cole no chat.

## 3. Netlify — Site configuration → Environment variables
Cadastre (as 3 secretas marque "Contains secret values"):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_COMPANY_SLUG=ice`, `NEXT_PUBLIC_TECH_EMAIL_DOMAIN=example.com`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `SUPABASE_SERVICE_ROLE_KEY`*, `VAPID_PRIVATE_KEY`*, `VAPID_SUBJECT=mailto:seu@email`, `CRON_SECRET`* (16+ caracteres).

## 4. GitHub — subir o código
1. **Não suba** as pastas `node_modules` e `.next` (o `.gitignore` já cuida disso se você usar o Git).
2. No repo `crm-saas`: **Add file → Upload files**, arraste o CONTEÚDO da pasta `ice-crm-v2` (inclusive `.github`, `public`, `src`, `supabase`) e faça commit.
3. Apague do repo as pastas antigas `src/app/portal` e `src/app/dashboard/installations`, e os arquivos `src/components/LeadForm.tsx`, `src/components/ui.tsx`, `src/components/AppShell.tsx` (substituídos).
4. Repo → Settings → Secrets and variables → Actions: crie `SITE_URL` (https://futurecriativo-crm.netlify.app, sem barra no final) e `CRON_SECRET` (mesmo valor do Netlify).
5. O Netlify publica sozinho. Aguarde o deploy ficar verde.
6. Só depois deixe o repositório público (se quiser). Antes, confira que não há nenhum arquivo `.env` no GitHub.

## 5. Teste de aceite (você, no celular)
1. Abra o site → Assistência → peça uma instalação → o WhatsApp deve abrir com a mensagem.
2. Gestão → Gestor → entre → Pedidos → Criar tarefa.
3. Técnicos → crie um técnico. **Se der erro de "e-mail interno"**, troque `NEXT_PUBLIC_TECH_EMAIL_DOMAIN` no Netlify (ex.: `tec.iceclima.com.br`) e faça novo deploy.
4. Entre como técnico (Gestão → Time Técnico), conclua a instalação.
5. Clientes → copie o código → Assistência → Consultar garantia.
6. Consultar garantia → "Ativar avisos" (iPhone: Compartilhar → Adicionar à Tela de Início antes). Depois: Avisos → enviar.
7. Configurações → envie a logo.
8. Rodapé → **Privacidade**: a página deve abrir com o botão de WhatsApp.

## 6. Avisos agendados (GitHub Actions)
O agendador roda a cada ~5 min, mas o GitHub pode atrasar e **pausa sozinho** se o repositório ficar 60 dias sem nenhuma alteração. Se os avisos agendados pararem: GitHub → Actions → "Avisos agendados" → **Enable workflow**. Na VPS, troque por `cron` (veja PROJETO.md).
