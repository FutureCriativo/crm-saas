'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/lib/errors';

// Carrega dados de uma função assíncrona com estado de carregando/erro e "recarregar"
export function useAsync<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fn();
      if (alive.current) setData(r);
    } catch (e: any) {
      if (alive.current) setError(friendlyError(e, 'Não foi possível carregar.'));
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);
  return { data, loading, error, reload: run, setData };
}
