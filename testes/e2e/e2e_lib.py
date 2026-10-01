import json, re, subprocess, os, time
from playwright.sync_api import sync_playwright

CHROME = '/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome'
BASE = 'http://127.0.0.1:3000'
ENV = json.load(open('/home/claude/testrig/test.env.json'))
SHOTS = '/home/claude/testrig/shots'
RESULTS = []

def check(label, cond, detail=''):
    RESULTS.append((label, bool(cond), str(detail)[:300]))
    print(('PASS ' if cond else 'FAIL ') + label + ('' if cond else f'  -> {detail}'))

def sql(q):
    r = subprocess.run(['psql', '-h', '/tmp', '-p', '5544', '-U', 'postgres', '-d', 'crm', '-At', '-F', '|', '-c', q], capture_output=True, text=True)
    if r.returncode != 0: raise RuntimeError(r.stderr)
    return r.stdout.strip()

class Session:
    """Um 'aparelho' (contexto do navegador) com coleta de erros"""
    def __init__(self, browser, mobile=True, name='ctx'):
        opts = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True) if mobile else dict(viewport={'width': 1280, 'height': 800})
        self.ctx = browser.new_context(locale='pt-BR', timezone_id='America/Sao_Paulo', **opts)
        self.name = name
        self.errors = []; self.wa_hits = []; self.failed = []
        # sem internet no sandbox: fontes e WhatsApp viram respostas de mentira (o WhatsApp registra o endereço pedido)
        self.ctx.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r: r.fulfill(status=200, content_type='text/css', body=''))
        def wa(route):
            self.wa_hits.append(route.request.url); route.fulfill(status=200, content_type='text/html', body='<html><body>WhatsApp (simulado)</body></html>')
        self.ctx.route(re.compile(r'https://wa\.me/.*'), wa)
        self.page = self.ctx.new_page()
        self._hook(self.page)
        self.ctx.on('page', self._hook)

    def _hook(self, p):
        p.on('pageerror', lambda e: self.errors.append(f'[{self.name}] pageerror: {e}'))
        def con(m):
            if m.type == 'error' and 'Failed to load resource' not in m.text: self.errors.append(f'[{self.name}] console: {m.text[:200]}')
        p.on('console', con)
        p.on('requestfailed', lambda r: self.failed.append(r.url))

    def shot(self, name, full=True):
        try:
            self.page.screenshot(path=f'{SHOTS}/{self.name}-{name}.png', full_page=full, timeout=8000)
        except Exception:
            try: self.page.screenshot(path=f'{SHOTS}/{self.name}-{name}.png', full_page=False, timeout=8000)
            except Exception as e: print('  (screenshot ignorado:', name, ')')

    def overflow(self):
        return self.page.evaluate('document.documentElement.scrollWidth - window.innerWidth')

def launch():
    pw = sync_playwright().start()
    browser = pw.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    return pw, browser
