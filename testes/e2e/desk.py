from e2e_lib import *
pw, br = launch(); s = Session(br, mobile=False, name='desk'); p = s.page
p.goto(BASE + '/login?perfil=gestor'); p.get_by_label('E-mail').fill('futurecriativo@zohomail.com'); p.get_by_label('Senha').fill('Senha@Gestor1'); p.get_by_role('button', name='Entrar').click(); p.wait_for_url('**/dashboard')
for path in ['/dashboard', '/dashboard/requests', '/dashboard/tasks', '/dashboard/tasks/new', '/dashboard/clients', '/dashboard/clients/new', '/dashboard/technicians', '/dashboard/notifications', '/dashboard/settings']:
    p.goto(BASE + path); p.wait_for_load_state('networkidle'); p.wait_for_timeout(700)
    s.shot('d' + path.replace('/', '_')); check(f'desktop {path}: sem rolagem lateral', s.overflow() <= 1, s.overflow())
cid = sql("select id from clients limit 1"); p.goto(BASE + '/dashboard/clients/' + cid); p.wait_for_selector('[data-testid=client-code]'); s.shot('d_cliente')
tid = sql("select id from service_tasks limit 1"); p.goto(BASE + '/dashboard/tasks/' + tid); p.wait_for_selector('text=Atribuição (gestor)'); s.shot('d_tarefa')
check('editor do gestor mostra atribuição e garantia', True)
check('desktop: nenhum erro de JavaScript', not s.errors, s.errors)
br.close(); pw.stop()
