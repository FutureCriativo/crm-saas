-- ============================================================================
-- CORREÇÃO 05 — SEGURANÇA EXTRA (rodar UMA vez, depois do fix_04)
-- Pode rodar de novo sem quebrar (idempotente).
--
--  1. Avisos push: só aceita endereços de serviços de push conhecidos (evita o servidor
--     ser usado para chamar endereços internos/aleatórios — "SSRF")
--  2. Consulta de garantia: tira a trava GLOBAL (um robô derrubava a consulta de todos);
--     fica só a trava por IP (curta e diária)
--  3. Data de conclusão: técnico só pode informar de 7 dias atrás até hoje
--     (a data define a garantia; o gestor continua livre para corrigir)
--  4. Tabelas antigas (installations, maintenance_*, leads): leitura só do gestor
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PUSH: lista de serviços permitidos
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_allowed_push_endpoint(p_url text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_url ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)(:443)?/[A-Za-z0-9._~:/?#@!$&''()*+,;=%-]*$'
$$;

-- Inscrições que já existem e não passam na lista saem (só podem ter vindo de teste ou abuso)
DELETE FROM public.push_subscriptions WHERE NOT public.is_allowed_push_endpoint(endpoint);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_endpoint_allowed') THEN
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_endpoint_allowed CHECK (public.is_allowed_push_endpoint(endpoint));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.save_push_subscription(p_code text, p_endpoint text, p_p256dh text, p_auth text, p_ua text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client public.clients;
BEGIN
  PERFORM public.rate_limit_check('push:ip:' || public.client_ip(), 10, 600);
  IF NOT public.is_allowed_push_endpoint(COALESCE(p_endpoint, '')) THEN
    RAISE EXCEPTION 'Serviço de avisos não reconhecido.';
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE client_code = upper(btrim(COALESCE(p_code, '')));
  IF v_client.id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.push_subscriptions (company_id, client_id, endpoint, p256dh, auth, user_agent)
  VALUES (v_client.company_id, v_client.id, p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  ON CONFLICT (endpoint) DO UPDATE SET client_id = EXCLUDED.client_id, company_id = EXCLUDED.company_id,
                                      p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. CONSULTA DE GARANTIA: sem trava global
--    (31^6 = 887 milhões de códigos: 20 tentativas/10 min e 200/dia por IP já tornam adivinhar inviável)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_warranty(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(btrim(COALESCE(p_code, ''))); v_client uuid; v_items jsonb; v_ip text := public.client_ip();
BEGIN
  PERFORM public.rate_limit_check('lookup:ip:' || v_ip, 20, 600);
  PERFORM public.rate_limit_check('lookup:day:' || v_ip, 200, 86400);
  IF v_code !~ '^[A-Z0-9]{6}$' THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT id INTO v_client FROM public.clients WHERE client_code = v_code;
  IF v_client IS NULL THEN RETURN jsonb_build_object('found', false); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'os', t.order_number, 'brand', i.brand, 'model', i.model, 'btus', i.btus,
           'installed_on', t.done_on, 'warranty_expires_at', t.warranty_expires_at
         ) ORDER BY t.done_on DESC, i.position), '[]'::jsonb)
    INTO v_items
  FROM public.service_tasks t JOIN public.task_items i ON i.task_id = t.id
  WHERE t.client_id = v_client AND t.kind = 'installation' AND t.status = 'done';

  RETURN jsonb_build_object('found', true, 'items', v_items);
END $$;
GRANT EXECUTE ON FUNCTION public.lookup_warranty(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. DATA DE CONCLUSÃO: técnico limitado a [hoje-7, hoje]
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.service_tasks_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_year text; v_seq int; v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_limited boolean;
BEGIN
  v_limited := current_user IN ('authenticated', 'anon') AND NOT public.is_owner();

  IF TG_OP = 'INSERT' THEN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
      v_year := to_char(v_today, 'YYYY');
      PERFORM pg_advisory_xact_lock(hashtext('os:' || NEW.company_id::text || v_year));
      SELECT COALESCE(MAX(split_part(order_number, '-', 2)::int), 0) + 1 INTO v_seq FROM public.service_tasks
        WHERE company_id = NEW.company_id AND order_number ~ ('^' || v_year || '-[0-9]+$');
      NEW.order_number := v_year || '-' || lpad(v_seq::text, 4, '0');
    END IF;
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  ELSE
    IF NEW.company_id <> OLD.company_id OR NEW.order_number <> OLD.order_number OR NEW.request_id IS DISTINCT FROM OLD.request_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Este campo não pode ser alterado.';
    END IF;
    IF v_limited AND (NEW.client_id <> OLD.client_id OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.kind <> OLD.kind
       OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date OR NEW.warranty_months <> OLD.warranty_months
       OR NEW.problem IS DISTINCT FROM OLD.problem) THEN
      RAISE EXCEPTION 'Só o gestor pode alterar cliente, técnico, data agendada, garantia ou problema informado.';
    END IF;
  END IF;

  -- Cliente e técnico precisam ser da mesma empresa
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = NEW.client_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Cliente não pertence à empresa.';
  END IF;
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.assigned_to AND company_id = NEW.company_id
                   AND role IN ('technician','owner') AND active) THEN
      RAISE EXCEPTION 'Técnico inválido ou desativado.';
    END IF;
  END IF;

  -- Técnico: a data do serviço não pode ser futura nem muito antiga (ela define a garantia)
  IF v_limited AND NEW.done_on IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.done_on IS DISTINCT FROM OLD.done_on) THEN
    IF NEW.done_on > v_today OR NEW.done_on < v_today - 7 THEN
      RAISE EXCEPTION 'A data do serviço deve ser de hoje ou dos últimos 7 dias. Para outra data, fale com o gestor.';
    END IF;
  END IF;

  -- Concluir / reabrir
  IF NEW.status = 'done' THEN
    IF TG_OP = 'INSERT' OR OLD.status <> 'done' THEN
      IF NEW.kind = 'installation' AND NOT EXISTS (SELECT 1 FROM public.task_items WHERE task_id = NEW.id) THEN
        RAISE EXCEPTION 'Adicione pelo menos um aparelho antes de concluir a instalação.';
      END IF;
      NEW.completed_at := now();
      NEW.completed_by := auth.uid();
    END IF;
    NEW.done_on := COALESCE(NEW.done_on, v_today);
    NEW.warranty_expires_at := CASE WHEN NEW.warranty_months > 0
      THEN (NEW.done_on + make_interval(months => NEW.warranty_months))::date ELSE NULL END;
  ELSE
    IF TG_OP = 'UPDATE' AND OLD.status = 'done' THEN NEW.reopened_count := OLD.reopened_count + 1; END IF;
    NEW.completed_at := NULL; NEW.completed_by := NULL; NEW.warranty_expires_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ----------------------------------------------------------------------------
-- 4. TABELAS ANTIGAS: só o gestor lê (antes, qualquer técnico da empresa lia tudo)
-- ----------------------------------------------------------------------------
DO $$ DECLARE r record; t text; BEGIN
  FOREACH t IN ARRAY ARRAY['installations', 'maintenance_requests', 'maintenance_records', 'leads'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, t);
      END LOOP;
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;

CREATE POLICY legacy_owner_select ON public.installations FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND public.is_owner());
CREATE POLICY legacy_owner_select ON public.maintenance_requests FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND public.is_owner());
CREATE POLICY legacy_owner_select ON public.maintenance_records FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND public.is_owner());
-- leads: sem regra nenhuma = ninguém lê pelo navegador (o formulário antigo foi fechado)

-- Views antigas: o app novo não usa mais. Ficam sem acesso pelo navegador.
DO $$ BEGIN
  IF to_regclass('public.clients_with_warranty') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.clients_with_warranty FROM anon, authenticated';
  END IF;
  IF to_regclass('public.upcoming_warranty_expirations') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.upcoming_warranty_expirations FROM anon, authenticated';
  END IF;
END $$;

COMMIT;

-- CONFERÊNCIA
SELECT
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_endpoint_allowed')                                   AS lista_push_ativa,
  (SELECT count(*) FROM public.push_subscriptions)                                                               AS inscricoes_restantes,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname = 'legacy_owner_select')         AS regras_legado;
