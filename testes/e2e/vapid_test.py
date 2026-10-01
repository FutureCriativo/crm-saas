from e2e_lib import *
import subprocess
pw, br = launch(); ctx = br.new_context(); p = ctx.new_page(); errs = []
p.on('pageerror', lambda e: errs.append(str(e))); p.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
p.goto('file:///home/claude/crm-saas/gerar-chaves-push.html'); p.click('#go'); p.wait_for_selector('#out:not([hidden])')
k = {i: p.inner_text('#' + i) for i in ('pub', 'priv', 'cron')}
check('página gera as 3 chaves sem erro', all(k.values()) and not errs, errs)
open('/tmp/k.json', 'w').write(json.dumps(k)); br.close(); pw.stop()
js = r"""
const k=require('/tmp/k.json'); const wp=require('/home/claude/crm-saas/node_modules/web-push'); const crypto=require('crypto');
wp.setVapidDetails('mailto:teste@example.com', k.pub, k.priv);   // valida tamanho/formato das chaves
const h=wp.getVapidHeaders('https://fcm.googleapis.com','mailto:teste@example.com',k.pub,k.priv,'aes128gcm'); // assina de verdade com a privada
const jwt=h.Authorization.split(' ')[1].split('.')[0]==='' ? '' : h.Authorization.replace(/^vapid t=/,'').split(',')[0];
const [a,b,s]=jwt.split('.');
const pubRaw=Buffer.from(k.pub,'base64url');
const key=crypto.createPublicKey({key:{kty:'EC',crv:'P-256',x:pubRaw.subarray(1,33).toString('base64url'),y:pubRaw.subarray(33).toString('base64url')},format:'jwk'});
const ok=crypto.verify('sha256',Buffer.from(a+'.'+b),{key,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url'));
console.log(JSON.stringify({pubBytes:pubRaw.length,privBytes:Buffer.from(k.priv,'base64url').length,cronLen:k.cron.length,assinaturaConfere:ok}));
"""
out = subprocess.run(['node', '-e', js], capture_output=True, text=True); print(out.stdout or out.stderr)
r = json.loads(out.stdout)
check('chave pública tem 65 bytes e a privada 32 (formato exigido)', r['pubBytes'] == 65 and r['privBytes'] == 32, r)
check('a biblioteca de envio (web-push) aceita as chaves e a assinatura confere com a pública', r['assinaturaConfere'], r)
check('CRON_SECRET gerado tem 16+ caracteres', r['cronLen'] >= 16, r)
