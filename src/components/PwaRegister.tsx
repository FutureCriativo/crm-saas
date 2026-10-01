'use client';
import { useEffect } from 'react';

// Registra o service worker (necessário para instalar o app e receber avisos)
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
