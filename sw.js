// Nombre del caché
const CACHE_NAME = 'kaizen-sushi-v10'; // Incrementé la versión

// Archivos que se guardarán en caché (solo locales)
const CACHE_ASSETS = [
    './index.html',     // <--- CORREGIDO: Ruta relativa
    './manifest.json',    // <--- AÑADIDO: Importante
    './favicon.png',      // <--- AÑADIDO: Importante
    // La fuente de Google (googleapis.com) se eliminó para evitar el error 'addAll'
    
    // Puedes añadir tus imágenes de sushi aquí si quieres:
    // './img/sushi_dragon.png',
    // './img/sushi_arcoiris.png',
    // './img/sushi_veggie.png'
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
            .catch(err => {
                // console.error('Service Worker: Falló cache.addAll(): ', err);
                // Si 'addAll' falla, la instalación se detiene.
            })
    );
});

// Evento de Activación: Limpia cachés antiguos
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME && cache !== 'kaizen-sushi-v1') { // Conservamos v1 por si acaso
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
    // No intentes cachear peticiones de dominios externos como Google Fonts en el 'fetch'
    if (e.request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    e.respondWith(
        caches.match(e.request)
            .then(response => {
                // Si está en caché, lo sirve desde ahí.
                // Si no, va a la red a buscarlo.
                return response || fetch(e.request);
            })
            .catch(() => {
                // Fallback (opcional): si todo falla
            })
    );
});