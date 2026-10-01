// Tipos compartilhados (espelham as tabelas do banco)

export type Role = 'owner' | 'technician';

export type Profile = {
  id: string;
  email: string;
  role: Role;
  company_id: string;
  name: string | null;
  username: string | null;
  active: boolean;
};

export type PublicSettings = { business_name: string; whatsapp: string | null; logo: string | null };
export type CompanySettings = {
  company_id: string;
  business_name: string;
  whatsapp: string | null;
  logo_data_url: string | null;
  warranty_months_default: number;
};

export type CatalogModel = { id: string; brand: string; line: string };
export type ApplianceModel = CatalogModel & { sort: number; active: boolean };

export type RequestKind = 'installation' | 'maintenance';
export type RequestStatus = 'new' | 'contacted' | 'scheduled' | 'done' | 'discarded';
export type Urgency = 'low' | 'normal' | 'high';

export type ItemInput = { brand?: string | null; model: string; btus?: number | null; serial_number?: string | null; location?: string | null };

export type ServiceRequest = {
  id: string;
  request_number: number;
  kind: RequestKind;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string | null;
  client_code: string | null;
  items: ItemInput[];
  preferred_date: string | null;
  problem: string | null;
  urgency: Urgency | null;
  message: string | null;
  status: RequestStatus;
  task_id: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  client_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
};

export type TaskStatus = 'pending' | 'done';
export type TaskItem = { id: string; brand: string | null; model: string; btus: number | null; serial_number: string | null; location: string | null; position: number };

export type ServiceTask = {
  id: string;
  order_number: string;
  kind: RequestKind;
  status: TaskStatus;
  client_id: string;
  assigned_to: string | null;
  address: string | null;
  scheduled_date: string | null;
  received_by: string | null;
  notes: string | null;
  problem: string | null;
  diagnosis: string | null;
  service_done: string | null;
  parts_used: string | null;
  amount: number | null;
  warranty_months: number;
  done_on: string | null;
  warranty_expires_at: string | null;
  completed_at: string | null;
  reopened_count: number;
  created_at: string;
  clients?: Pick<Client, 'id' | 'name' | 'phone' | 'address' | 'client_code'> | null;
  task_items?: TaskItem[];
};

export type Technician = { id: string; name: string | null; username: string | null; active: boolean; email: string };

export type NotificationAudience = 'all' | 'client' | 'warranty_expiring' | 'warranty_expired';
export type NotificationStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type AppNotification = {
  id: string;
  title: string;
  body: string;
  url: string;
  audience: NotificationAudience;
  client_id: string | null;
  scheduled_at: string;
  status: NotificationStatus;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
  error: string | null;
  created_at: string;
  clients?: { name: string } | null;
};

export type WarrantyItem = {
  os: string;
  brand: string | null;
  model: string;
  btus: number | null;
  installed_on: string | null;
  warranty_expires_at: string | null;
};
export type WarrantyLookup = { found: false } | { found: true; items: WarrantyItem[] };
