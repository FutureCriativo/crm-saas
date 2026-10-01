import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Uso (Windows, Mac ou Linux, sem instalar Postgres): veja testes/LEIA-ME.md
const root = process.argv[2] && process.argv[2] !== 'twice' ? process.argv[2] : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv.includes('twice') ? 'twice' : process.argv.includes('no05') ? 'no05' : 'normal';
const withFix05 = mode !== 'no05';
function split(sql) {
  const out = []; let cur = ''; let i = 0; let dollar = null; let inStr = false; let inLine = false;
  while (i < sql.length) {
    const c = sql[i];
    if (inLine) { cur += c; if (c === '\n') inLine = false; i++; continue; }
    if (dollar) { if (sql.startsWith(dollar, i)) { cur += dollar; i += dollar.length; dollar = null; } else { cur += c; i++; } continue; }
    if (inStr) { cur += c; if (c === "'") inStr = false; i++; continue; }
    if (c === '-' && sql[i+1] === '-') { inLine = true; cur += c; i++; continue; }
    if (c === "'") { inStr = true; cur += c; i++; continue; }
    if (c === '$') { const m = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i)); if (m) { dollar = m[0]; cur += m[0]; i += m[0].length; continue; } }
    if (c === ';') { cur += c; out.push(cur); cur = ''; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur);
  return out.filter(s => s.replace(/--.*$/gm, '').trim() !== '');
}
const db = new PGlite();
async function runFile(path, strip = true) {
  let sql = fs.readFileSync(path, 'utf8');
  if (strip) sql = sql.split('\n').filter(l => !l.startsWith(String.fromCharCode(92))).join('\n');
  for (const st of split(sql)) {
    try { await db.exec(st); } catch (e) { console.error('ERRO em', path, '\n', st.slice(0, 300), '\n', e.message); process.exit(1); }
  }
}
const T = root + '/testes/sql/';
await runFile(T + '00_supabase_mock.sql');
await runFile(T + '01_base_schema.sql');
await runFile(T + '03_fix_03.sql');
// dados "antes da v2" (copiados do dbreset.sh)
const reset = fs.readFileSync(T + 'dbreset.sh', 'utf8');
const seed = /<<'SQL'\n([\s\S]*?)\nSQL/.exec(reset)[1];
for (const st of split(seed)) await db.exec(st);
await runFile(root + '/supabase/fix_04_arquitetura_v2.sql');
if (withFix05) { await runFile(root + '/supabase/fix_05_seguranca_extra.sql'); if (mode==='twice') { await runFile(root + '/supabase/fix_04_arquitetura_v2.sql'); await runFile(root + '/supabase/fix_05_seguranca_extra.sql'); } }
await runFile(T + 'sql_tests.sql');
const r = await db.query('SELECT count(*) FILTER (WHERE ok)::int AS passou, count(*) FILTER (WHERE NOT ok)::int AS falhou, count(*)::int AS total FROM t.results');
console.log(r.rows[0]);
const f = await db.query('SELECT n, label, detail FROM t.results WHERE NOT ok ORDER BY n');
console.table(f.rows);
