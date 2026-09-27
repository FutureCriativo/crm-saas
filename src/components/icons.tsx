// Ícones simples em SVG (sem biblioteca extra)
type P = { className?: string };
const base = (d: React.ReactNode, className = 'h-5 w-5') => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {d}
  </svg>
);

export const IconHome = ({ className }: P) =>
  base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>, className);
export const IconUsers = ({ className }: P) =>
  base(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>, className);
export const IconWrench = ({ className }: P) =>
  base(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />, className);
export const IconPlus = ({ className }: P) =>
  base(<><path d="M12 5v14" /><path d="M5 12h14" /></>, className);
export const IconLogout = ({ className }: P) =>
  base(<><path d="M15 17l5-5-5-5" /><path d="M20 12H9" /><path d="M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" /></>, className);
export const IconSearch = ({ className }: P) =>
  base(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, className);
export const IconShield = ({ className }: P) =>
  base(<><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>, className);
export const IconAlert = ({ className }: P) =>
  base(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5" /><path d="M12 16.5h.01" /></>, className);
export const IconSnow = ({ className }: P) =>
  base(<><path d="M12 2v20" /><path d="M4.9 6.5 19.1 17.5" /><path d="M19.1 6.5 4.9 17.5" /><path d="m9 4 3 2 3-2" /><path d="m9 20 3-2 3 2" /></>, className);
export const IconChevron = ({ className }: P) =>
  base(<path d="m9 6 6 6-6 6" />, className);
export const IconChat = ({ className }: P) =>
  base(<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" />, className);
export const IconMail = ({ className }: P) =>
  base(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>, className);
export const IconCheck = ({ className }: P) =>
  base(<path d="m5 12.5 4.5 4.5L19 7.5" />, className);
export const IconSparkle = ({ className }: P) =>
  base(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6 6 2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>, className);
export const IconCalendar = ({ className }: P) =>
  base(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>, className);
export const IconLock = ({ className }: P) =>
  base(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, className);
