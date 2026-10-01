#!/bin/bash
# sobe tudo e roda o teste no MESMO comando (evita os processos morrerem entre comandos)
cd /home/claude/testrig
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata status" >/dev/null 2>&1 || su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -o '-p 5544 -k /tmp' -l /tmp/pg.log start" >/dev/null 2>&1
sleep 1
./start_backend.sh >/dev/null 2>&1
./start_site.sh nobuild >/dev/null 2>&1
for i in 1 2 3 4 5; do curl -s -o /dev/null http://127.0.0.1:8080/rest/v1/ -H "apikey: x" && break; sleep 1; done
timeout 900 python3 ${1:-e2e.py} 2>&1 | grep -v "^  File\|^    \|Traceback"
