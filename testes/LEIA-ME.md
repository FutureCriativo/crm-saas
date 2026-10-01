# Testes (ambiente de desenvolvimento, Linux)

Não entram no deploy. Servem para repetir a verificação quando mudar o banco ou as telas.

- `sql/rodar_pglite.mjs` — **jeito fácil**: `npm run test:sql` (Windows/Mac/Linux, sem instalar Postgres). Roda o mesmo `sql_tests.sql` com Postgres embutido. `npm run test:sql -- twice` também prova que os scripts rodam 2x.
- `sql/` (jeito antigo, Linux com Postgres) — recria um banco Postgres que imita o Supabase, aplica `supabase/fix_04_arquitetura_v2.sql` e roda 155 verificações de segurança (visitante, gestor, técnicos, técnico desativado, outra empresa).
  O schema base em `01_base_schema.sql` é uma RECONSTRUÇÃO (o schema original não está versionado).
- `e2e/` — sobe PostgREST + login simulado + site e clica o fluxo inteiro com Chrome (Playwright). 60 verificações.
  Os caminhos dentro dos scripts (`/home/claude/...`) foram feitos para o ambiente onde rodaram; ajuste ao usar em outro lugar.
- Push: o envio real NÃO é testado aqui (precisa de navegador com serviço de push de verdade). O modo `PUSH_TRANSPORT=dry-run` testa a lógica.
