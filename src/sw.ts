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
