#!/bin/bash
# (re)inicia o mini-Supabase: banco resetado + migração + PostgREST + login simulado + gateway
cd /home/claude/testrig
pkill -f "postgrest pgrst.conf" 2>/dev/null; pkill -f "node servers.js" 2>/dev/null; sleep 1
./dbreset.sh >/dev/null 2>&1
psql -h /tmp -p 5544 -U postgres -d crm -q -v ON_ERROR_STOP=1 -f /home/claude/crm-saas/supabase/fix_04_arquitetura_v2.sql >/dev/null 2>&1 || { echo "MIGRAÇÃO FALHOU"; exit 1; }
# senha do gestor de teste
H=$(node -e "console.log('sha256:'+require('crypto').createHash('sha256').update('Senha@Gestor1').digest('hex'))")
psql -h /tmp -p 5544 -U postgres -d crm -q -c "update auth.users set encrypted_password='$H' where id='11111111-1111-1111-1111-111111111111'"
setsid nohup /tmp/pgrst/postgrest pgrst.conf > /tmp/pgrst.log 2>&1 < /dev/null &
JWT_SECRET=$(node -p "require('./test.env.json').JWT_SECRET") AUTH_LOG=/tmp/auth.log setsid nohup node servers.js > /tmp/servers.log 2>&1 < /dev/null &
sleep 3
curl -s -o /dev/null -w "gateway->postgrest: %{http_code}\n" http://127.0.0.1:8080/rest/v1/ -H "apikey: x"
