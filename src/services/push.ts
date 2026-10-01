import { supabase } from '@/lib/supabase';
import { VAPID_PUBLIC_KEY } from '@/lib/config';

// Lado do CLIENTE (navegador): ativar/desativar avisos
export type PushResult = 'ok' | 'denied' | 'unsupported' | 'invalid-code' | 'no-key' | 'error';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// iPhone só recebe push se o site estiver instalado na tela inicial
export function needsInstallOnIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return ios && !standalone;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(code: string): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'no-key';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const sub = (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource }));
    const json = sub.toJSON() as any;
    const { data, error } = await supabase.rpc('save_push_subscription', {
      p_code: code, p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth, p_ua: navigator.userAgent.slice(0, 250),
    });
    if (error) return 'error';
    if (!data) { await sub.unsubscribe(); return 'invalid-code'; }
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}
