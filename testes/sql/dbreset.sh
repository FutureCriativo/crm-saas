#!/bin/bash
# Recria o banco de teste do zero: mock do Supabase + schema base + fix_03 (+ dados de exemplo "antes da v2")
P="psql -h /tmp -p 5544 -U postgres -v ON_ERROR_STOP=1 -q"
psql -h /tmp -p 5544 -U postgres -q -c "DROP DATABASE IF EXISTS crm" -c "CREATE DATABASE crm" 2>/dev/null
for f in 00_supabase_mock.sql 01_base_schema.sql 03_fix_03.sql; do $P -d crm -f /home/claude/testrig/$f || exit 1; done
$P -d crm <<'SQL'
-- Estado "antes da v2": empresa de teste + dono + 1 cliente + a OS 2026-0001 do relatório
INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111', 'futurecriativo@zohomail.com');
INSERT INTO companies (id, name, email, service_type) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Empresa Teste', 'futurecriativo@zohomail.com', 'ac');
INSERT INTO users (id, company_id, email, role, name) VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'futurecriativo@zohomail.com', 'owner', 'Matheus');
INSERT INTO clients (id, company_id, name, phone, address, city) VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cliente Antigo', '15988887777', 'Rua A, 10', 'Sorocaba');
INSERT INTO installations (company_id, client_id, machine_type, machine_brand, model, installation_date, installed_by, warranty_months, installation_notes)
 VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Split 12.000 BTU', 'LG', 'Dual', '2026-09-25', 'Paulo', 12, 'Primeira OS de teste');
SQL
echo "banco resetado"
