// Gera chaves de TESTE (JWT anon/service_role) e VAPID de teste. Só para o ambiente local.
const crypto = require('crypto'); const fs = require('fs');
const SECRET = 'jwt-secret-somente-para-teste-local-0123456789abcdef';
const b64u = (b) => Buffer.from(b).toString('base64url');
const sign = (p) => { const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), b = b64u(JSON.stringify(p)); return `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`; };
const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
const wp = require('/home/claude/crm-saas/node_modules/web-push');
const vapid = wp.generateVAPIDKeys();
const env = { JWT_SECRET: SECRET, ANON: sign({ role: 'anon', iss: 'test', exp }), SERVICE: sign({ role: 'service_role', iss: 'test', exp }), VAPID_PUBLIC: vapid.publicKey, VAPID_PRIVATE: vapid.privateKey, CRON_SECRET: 'cron-secret-de-teste-0123456789' };
fs.writeFileSync('/home/claude/testrig/test.env.json', JSON.stringify(env, null, 1));
console.log('chaves de teste geradas');
