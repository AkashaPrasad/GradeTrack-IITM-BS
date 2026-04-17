/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<import('workbox-build').ManifestEntry>;
};

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

const navigationHandler = createHandlerBoundToURL('/index.html');

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/auth\/v1\//, /^\/rest\/v1\//, /^\/functions\/v1\//, /^\/_/],
  }),
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event: PushEvent) => {
  let data: { title?: string; body?: string; icon?: string; tag?: string; url?: string } = {};
  try { data = event.data?.json() ?? {}; } catch { /* plain text */ }
  const title = data.title ?? 'GradeTrack';
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: data.icon ?? '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag ?? 'gradetrack',
    data: { url: data.url ?? '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url: string = (event.notification.data?.url as string) ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
