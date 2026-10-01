-- ==========================================
-- CORREÇÃO 03 — site público, portal do cliente e segurança
-- Rodar UMA vez no Supabase SQL Editor (depois do fix_01 e fix_02)
-- ==========================================

-- 1. Pedidos de orçamento vindos do site (qualquer visitante pode ENVIAR, ninguém pode LER pela internet)
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  phone varchar(30) NOT NULL CHECK (char_length(phone) BETWEEN 8 AND 30),
  email varchar(160) CHECK (email IS NULL OR email = '' OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  city varchar(100),
  service varchar(60),
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  source varchar(40) NOT NULL DEFAULT 'site',
  status varchar(20) NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leads FROM anon, authenticated;
GRANT INSERT (name, phone, email, city, service, message) ON public.leads TO anon, authenticated;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new' AND source = 'site');

-- 2. Cliente final pode ter login próprio (liga o cadastro do cliente a um usuário)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_user ON public.clients(user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role IN ('owner','technician') FROM public.users WHERE id = auth.uid() LIMIT 1), false)
$$;

-- 3. Regras de acesso: equipe (dono/técnico) vê a empresa toda; cliente vê SÓ o que é dele
DROP POLICY IF EXISTS "users_see_company_users" ON public.users;
CREATE POLICY "users_see_company_users" ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR (company_id = my_company_id() AND is_staff()));

DROP POLICY IF EXISTS "clients_access" ON public.clients;
DROP POLICY IF EXISTS "clients_self" ON public.clients;
CREATE POLICY "clients_access" ON public.clients FOR SELECT TO authenticated
  USING (company_id = my_company_id() AND is_staff());
CREATE POLICY "clients_self" ON public.clients FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "installations_access" ON public.installations;
DROP POLICY IF EXISTS "installations_self" ON public.installations;
CREATE POLICY "installations_access" ON public.installations FOR SELECT TO authenticated
  USING (company_id = my_company_id() AND is_staff());
CREATE POLICY "installations_self" ON public.installations FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "maintenance_requests_access" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_requests_insert" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_requests_update" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_requests_self" ON public.maintenance_requests;
CREATE POLICY "maintenance_requests_access" ON public.maintenance_requests FOR SELECT TO authenticated
  USING (company_id = my_company_id() AND is_staff());
CREATE POLICY "maintenance_requests_self" ON public.maintenance_requests FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY "maintenance_requests_insert" ON public.maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (company_id = my_company_id()
    AND (is_staff() OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())));
CREATE POLICY "maintenance_requests_update" ON public.maintenance_requests FOR UPDATE TO authenticated
  USING (company_id = my_company_id() AND is_staff());

DROP POLICY IF EXISTS "maintenance_records_access" ON public.maintenance_records;
CREATE POLICY "maintenance_records_access" ON public.maintenance_records FOR SELECT TO authenticated
  USING (company_id = my_company_id() AND is_staff());

-- 4. Visitante sem login não enxerga nada das tabelas internas
REVOKE ALL ON public.companies, public.users, public.clients, public.installations,
  public.maintenance_requests, public.maintenance_records FROM anon;
REVOKE ALL ON public.clients_with_warranty, public.upcoming_warranty_expirations FROM anon;
