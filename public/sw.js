// Service worker: recebe os avisos (push) e abre o site ao tocar na notificação.
// Não guarda páginas em cache (evita mostrar versão velha do sistema).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Só aceita caminho interno do próprio site (nunca link externo)
function safeUrl(u) {
  return typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? u : '/consulta';
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = String(data.title || 'Aviso').slice(0, 80);
  const options = {
    body: String(data.body || '').slice(0, 240),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: safeUrl(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(safeUrl(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url === target && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
