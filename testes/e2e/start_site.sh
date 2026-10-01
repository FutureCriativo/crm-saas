#!/bin/bash
# Build + start do site apontando para o mini-Supabase de teste
cd /home/claude/crm-saas
pkill -f "next start" 2>/dev/null; pkill -f "next-server" 2>/dev/null; sleep 1
E=/home/claude/testrig/test.env.json
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:8080
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(node -p "require('$E').ANON")
export NEXT_PUBLIC_VAPID_PUBLIC_KEY=$(node -p "require('$E').VAPID_PUBLIC")
export NEXT_PUBLIC_COMPANY_SLUG=ice
export NEXT_PUBLIC_TECH_EMAIL_DOMAIN=example.com
[ "$1" = "nobuild" ] || npm run build > /tmp/build.log 2>&1 || { tail -30 /tmp/build.log; echo "BUILD FALHOU"; exit 1; }
export SUPABASE_SERVICE_ROLE_KEY=$(node -p "require('$E').SERVICE")
export VAPID_PRIVATE_KEY=$(node -p "require('$E').VAPID_PRIVATE")
export VAPID_SUBJECT=mailto:teste@example.com
export CRON_SECRET=$(node -p "require('$E').CRON_SECRET")
export PUSH_TRANSPORT=dry-run
export PUSH_DRY_RUN_FILE=/tmp/push-dry-run.log
: > /tmp/push-dry-run.log
setsid nohup npx next start -p 3000 -H 127.0.0.1 > /tmp/site.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "site: %{http_code}\n" http://127.0.0.1:3000/
