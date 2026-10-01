'use client';
import { APP_NAME } from '@/lib/brand';
import { useSettings } from '@/hooks/useSettings';
import { IconSnow } from './icons';

// Logo e nome vêm das Configurações (o gestor troca). Sem logo enviada, mostra o ícone padrão.
export default function Logo({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  const name = settings?.business_name || APP_NAME;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {settings?.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={settings.logo} alt={name} className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-300 text-brand-900 shadow-sm">
          <IconSnow className="h-5 w-5" />
        </span>
      )}
      {!compact && <span className="truncate text-[15px] font-bold tracking-tight text-slate-900">{name}</span>}
    </div>
  );
}
