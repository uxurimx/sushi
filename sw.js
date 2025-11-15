// Nombre del caché
const CACHE_NAME = 'kaizen-sushi-v1';

// Archivos que se guardarán en caché para que funcione offline
const CACHE_ASSETS = [
    '/index.html',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'
    // Puedes añadir tus imágenes de sushi aquí si quieres:
    // '/img/sushi_dragon.png',
    // '/img/sushi_arcoiris.png',
    // '/img/sushi_veggie.png'
];

// Evento de Instalación: Se guardan los assets en caché
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // console.log('Service Worker: Caching files');
                return cache.addAll(CACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Evento de Activación: Limpia cachés antiguos
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        // console.log('Service Worker: Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Evento Fetch: Sirve la app desde el caché (Offline-First)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request)
            .then(response => {
                // Si está en caché, lo sirve desde ahí.
                // Si no, va a la red a buscarlo.
                return response || fetch(e.request);
            })
            .catch(() => {
                // Fallback (opcional): si todo falla, podrías
                // mostrar una página HTML de "sin conexión".
                // Por ahora, solo fallará la petición.
            })
    );
});