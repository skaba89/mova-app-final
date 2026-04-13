// ═══════════════════════════════════════════════════════════════════════════
// MOVA — Service Worker v3
// Super-app de mobilite pour Conakry, Guinee
// Caching strategies: precache, network-first, stale-while-revalidate
// Push notifications, background sync, offline fallback
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'mova-v3';

// ─── Precache: critical assets fetched on install ────────────────────────
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
];

// ─── Cache TTL for API responses (5 minutes) ─────────────────────────────
const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

// ─── Offline fallback HTML (MOVA branded) ────────────────────────────────
const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MOVA — Hors connexion</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0fdf4;
      color: #1a1a2e;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: #059669;
      border-radius: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 800;
      color: white;
      letter-spacing: -1px;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      color: #064e3b;
    }
    p {
      font-size: 1rem;
      color: #4b5563;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .retry-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #059669;
      color: white;
      border: none;
      border-radius: 0.75rem;
      padding: 0.875rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .retry-btn:hover { background: #047857; }
    .retry-btn:active { transform: scale(0.97); }
    .wifi-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1.5rem;
      opacity: 0.4;
    }
    .wifi-icon svg { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">M</div>
    <div class="wifi-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2" y1="20" x2="22" y2="20" stroke="#dc2626" stroke-width="2.5"/>
        <line x1="7" y1="15" x2="17" y2="15" stroke="#dc2626" stroke-width="2.5"/>
        <line x1="12" y1="10" x2="12" y2="10" stroke="#dc2626" stroke-width="3"/>
      </svg>
    </div>
    <h1>Hors connexion</h1>
    <p>Impossible de se connecter a Internet. Veuillez verifier votre connexion reseau et reessayer.</p>
    <button class="retry-btn" onclick="window.location.reload()">
      &#x21bb; Reessayer
    </button>
  </div>
</body>
</html>`;

// ═══════════════════════════════════════════════════════════════════════════
// INSTALL EVENT — Precache critical assets
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache: certaines ressources statiques ont echoue', err);
      });
    })
  );
  self.skipWaiting();
});

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVATE EVENT — Clean up ALL old caches (force fresh start)
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log(`[SW] Suppression de l'ancien cache: ${key}`);
            return caches.delete(key);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ═══════════════════════════════════════════════════════════════════════════
// FETCH EVENT — Routing strategies
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;

  // ─── Strategy 1: Network-first for API calls (/api/*) ────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ─── Strategy 2: Network-first for Next.js static assets ─────────────
  // Content-hashed files: always fetch from network to get latest after deploy
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // ─── Strategy 3: Network-first for navigation requests (/) ───────────
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // ─── Strategy 4: Stale-while-revalidate for other static assets ──────
  event.respondWith(staleWhileRevalidate(request));
});

// ─── Strategy: Network-first with cache fallback ────────────────────────
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      return new Response(OFFLINE_PAGE, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return new Response('Ressource indisponible hors ligne', { status: 503 });
  }
}

// ─── Strategy: Network-first (for API calls) ─────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      const responseToCache = response.clone();

      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-timestamp', Date.now().toString());

      const body = await responseToCache.blob();
      const cachedResponse = new Response(body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });
      cache.put(request, cachedResponse);
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);

    if (cached) {
      const timestamp = cached.headers.get('sw-cache-timestamp');
      if (timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age > API_CACHE_TTL) {
          console.warn(`[SW] Cache API expire (${Math.round(age / 1000)}s), reseau indisponible`);
        }
      }
      return cached;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Donnees indisponibles hors connexion',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ─── Strategy: Stale-while-revalidate (for general static assets) ────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((err) => {
      console.warn(`[SW] Stale-while-revalidate: echec de la mise a jour pour ${request.url}`, err);
    });

  return cached || fetchPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH EVENT — Handle incoming push notifications
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  let data = {
    title: 'MOVA',
    body: 'Vous avez une nouvelle notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: {},
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = {
        title: parsed.title || 'MOVA',
        body: parsed.body || parsed.message || 'Vous avez une nouvelle notification',
        icon: parsed.icon || '/icons/icon-192x192.png',
        badge: parsed.badge || '/icons/icon-192x192.png',
        data: parsed.data || parsed || {},
        tag: parsed.tag || 'mova-notification',
        requireInteraction: parsed.requireInteraction || false,
        actions: parsed.actions || [],
      };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || 'mova-notification',
    requireInteraction: data.requireInteraction || false,
    data: data.data,
    vibrate: [100, 50, 100],
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options).then(() => {
      if (!options.requireInteraction) {
        setTimeout(() => {
          self.registration.getNotifications().then((notifications) => {
            notifications.forEach((n) => {
              if (n.tag === options.tag && !n.requireInteraction) {
                n.close();
              }
            });
          });
        }, 5000);
      }
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION CLICK — Focus or open the app
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.notification.data?.url) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND SYNC — Wallet operations sync
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
  if (event.tag === 'mova-wallet-sync') {
    console.log('[SW] Synchronisation du portefeuille en arriere-plan...');
    event.waitUntil(syncWalletOperations());
  }
});

// ─── Wallet sync implementation ──────────────────────────────────────────
async function syncWalletOperations() {
  try {
    const db = await openWalletDB();
    if (!db) {
      console.warn('[SW] Base de donnees portefeuille indisponible');
      return;
    }

    const tx = db.transaction('pending-operations', 'readonly');
    const store = tx.objectStore('pending-operations');
    const allPending = await store.getAll();

    if (allPending.length === 0) {
      console.log('[SW] Aucune operation de portefeuille en attente');
      return;
    }

    console.log(`[SW] ${allPending.length} operation(s) de portefeuille a synchroniser`);

    for (const operation of allPending) {
      try {
        const response = await fetch(operation.url, {
          method: operation.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...operation.headers,
          },
          body: JSON.stringify(operation.body),
        });

        if (response.ok) {
          const deleteTx = db.transaction('pending-operations', 'readwrite');
          deleteTx.objectStore('pending-operations').delete(operation.id);
          console.log(`[SW] Operation synchronisee: ${operation.id}`);
        } else {
          console.warn(`[SW] Echec de la synchronisation pour ${operation.id}: ${response.status}`);
        }
      } catch (err) {
        console.warn(`[SW] Erreur reseau pour ${operation.id}:`, err);
      }
    }

    db.close();
  } catch (error) {
    console.error('[SW] Erreur lors de la synchronisation du portefeuille:', error);
  }
}

// ─── Open IndexedDB for wallet operations ────────────────────────────────
function openWalletDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open('mova-wallet', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-operations')) {
        db.createObjectStore('pending-operations', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = () => {
      console.warn('[SW] Impossible d\'ouvrir la base de donnees du portefeuille');
      resolve(null);
    };
  });
}
