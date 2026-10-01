'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getPublicSettings } from '@/services/settings';
import type { PublicSettings } from '@/types';

type Ctx = { settings: PublicSettings | null; loaded: boolean; refresh: () => Promise<void> };
const SettingsContext = createContext<Ctx>({ settings: null, loaded: false, refresh: async () => {} });

// Nome, WhatsApp e logo da empresa (vêm do banco; o gestor troca em Configurações)
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try { setSettings(await getPublicSettings()); } catch { /* segue com o padrão */ }
    setLoaded(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return <SettingsContext.Provider value={{ settings, loaded, refresh }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
