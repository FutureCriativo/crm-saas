\set ON_ERROR_STOP 1
\set QUIET 1
SET client_min_messages = warning;
DROP SCHEMA IF EXISTS t CASCADE; CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO PUBLIC;
CREATE TABLE t.results(n serial, label text, ok boolean, detail text);
CREATE TABLE t.vars(k text PRIMARY KEY, v text);
GRANT ALL ON t.results, t.vars TO PUBLIC; GRANT ALL ON SEQUENCE t.results_n_seq TO PUBLIC;
CREATE FUNCTION t.check(label text, cond boolean, detail text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$ INSERT INTO t.results(label, ok, detail) VALUES (label, coalesce(cond,false), detail) $$;
CREATE FUNCTION t.err(q text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE q; RETURN NULL; EXCEPTION WHEN others THEN RETURN SQLERRM; END $$;
CREATE FUNCTION t.as_user(uid uuid, ip text DEFAULT '10.0.0.1') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.headers', json_build_object('cf-connecting-ip', ip)::text, true);
  SET LOCAL ROLE authenticated;
END $$;
CREATE FUNCTION t.as_anon(ip text DEFAULT '10.0.0.2') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('request.headers', json_build_object('cf-connecting-ip', ip)::text, true);
  SET LOCAL ROLE anon;
END $$;
CREATE FUNCTION t.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true); SET LOCAL ROLE service_role; END $$;
CREATE FUNCTION t.rows(q text) RETURNS int LANGUAGE plpgsql AS $$ DECLARE n int; BEGIN EXECUTE q; GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;
CREATE FUNCTION t.back() RETURNS void LANGUAGE plpgsql AS $$ BEGIN RESET ROLE; END $$;
CREATE FUNCTION t.yr() RETURNS text LANGUAGE sql AS $$ SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY') $$;

-- ===== DADOS DE TESTE (como administrador do banco) =====
-- Dono A = 1111.. | Técnicos A: T1=2222..01, T2=2222..02, T3(inativo)=2222..03 | Empresa B: dono 3333.., técnico 4444..
INSERT INTO auth.users(id,email) VALUES
 ('22222222-0000-0000-0000-000000000001','tec-paulo-ice@example.com'),('22222222-0000-0000-0000-000000000002','tec-ana-ice@example.com'),
 ('22222222-0000-0000-0000-000000000003','tec-velho-ice@example.com'),('33333333-0000-0000-0000-000000000001','dono-b@b.com'),
 ('44444444-0000-0000-0000-000000000001','tec-bia-b@example.com');
INSERT INTO companies(id,name,email,slug) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','Empresa B','b@b.com','empresa-b');
INSERT INTO users(id,company_id,email,role,name,username,active) VALUES
 ('22222222-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','tec-paulo-ice@example.com','technician','Paulo','paulo',true),
 ('22222222-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','tec-ana-ice@example.com','technician','Ana','ana',true),
 ('22222222-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','tec-velho-ice@example.com','technician','Velho','velho',true),
 ('33333333-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','dono-b@b.com','owner','Dono B',NULL,true),
 ('44444444-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','tec-bia-b@example.com','technician','Bia','bia',true);
INSERT INTO clients(id,company_id,name,phone,address) VALUES ('cccccccc-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','Cliente B','15977776666','Rua B, 1');
SELECT count(*) FROM (SELECT t.check('empresa B ganhou catálogo e configurações automaticamente', (SELECT count(*) FROM appliance_models WHERE company_id='bbbbbbbb-0000-0000-0000-000000000001')=7 AND (SELECT count(*) FROM company_settings)=2)) x;

-- ===== 1. VISITANTE (anon) =====
DO $t$ DECLARE r jsonb; e text; i int; BEGIN
  PERFORM t.as_anon('1.1.1.1');
  FOREACH e IN ARRAY ARRAY['clients','service_tasks','task_items','service_requests','notifications','company_settings','appliance_models','users','installations','push_subscriptions','rate_limits'] LOOP
    PERFORM t.check('anon NÃO lê '||e, t.err('SELECT count(*) FROM public.'||e) LIKE 'permission denied%', t.err('SELECT count(*) FROM public.'||e));
  END LOOP;
  PERFORM t.check('anon NÃO grava em service_requests direto', t.err($q$INSERT INTO service_requests(company_id,request_number,kind,name,phone,address) VALUES ('aaaaaaaa-0000-0000-0000-000000000001',99,'installation','x','15999990000','Rua X, 1')$q$) LIKE 'permission denied%');
  PERFORM t.check('anon NÃO grava em leads (fechado)', t.err($q$INSERT INTO leads(name,phone) VALUES ('robo','15999990000')$q$) LIKE 'permission denied%');
  PERFORM t.check('anon lê config pública (WhatsApp da ICE)', public.get_public_settings('ice')->>'whatsapp' = '5515996966519');
  PERFORM t.check('config pública não expõe id/dados internos', (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(public.get_public_settings('ice')) k) = ARRAY['business_name','logo','whatsapp']);
  PERFORM t.check('config de empresa inexistente = nulo', public.get_public_settings('nao-existe') IS NULL);
  PERFORM t.check('catálogo público tem 7 aparelhos', jsonb_array_length(public.get_public_catalog('ice')) = 7);
  PERFORM t.check('anon NÃO chama notification_targets', t.err($q$SELECT * FROM notification_targets(gen_random_uuid())$q$) LIKE 'permission denied%');
  PERFORM t.check('anon NÃO chama claim_notifications', t.err($q$SELECT * FROM claim_notifications()$q$) LIKE 'permission denied%');
  PERFORM t.check('anon NÃO chama rate_limit_check', t.err($q$SELECT rate_limit_check('x',1,1)$q$) LIKE 'permission denied%');
  PERFORM t.check('anon NÃO chama create_task', t.err($q$SELECT create_task(gen_random_uuid(),'installation',NULL,NULL,NULL,NULL,NULL,'[]')$q$) LIKE 'Apenas o gestor%');
END $t$;

-- ===== 2. PEDIDOS DA ASSISTÊNCIA (função pública) =====
DO $t$ DECLARE r jsonb; BEGIN
  PERFORM t.as_anon('2.2.2.2');
  r := public.submit_request('ice','installation','Joana Silva','(15) 91111-2222','joana@x.com','Rua das Flores, 100','Sorocaba',
        '[{"brand":"LG","model":"Dual Inverter","btus":12000},{"model":"Outro modelo","btus":9000}]'::jsonb, current_date+7, NULL, NULL, NULL, 'quero de manhã');
  PERFORM t.check('pedido de instalação gravado e numerado', (r->>'number')::int = 1, r::text);
  r := public.submit_request('ice','maintenance','Carlos','15933334444',NULL,'Av. Brasil, 50',NULL,'[{"model":"Samsung WindFree","btus":18000}]'::jsonb,NULL,'Não gela','high','ABC234',NULL);
  PERFORM t.check('pedido de manutenção gravado (nº 2)', (r->>'number')::int = 2);
  PERFORM t.check('telefone inválido recusado', t.err($q$SELECT submit_request('ice','installation','Ana','123','', 'Rua A, 10',NULL,'[{"model":"x"}]',NULL,NULL,NULL,NULL,NULL)$q$) = 'Informe o WhatsApp com DDD.');
  PERFORM t.check('instalação sem aparelho recusada', t.err($q$SELECT submit_request('ice','installation','Ana','15955556666','', 'Rua A, 10',NULL,'[]',NULL,NULL,NULL,NULL,NULL)$q$) = 'Informe ao menos um aparelho.');
  PERFORM t.check('manutenção sem problema recusada', t.err($q$SELECT submit_request('ice','maintenance','Ana','15955556666','', 'Rua A, 10',NULL,'[]',NULL,'',NULL,NULL,NULL)$q$) = 'Conte qual é o problema.');
  PERFORM t.check('e-mail inválido recusado', t.err($q$SELECT submit_request('ice','installation','Ana','15955556666','nao-e-email', 'Rua A, 10',NULL,'[{"model":"x"}]',NULL,NULL,NULL,NULL,NULL)$q$) = 'E-mail inválido.');
  PERFORM t.check('data no passado recusada', t.err($q$SELECT submit_request('ice','installation','Ana','15955556666','', 'Rua A, 10',NULL,'[{"model":"x"}]',current_date-30,NULL,NULL,NULL,NULL)$q$) = 'Data desejada inválida.');
  PERFORM t.check('empresa inexistente recusada', t.err($q$SELECT submit_request('xxx','installation','Ana','15955556666','', 'Rua A, 10',NULL,'[{"model":"x"}]',NULL,NULL,NULL,NULL,NULL)$q$) = 'Empresa não encontrada.');
  PERFORM t.check('mais de 10 aparelhos recusado', t.err($q$SELECT submit_request('ice','installation','Ana','15955556666','', 'Rua A, 10',NULL,(SELECT jsonb_agg(jsonb_build_object('model','m'||g)) FROM generate_series(1,11) g),NULL,NULL,NULL,NULL,NULL)$q$) LIKE 'Máximo de 10%');
  -- injeção de HTML/script vira só texto; nada executa no banco
  r := public.submit_request('ice','installation','<script>alert(1)</script>','15955557777',NULL,'Rua <b>X</b>, 10',NULL,'[{"model":"<img src=x onerror=alert(1)>","btus":"12000; DROP TABLE clients"}]'::jsonb,NULL,NULL,NULL,NULL,NULL);
END $t$;
SELECT t.check('texto com HTML/SQL vira só texto, BTU inválido vira nulo e a tabela continua lá',
  (SELECT items->0->>'btus' IS NULL AND name = '<script>alert(1)</script>' FROM service_requests WHERE name LIKE '<script>%') AND to_regclass('public.clients') IS NOT NULL);
INSERT INTO t.vars SELECT 'req_joana', id::text FROM service_requests WHERE name='Joana Silva';
INSERT INTO t.vars SELECT 'req_carlos', id::text FROM service_requests WHERE name='Carlos';
-- limite por telefone (5 por hora) e por IP (10 por hora)
DO $t$ DECLARE i int; last text; BEGIN
  PERFORM t.as_anon('3.3.3.3');
  FOR i IN 1..5 LOOP
    PERFORM public.submit_request('ice','maintenance','Spam','15900001111',NULL,'Rua Spam, 1',NULL,'[]',NULL,'problema x',NULL,NULL,NULL);
  END LOOP;
  last := t.err($q$SELECT submit_request('ice','maintenance','Spam','15900001111',NULL,'Rua Spam, 1',NULL,'[]',NULL,'problema x',NULL,NULL,NULL)$q$);
  PERFORM t.check('6º pedido do mesmo telefone na hora é bloqueado', last LIKE 'Muitas tentativas%', last);
END $t$;
DO $t$ DECLARE i int; n int := 0; last text; BEGIN
  PERFORM t.as_anon('4.4.4.4');
  FOR i IN 1..10 LOOP
    PERFORM public.submit_request('ice','maintenance','Bot','1590000'||lpad(i::text,4,'0'),NULL,'Rua Bot, 1',NULL,'[]',NULL,'problema x',NULL,NULL,NULL);
  END LOOP;
  last := t.err($q$SELECT submit_request('ice','maintenance','Bot','15900009999',NULL,'Rua Bot, 1',NULL,'[]',NULL,'problema x',NULL,NULL,NULL)$q$);
  PERFORM t.check('11º pedido do mesmo IP na hora é bloqueado', last LIKE 'Muitas tentativas%', last);
END $t$;

-- ===== 3. GESTOR A: cliente, tarefas =====
DO $t$ DECLARE c record; r jsonb; bad text; BEGIN
  PERFORM t.as_user('11111111-1111-1111-1111-111111111111');
  INSERT INTO clients(company_id,name,phone,address) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Maria Teste','15999990000','Rua X, 5') RETURNING id, client_code INTO c;
  PERFORM t.check('cliente novo ganha código de 6 caracteres sem ambíguos', c.client_code ~ '^[A-HJKMNP-Z2-9]{6}$', c.client_code);
  INSERT INTO t.vars VALUES ('client_maria', c.id::text), ('code_maria', c.client_code);
  r := public.create_task(c.id,'installation','22222222-0000-0000-0000-000000000001', current_date, 'Rua X, 5', NULL, 'portão azul',
        '[{"brand":"LG","model":"Dual Inverter","btus":12000},{"brand":"Gree","model":"Split Inverter","btus":9000,"location":"quarto"}]'::jsonb);
  PERFORM t.check('tarefa nova recebe a OS seguinte (ANO-0002, pois 0001 foi migrada)', r->>'order_number' = t.yr()||'-0002', r::text);
  INSERT INTO t.vars VALUES ('task_a1', r->>'id');
  r := public.create_task(c.id,'installation','22222222-0000-0000-0000-000000000001', current_date, 'Rua X, 5', NULL, NULL, '[]'::jsonb);
  INSERT INTO t.vars VALUES ('task_a2', r->>'id');
  r := public.create_task(c.id,'maintenance','22222222-0000-0000-0000-000000000002', current_date, 'Rua X, 5', 'Não gela', NULL, '[{"model":"Samsung","btus":18000}]'::jsonb);
  INSERT INTO t.vars VALUES ('task_a3', r->>'id');
  PERFORM t.check('terceira tarefa = ANO-0004', r->>'order_number' = t.yr()||'-0004', r::text);
  r := public.create_task(c.id,'installation','22222222-0000-0000-0000-000000000003', current_date, NULL, NULL, NULL, '[{"model":"Elgin"}]'::jsonb);
  INSERT INTO t.vars VALUES ('task_a4_t3', r->>'id');
  bad := t.err(format($q$SELECT create_task(%L,'installation','44444444-0000-0000-0000-000000000001',NULL,NULL,NULL,NULL,'[]')$q$, c.id));
  PERFORM t.check('gestor NÃO atribui a técnico de outra empresa', bad LIKE 'Técnico inválido%', bad);
  bad := t.err($q$SELECT create_task('cccccccc-0000-0000-0000-000000000002','installation',NULL,NULL,NULL,NULL,NULL,'[]')$q$);
  PERFORM t.check('gestor NÃO cria tarefa para cliente de outra empresa', bad IS NOT NULL, bad);
  PERFORM t.check('gestor vê só clientes da empresa dele (não vê o Cliente B)', (SELECT count(*) FROM clients WHERE name='Cliente B') = 0);
  PERFORM t.check('gestor vê as tarefas (migrada + 4 novas)', (SELECT count(*) FROM service_tasks) = 5);
  PERFORM t.check('gestor vê os pedidos da empresa', (SELECT count(*) FROM service_requests) >= 2);
  PERFORM t.check('gestor vê a equipe (3 técnicos + ele)', (SELECT count(*) FROM users) = 4);
  PERFORM t.check('gestor NÃO consegue alterar papel na tabela users', t.err($q$UPDATE users SET role='client' WHERE id='22222222-0000-0000-0000-000000000001'$q$) LIKE 'permission denied%');
END $t$;

-- ===== 4. TÉCNICO T1 (Paulo) =====
DO $t$ DECLARE tk text; bad text; r jsonb; s record; d date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
  PERFORM t.as_user('22222222-0000-0000-0000-000000000001');
  PERFORM t.check('técnico vê só as tarefas atribuídas a ele (2)', (SELECT count(*) FROM service_tasks) = 2, (SELECT count(*) FROM service_tasks)::text);
  PERFORM t.check('técnico NÃO vê tarefa de outro técnico', (SELECT count(*) FROM service_tasks WHERE assigned_to='22222222-0000-0000-0000-000000000002') = 0);
  PERFORM t.check('técnico NÃO vê tarefa migrada/sem técnico', (SELECT count(*) FROM service_tasks WHERE assigned_to IS NULL) = 0);
  PERFORM t.check('técnico vê só o cliente das tarefas dele', (SELECT count(*) FROM clients) = 1 AND (SELECT name FROM clients) = 'Maria Teste');
  PERFORM t.check('técnico vê os aparelhos das tarefas dele (2)', (SELECT count(*) FROM task_items) = 2, (SELECT count(*) FROM task_items)::text);
  PERFORM t.check('técnico NÃO lê pedidos', (SELECT count(*) FROM service_requests) = 0);
  PERFORM t.check('técnico NÃO lê notificações', (SELECT count(*) FROM notifications) = 0);
  PERFORM t.check('técnico vê só a si mesmo em users', (SELECT count(*) FROM users) = 1);
  PERFORM t.check('técnico NÃO cria tarefa', t.err($q$SELECT create_task((SELECT id FROM clients LIMIT 1),'installation',NULL,NULL,NULL,NULL,NULL,'[]')$q$) LIKE 'Apenas o gestor%');
  PERFORM t.check('técnico NÃO cria cliente', t.err($q$INSERT INTO clients(company_id,name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Fantasma')$q$) LIKE '%row-level security%');
  PERFORM t.check('técnico NÃO escreve em installations (legado fechado)', t.err($q$INSERT INTO installations(company_id,client_id,machine_type) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','x')$q$) LIKE 'permission denied%');
  PERFORM t.check('técnico NÃO vira dono (users fechado)', t.err($q$UPDATE users SET role='owner' WHERE id='22222222-0000-0000-0000-000000000001'$q$) LIKE 'permission denied%');
  PERFORM t.check('técnico NÃO altera configurações', t.rows('UPDATE company_settings SET business_name=''hack''') = 0);
  PERFORM t.check('técnico NÃO cria notificação', t.err($q$INSERT INTO notifications(company_id,title,body,audience) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','a','b','all')$q$) LIKE '%row-level security%');
  PERFORM t.check('técnico NÃO lê as chaves de push', t.err($q$SELECT endpoint FROM push_subscriptions$q$) LIKE 'permission denied%');

  tk := (SELECT v FROM t.vars WHERE k='task_a1');
  bad := t.err(format($q$UPDATE service_tasks SET assigned_to='22222222-0000-0000-0000-000000000002' WHERE id=%L$q$, tk));
  PERFORM t.check('técnico NÃO repassa a tarefa para outro', bad IS NOT NULL, bad);
  bad := t.err(format($q$UPDATE service_tasks SET warranty_months=60 WHERE id=%L$q$, tk));
  PERFORM t.check('técnico NÃO muda a garantia', bad LIKE 'Só o gestor%', bad);
  bad := t.err(format($q$UPDATE service_tasks SET order_number='9999-0001' WHERE id=%L$q$, tk));
  PERFORM t.check('ninguém troca o número da OS', bad LIKE 'Este campo não pode%', bad);
  bad := t.err(format($q$SELECT save_task(%L,'{"scheduled_date":"2030-01-01"}',NULL,NULL)$q$, tk));
  PERFORM t.check('técnico NÃO muda a data agendada', bad LIKE 'Só o gestor%', bad);
  bad := t.err(format($q$SELECT save_task(%L,'{}',NULL,'done')$q$, (SELECT v FROM t.vars WHERE k='task_a3')));
  PERFORM t.check('técnico NÃO mexe em tarefa de outro técnico', bad LIKE 'Tarefa não encontrada%', bad);

  -- conclui a instalação sem aparelho: bloqueado
  bad := t.err(format($q$SELECT save_task(%L,'{"received_by":"João"}',NULL,'done')$q$, (SELECT v FROM t.vars WHERE k='task_a2')));
  PERFORM t.check('não conclui instalação sem aparelho', bad LIKE 'Adicione pelo menos um aparelho%', bad);

  -- fluxo feliz: edita campos, concluir, reabrir
  r := public.save_task(tk::uuid, jsonb_build_object('received_by','Dona Maria','notes','Tudo certo','done_on',d::text), NULL, 'done');
  PERFORM t.check('concluir instalação calcula a garantia no servidor (12 meses)', r->>'status'='done' AND r->>'warranty_expires_at'=(d + interval '12 months')::date::text, r::text);
  r := public.save_task((SELECT v FROM t.vars WHERE k='task_a2')::uuid, '{"received_by":"Seu Zé","notes":"Bancada"}'::jsonb,
        '[{"model":"Philco Split Inverter","btus":24000}]'::jsonb, 'done');
  PERFORM t.check('técnico adiciona aparelho e conclui', r->>'status'='done', r::text);
  r := public.save_task((SELECT v FROM t.vars WHERE k='task_a2')::uuid, '{}'::jsonb, NULL, 'pending');
  PERFORM t.check('reabrir zera a garantia', r->>'status'='pending' AND r->>'warranty_expires_at' IS NULL, r::text);
  SELECT * INTO s FROM service_tasks WHERE id=(SELECT v FROM t.vars WHERE k='task_a2')::uuid;
  PERFORM t.check('reabertura é contada', s.reopened_count = 1 AND s.completed_at IS NULL, s.reopened_count::text);
  r := public.save_task(tk::uuid, '{"notes":"Editei depois de concluir"}'::jsonb, NULL, NULL);
  PERFORM t.check('editar tarefa concluída mantém concluída e garantia', r->>'status'='done' AND r->>'warranty_expires_at'=(d + interval '12 months')::date::text, r::text);
  r := public.save_task(tk::uuid, jsonb_build_object('done_on',(d-3)::text), NULL, NULL);
  PERFORM t.check('mudar a data do serviço recalcula a garantia', r->>'warranty_expires_at'=((d-3) + interval '12 months')::date::text, r::text);
  -- fix_05: técnico não escolhe data futura nem muito antiga (ela define a garantia)
  bad := t.err(format($q$SELECT save_task(%L, jsonb_build_object('done_on',%L), NULL, NULL)$q$, tk, (d+1)::text));
  PERFORM t.check('técnico NÃO informa data futura de conclusão', bad LIKE 'A data do serviço deve ser%', bad);
  bad := t.err(format($q$SELECT save_task(%L, jsonb_build_object('done_on',%L), NULL, NULL)$q$, tk, (d-8)::text));
  PERFORM t.check('técnico NÃO informa data com mais de 7 dias', bad LIKE 'A data do serviço deve ser%', bad);
  PERFORM t.check('data recusada não altera a garantia', (SELECT warranty_expires_at FROM service_tasks WHERE id=tk::uuid) = ((d-3) + interval '12 months')::date);
  PERFORM t.check('técnico troca os aparelhos (tudo ou nada)', (SELECT count(*) FROM task_items WHERE task_id=tk::uuid) = 2);
  PERFORM public.save_task_items(tk::uuid, '[{"model":"Só um","btus":9000}]'::jsonb);
  PERFORM t.check('lista de aparelhos substituída', (SELECT count(*) FROM task_items WHERE task_id=tk::uuid) = 1);
  PERFORM public.save_task_items(tk::uuid, '[{"brand":"LG","model":"Dual Inverter","btus":12000},{"brand":"Gree","model":"Split Inverter","btus":9000}]'::jsonb);
END $t$;

-- ===== 5. OUTRA EMPRESA (B) tentando chegar nos dados da A =====
DO $t$ DECLARE bad text; n int; BEGIN
  PERFORM t.as_user('33333333-0000-0000-0000-000000000001');
  PERFORM t.check('dono B NÃO vê tarefas da A', (SELECT count(*) FROM service_tasks) = 0);
  PERFORM t.check('dono B NÃO vê clientes da A', (SELECT count(*) FROM clients) = 1 AND (SELECT name FROM clients)='Cliente B');
  PERFORM t.check('dono B NÃO vê pedidos da A', (SELECT count(*) FROM service_requests) = 0);
  PERFORM t.check('dono B NÃO vê aparelhos da A', (SELECT count(*) FROM task_items) = 0);
  PERFORM t.check('dono B NÃO vê equipe da A', (SELECT count(*) FROM users) = 2);
  PERFORM t.check('dono B NÃO vê configurações da A', (SELECT count(*) FROM company_settings) = 1);
  n := t.rows('UPDATE clients SET name=''INVADIDO'' WHERE id=(SELECT v FROM t.vars WHERE k=''client_maria'')::uuid');
  PERFORM t.check('dono B NÃO altera cliente da A', n = 0);
  n := t.rows('UPDATE service_tasks SET notes=''invadido'' WHERE id=(SELECT v FROM t.vars WHERE k=''task_a1'')::uuid');
  PERFORM t.check('dono B NÃO altera tarefa da A', n = 0);
  bad := t.err(format($q$SELECT save_task(%L,'{"notes":"x"}',NULL,NULL)$q$, (SELECT v FROM t.vars WHERE k='task_a1')));
  PERFORM t.check('dono B NÃO salva tarefa da A via função', bad LIKE 'Tarefa não encontrada%', bad);
  bad := t.err(format($q$SELECT create_task_from_request(%L,NULL,NULL)$q$, (SELECT v FROM t.vars WHERE k='req_joana')));
  PERFORM t.check('dono B NÃO transforma pedido da A em tarefa', bad LIKE 'Pedido não encontrado%', bad);
END $t$;

-- ===== 6. PEDIDO vira TAREFA (gestor A) =====
DO $t$ DECLARE r jsonb; n0 int; n1 int; req record; BEGIN
  PERFORM t.as_user('11111111-1111-1111-1111-111111111111');
  n0 := (SELECT count(*) FROM clients);
  r := public.create_task_from_request((SELECT v FROM t.vars WHERE k='req_joana')::uuid, '22222222-0000-0000-0000-000000000002', current_date+3);
  PERFORM t.check('pedido virou tarefa com OS', r->>'order_number' ~ '^[0-9]{4}-[0-9]{4}$', r::text);
  PERFORM t.check('cliente novo criado a partir do pedido', (SELECT count(*) FROM clients) = n0+1 AND EXISTS (SELECT 1 FROM clients WHERE name='Joana Silva' AND phone='15911112222'));
  PERFORM t.check('aparelhos do pedido viraram aparelhos da tarefa (2)', (SELECT count(*) FROM task_items WHERE task_id=(r->>'task_id')::uuid) = 2);
  SELECT * INTO req FROM service_requests WHERE id=(SELECT v FROM t.vars WHERE k='req_joana')::uuid;
  PERFORM t.check('pedido marcado como agendado e ligado à tarefa', req.status='scheduled' AND req.task_id=(r->>'task_id')::uuid);
  PERFORM t.check('mesmo pedido não vira tarefa duas vezes', t.err(format($q$SELECT create_task_from_request(%L,NULL,NULL)$q$, req.id)) LIKE 'Este pedido já virou tarefa%');
  PERFORM t.check('gestor edita status do pedido', t.rows('UPDATE service_requests SET status=''contacted'' WHERE id=(SELECT v FROM t.vars WHERE k=''req_carlos'')::uuid') = 1);
END $t$;
-- pedido de cliente que já existe (mesmo telefone) reaproveita o cadastro
DO $t$ DECLARE rq jsonb; r jsonb; n0 int; BEGIN
  PERFORM t.as_anon('5.5.5.5');
  rq := public.submit_request('ice','maintenance','Maria de novo','(15) 99999-0000',NULL,'Rua X, 5',NULL,'[]',NULL,'ruído estranho','normal',NULL,NULL);
  PERFORM t.as_user('11111111-1111-1111-1111-111111111111');
  n0 := (SELECT count(*) FROM clients);
  r := public.create_task_from_request((SELECT id FROM service_requests WHERE request_number=(rq->>'number')::int AND name='Maria de novo'), NULL, NULL);
  PERFORM t.check('pedido com telefone já cadastrado reaproveita o cliente', (SELECT count(*) FROM clients) = n0
     AND (SELECT client_id FROM service_tasks WHERE id=(r->>'task_id')::uuid) = (SELECT v FROM t.vars WHERE k='client_maria')::uuid);
END $t$;

INSERT INTO t.vars SELECT 'code_antigo', client_code FROM clients WHERE name='Cliente Antigo';
-- ===== 7. CONSULTA DE GARANTIA (visitante com o código) =====
DO $t$ DECLARE r jsonb; code text := (SELECT v FROM t.vars WHERE k='code_maria'); txt text; BEGIN
  PERFORM t.as_anon('6.6.6.6');
  r := public.lookup_warranty(code);
  txt := r::text;
  PERFORM t.check('código válido acha os aparelhos concluídos (2 da OS concluída)', (r->>'found')::boolean AND jsonb_array_length(r->'items') = 2, txt);
  PERFORM t.check('só aparelho/OS/datas: sem nome, telefone, endereço ou e-mail', txt NOT ILIKE '%Maria%' AND txt NOT LIKE '%15999990000%' AND txt NOT LIKE '%Rua X%'
     AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(r->'items'->0) k) = ARRAY['brand','btus','installed_on','model','os','warranty_expires_at']);
  PERFORM t.check('tarefa reaberta não aparece na garantia', txt NOT LIKE '%Philco%');
  PERFORM t.check('código em minúsculas e com espaços funciona', (public.lookup_warranty('  '||lower(code)||' ')->>'found')::boolean);
  PERFORM t.check('código inexistente = found:false', (public.lookup_warranty('ZZZZZZ')->>'found')::boolean = false);
  PERFORM t.check('código mal formado = found:false', (public.lookup_warranty('abc')->>'found')::boolean = false);
  PERFORM t.check('cliente migrado acha a OS antiga com garantia original', (SELECT jsonb_array_length(public.lookup_warranty((SELECT v FROM t.vars WHERE k='code_antigo'))->'items')) = 1);
END $t$;
DO $t$ DECLARE i int; last text; BEGIN
  PERFORM t.as_anon('7.7.7.7');
  FOR i IN 1..20 LOOP PERFORM public.lookup_warranty('AAAAA'||(i%9+1)); END LOOP;
  last := t.err($q$SELECT lookup_warranty('BBBBBB')$q$);
  PERFORM t.check('21ª tentativa de código do mesmo IP em 10 min é bloqueada (anti-adivinhação)', last LIKE 'Muitas tentativas%', last);
  PERFORM t.as_anon('8.8.8.8');
  PERFORM t.check('outro IP não é afetado', (public.lookup_warranty('BBBBBB')->>'found')::boolean = false);
END $t$;

-- ===== 8. PUSH =====
DO $t$ DECLARE ok boolean; code text := (SELECT v FROM t.vars WHERE k='code_maria'); BEGIN
  PERFORM t.as_anon('9.9.9.1');
  ok := public.save_push_subscription(code, 'https://fcm.googleapis.com/fcm/send/maria-1', repeat('B',65), 'authsecret123456', 'Chrome');
  PERFORM t.check('cliente com código ativa avisos', ok);
  PERFORM t.check('reativar o mesmo aparelho não duplica', public.save_push_subscription(code, 'https://fcm.googleapis.com/fcm/send/maria-1', repeat('B',65), 'authsecret123456', 'Chrome'));
  PERFORM t.check('código errado não ativa avisos', public.save_push_subscription('ZZZZZZ', 'https://fcm.googleapis.com/fcm/send/x', repeat('B',65), 'authsecret123456') = false);
  PERFORM t.check('endpoint sem https é recusado', t.err($q$SELECT save_push_subscription('$q$||code||$q$','http://evil/x','BBBBBBBBBBBBBB','authsecret123456')$q$) IS NOT NULL);
  PERFORM t.as_anon('9.9.9.3');
  -- fix_05: só serviços de push conhecidos (evita o servidor chamar endereços internos)
  PERFORM t.check('endereço interno (169.254...) é recusado', t.err($q$SELECT save_push_subscription('$q$||code||$q$','https://169.254.169.254/latest','BBBBBBBBBBBBBB','authsecret123456')$q$) LIKE 'Serviço de avisos não reconhecido%');
  PERFORM t.check('domínio falso parecido é recusado', t.err($q$SELECT save_push_subscription('$q$||code||$q$','https://fcm.googleapis.com.evil.com/x','BBBBBBBBBBBBBB','authsecret123456')$q$) LIKE 'Serviço de avisos não reconhecido%');
  PERFORM t.check('truque com @ é recusado', t.err($q$SELECT save_push_subscription('$q$||code||$q$','https://fcm.googleapis.com@evil.com/x','BBBBBBBBBBBBBB','authsecret123456')$q$) LIKE 'Serviço de avisos não reconhecido%');
  PERFORM t.check('endereço aleatório https é recusado', t.err($q$SELECT save_push_subscription('$q$||code||$q$','https://meu-servidor.com/push','BBBBBBBBBBBBBB','authsecret123456')$q$) LIKE 'Serviço de avisos não reconhecido%');
  PERFORM t.check('Firefox, Windows e Apple são aceitos',
    public.save_push_subscription(code, 'https://updates.push.services.mozilla.com/wpush/v2/abc', repeat('B',65), 'authsecret123456')
    AND public.save_push_subscription(code, 'https://wns2-par02p.notify.windows.com/w/?token=abc', repeat('B',65), 'authsecret123456')
    AND public.save_push_subscription(code, 'https://web.push.apple.com/abc', repeat('B',65), 'authsecret123456'));
  PERFORM public.remove_push_subscription('https://updates.push.services.mozilla.com/wpush/v2/abc');
  PERFORM public.remove_push_subscription('https://wns2-par02p.notify.windows.com/w/?token=abc');
  PERFORM public.remove_push_subscription('https://web.push.apple.com/abc');
  PERFORM t.check('anon remove a própria inscrição', public.remove_push_subscription('https://fcm.googleapis.com/fcm/send/nao-existe'));
  PERFORM public.save_push_subscription((SELECT v FROM t.vars WHERE k='code_antigo'), 'https://fcm.googleapis.com/fcm/send/antigo-1', repeat('C',65), 'authsecret654321');
END $t$;

DO $t$ DECLARE n uuid; r record; cnt int; BEGIN
  PERFORM t.as_user('11111111-1111-1111-1111-111111111111');
  PERFORM t.check('gestor conta as inscrições (2)', (SELECT count(*) FROM push_subscriptions) = 2);
  PERFORM t.check('gestor NÃO lê endpoint/chaves das inscrições', t.err($q$SELECT endpoint FROM push_subscriptions$q$) LIKE 'permission denied%' AND t.err($q$SELECT p256dh FROM push_subscriptions$q$) LIKE 'permission denied%');
  PERFORM t.check('gestor NÃO chama notification_targets direto', t.err($q$SELECT * FROM notification_targets(gen_random_uuid())$q$) LIKE 'permission denied%');
  -- tenta forçar status/contadores na criação
  INSERT INTO notifications(company_id,title,body,audience,status,sent_count,failed_count,sent_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Faça a manutenção','Seu ar precisa de revisão','all','sent',77,5,now()) RETURNING id INTO n;
  INSERT INTO t.vars VALUES ('notif_all', n::text);
  SELECT * INTO r FROM notifications WHERE id=n;
  PERFORM t.check('gestor NÃO cria notificação já "enviada" nem com contadores falsos', r.status='scheduled' AND r.sent_count=0 AND r.failed_count=0 AND r.sent_at IS NULL, row(r.status,r.sent_count)::text);
  PERFORM t.check('público "cliente" exige cliente', t.err($q$INSERT INTO notifications(company_id,title,body,audience) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','a','b','client')$q$) LIKE '%check constraint%');
  PERFORM t.check('link da notificação só aceita caminho interno', t.err($q$INSERT INTO notifications(company_id,title,body,audience,url) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','a','b','all','https://evil.com')$q$) LIKE '%check constraint%'
     AND t.err($q$INSERT INTO notifications(company_id,title,body,audience,url) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','a','b','all','javascript:alert(1)')$q$) LIKE '%check constraint%');
  INSERT INTO notifications(company_id,title,body,audience,client_id,scheduled_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Só a Maria','Olá!','client',(SELECT v FROM t.vars WHERE k='client_maria')::uuid, now()) RETURNING id INTO n;
  INSERT INTO t.vars VALUES ('notif_maria', n::text);
  INSERT INTO notifications(company_id,title,body,audience,scheduled_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Futuro','Amanhã','all', now()+interval '1 day') RETURNING id INTO n;
  INSERT INTO t.vars VALUES ('notif_future', n::text);
  UPDATE notifications SET sent_count=99, title='Futuro (editado)' WHERE id=n;
  PERFORM t.check('gestor edita notificação agendada, mas não os contadores', (SELECT title='Futuro (editado)' AND sent_count=0 FROM notifications WHERE id=n));
  PERFORM t.check('gestor NÃO marca como enviada na mão', t.err(format($q$UPDATE notifications SET status='sent' WHERE id=%L$q$, n)) LIKE '%row-level security%');
  PERFORM t.check('gestor cancela agendada', t.rows(format($q$UPDATE notifications SET status='cancelled' WHERE id=%L$q$, n)) = 1);
  PERFORM t.check('notificação cancelada não muda mais', t.rows(format($q$UPDATE notifications SET status='scheduled' WHERE id=%L$q$, n)) = 0);
END $t$;
DO $t$ DECLARE n int; ids uuid[]; r record; BEGIN
  -- servidor (service_role): reivindica o que está vencido e calcula os alvos
  PERFORM t.as_service();
  SELECT array_agg(id) INTO ids FROM claim_notifications();
  PERFORM t.check('servidor reivindica só as notificações vencidas (2) e não a agendada/cancelada', coalesce(array_length(ids,1),0) = 2 AND (SELECT v FROM t.vars WHERE k='notif_future')::uuid <> ALL(ids), ids::text);
  PERFORM t.check('reivindicação é única (segunda chamada não devolve nada)', (SELECT count(*) FROM claim_notifications()) = 0);
  PERFORM t.check('público "todos" = 2 aparelhos', (SELECT count(*) FROM notification_targets((SELECT v FROM t.vars WHERE k='notif_all')::uuid)) = 2);
  PERFORM t.check('público "cliente" = só o aparelho da Maria', (SELECT count(*) FROM notification_targets((SELECT v FROM t.vars WHERE k='notif_maria')::uuid)) = 1
     AND (SELECT endpoint FROM notification_targets((SELECT v FROM t.vars WHERE k='notif_maria')::uuid)) = 'https://fcm.googleapis.com/fcm/send/maria-1');
  PERFORM t.back();
END $t$;
-- garantia vencendo / vencida
INSERT INTO notifications(id,company_id,title,body,audience) VALUES
 ('dddddddd-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Vencendo','x','warranty_expiring'),
 ('dddddddd-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','Vencida','x','warranty_expired');
UPDATE service_tasks SET done_on = (current_date + 10 - interval '12 months')::date WHERE id=(SELECT v FROM t.vars WHERE k='task_a1')::uuid;
DO $t$ BEGIN
  PERFORM t.as_service();
  PERFORM t.check('público "garantia vencendo" acha a Maria (vence em 10 dias)', (SELECT count(*) FROM notification_targets('dddddddd-0000-0000-0000-00000000000a')) = 1);
  PERFORM t.check('"garantia vencida" não pega quem ainda está coberto', (SELECT count(*) FROM notification_targets('dddddddd-0000-0000-0000-00000000000b')) = 0);
  PERFORM t.back();
END $t$;
UPDATE service_tasks SET done_on = (current_date - 5 - interval '12 months')::date WHERE id=(SELECT v FROM t.vars WHERE k='task_a1')::uuid;
DO $t$ BEGIN
  PERFORM t.as_service();
  PERFORM t.check('"garantia vencendo" não pega vencida', (SELECT count(*) FROM notification_targets('dddddddd-0000-0000-0000-00000000000a')) = 0);
  PERFORM t.check('"garantia vencida" acha a Maria', (SELECT count(*) FROM notification_targets('dddddddd-0000-0000-0000-00000000000b')) = 1);
  PERFORM t.back();
END $t$;

-- ===== 9. TÉCNICO DESATIVADO =====
UPDATE users SET active=false WHERE id='22222222-0000-0000-0000-000000000003';
DO $t$ DECLARE bad text; BEGIN
  PERFORM t.as_user('22222222-0000-0000-0000-000000000003');
  PERFORM t.check('técnico desativado não vê tarefas (nem as dele)', (SELECT count(*) FROM service_tasks) = 0);
  PERFORM t.check('técnico desativado não vê clientes', (SELECT count(*) FROM clients) = 0);
  PERFORM t.check('técnico desativado não altera tarefa', t.err(format($q$SELECT save_task(%L,'{"notes":"x"}',NULL,NULL)$q$, (SELECT v FROM t.vars WHERE k='task_a4_t3'))) LIKE 'Tarefa não encontrada%');
  PERFORM t.as_user('11111111-1111-1111-1111-111111111111');
  bad := t.err($q$SELECT create_task('cccccccc-0000-0000-0000-000000000001','installation','22222222-0000-0000-0000-000000000003',NULL,NULL,NULL,NULL,'[]')$q$);
  PERFORM t.check('gestor NÃO atribui tarefa a técnico desativado', bad LIKE 'Técnico inválido%', bad);
END $t$;

-- ===== 10. CONFIGURAÇÕES e CATÁLOGO =====
DO $t$ DECLARE n int; BEGIN
  PERFORM t.as_user('11111111-1111-1111-1111-111111111111');
  PERFORM t.check('gestor altera WhatsApp/nome', t.rows('UPDATE company_settings SET business_name=''ICE Multservice'' , whatsapp=''5515996966519''') = 1);
  PERFORM t.check('WhatsApp só aceita dígitos com DDI', t.err($q$UPDATE company_settings SET whatsapp='(15) 9999'$q$) LIKE '%check constraint%');
  PERFORM t.check('logo PNG em base64 é aceita', t.err($q$UPDATE company_settings SET logo_data_url='data:image/png;base64,iVBORw0KGgo='$q$) IS NULL);
  PERFORM t.check('logo SVG (pode carregar script) é recusada', t.err($q$UPDATE company_settings SET logo_data_url='data:image/svg+xml;base64,PHN2Zz4='$q$) LIKE '%check constraint%');
  PERFORM t.check('logo de URL externa é recusada', t.err($q$UPDATE company_settings SET logo_data_url='https://evil.com/x.png'$q$) LIKE '%check constraint%');
  PERFORM t.check('gestor adiciona modelo ao catálogo', t.err($q$INSERT INTO appliance_models(company_id,brand,line) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Daikin','Inverter')$q$) IS NULL);
  PERFORM t.check('modelo repetido é recusado', t.err($q$INSERT INTO appliance_models(company_id,brand,line) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','daikin','INVERTER')$q$) LIKE '%duplicate key%');
  PERFORM t.check('gestor NÃO mexe no catálogo da outra empresa', t.err($q$INSERT INTO appliance_models(company_id,brand,line) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','Hack','X1')$q$) LIKE '%row-level security%');
  PERFORM t.as_user('22222222-0000-0000-0000-000000000001');
  PERFORM t.check('técnico lê o catálogo', (SELECT count(*) FROM appliance_models) = 8);
  PERFORM t.check('técnico NÃO mexe no catálogo', t.err($q$INSERT INTO appliance_models(company_id,brand,line) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Zzz','Top')$q$) LIKE '%row-level security%');
  PERFORM t.as_anon('1.2.3.4');
  PERFORM t.check('catálogo público reflete o novo modelo (8)', jsonb_array_length(public.get_public_catalog('ice')) = 8);
  PERFORM t.check('nome novo aparece na config pública', public.get_public_settings('ice')->>'business_name' = 'ICE Multservice');
END $t$;

-- ===== 11. fix_05: LEGADO e CONSULTA =====
DO $t$ BEGIN
  PERFORM t.as_user('22222222-0000-0000-0000-000000000001');
  PERFORM t.check('técnico NÃO lê mais installations (legado)', (SELECT count(*) FROM installations) = 0);
  PERFORM t.check('técnico NÃO lê maintenance_requests (legado)', (SELECT count(*) FROM maintenance_requests) = 0);
  PERFORM t.check('técnico NÃO lê as views antigas', t.err('SELECT count(*) FROM public.clients_with_warranty') LIKE 'permission denied%');
  PERFORM t.as_user('11111111-1111-1111-1111-111111111111');
  PERFORM t.check('gestor ainda lê installations (legado)', (SELECT count(*) FROM installations) >= 1);
  PERFORM t.check('gestor NÃO lê leads', t.err('SELECT count(*) FROM public.leads') LIKE 'permission denied%');
  PERFORM t.as_user('33333333-0000-0000-0000-000000000001');
  PERFORM t.check('gestor de OUTRA empresa não lê o legado da ICE', (SELECT count(*) FROM installations) = 0);
  PERFORM t.as_anon('7.7.7.7');
  PERFORM t.check('anon NÃO lê as views antigas', t.err('SELECT count(*) FROM public.upcoming_warranty_expirations') LIKE 'permission denied%');
END $t$;

-- sem trava global: muitos IPs diferentes consultam à vontade; o mesmo IP continua limitado
DO $t$ DECLARE i int; last text; BEGIN
  FOR i IN 1..1100 LOOP
    PERFORM t.as_anon('8.8.' || (i / 250) || '.' || (i % 250 + 1));
    PERFORM public.lookup_warranty('ZZZZZ2');
  END LOOP;
  PERFORM t.as_anon('8.9.9.9');
  PERFORM t.check('1100 consultas de IPs diferentes NÃO travam a consulta para os outros', (public.lookup_warranty('ZZZZZ2')->>'found')::boolean = false);
  PERFORM t.back();
  PERFORM t.check('não existe mais a chave global lookup:all', NOT EXISTS (SELECT 1 FROM rate_limits WHERE key = 'lookup:all'));
END $t$;

-- ===== RESULTADO =====
\set QUIET 0
\pset format aligned
SELECT count(*) FILTER (WHERE ok) AS passou, count(*) FILTER (WHERE NOT ok) AS falhou, count(*) AS total FROM t.results;
SELECT n, label, detail FROM t.results WHERE NOT ok ORDER BY n;
