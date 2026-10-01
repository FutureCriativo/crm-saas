// Mini "Supabase" local para teste: login simulado (GoTrue) + porta de entrada que encaminha /rest/v1 -> PostgREST real e /auth/v1 -> login simulado
const http = require('http'), crypto = require('crypto'), { Pool } = require('pg');
const SECRET = process.env.JWT_SECRET;
const pool = new Pool({ host: '/tmp', port: 5544, user: 'postgres', database: 'crm' });
const b64u = (b) => Buffer.from(b).toString('base64url');
const sign = (p) => { const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), b = b64u(JSON.stringify(p)); return `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`; };
const verify = (t) => { try { const [h, b, s] = t.split('.'); if (crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url') !== s) return null; const p = JSON.parse(Buffer.from(b, 'base64url')); if (p.exp && p.exp < Date.now() / 1000) return null; return p; } catch { return null; } };
const hash = (pw) => 'sha256:' + crypto.createHash('sha256').update(pw).digest('hex');
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, created_at: u.created_at });
const session = (u) => { const exp = Math.floor(Date.now() / 1000) + 3600; return { access_token: sign({ aud: 'authenticated', exp, sub: u.id, email: u.email, role: 'authenticated', session_id: crypto.randomUUID() }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `rt.${u.id}.${crypto.randomBytes(6).toString('hex')}`, user: userJson(u) }; };
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { r(d ? JSON.parse(d) : {}); } catch { r({}); } }); });
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');
const isBanned = (u) => u.banned_until && new Date(u.banned_until) > new Date();
const logFile = process.env.AUTH_LOG;
const log = (...a) => { if (logFile) require('fs').appendFileSync(logFile, a.join(' ') + '\n'); };

const auth = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); const path = url.pathname; const body = req.method === 'GET' ? {} : await readBody(req);
  log(req.method, path, url.search);
  try {
    if (req.method === 'POST' && path === '/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const { rows } = await pool.query('select * from auth.users where lower(email)=lower($1)', [body.email || '']);
        const u = rows[0];
        if (!u || u.encrypted_password !== hash(body.password || '')) return json(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        if (isBanned(u)) return json(res, 400, { code: 400, error_code: 'user_banned', msg: 'User is banned' });
        return json(res, 200, session(u));
      }
      if (grant === 'refresh_token') {
        const id = (body.refresh_token || '').split('.')[1];
        const { rows } = await pool.query('select * from auth.users where id::text=$1', [id]);
        if (!rows[0] || isBanned(rows[0])) return json(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        return json(res, 200, session(rows[0]));
      }
    }
    if (req.method === 'GET' && path === '/user') {
      const p = verify(bearer(req));
      if (!p || p.role !== 'authenticated') return json(res, 401, { code: 401, msg: 'invalid JWT' });
      const { rows } = await pool.query('select * from auth.users where id::text=$1', [p.sub]);
      if (!rows[0]) return json(res, 404, { code: 404, msg: 'User not found' });
      if (isBanned(rows[0])) return json(res, 403, { code: 403, error_code: 'user_banned', msg: 'User is banned' });
      return json(res, 200, userJson(rows[0]));
    }
    if (req.method === 'POST' && path === '/logout') return json(res, 204);
    if (path.startsWith('/admin/users')) {
      const p = verify(bearer(req));
      if (!p || p.role !== 'service_role') return json(res, 403, { code: 403, msg: 'not_admin' });
      if (req.method === 'POST' && path === '/admin/users') {
        const { rows: ex } = await pool.query('select 1 from auth.users where lower(email)=lower($1)', [body.email]);
        if (ex.length) return json(res, 422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' });
        if ((body.password || '').length < 6) return json(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters' });
        const { rows } = await pool.query('insert into auth.users (email, encrypted_password) values ($1,$2) returning *', [body.email, hash(body.password)]);
        return json(res, 200, userJson(rows[0]));
      }
      const id = path.split('/')[3];
      if (req.method === 'PUT') {
        if (body.password) { if (body.password.length < 6) return json(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters' }); await pool.query('update auth.users set encrypted_password=$2 where id::text=$1', [id, hash(body.password)]); }
        if (body.ban_duration) await pool.query('update auth.users set banned_until = $2 where id::text=$1', [id, body.ban_duration === 'none' ? null : new Date(Date.now() + 876000 * 3600e3)]);
        const { rows } = await pool.query('select * from auth.users where id::text=$1', [id]);
        return json(res, rows[0] ? 200 : 404, rows[0] ? userJson(rows[0]) : { code: 404, msg: 'not found' });
      }
      if (req.method === 'DELETE') { await pool.query('delete from auth.users where id::text=$1', [id]); return json(res, 200, {}); }
    }
    json(res, 404, { code: 404, msg: 'not found ' + path });
  } catch (e) { console.error(e); json(res, 500, { msg: String(e) }); }
});
auth.listen(9999, '127.0.0.1');

// Porta de entrada (imita o endereço do Supabase) com CORS liberado para o site de teste
const gw = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'content-range,content-profile');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let port, path;
  if (req.url.startsWith('/rest/v1')) { port = 3001; path = req.url.replace('/rest/v1', '') || '/'; }
  else if (req.url.startsWith('/auth/v1')) { port = 9999; path = req.url.replace('/auth/v1', '') || '/'; }
  else { res.writeHead(404); return res.end(); }
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  delete headers.origin;
  const p = http.request({ host: '127.0.0.1', port, path, method: req.method, headers }, (r) => {
    const h = { ...r.headers }; delete h['access-control-allow-origin'];
    res.writeHead(r.statusCode, h); r.pipe(res);
  });
  p.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(p);
});
gw.listen(8080, '127.0.0.1');
console.log('mock auth :9999, gateway :8080 prontos');
