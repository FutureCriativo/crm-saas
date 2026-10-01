-- RECONSTRUÇÃO do schema base (o repositório só tem o fix_03; o schema original não está versionado).
-- Colunas deduzidas do código das telas e do relatório de 25/09/2026.
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL, email varchar(200) UNIQUE, service_type varchar(50),
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  email varchar(200), role varchar(20) NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','technician','client')),
  name varchar(200), created_at timestamptz DEFAULT now()
);
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  name varchar(200) NOT NULL, phone varchar(30), email varchar(200), address text, city varchar(100), state varchar(2), notes text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  order_number varchar(30), machine_type varchar(100) NOT NULL, machine_brand varchar(100), model varchar(100), serial_number varchar(100),
  installation_date date NOT NULL DEFAULT current_date, installed_by varchar(100),
  warranty_months int NOT NULL DEFAULT 12, warranty_start_date date, warranty_expires_at date, warranty_status varchar(20),
  installation_notes text, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id),
  client_id uuid REFERENCES public.clients(id), installation_id uuid REFERENCES public.installations(id),
  description text, status varchar(20) DEFAULT 'open', created_at timestamptz DEFAULT now()
);
CREATE TABLE public.maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id),
  installation_id uuid REFERENCES public.installations(id), notes text, performed_at date, created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.set_warranty() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.warranty_expires_at := (COALESCE(NEW.warranty_start_date, NEW.installation_date) + make_interval(months => NEW.warranty_months))::date; RETURN NEW; END $$;
CREATE TRIGGER set_warranty_trigger BEFORE INSERT OR UPDATE ON public.installations FOR EACH ROW EXECUTE FUNCTION public.set_warranty();
CREATE VIEW public.clients_with_warranty AS SELECT c.id, c.name, min(i.warranty_expires_at) AS next_expiry FROM public.clients c LEFT JOIN public.installations i ON i.client_id = c.id GROUP BY c.id, c.name;
CREATE VIEW public.upcoming_warranty_expirations AS SELECT i.* FROM public.installations i WHERE i.warranty_expires_at BETWEEN current_date AND current_date + 30;

-- ---- fix_01 (da skill criacao-de-crm) ----
CREATE OR REPLACE FUNCTION public.my_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.my_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1 $$;
ALTER VIEW clients_with_warranty SET (security_invoker = true);
ALTER VIEW upcoming_warranty_expirations SET (security_invoker = true);
ALTER TABLE installations ALTER COLUMN order_number DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.set_order_number() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ano text := to_char(COALESCE(NEW.installation_date, CURRENT_DATE), 'YYYY'); seq int;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id::text || ano));
    SELECT COALESCE(MAX(split_part(order_number, '-', 2)::int), 0) + 1 INTO seq FROM installations
     WHERE company_id = NEW.company_id AND order_number ~ ('^' || ano || '-[0-9]+$');
    NEW.order_number := ano || '-' || lpad(seq::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER set_order_number_trigger BEFORE INSERT ON installations FOR EACH ROW EXECUTE FUNCTION set_order_number();
CREATE UNIQUE INDEX IF NOT EXISTS uq_installations_company_os ON installations(company_id, order_number);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY; ALTER TABLE users ENABLE ROW LEVEL SECURITY; ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations ENABLE ROW LEVEL SECURITY; ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_select ON companies FOR SELECT TO authenticated USING (id = my_company_id());
CREATE POLICY users_see_company_users ON users FOR SELECT TO authenticated USING (id = auth.uid() OR company_id = my_company_id());
CREATE POLICY users_update_self ON users FOR UPDATE TO authenticated USING (id = auth.uid());   -- cenário pior: política antiga frouxa
CREATE POLICY clients_access ON clients FOR SELECT TO authenticated USING (company_id = my_company_id());
CREATE POLICY clients_insert ON clients FOR INSERT TO authenticated WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','technician'));
CREATE POLICY clients_update ON clients FOR UPDATE TO authenticated USING (company_id = my_company_id() AND my_role() IN ('owner','technician'));
CREATE POLICY installations_access ON installations FOR SELECT TO authenticated USING (company_id = my_company_id());
CREATE POLICY installations_insert ON installations FOR INSERT TO authenticated WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','technician'));
CREATE POLICY maintenance_requests_access ON maintenance_requests FOR SELECT TO authenticated USING (company_id = my_company_id());
CREATE POLICY maintenance_records_access ON maintenance_records FOR SELECT TO authenticated USING (company_id = my_company_id());
