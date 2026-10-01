-- ============================================================================
-- CORREÇÃO 04 — ARQUITETURA v2 (Assistência, Tarefas, Técnicos, Garantia, Push)
-- Rodar UMA vez no Supabase SQL Editor, depois dos fix_01, fix_02 e fix_03.
-- Pode rodar de novo sem quebrar (idempotente).
--
-- O que este script faz:
--  1. Empresa ganha "slug" (endereço curto) e configurações (logo, WhatsApp)
--  2. Técnicos passam a ter usuário + senha (sem e-mail de verdade)
--  3. Clientes ganham um CÓDIGO de 6 caracteres (para consultar garantia)
--  4. Pedidos da Assistência (instalação/manutenção) entram por função segura
--  5. Tarefas (OS) + aparelhos de cada tarefa; OS numerada ANO-0001
--  6. Consulta pública de garantia pelo código (sem expor dados pessoais)
--  7. Notificações push (inscrições + disparos programados)
--  8. Regras de acesso (RLS): técnico só vê as tarefas dele
--  9. Migra as OS antigas (tabela installations) para o modelo novo
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EMPRESA: slug + funções de apoio
-- ----------------------------------------------------------------------------
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS slug text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_slug_format') THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_slug_format CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]{2,40}$');
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_slug ON public.companies(slug);
-- Hoje existe uma empresa só: ela vira "ice" (o site usa NEXT_PUBLIC_COMPANY_SLUG=ice)
UPDATE public.companies SET slug = 'ice' WHERE slug IS NULL AND (SELECT count(*) FROM public.companies) = 1;

-- USUÁRIOS: técnicos entram com usuário + senha
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_format') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9._-]{3,30}$');
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_company_username ON public.users(company_id, username) WHERE username IS NOT NULL;

-- Quem é quem (a prova de recursão e respeitando "ativo")
CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role IN ('owner','technician') AND active FROM public.users WHERE id = auth.uid() LIMIT 1), false)
$$;
CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role = 'owner' AND active FROM public.users WHERE id = auth.uid() LIMIT 1), false)
$$;

-- ----------------------------------------------------------------------------
-- 2. LIMITE DE TENTATIVAS (anti-abuso nas funções públicas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- IP de quem chamou (o cabeçalho do Cloudflare não pode ser forjado pelo visitante)
CREATE OR REPLACE FUNCTION public.client_ip() RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE h json; v text;
BEGIN
  BEGIN
    h := current_setting('request.headers', true)::json;
  EXCEPTION WHEN others THEN h := NULL;
  END;
  IF h IS NULL THEN RETURN 'unknown'; END IF;
  v := nullif(btrim(h->>'cf-connecting-ip'), '');
  IF v IS NULL THEN
    v := nullif(btrim((string_to_array(COALESCE(h->>'x-forwarded-for', ''), ','))[array_length(string_to_array(COALESCE(h->>'x-forwarded-for', ''), ','), 1)]), '');
  END IF;
  RETURN COALESCE(left(v, 60), 'unknown');
END $$;

CREATE OR REPLACE FUNCTION public.rate_limit_check(p_key text, p_max int, p_window_seconds int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w timestamptz; h int;
BEGIN
  w := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.rate_limits (key, window_start, hits) VALUES (p_key, w, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET hits = public.rate_limits.hits + 1
    RETURNING hits INTO h;
  IF h > p_max THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  END IF;
  IF random() < 0.02 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.rate_limit_check(text, int, int) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. CLIENTE: código de 6 caracteres (sem 0, O, 1, I, L para não confundir)
-- ----------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_code varchar(6);

CREATE OR REPLACE FUNCTION public.gen_client_code() RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea; code text; i int;
BEGIN
  LOOP
    b := uuid_send(gen_random_uuid());      -- aleatório de verdade (não adivinhável)
    code := '';
    FOR i IN 0..5 LOOP
      code := code || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clients WHERE client_code = code);
  END LOOP;
  RETURN code;
END $$;

CREATE OR REPLACE FUNCTION public.set_client_code() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_code IS NULL OR NEW.client_code = '' THEN NEW.client_code := public.gen_client_code(); END IF;
  NEW.client_code := upper(NEW.client_code);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS set_client_code_trigger ON public.clients;
CREATE TRIGGER set_client_code_trigger BEFORE INSERT OR UPDATE OF client_code ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_client_code();

UPDATE public.clients SET client_code = public.gen_client_code() WHERE client_code IS NULL;
ALTER TABLE public.clients ALTER COLUMN client_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_code ON public.clients(client_code);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_code_format') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_code_format CHECK (client_code ~ '^[A-Z0-9]{6}$');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. CONFIGURAÇÕES DA EMPRESA (logo, WhatsApp) + CATÁLOGO DE APARELHOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT '' CHECK (char_length(business_name) <= 80),
  whatsapp text CHECK (whatsapp IS NULL OR whatsapp ~ '^[0-9]{12,13}$'),  -- com DDI: 5515999999999
  logo_data_url text CHECK (logo_data_url IS NULL OR (char_length(logo_data_url) <= 300000
      AND logo_data_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')),  -- SVG fica de fora de propósito (risco de script)
  warranty_months_default int NOT NULL DEFAULT 12 CHECK (warranty_months_default BETWEEN 0 AND 120),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appliance_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brand text NOT NULL CHECK (char_length(btrim(brand)) BETWEEN 2 AND 40),
  line text NOT NULL CHECK (char_length(btrim(line)) BETWEEN 2 AND 60),
  sort int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_appliance_models ON public.appliance_models(company_id, lower(brand), lower(line));

-- Lista inicial: linhas populares no Brasil (não é ranking oficial; o gestor edita à vontade)
CREATE OR REPLACE FUNCTION public.seed_company_defaults(p_company uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_settings (company_id, business_name)
    SELECT c.id, c.name FROM public.companies c WHERE c.id = p_company
    ON CONFLICT (company_id) DO NOTHING;
  INSERT INTO public.appliance_models (company_id, brand, line, sort) VALUES
    (p_company, 'Springer Midea', 'Split Inverter', 1),
    (p_company, 'LG',             'Dual Inverter',  2),
    (p_company, 'Samsung',        'WindFree Inverter', 3),
    (p_company, 'Gree',           'Split Inverter', 4),
    (p_company, 'Elgin',          'Split Inverter', 5),
    (p_company, 'Philco',         'Split Inverter', 6),
    (p_company, 'Consul',         'Split',          7)
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.seed_company_defaults(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_company_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.seed_company_defaults(NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS company_defaults_trigger ON public.companies;
CREATE TRIGGER company_defaults_trigger AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.on_company_created();

SELECT public.seed_company_defaults(id) FROM public.companies;

-- Dados iniciais da ICE (empresa com slug 'ice'): WhatsApp que recebe os pedidos
UPDATE public.company_settings s SET whatsapp = '5515996966519', business_name = 'ICE Multservice Climatização'
  FROM public.companies c WHERE c.id = s.company_id AND c.slug = 'ice' AND s.whatsapp IS NULL;

-- Dados PÚBLICOS da empresa (nome, WhatsApp, logo) e lista de aparelhos para o formulário
CREATE OR REPLACE FUNCTION public.get_public_settings(p_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('business_name', s.business_name, 'whatsapp', s.whatsapp, 'logo', s.logo_data_url)
  FROM public.companies c JOIN public.company_settings s ON s.company_id = c.id
  WHERE c.slug = lower(btrim(COALESCE(p_slug, '')))
$$;
CREATE OR REPLACE FUNCTION public.get_public_catalog(p_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', m.id, 'brand', m.brand, 'line', m.line) ORDER BY m.sort, m.brand, m.line), '[]'::jsonb)
  FROM public.appliance_models m JOIN public.companies c ON c.id = m.company_id
  WHERE c.slug = lower(btrim(COALESCE(p_slug, ''))) AND m.active
$$;
GRANT EXECUTE ON FUNCTION public.get_public_settings(text), public.get_public_catalog(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. PEDIDOS DA ASSISTÊNCIA (site público → banco)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_number int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('installation','maintenance')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (phone ~ '^[0-9]{10,11}$'),          -- só DDD + número
  email text CHECK (email IS NULL OR (char_length(email) <= 160 AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  address text NOT NULL CHECK (char_length(btrim(address)) BETWEEN 5 AND 200),
  city text CHECK (city IS NULL OR char_length(city) <= 100),
  client_code varchar(6),
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 10),
  preferred_date date,
  problem text CHECK (problem IS NULL OR char_length(problem) <= 1000),
  urgency text CHECK (urgency IS NULL OR urgency IN ('low','normal','high')),
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','scheduled','done','discarded')),
  task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, request_number)
);
CREATE INDEX IF NOT EXISTS idx_requests_company_status ON public.service_requests(company_id, status, created_at DESC);

-- Limpa a lista de aparelhos que veio do navegador (nunca confiar no que chega)
CREATE OR REPLACE FUNCTION public.sanitize_items(p_items jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE e jsonb; result jsonb := '[]'::jsonb; m text; b text; bt int;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RETURN '[]'::jsonb; END IF;
  IF jsonb_array_length(p_items) > 10 THEN RAISE EXCEPTION 'Máximo de 10 aparelhos por pedido.'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(e) <> 'object' THEN CONTINUE; END IF;
    m := left(btrim(COALESCE(e->>'model', '')), 80);
    b := left(btrim(COALESCE(e->>'brand', '')), 40);
    bt := CASE WHEN (e->>'btus') ~ '^[0-9]{4,6}$' THEN (e->>'btus')::int ELSE NULL END;
    IF m = '' THEN CONTINUE; END IF;
    result := result || jsonb_build_array(jsonb_build_object('brand', nullif(b, ''), 'model', m, 'btus', bt));
  END LOOP;
  RETURN result;
END $$;

-- Única porta de entrada do visitante: valida, limita tentativas e grava
CREATE OR REPLACE FUNCTION public.submit_request(
  p_slug text, p_kind text, p_name text, p_phone text, p_email text, p_address text, p_city text,
  p_items jsonb, p_preferred_date date, p_problem text, p_urgency text, p_client_code text, p_message text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_phone text; v_num int; v_items jsonb; v_code text; v_email text; v_ip text := public.client_ip();
BEGIN
  SELECT id INTO v_company FROM public.companies WHERE slug = lower(btrim(COALESCE(p_slug, '')));
  IF v_company IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('installation','maintenance') THEN RAISE EXCEPTION 'Tipo de pedido inválido.'; END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  IF length(v_phone) IN (12, 13) AND left(v_phone, 2) = '55' THEN v_phone := substr(v_phone, 3); END IF;
  IF length(v_phone) NOT IN (10, 11) THEN RAISE EXCEPTION 'Informe o WhatsApp com DDD.'; END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) < 2 THEN RAISE EXCEPTION 'Informe o nome completo.'; END IF;
  IF char_length(btrim(COALESCE(p_address, ''))) < 5 THEN RAISE EXCEPTION 'Informe o endereço.'; END IF;
  v_email := nullif(btrim(COALESCE(p_email, '')), '');
  IF v_email IS NOT NULL AND (char_length(v_email) > 160 OR v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
    RAISE EXCEPTION 'E-mail inválido.';
  END IF;
  IF p_preferred_date IS NOT NULL AND (p_preferred_date < current_date - 1 OR p_preferred_date > current_date + 365) THEN
    RAISE EXCEPTION 'Data desejada inválida.';
  END IF;
  IF p_urgency IS NOT NULL AND p_urgency NOT IN ('low','normal','high') THEN RAISE EXCEPTION 'Urgência inválida.'; END IF;
  IF char_length(COALESCE(p_problem, '')) > 1000 OR char_length(COALESCE(p_message, '')) > 1000 THEN RAISE EXCEPTION 'Texto muito longo.'; END IF;

  v_items := public.sanitize_items(p_items);
  IF p_kind = 'installation' AND jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'Informe ao menos um aparelho.'; END IF;
  IF p_kind = 'maintenance' AND char_length(btrim(COALESCE(p_problem, ''))) < 3 THEN RAISE EXCEPTION 'Conte qual é o problema.'; END IF;

  v_code := upper(btrim(COALESCE(p_client_code, '')));
  IF v_code !~ '^[A-Z0-9]{6}$' THEN v_code := NULL; END IF;   -- não confirma se o código existe (evita adivinhação)

  -- Limites: por IP, por telefone e por empresa
  PERFORM public.rate_limit_check('req:ip:' || v_ip, 10, 3600);
  PERFORM public.rate_limit_check('req:phone:' || v_phone, 5, 3600);
  PERFORM public.rate_limit_check('req:co:' || v_company::text, 200, 3600);

  PERFORM pg_advisory_xact_lock(hashtext('req:' || v_company::text));
  SELECT COALESCE(MAX(request_number), 0) + 1 INTO v_num FROM public.service_requests WHERE company_id = v_company;

  INSERT INTO public.service_requests (company_id, request_number, kind, name, phone, email, address, city, client_code,
                                       items, preferred_date, problem, urgency, message)
  VALUES (v_company, v_num, p_kind, left(btrim(p_name), 120), v_phone, v_email, left(btrim(p_address), 200),
          nullif(left(btrim(COALESCE(p_city, '')), 100), ''), v_code, v_items, p_preferred_date,
          nullif(btrim(COALESCE(p_problem, '')), ''), p_urgency, nullif(btrim(COALESCE(p_message, '')), ''));

  RETURN jsonb_build_object('number', v_num);
END $$;
GRANT EXECUTE ON FUNCTION public.submit_request(text, text, text, text, text, text, text, jsonb, date, text, text, text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. TAREFAS (= OS) e APARELHOS DA TAREFA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('installation','maintenance')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  address text CHECK (address IS NULL OR char_length(address) <= 200),
  scheduled_date date,
  received_by text CHECK (received_by IS NULL OR char_length(received_by) <= 120),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  problem text CHECK (problem IS NULL OR char_length(problem) <= 1000),
  diagnosis text CHECK (diagnosis IS NULL OR char_length(diagnosis) <= 1000),
  service_done text CHECK (service_done IS NULL OR char_length(service_done) <= 1000),
  parts_used text CHECK (parts_used IS NULL OR char_length(parts_used) <= 500),
  amount numeric(10,2) CHECK (amount IS NULL OR amount >= 0),
  warranty_months int NOT NULL DEFAULT 12 CHECK (warranty_months BETWEEN 0 AND 120),
  done_on date,
  warranty_expires_at date,
  completed_at timestamptz,
  completed_by uuid,
  reopened_count int NOT NULL DEFAULT 0,
  request_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, order_number)
);
CREATE INDEX IF NOT EXISTS idx_tasks_company_status ON public.service_tasks(company_id, status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.service_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON public.service_tasks(client_id);

CREATE TABLE IF NOT EXISTS public.task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.service_tasks(id) ON DELETE CASCADE,
  brand text CHECK (brand IS NULL OR char_length(brand) <= 40),
  model text NOT NULL CHECK (char_length(btrim(model)) BETWEEN 1 AND 80),
  btus int CHECK (btus IS NULL OR btus BETWEEN 3000 AND 120000),
  serial_number text CHECK (serial_number IS NULL OR char_length(serial_number) <= 60),
  location text CHECK (location IS NULL OR char_length(location) <= 60),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_task ON public.task_items(task_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'requests_task_fk') THEN
    ALTER TABLE public.service_requests ADD CONSTRAINT requests_task_fk FOREIGN KEY (task_id) REFERENCES public.service_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Regras da tarefa (calculadas no servidor, nunca aceitas do navegador)
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
DROP TRIGGER IF EXISTS service_tasks_guard_trigger ON public.service_tasks;
CREATE TRIGGER service_tasks_guard_trigger BEFORE INSERT OR UPDATE ON public.service_tasks
  FOR EACH ROW EXECUTE FUNCTION public.service_tasks_guard();

CREATE OR REPLACE FUNCTION public.task_items_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- a empresa do aparelho é SEMPRE a da tarefa (ignora o que veio do navegador)
  SELECT company_id INTO NEW.company_id FROM public.service_tasks WHERE id = NEW.task_id;
  IF NEW.company_id IS NULL THEN RAISE EXCEPTION 'Tarefa não encontrada.'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS task_items_guard_trigger ON public.task_items;
CREATE TRIGGER task_items_guard_trigger BEFORE INSERT ON public.task_items FOR EACH ROW EXECUTE FUNCTION public.task_items_guard();

-- Troca os aparelhos da tarefa de uma vez (tudo ou nada). Respeita as regras de acesso de quem chama.
CREATE OR REPLACE FUNCTION public.save_task_items(p_task uuid, p_items jsonb) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN p_items := '[]'::jsonb; END IF;
  IF jsonb_array_length(p_items) > 20 THEN RAISE EXCEPTION 'Máximo de 20 aparelhos por tarefa.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_tasks WHERE id = p_task) THEN RAISE EXCEPTION 'Tarefa não encontrada.'; END IF;
  DELETE FROM public.task_items WHERE task_id = p_task;
  INSERT INTO public.task_items (company_id, task_id, brand, model, btus, serial_number, location, position)
  SELECT public.my_company_id(), p_task, nullif(btrim(x.brand), ''), btrim(x.model), x.btus,
         nullif(btrim(x.serial_number), ''), nullif(btrim(x.location), ''), (row_number() OVER ())::int - 1
  FROM jsonb_to_recordset(p_items) AS x(brand text, model text, btus int, serial_number text, location text)
  WHERE btrim(COALESCE(x.model, '')) <> '';
END $$;

-- Gestor cria a tarefa (já com aparelhos e técnico)
CREATE OR REPLACE FUNCTION public.create_task(
  p_client uuid, p_kind text, p_assigned uuid, p_date date, p_address text, p_problem text, p_notes text, p_items jsonb
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_task public.service_tasks; v_months int;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Apenas o gestor pode criar tarefas.'; END IF;
  SELECT warranty_months_default INTO v_months FROM public.company_settings WHERE company_id = public.my_company_id();
  INSERT INTO public.service_tasks (company_id, kind, client_id, assigned_to, scheduled_date, address, problem, notes, warranty_months)
  VALUES (public.my_company_id(), p_kind, p_client, p_assigned, p_date, nullif(btrim(COALESCE(p_address, '')), ''),
          nullif(btrim(COALESCE(p_problem, '')), ''), nullif(btrim(COALESCE(p_notes, '')), ''), COALESCE(v_months, 12))
  RETURNING * INTO v_task;
  PERFORM public.save_task_items(v_task.id, p_items);
  RETURN jsonb_build_object('id', v_task.id, 'order_number', v_task.order_number);
END $$;

-- Salva a tarefa (campos + aparelhos + concluir/reabrir) numa só operação
CREATE OR REPLACE FUNCTION public.save_task(p_task uuid, p_fields jsonb, p_items jsonb, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_task public.service_tasks; f jsonb := COALESCE(p_fields, '{}'::jsonb);
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('pending','done') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
  IF p_items IS NOT NULL THEN PERFORM public.save_task_items(p_task, p_items); END IF;

  UPDATE public.service_tasks SET
    address         = CASE WHEN f ? 'address'         THEN nullif(btrim(f->>'address'), '')         ELSE address END,
    received_by     = CASE WHEN f ? 'received_by'     THEN nullif(btrim(f->>'received_by'), '')     ELSE received_by END,
    notes           = CASE WHEN f ? 'notes'           THEN nullif(btrim(f->>'notes'), '')           ELSE notes END,
    diagnosis       = CASE WHEN f ? 'diagnosis'       THEN nullif(btrim(f->>'diagnosis'), '')       ELSE diagnosis END,
    service_done    = CASE WHEN f ? 'service_done'    THEN nullif(btrim(f->>'service_done'), '')    ELSE service_done END,
    parts_used      = CASE WHEN f ? 'parts_used'      THEN nullif(btrim(f->>'parts_used'), '')      ELSE parts_used END,
    amount          = CASE WHEN f ? 'amount'          THEN nullif(btrim(f->>'amount'), '')::numeric ELSE amount END,
    done_on         = CASE WHEN f ? 'done_on'         THEN nullif(btrim(f->>'done_on'), '')::date   ELSE done_on END,
    problem         = CASE WHEN f ? 'problem'         THEN nullif(btrim(f->>'problem'), '')         ELSE problem END,
    scheduled_date  = CASE WHEN f ? 'scheduled_date'  THEN nullif(btrim(f->>'scheduled_date'), '')::date ELSE scheduled_date END,
    warranty_months = CASE WHEN f ? 'warranty_months' THEN (f->>'warranty_months')::int             ELSE warranty_months END,
    assigned_to     = CASE WHEN f ? 'assigned_to'     THEN nullif(btrim(f->>'assigned_to'), '')::uuid ELSE assigned_to END,
    status          = COALESCE(p_status, status)
  WHERE id = p_task
  RETURNING * INTO v_task;

  IF v_task.id IS NULL THEN RAISE EXCEPTION 'Tarefa não encontrada ou sem permissão.'; END IF;
  RETURN jsonb_build_object('id', v_task.id, 'status', v_task.status, 'warranty_expires_at', v_task.warranty_expires_at);
END $$;

-- Pedido da Assistência vira tarefa (cria o cliente se ainda não existir) — só o gestor
CREATE OR REPLACE FUNCTION public.create_task_from_request(p_request uuid, p_assigned uuid, p_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.service_requests; v_client uuid; v_task public.service_tasks; v_months int; v_company uuid := public.my_company_id();
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Apenas o gestor pode criar tarefas.'; END IF;
  SELECT * INTO r FROM public.service_requests WHERE id = p_request AND company_id = v_company FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF r.task_id IS NOT NULL THEN RAISE EXCEPTION 'Este pedido já virou tarefa.'; END IF;

  IF r.client_code IS NOT NULL THEN
    SELECT id INTO v_client FROM public.clients WHERE company_id = v_company AND client_code = r.client_code;
  END IF;
  IF v_client IS NULL THEN
    SELECT id INTO v_client FROM public.clients
      WHERE company_id = v_company AND right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) = right(r.phone, 10)
      ORDER BY created_at LIMIT 1;
  END IF;
  IF v_client IS NULL THEN
    INSERT INTO public.clients (company_id, name, phone, email, address, city)
    VALUES (v_company, r.name, r.phone, r.email, r.address, r.city) RETURNING id INTO v_client;
  END IF;

  SELECT warranty_months_default INTO v_months FROM public.company_settings WHERE company_id = v_company;
  INSERT INTO public.service_tasks (company_id, kind, client_id, assigned_to, scheduled_date, address, problem, notes, warranty_months, request_id)
  VALUES (v_company, r.kind, v_client, p_assigned, COALESCE(p_date, r.preferred_date), r.address, r.problem,
          concat_ws(E'\n', nullif(r.message, ''), CASE WHEN r.urgency = 'high' THEN 'Cliente marcou como URGENTE.' END),
          COALESCE(v_months, 12), r.id)
  RETURNING * INTO v_task;

  INSERT INTO public.task_items (company_id, task_id, brand, model, btus, position)
  SELECT v_company, v_task.id, nullif(x.brand, ''), x.model, x.btus, (row_number() OVER ())::int - 1
  FROM jsonb_to_recordset(r.items) AS x(brand text, model text, btus int);

  UPDATE public.service_requests SET status = 'scheduled', task_id = v_task.id WHERE id = r.id;
  RETURN jsonb_build_object('task_id', v_task.id, 'order_number', v_task.order_number);
END $$;

-- ----------------------------------------------------------------------------
-- 7. CONSULTA PÚBLICA DE GARANTIA (código do cliente → só aparelho e datas)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_warranty(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(btrim(COALESCE(p_code, ''))); v_client uuid; v_items jsonb;
BEGIN
  PERFORM public.rate_limit_check('lookup:ip:' || public.client_ip(), 20, 600);
  PERFORM public.rate_limit_check('lookup:all', 1000, 600);
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
-- 8. PUSH: inscrições dos clientes + notificações do gestor
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000 AND endpoint ~ '^https://'),
  p256dh text NOT NULL CHECK (char_length(p256dh) BETWEEN 10 AND 200),
  auth text NOT NULL CHECK (char_length(auth) BETWEEN 8 AND 100),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_client ON public.push_subscriptions(client_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 200),
  url text NOT NULL DEFAULT '/consulta' CHECK (url ~ '^/[A-Za-z0-9/_?=&.%-]*$' AND char_length(url) <= 200),
  audience text NOT NULL CHECK (audience IN ('all','client','warranty_expiring','warranty_expired')),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sending','sent','failed','cancelled')),
  claimed_at timestamptz,
  sent_at timestamptz,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  error text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_client_audience CHECK ((audience = 'client') = (client_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_notifications_due ON public.notifications(status, scheduled_at);

-- O gestor não mexe em contadores nem em status de envio (quem faz isso é o servidor)
CREATE OR REPLACE FUNCTION public.notifications_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'scheduled'; NEW.sent_count := 0; NEW.failed_count := 0; NEW.sent_at := NULL; NEW.claimed_at := NULL; NEW.error := NULL;
      NEW.created_by := auth.uid();
    ELSE
      NEW.sent_count := OLD.sent_count; NEW.failed_count := OLD.failed_count; NEW.sent_at := OLD.sent_at;
      NEW.claimed_at := OLD.claimed_at; NEW.error := OLD.error; NEW.company_id := OLD.company_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notifications_guard_trigger ON public.notifications;
CREATE TRIGGER notifications_guard_trigger BEFORE INSERT OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notifications_guard();

-- Cliente (com o código) liga o aparelho dele às notificações
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_code text, p_endpoint text, p_p256dh text, p_auth text, p_ua text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client public.clients;
BEGIN
  PERFORM public.rate_limit_check('push:ip:' || public.client_ip(), 10, 600);
  SELECT * INTO v_client FROM public.clients WHERE client_code = upper(btrim(COALESCE(p_code, '')));
  IF v_client.id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.push_subscriptions (company_id, client_id, endpoint, p256dh, auth, user_agent)
  VALUES (v_client.company_id, v_client.id, p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  ON CONFLICT (endpoint) DO UPDATE SET client_id = EXCLUDED.client_id, company_id = EXCLUDED.company_id,
                                      p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;
  RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.remove_push_subscription(p_endpoint text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.rate_limit_check('push:ip:' || public.client_ip(), 20, 600);
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text, text), public.remove_push_subscription(text) TO anon, authenticated;

-- Funções do SERVIDOR (só a chave service_role chama; nunca o navegador)
CREATE OR REPLACE FUNCTION public.claim_notifications(p_id uuid DEFAULT NULL) RETURNS SETOF public.notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.notifications n SET status = 'sending', claimed_at = now()
  WHERE n.id IN (
    SELECT id FROM public.notifications
    WHERE (p_id IS NULL OR id = p_id)
      AND ((status = 'scheduled' AND scheduled_at <= now()) OR (status = 'sending' AND claimed_at < now() - interval '10 minutes'))
    ORDER BY scheduled_at LIMIT 20 FOR UPDATE SKIP LOCKED)
  RETURNING n.*;
END $$;

CREATE OR REPLACE FUNCTION public.notification_targets(p_id uuid)
RETURNS TABLE (subscription_id uuid, endpoint text, p256dh text, auth text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.notifications; v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO n FROM public.notifications WHERE id = p_id;
  IF n.id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT s.id, s.endpoint, s.p256dh, s.auth FROM public.push_subscriptions s
  WHERE s.company_id = n.company_id AND (
    n.audience = 'all'
    OR (n.audience = 'client' AND s.client_id = n.client_id)
    OR (n.audience = 'warranty_expiring' AND EXISTS (
          SELECT 1 FROM public.service_tasks t WHERE t.client_id = s.client_id AND t.kind = 'installation' AND t.status = 'done'
            AND t.warranty_expires_at BETWEEN v_today AND v_today + 30))
    OR (n.audience = 'warranty_expired' AND EXISTS (
          SELECT 1 FROM public.service_tasks t WHERE t.client_id = s.client_id AND t.kind = 'installation' AND t.status = 'done'
            AND t.warranty_expires_at < v_today)
        AND NOT EXISTS (
          SELECT 1 FROM public.service_tasks t WHERE t.client_id = s.client_id AND t.kind = 'installation' AND t.status = 'done'
            AND t.warranty_expires_at >= v_today))
  );
END $$;

REVOKE ALL ON FUNCTION public.claim_notifications(uuid), public.notification_targets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications(uuid), public.notification_targets(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 9. REGRAS DE ACESSO (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appliance_models  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;

-- Começa do zero em users e clients (os nomes antigos das regras não importam mais)
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('users', 'clients') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- users: cada um vê a si mesmo; o gestor vê a equipe. Ninguém altera por aqui (só o servidor).
CREATE POLICY users_select ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR (company_id = public.my_company_id() AND public.is_owner()));
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon, authenticated;

-- clients: gestor faz tudo; técnico só vê o cliente das tarefas dele
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND public.is_staff()
         AND (public.is_owner() OR id IN (SELECT client_id FROM public.service_tasks WHERE assigned_to = auth.uid())));
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.is_owner());
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.is_owner())
  WITH CHECK (company_id = public.my_company_id() AND public.is_owner());
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.is_owner());

-- settings e catálogo: equipe lê, gestor altera
DROP POLICY IF EXISTS settings_select ON public.company_settings;
DROP POLICY IF EXISTS settings_update ON public.company_settings;
CREATE POLICY settings_select ON public.company_settings FOR SELECT TO authenticated USING (company_id = public.my_company_id() AND public.is_staff());
CREATE POLICY settings_update ON public.company_settings FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.is_owner()) WITH CHECK (company_id = public.my_company_id() AND public.is_owner());

DROP POLICY IF EXISTS models_select ON public.appliance_models;
DROP POLICY IF EXISTS models_write ON public.appliance_models;
CREATE POLICY models_select ON public.appliance_models FOR SELECT TO authenticated USING (company_id = public.my_company_id() AND public.is_staff());
CREATE POLICY models_write ON public.appliance_models FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND public.is_owner()) WITH CHECK (company_id = public.my_company_id() AND public.is_owner());

-- pedidos: só o gestor
DROP POLICY IF EXISTS requests_select ON public.service_requests;
DROP POLICY IF EXISTS requests_update ON public.service_requests;
DROP POLICY IF EXISTS requests_delete ON public.service_requests;
CREATE POLICY requests_select ON public.service_requests FOR SELECT TO authenticated USING (company_id = public.my_company_id() AND public.is_owner());
CREATE POLICY requests_update ON public.service_requests FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.is_owner()) WITH CHECK (company_id = public.my_company_id() AND public.is_owner());
CREATE POLICY requests_delete ON public.service_requests FOR DELETE TO authenticated USING (company_id = public.my_company_id() AND public.is_owner());

-- tarefas: gestor vê todas; técnico só as dele
DROP POLICY IF EXISTS tasks_select ON public.service_tasks;
DROP POLICY IF EXISTS tasks_insert ON public.service_tasks;
DROP POLICY IF EXISTS tasks_update ON public.service_tasks;
DROP POLICY IF EXISTS tasks_delete ON public.service_tasks;
CREATE POLICY tasks_select ON public.service_tasks FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND (public.is_owner() OR (public.is_staff() AND assigned_to = auth.uid())));
CREATE POLICY tasks_insert ON public.service_tasks FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.is_owner() AND status = 'pending');
CREATE POLICY tasks_update ON public.service_tasks FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND (public.is_owner() OR (public.is_staff() AND assigned_to = auth.uid())))
  WITH CHECK (company_id = public.my_company_id() AND (public.is_owner() OR (public.is_staff() AND assigned_to = auth.uid())));
CREATE POLICY tasks_delete ON public.service_tasks FOR DELETE TO authenticated USING (company_id = public.my_company_id() AND public.is_owner());

-- aparelhos: seguem a tarefa (quem vê a tarefa vê os aparelhos)
DROP POLICY IF EXISTS items_select ON public.task_items;
DROP POLICY IF EXISTS items_insert ON public.task_items;
DROP POLICY IF EXISTS items_update ON public.task_items;
DROP POLICY IF EXISTS items_delete ON public.task_items;
CREATE POLICY items_select ON public.task_items FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND task_id IN (SELECT id FROM public.service_tasks));
CREATE POLICY items_insert ON public.task_items FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND task_id IN (SELECT id FROM public.service_tasks));
CREATE POLICY items_update ON public.task_items FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND task_id IN (SELECT id FROM public.service_tasks))
  WITH CHECK (company_id = public.my_company_id() AND task_id IN (SELECT id FROM public.service_tasks));
CREATE POLICY items_delete ON public.task_items FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND task_id IN (SELECT id FROM public.service_tasks));

-- notificações: só o gestor (e só pode mexer nas que ainda não foram enviadas)
DROP POLICY IF EXISTS notif_select ON public.notifications;
DROP POLICY IF EXISTS notif_insert ON public.notifications;
DROP POLICY IF EXISTS notif_update ON public.notifications;
CREATE POLICY notif_select ON public.notifications FOR SELECT TO authenticated USING (company_id = public.my_company_id() AND public.is_owner());
CREATE POLICY notif_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND public.is_owner());
CREATE POLICY notif_update ON public.notifications FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.is_owner() AND status = 'scheduled')
  WITH CHECK (company_id = public.my_company_id() AND public.is_owner() AND status IN ('scheduled', 'cancelled'));

-- inscrições push: o gestor só enxerga quantas existem (as chaves ficam escondidas)
DROP POLICY IF EXISTS push_select ON public.push_subscriptions;
CREATE POLICY push_select ON public.push_subscriptions FOR SELECT TO authenticated USING (company_id = public.my_company_id() AND public.is_owner());
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT (id, company_id, client_id, created_at) ON public.push_subscriptions TO authenticated;

-- Visitante sem login não toca em nenhuma tabela nova
REVOKE ALL ON public.company_settings, public.appliance_models, public.service_requests,
              public.service_tasks, public.task_items, public.notifications FROM anon;

-- ----------------------------------------------------------------------------
-- 10. MIGRAR AS OS ANTIGAS (installations → tarefas concluídas)
-- ----------------------------------------------------------------------------
ALTER TABLE public.service_tasks DISABLE TRIGGER USER;
ALTER TABLE public.task_items DISABLE TRIGGER USER;

INSERT INTO public.service_tasks (company_id, order_number, kind, status, client_id, scheduled_date, notes,
                                  warranty_months, done_on, warranty_expires_at, completed_at, created_at)
SELECT i.company_id, i.order_number, 'installation', 'done', i.client_id, i.installation_date,
       concat_ws(E'\n', nullif(i.installation_notes, ''), CASE WHEN nullif(i.installed_by, '') IS NOT NULL THEN 'Técnico: ' || i.installed_by END),
       COALESCE(i.warranty_months, 12), i.installation_date, i.warranty_expires_at,
       COALESCE(i.installation_date::timestamptz, now()), COALESCE(i.created_at, now())
FROM public.installations i
WHERE i.order_number IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.service_tasks t WHERE t.company_id = i.company_id AND t.order_number = i.order_number);

INSERT INTO public.task_items (company_id, task_id, brand, model, serial_number, position)
SELECT t.company_id, t.id, nullif(i.machine_brand, ''),
       left(COALESCE(nullif(concat_ws(' ', nullif(i.machine_type, ''), nullif(i.model, '')), ''), 'Aparelho'), 80),
       nullif(left(i.serial_number, 60), ''), 0
FROM public.installations i
JOIN public.service_tasks t ON t.company_id = i.company_id AND t.order_number = i.order_number
WHERE NOT EXISTS (SELECT 1 FROM public.task_items x WHERE x.task_id = t.id);

ALTER TABLE public.service_tasks ENABLE TRIGGER USER;
ALTER TABLE public.task_items ENABLE TRIGGER USER;

-- ----------------------------------------------------------------------------
-- 11. LIMPEZA DE SEGURANÇA (tabelas antigas viram só-leitura; formulário antigo fecha)
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.installations, public.maintenance_requests, public.maintenance_records FROM anon, authenticated;
DO $$ BEGIN
  IF to_regclass('public.leads') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.leads FROM anon, authenticated';
  END IF;
END $$;

COMMIT;

-- ----------------------------------------------------------------------------
-- CONFERÊNCIA (rode e veja se tudo aparece "true" / números esperados)
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.companies WHERE slug IS NOT NULL)                     AS empresas_com_slug,
  (SELECT count(*) FROM public.clients WHERE client_code IS NOT NULL)                AS clientes_com_codigo,
  (SELECT count(*) FROM public.service_tasks)                                        AS tarefas_migradas,
  (SELECT count(*) FROM public.appliance_models)                                     AS aparelhos_no_catalogo,
  (SELECT whatsapp FROM public.company_settings LIMIT 1)                             AS whatsapp_config,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'submit_request')                    AS funcao_pedidos,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'lookup_warranty')                   AS funcao_garantia;
