// Datas do banco vêm como "2026-09-25". new Date() nesse formato usa UTC
// e no Brasil mostra o dia anterior. Por isso formatamos pelo texto.
export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function addDaysISO(days: number): string {
  const d = new Date(todayISO() + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Status calculado na hora (o que vale é a data de vencimento)
export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired' | 'none';

export function warrantyStatus(expiresAt?: string | null): WarrantyStatus {
  if (!expiresAt) return 'none';
  const today = todayISO();
  if (expiresAt < today) return 'expired';
  if (expiresAt < addDaysISO(30)) return 'expiring_soon';
  return 'active';
}

export const warrantyLabel: Record<WarrantyStatus, { text: string; css: string; dot: string }> = {
  active: { text: 'Em garantia', css: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  expiring_soon: { text: 'Vencendo', css: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  expired: { text: 'Vencida', css: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  none: { text: 'Sem garantia', css: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

export function formatBtus(btus?: number | null): string {
  return btus ? `${btus.toLocaleString('pt-BR')} BTUs` : '';
}

// "15999998888" -> "(15) 99999-8888"
export function formatPhone(value?: string | null): string {
  const d = (value || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value || '';
}

export function brl(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function applianceLabel(i: { brand?: string | null; model: string; btus?: number | null }): string {
  return [i.brand, i.model, formatBtus(i.btus)].filter(Boolean).join(' ');
}
