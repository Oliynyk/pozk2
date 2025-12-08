// ==========================================
// SERVICE WORKER - Розклад К-ПНУ
// ==========================================

const CACHE_NAME = 'kpnu-schedule-v1';

// Статичні ресурси для кешування (App Shell)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',

  // Стилі
  './style.css',
  './calendar.css',
  './chat.css',

  // Основні скрипти
  './utils.js',
  './navigation.js',
  './schedule.js',
  './search.js',
  './calendar.js',
  './bells_scheduler.js',
  './meteo.js',
  './news.js',
  './login.js',
  './chat-folders.js',
  './animations.js',
  './accent-color.js',
  './font-size.js',
  './settings-reset.js',
  './webauthn.js',

  // Іконки PWA
  './images/icon-192x192.png',
  './images/icon-512x512.png'
];

// API домени (не кешуємо, або кешуємо з network-first)
const API_HOSTS = [
  'vnz.osvita.net',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com'
];

// ==========================================
// 1. INSTALL - Кешуємо статичні ресурси
// ==========================================
self.addEventListener('install', event => {
  console.log('[SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell...');
        // Використовуємо addAll з обробкою помилок для кожного файлу
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache: ${url}`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
        return self.skipWaiting(); // Активувати відразу
      })
  );
});

// ==========================================
// 2. ACTIVATE - Очищаємо старі кеші
// ==========================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients...');
        return self.clients.claim(); // Взяти контроль над всіма вкладками
      })
  );
});

// ==========================================
// 3. FETCH - Стратегія обслуговування запитів
// ==========================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Пропускаємо не-GET запити
  if (event.request.method !== 'GET') {
    return;
  }

  // Пропускаємо chrome-extension та інші нестандартні протоколи
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API запити - Network First (спочатку мережа, потім кеш)
  if (API_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Зовнішні CDN ресурси - Network First
  if (url.hostname !== location.hostname) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Статичні ресурси - Cache First (спочатку кеш, потім мережа)
  event.respondWith(cacheFirst(event.request));
});

// ==========================================
// СТРАТЕГІЇ КЕШУВАННЯ
// ==========================================

// Cache First - для статичних ресурсів
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    // Кешуємо нові ресурси (якщо успішна відповідь)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    // Можна повернути fallback сторінку тут
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network First - для API та динамічного контенту
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Опціонально: кешувати успішні API відповіді
    if (response.ok && request.url.includes('vnz.osvita.net')) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Мережа недоступна - пробуємо кеш
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Немає ні мережі ні кешу
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ==========================================
// PUSH NOTIFICATIONS (заготовка)
// ==========================================
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Нове сповіщення',
    icon: './images/icon-192x192.png',
    badge: './images/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Розклад К-ПНУ', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || './')
  );
});
