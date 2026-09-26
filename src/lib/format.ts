// Datas do banco vêm como "2026-09-25". new Date() nesse formato usa UTC
// e no Brasil mostra o dia anterior. Por isso formatamos pelo texto.
export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
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

// Status calculado na hora (o campo warranty_status do banco fica
// desatualizado com o passar dos dias).
export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired';

export function warrantyStatus(expiresAt?: string | null): WarrantyStatus {
  if (!expiresAt) return 'expired';
  const today = todayISO();
  if (expiresAt < today) return 'expired';
  if (expiresAt < addDaysISO(30)) return 'expiring_soon';
  return 'active';
}

export const warrantyLabel: Record<WarrantyStatus, { text: string; css: string }> = {
  active: { text: 'Ativa', css: 'bg-green-100 text-green-800' },
  expiring_soon: { text: 'Vencendo', css: 'bg-yellow-100 text-yellow-800' },
  expired: { text: 'Vencida', css: 'bg-red-100 text-red-800' },
};
