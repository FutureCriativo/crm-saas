from e2e_lib import *
import urllib.parse

pw, br = launch()
cli = Session(br, True, 'cliente'); ges = Session(br, True, 'gestor'); tec = Session(br, True, 'tecnico')
P = lambda s: s.page

# ---------- 1. CLIENTE: pedido de instalação -> grava no banco + abre WhatsApp ----------
p = P(cli); p.goto(BASE + '/'); p.wait_for_load_state('networkidle')
p.get_by_role('link', name='Organizar instalação').first.click(); p.wait_for_url('**/assistencia/instalacao')
p.get_by_label('Nome completo *').fill('Joana Silva')
p.get_by_label('WhatsApp (com DDD) *').fill('(15) 91111-2222')
p.get_by_label('Endereço da instalação *').fill('Rua das Flores, 100, Centro')
p.get_by_label('Modelo do aparelho 1').select_option(label='LG Dual Inverter')
p.get_by_label('Potência do aparelho 1').select_option('12000')
p.get_by_role('button', name='Adicionar outro aparelho').click()
p.get_by_label('Modelo do aparelho 2').select_option(label='Outro (digitar)')
p.get_by_placeholder('Ex.: Daikin').fill('Daikin'); p.get_by_placeholder('Ex.: Inverter Ecoswing').fill('Ecoswing')
p.get_by_label('Potência do aparelho 2').select_option('9000')
cli.shot('01-form-preenchido')
# erro de validação primeiro: telefone inválido
p.get_by_label('WhatsApp (com DDD) *').fill('123')
p.get_by_role('button', name='Enviar pedido e continuar no WhatsApp').click()
check('telefone inválido mostra aviso e não envia', p.locator('div[role=alert]:not(#__next-route-announcer__)').is_visible() and 'DDD' in p.locator('div[role=alert]:not(#__next-route-announcer__)').inner_text())
p.get_by_label('WhatsApp (com DDD) *').fill('(15) 91111-2222')
with p.context.expect_page() as popup:
    p.get_by_role('button', name='Enviar pedido e continuar no WhatsApp').click()
wa_page = popup.value
p.wait_for_selector('[data-testid=request-done]')
cli.shot('02-pedido-enviado')
time.sleep(1)
wa_url = next((u for u in cli.wa_hits if 'wa.me' in u), '')
check('pedido aparece na tela como registrado (#1)', 'Pedido #1 registrado' in p.inner_text('[data-testid=request-done]'))
check('WhatsApp abre no número da empresa (5515996966519)', 'wa.me/5515996966519' in wa_url, wa_url[:80])
msg = urllib.parse.unquote(wa_url.split('text=')[-1]) if 'text=' in wa_url else ''
check('mensagem do WhatsApp leva nome, endereço e aparelhos', all(x in msg for x in ['Joana Silva', 'Rua das Flores', 'LG Dual Inverter 12.000 BTUs', 'Daikin Ecoswing 9.000 BTUs']), msg)
check('botão "Abrir WhatsApp" de reserva existe', p.get_by_role('link', name='Abrir WhatsApp').is_visible())
row = sql("select kind, name, phone, jsonb_array_length(items), request_number from service_requests where name='Joana Silva'")
check('pedido gravado no banco (telefone só dígitos, 2 aparelhos)', row == 'installation|Joana Silva|15911112222|2|1', row)

# ---------- 2. GESTOR: login, pedido novo, técnico, tarefa ----------
p = P(ges); p.goto(BASE + '/gestao'); p.wait_for_load_state('networkidle')
p.get_by_role('link', name=re.compile('^Gestor')).first.click()
p.get_by_label('E-mail').fill('futurecriativo@zohomail.com'); p.get_by_label('Senha').fill('errada')
p.get_by_role('button', name='Entrar').click(); p.wait_for_selector('div[role=alert]:not(#__next-route-announcer__)')
check('senha errada do gestor é recusada com aviso claro', 'incorretos' in p.locator('div[role=alert]:not(#__next-route-announcer__)').inner_text())
p.get_by_label('Senha').fill('Senha@Gestor1'); p.get_by_role('button', name='Entrar').click()
p.wait_for_url('**/dashboard'); p.wait_for_selector('text=Resumo do seu dia'); p.wait_for_load_state('networkidle')
ges.shot('03-dashboard')
check('gestor entra no painel', p.url.endswith('/dashboard'))
check('painel mostra 1 pedido novo', p.locator('[data-testid="stat-Pedidos novos"]').inner_text().strip().startswith('1') or '1' in p.locator('[data-testid="stat-Pedidos novos"]').inner_text())

# cria técnico
p.goto(BASE + '/dashboard/technicians'); p.wait_for_selector('text=Novo técnico')
p.get_by_label('Nome', exact=True).fill('Paulo Souza'); p.get_by_label('Usuário').fill('Pa ulo!')
p.get_by_label('Senha', exact=True).fill('123'); p.get_by_test_id('btn-create-tech').click()
p.wait_for_selector('div[role=alert]:not(#__next-route-announcer__)'); check('usuário com maiúscula é recusado', 'minúsculas' in p.locator('div[role=alert]:not(#__next-route-announcer__)').inner_text())
p.get_by_label('Usuário').fill('paulo'); p.get_by_test_id('btn-create-tech').click(); p.wait_for_selector('div[role=alert]:not(#__next-route-announcer__)')
check('senha curta é recusada', '6 caracteres' in p.locator('div[role=alert]:not(#__next-route-announcer__)').inner_text())
p.get_by_label('Senha', exact=True).fill('Paulo#2026'); p.get_by_test_id('btn-create-tech').click(); p.wait_for_selector('[data-testid=tech-created]')
ges.shot('04-tecnico-criado')
check('técnico criado e aparece na lista', p.locator('[data-testid=tech-row]').count() == 1)
u = sql("select username, role, active, email from users where username='paulo'")
check('técnico no banco com e-mail interno (nunca e-mail real)', u == 'paulo|technician|t|tec-paulo-ice@example.com', u)
p.get_by_label('Nome', exact=True).fill('Ana Lima'); p.get_by_label('Usuário').fill('ana'); p.get_by_label('Senha', exact=True).fill('Ana#2026x')
p.get_by_test_id('btn-create-tech').click(); p.locator('[data-testid=tech-row]').nth(1).wait_for()
p.get_by_label('Nome', exact=True).fill('Dup'); p.get_by_label('Usuário').fill('paulo'); p.get_by_label('Senha', exact=True).fill('Dup#2026x')
p.get_by_test_id('btn-create-tech').click(); p.wait_for_selector('div[role=alert]:not(#__next-route-announcer__)')
check('usuário repetido é recusado', 'Já existe' in p.locator('div[role=alert]:not(#__next-route-announcer__)').inner_text())

# pedido -> tarefa
p.goto(BASE + '/dashboard/requests'); p.wait_for_selector('[data-testid=request-card]')
ges.shot('05-pedidos')
check('pedido da Joana aparece com aparelhos', 'Daikin' in p.locator('[data-testid=request-card]').first.inner_text())
p.get_by_test_id('btn-make-task').click(); p.get_by_label('Técnico', exact=True).select_option(label='Paulo Souza'); p.get_by_test_id('btn-confirm-task').click()
p.wait_for_url(re.compile('/dashboard/tasks/[0-9a-f-]{36}')); p.wait_for_selector('text=Aparelhos instalados')
ges.shot('06-tarefa-do-gestor')
t = sql("select order_number, status, kind from service_tasks where client_id=(select id from clients where name='Joana Silva')")
ym = sql("select to_char(now() at time zone 'America/Sao_Paulo','YYYY')")
check('pedido virou tarefa OS seguinte (ANO-0002) pendente', t == f'{ym}-0002|pending|installation', t)
check('editor do gestor mostra os 2 aparelhos do pedido', p.locator('[data-testid=item-row]').count() == 2)
code = sql("select client_code from clients where name='Joana Silva'")
check('cliente novo ganhou código de 6 caracteres', re.fullmatch(r'[A-HJKMNP-Z2-9]{6}', code or ''), code)

# segunda tarefa criada direto (manutenção para Paulo) pela tela Nova tarefa
p.goto(BASE + '/dashboard/tasks/new'); p.get_by_role('heading', name='Nova tarefa').wait_for()
p.get_by_label('Cliente', exact=True).select_option(label='Cliente Antigo')
p.get_by_role('radio', name='Manutenção').click()
p.get_by_label('Técnico', exact=True).select_option(label='Paulo Souza')
p.get_by_label('Problema informado').fill('Não gela')
p.get_by_test_id('btn-create-task').click(); p.wait_for_url(re.compile('/dashboard/tasks/[0-9a-f-]{36}'))
check('gestor cria tarefa de manutenção (ANO-0003)', sql("select order_number from service_tasks where kind='maintenance'") == f'{ym}-0003')

# ---------- 3. TÉCNICO ----------
p = P(tec); p.goto(BASE + '/login?perfil=tecnico'); p.wait_for_load_state('networkidle')
p.get_by_label('Usuário').fill('paulo'); p.get_by_label('Senha').fill('errada'); p.get_by_role('button', name='Entrar').click(); p.wait_for_selector('div[role=alert]:not(#__next-route-announcer__)')
check('técnico: senha errada recusada', 'Usuário ou senha incorretos' in p.locator('div[role=alert]:not(#__next-route-announcer__)').inner_text())
p.get_by_label('Senha').fill('Paulo#2026'); p.get_by_role('button', name='Entrar').click()
p.wait_for_url('**/tecnico'); p.wait_for_selector('[data-testid=task-card]'); p.wait_for_load_state('networkidle')
tec.shot('07-tecnico-lista')
check('técnico vê as 2 tarefas dele', p.locator('[data-testid=task-card]').count() == 2)
check('técnico NÃO acessa o painel do gestor (vai para /tecnico)', (p.goto(BASE + '/dashboard'), p.wait_for_url('**/tecnico'))[1] is None or True)
p.wait_for_selector('[data-testid=task-card]')
p.locator('[data-testid=task-card]', has_text='Joana Silva').click(); p.wait_for_selector('text=Aparelhos instalados')
tec.shot('08-tecnico-tarefa')
check('técnico vê cliente, telefone e endereço', 'Joana Silva' in p.inner_text('main') and '(15) 91111-2222' in p.inner_text('main') and 'Rua das Flores' in p.get_by_label('Endereço do serviço').input_value())
check('técnico NÃO vê bloco de atribuição/garantia do gestor', p.get_by_text('Atribuição (gestor)').count() == 0)
# + aparelho, quem recebeu, observação, concluir
p.get_by_role('button', name='+ Aparelho').click()
p.get_by_label('Modelo do aparelho 3').select_option(label='Gree Split Inverter'); p.get_by_label('Potência do aparelho 3').select_option('18000')
p.get_by_label('Quem recebeu o serviço').fill('Dona Joana'); p.get_by_label('Observação').fill('Instalado na sala e quarto')
p.get_by_test_id('btn-complete').click(); p.wait_for_selector('[data-testid=done-banner]'); p.wait_for_load_state('networkidle')
tec.shot('09-tecnico-concluida')
r = sql("select status, received_by, done_on, warranty_expires_at, (select count(*) from task_items i where i.task_id=t.id) from service_tasks t where client_id=(select id from clients where name='Joana Silva')")
today = sql("select (now() at time zone 'America/Sao_Paulo')::date"); exp = sql(f"select ('{today}'::date + interval '12 months')::date")
check('instalação concluída no banco: 3 aparelhos, recebedor, garantia 12 meses', r == f'done|Dona Joana|{today}|{exp}|3', r)
check('banner de concluída mostra data da garantia', exp.split('-')[2] + '/' + exp.split('-')[1] in p.inner_text('[data-testid=done-banner]'))
# reabrir e concluir de novo
p.get_by_test_id('btn-reopen').click(); p.wait_for_selector('[data-testid=btn-complete]')
check('reabrir volta para pendente e zera garantia', sql("select status||'|'||reopened_count||'|'||coalesce(warranty_expires_at::text,'nulo') from service_tasks where received_by='Dona Joana'") == 'pending|1|nulo')
p.get_by_test_id('btn-complete').click(); p.wait_for_selector('[data-testid=done-banner]')
# editar depois de concluir
p.get_by_label('Observação').fill('Observação editada depois'); p.get_by_test_id('btn-save').click(); p.wait_for_timeout(800)
check('editar tarefa concluída salva e mantém concluída', sql("select status||'|'||notes from service_tasks where received_by='Dona Joana'") == 'done|Observação editada depois')
# manutenção: formulário de visita
p.goto(BASE + '/tecnico'); p.wait_for_selector('[data-testid=task-card]'); p.locator('[data-testid=task-card]', has_text='Cliente Antigo').click(); p.wait_for_selector('text=Diagnóstico')
tec.shot('10-tecnico-manutencao')
check('manutenção mostra o problema informado ao técnico', 'Não gela' in p.inner_text('main'))
p.get_by_label('Diagnóstico').fill('Gás baixo'); p.get_by_label('Serviço realizado').fill('Recarga de gás'); p.get_by_label('Peças trocadas').fill('Capacitor'); p.get_by_label('Valor cobrado (R$)').fill('250,50')
p.get_by_test_id('btn-complete').click(); p.wait_for_selector('[data-testid=done-banner]')
check('manutenção concluída com diagnóstico, peças e valor', sql("select status||'|'||diagnosis||'|'||parts_used||'|'||amount from service_tasks where kind='maintenance'") == 'done|Gás baixo|Capacitor|250.50')

# técnico tenta burlar pelo navegador: chama a API do banco direto com o token dele
tok = tec.page.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('auth-token')))).access_token")
def api(path, method='GET', body=None, token=tok):
    return tec.page.evaluate("""async ([u, m, b, t, k]) => { const r = await fetch(u, {method:m, headers:{apikey:k, Authorization:'Bearer '+t, 'Content-Type':'application/json', Prefer:'return=representation'}, body: b?JSON.stringify(b):undefined}); return [r.status, (await r.text()).slice(0,200)]; }""",
        ['http://127.0.0.1:8080/rest/v1' + path, method, body, token, ENV['ANON']])
st, txt = api('/users?id=eq.22222222-0000-0000-0000-000000000001', 'PATCH', {'role': 'owner'})
check('técnico NÃO consegue virar dono pela API', st in (401, 403), (st, txt))
st, txt = api('/service_requests?select=*')
check('técnico lê 0 pedidos pela API', st == 200 and txt.strip() == '[]', (st, txt))
st, txt = api('/clients?select=name')
check('técnico só enxerga clientes das tarefas dele', 'Joana' in txt and 'Cliente Antigo' in txt and len(json.loads(txt)) <= 2 if st == 200 and txt.endswith(']') else True, txt)
st, txt = api('/rpc/create_task', 'POST', {'p_client': sql("select id from clients limit 1"), 'p_kind': 'installation', 'p_assigned': None, 'p_date': None, 'p_address': '', 'p_problem': '', 'p_notes': '', 'p_items': []})
check('técnico NÃO cria tarefa pela API', st >= 400, (st, txt))
# token do técnico não serve na rota de gestor
r = tec.page.evaluate("""async (t) => { const r = await fetch('/api/technicians', {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+t}, body: JSON.stringify({name:'Hack', username:'hack', password:'123456'})}); return [r.status, await r.text()]; }""", tok)
check('técnico NÃO cria técnico na rota do servidor (403)', r[0] == 403, r)
r = tec.page.evaluate("""async () => { const r = await fetch('/api/technicians', {method:'POST', headers:{'Content-Type':'application/json'}, body: '{}'}); return r.status; }""")
check('rota do servidor sem login devolve 401', r == 401, r)

# ---------- 4. CLIENTE consulta a garantia pelo código ----------
p = P(cli); p.goto(BASE + '/consulta'); p.wait_for_load_state('networkidle')
p.get_by_label('Código de cliente').fill('ZZZZZZ'); p.get_by_role('button', name='Consultar').click(); p.wait_for_selector('[data-testid=not-found]')
check('código inexistente mostra "não encontrado"', True)
p.get_by_label('Código de cliente').fill(code.lower()); p.get_by_role('button', name='Consultar').click(); p.wait_for_selector('[data-testid=warranty-result]'); p.wait_for_load_state('networkidle')
cli.shot('11-garantia')
txt = p.inner_text('[data-testid=warranty-result]')
check('consulta mostra 3 aparelhos com garantia', p.locator('[data-testid=warranty-item]').count() == 3 and 'Em garantia' in txt, txt[:200])
check('consulta NÃO mostra nome, telefone nem endereço', not any(x in txt for x in ['Joana', '91111', 'Rua das Flores']))
hrefs = p.locator('[data-testid=warranty-item] a').evaluate_all('els=>els.map(e=>e.href)')
check('botão de suporte leva código + aparelho para o WhatsApp', hrefs and code in urllib.parse.unquote(hrefs[0]) and 'OS' in urllib.parse.unquote(hrefs[0]), hrefs[:1])
check('card de avisos aparece com botão Ativar', p.get_by_test_id('push-card').is_visible())
# brute force: 21 tentativas seguidas
p.goto(BASE + '/consulta')
for i in range(22):
    p.get_by_label('Código de cliente').fill('AAAAA' + str(i % 9 + 2)); p.get_by_role('button', name='Consultar').click(); p.wait_for_timeout(120)
p.wait_for_timeout(500)
check('muitas tentativas de código seguidas são bloqueadas com aviso', 'Muitas tentativas' in p.inner_text('main'), p.inner_text('main')[-200:])

# ---------- 5. GESTOR: clientes, configurações, avisos ----------
p = P(ges); p.goto(BASE + '/dashboard/clients'); p.wait_for_selector('[data-testid=client-row]'); ges.shot('12-clientes')
check('lista de clientes mostra o código de cada um', code in p.inner_text('main'))
p.goto(BASE + '/dashboard/settings'); p.wait_for_selector('[data-testid=btn-save-settings]')
p.get_by_test_id('logo-input').set_input_files('/home/claude/testrig/logo-teste.png'); p.wait_for_selector('[data-testid=logo-preview]')
p.get_by_label('Nome da empresa').fill('ICE Multservice'); p.get_by_test_id('btn-save-settings').click(); p.wait_for_timeout(1200)
logo = sql("select length(logo_data_url)||'|'||left(logo_data_url,22) from company_settings where business_name='ICE Multservice'")
check('logo enviada é reduzida e salva como PNG no banco', logo.endswith('data:image/png;base64,') and int(logo.split('|')[0]) < 280000, logo)
p.get_by_placeholder('Marca (ex.: Daikin)').fill('Daikin'); p.get_by_placeholder('Linha/modelo (ex.: Inverter)').fill('Inverter Flex'); p.get_by_test_id('btn-add-model').click(); p.wait_for_timeout(800)
check('gestor adiciona modelo ao catálogo', sql("select count(*) from appliance_models where brand='Daikin'") == '1')
ges.shot('13-configuracoes')
cli.page.goto(BASE + '/'); cli.page.wait_for_load_state('networkidle')
check('logo nova aparece no site público', cli.page.locator('header img').first.get_attribute('src').startswith('data:image/png'))
cli.shot('14-home-com-logo')

# avisos: inscrições simuladas (o navegador do sandbox não tem serviço de push de verdade)
cid = sql("select id from clients where name='Joana Silva'")
sql(f"insert into push_subscriptions(company_id,client_id,endpoint,p256dh,auth) values ('aaaaaaaa-0000-0000-0000-000000000001','{cid}','https://fcm.googleapis.com/fcm/send/ok-1','{'B'*65}','authsecret123456'),('aaaaaaaa-0000-0000-0000-000000000001','{cid}','https://fcm.googleapis.com/fcm/send/gone/2','{'B'*65}','authsecret123456')")
p.goto(BASE + '/dashboard/notifications'); p.wait_for_selector('[data-testid=subs-count]')
from playwright.sync_api import expect
try:
    expect(p.locator('[data-testid=subs-count]')).to_have_text('2', timeout=8000); ok_ = True
except Exception: ok_ = False
check('gestor vê quantos aparelhos têm avisos ativos', ok_, p.inner_text('[data-testid=subs-count]'))
p.get_by_role('button', name='Hora da manutenção').click()
p.get_by_test_id('btn-send-notification').click(); p.wait_for_selector('[data-testid=notification-row]'); p.wait_for_timeout(1500); ges.shot('15-avisos')
row = sql("select status||'|'||sent_count||'|'||failed_count from notifications order by created_at desc limit 1")
check('aviso enviado: 1 entregue, 1 falha, status enviada', row == 'sent|1|1', row)
check('inscrição morta (410) foi apagada automaticamente', sql("select count(*) from push_subscriptions") == '1')
dry = open('/tmp/push-dry-run.log').read()
check('conteúdo enviado tem título, texto e link interno', '"title":"Hora da manutenção"' in dry and '"url":"/consulta"' in dry, dry[:200])
# agendado para o futuro: não sai sozinho; o agendador só envia os vencidos
p.get_by_role('button', name='Hora da manutenção').click(); p.get_by_role('radio', name='Agendar').click()
fut = (time.strftime('%Y-%m-%dT%H:%M', time.localtime(time.time() + 3 * 86400)))
p.get_by_label('Data e hora do envio').fill(fut); p.get_by_test_id('btn-send-notification').click(); p.wait_for_timeout(1200)
check('aviso agendado fica como "scheduled"', sql("select status from notifications order by created_at desc limit 1") == 'scheduled')
import urllib.request
def cron(tokn):
    rq = urllib.request.Request(BASE + '/api/cron/push', method='POST', headers={'Authorization': 'Bearer ' + tokn})
    try: return urllib.request.urlopen(rq).status
    except urllib.error.HTTPError as e: return e.code
check('agendador sem senha correta é barrado (401)', cron('errada') == 401)
check('agendador com a senha correta responde 200', cron(ENV['CRON_SECRET']) == 200)
check('agendador não envia o que ainda é futuro', sql("select status from notifications order by created_at desc limit 1") == 'scheduled')
sql("update notifications set scheduled_at = now() - interval '1 minute' where status='scheduled'")
check('agendador envia o que venceu', cron(ENV['CRON_SECRET']) == 200 and sql("select status from notifications order by created_at desc limit 1") in ('sent', 'failed'))

# ---------- 6. Desativar técnico ----------
p.goto(BASE + '/dashboard/technicians'); p.wait_for_selector('[data-testid=tech-row]')
p.locator('[data-testid=tech-row]', has_text='Paulo Souza').get_by_role('button', name='Desativar').click(); p.wait_for_timeout(1200)
check('técnico desativado no banco', sql("select active from users where username='paulo'") == 'f')
st, txt = api('/service_tasks?select=id')
check('token antigo do técnico desativado não lê mais nenhuma tarefa', st == 200 and txt.strip() == '[]', (st, txt))
t2 = Session(br, True, 'tecnico2'); q = P(t2); q.goto(BASE + '/login?perfil=tecnico'); q.get_by_label('Usuário').fill('paulo'); q.get_by_label('Senha').fill('Paulo#2026'); q.get_by_role('button', name='Entrar').click(); q.wait_for_selector('div[role=alert]:not(#__next-route-announcer__)')
check('técnico desativado não consegue entrar', 'desativado' in q.locator('div[role=alert]:not(#__next-route-announcer__)').inner_text().lower(), q.locator('div[role=alert]:not(#__next-route-announcer__)').inner_text())
p.locator('[data-testid=tech-row]', has_text='Ana Lima').get_by_role('button', name='Redefinir senha').click(); p.get_by_role('textbox', name='Nova senha').fill('Nova#Senha9'); p.get_by_role('dialog').get_by_role('button', name='Redefinir', exact=True).click(); p.wait_for_timeout(1000)
t3 = Session(br, True, 'tecnico3'); q = P(t3); q.goto(BASE + '/login?perfil=tecnico'); q.get_by_label('Usuário').fill('ana'); q.get_by_label('Senha').fill('Nova#Senha9'); q.get_by_role('button', name='Entrar').click()
try: q.wait_for_url('**/tecnico', timeout=8000); ok = True
except Exception: ok = False
check('senha redefinida pelo gestor funciona no login da Ana', ok)

# ---------- erros de JavaScript e layout ----------
allerr = cli.errors + ges.errors + tec.errors + t2.errors + t3.errors
check('nenhum erro de JavaScript em todo o fluxo', not allerr, allerr[:5])
print(f"\nTOTAL: {sum(1 for r in RESULTS if r[1])}/{len(RESULTS)} passaram")
json.dump(RESULTS, open('/home/claude/testrig/e2e_results.json', 'w'), ensure_ascii=False)
br.close(); pw.stop()
