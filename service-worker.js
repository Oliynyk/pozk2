const CACHE_NAME = 'rozk2-pwa-v1'; // Змініть назву кешу при оновленні файлів

const urlsToCache = [
  // 1. Кореневий шлях (зазвичай index.html)
  '/', 

  // 2. Основні HTML-файли
  'index.html',

  // 3. Стилі (CSS)
  'style.css',

  
  // 4. Скрипти (JS)

  'news.js',

  
  // 5. Маніфест
  'manifest.json',
  
  // 6. Критично важливі зображення/іконки (наприклад, іконка PWA)
  'images/icon-192x192.png' // Приклад
  // Якщо у вас багато зображень, кешуйте лише ті, що потрібні для офлайн-оболонки
];

// 1. Подія 'install' - кешуємо ресурси
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Подія 'fetch' - обслуговуємо запити з кешу
self.addEventListener('fetch', event => {
  // Перевіряємо, чи є запит у кеші
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Якщо запит є в кеші, повертаємо його
        if (response) {
          return response;
        }
        // Інакше - робимо мережевий запит
        return fetch(event.request);
      })
  );
});

// 3. Подія 'activate' - очищаємо старі кеші
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Видаляємо старий кеш
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});


