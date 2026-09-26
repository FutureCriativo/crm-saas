import { APP_NAME } from '@/lib/brand';
import { IconSnow } from './icons';

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-300 text-brand-900 shadow-sm">
        <IconSnow className="h-5 w-5" />
      </span>
      {!compact && <span className="text-[15px] font-bold tracking-tight text-slate-900">{APP_NAME}</span>}
    </div>
  );
}
