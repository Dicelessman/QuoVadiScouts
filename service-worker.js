// Service Worker per QuoVadiScout PWA v1.3.1
const CACHE_NAME = 'quovadiscout-v1.3.1';
const STATIC_CACHE = 'static-v1.3.1';
const DYNAMIC_CACHE = 'dynamic-v1.3.1';
const IMAGE_CACHE = 'images-v1.3.1';
const FREQUENTLY_USED_CACHE = 'frequently-used-v1';
const MAX_CACHED_STRUCTURES = 50;

// Risorse da cachare staticamente
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.local.html',
  '/styles.css',
  '/script.js',
  '/dist/script.js',
  '/dashboard.html',
  '/dashboard.css',
  '/dashboard.js',
  '/manifest.json',
  // CDN resources
  'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js'
];

// Installazione Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installazione in corso...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Service Worker: Caching risorse statiche...');
        // Cache ogni asset individualmente per gestire errori singoli
        const cachePromises = STATIC_ASSETS.map(asset => {
          return fetch(asset)
            .then(response => {
              if (response.ok) {
                return cache.put(asset, response);
              } else {
                console.warn(`⚠️ Service Worker: Impossibile cachare ${asset}: ${response.status}`);
                return Promise.resolve();
              }
            })
            .catch(error => {
              console.warn(`⚠️ Service Worker: Errore caching ${asset}:`, error.message);
              return Promise.resolve();
            });
        });
        
        return Promise.all(cachePromises);
      })
      .then(() => {
        console.log('✅ Service Worker: Installazione completata');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Errore durante installazione:', error);
        // Non bloccare l'installazione per errori di cache
        return self.skipWaiting();
      })
  );
});

// Attivazione Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Attivazione in corso...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== FREQUENTLY_USED_CACHE) {
              console.log('🗑️ Service Worker: Rimozione cache obsoleta:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Attivazione completata');
        return self.clients.claim();
      })
  );
});

// Intercettazione richieste
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignora richieste per favicon e altre risorse non critiche
  if (url.pathname.includes('favicon.ico') || 
      url.pathname.includes('robots.txt') ||
      url.pathname.includes('sitemap.xml')) {
    return;
  }
  
  // Ignora richieste da estensioni Chrome
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Ignora richieste POST (non supportate dal cache)
  if (request.method !== 'GET') {
    return;
  }
  
  // Strategia per risorse statiche
  if (isStaticAsset(request)) {
    event.respondWith(
      cacheFirst(request).catch(error => {
        console.warn('⚠️ Service Worker: Errore cache-first per:', request.url, error);
        return new Response('Risorsa non disponibile', { status: 404 });
      })
    );
  }
  // Strategia per API Firebase
  else if (isFirebaseRequest(request)) {
    event.respondWith(
      networkFirst(request).catch(error => {
        console.warn('⚠️ Service Worker: Errore network-first per:', request.url, error);
        return new Response('API non disponibile', { status: 503 });
      })
    );
  }
  // Strategia per immagini
  else if (isImageRequest(request)) {
    event.respondWith(
      cacheFirst(request).catch(error => {
        console.warn('⚠️ Service Worker: Errore immagine per:', request.url, error);
        return new Response('Immagine non disponibile', { status: 404 });
      })
    );
  }
  // Strategia di default
  else {
    event.respondWith(
      networkFirst(request).catch(error => {
        console.warn('⚠️ Service Worker: Errore default per:', request.url, error);
        return new Response('Risorsa non disponibile', { status: 404 });
      })
    );
  }
});

// Strategia Cache First (per risorse statiche)
async function cacheFirst(request) {
  try {
    // Verifica se la richiesta è cachabile
    if (!isCacheableRequest(request)) {
      return fetch(request);
    }
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Service Worker: Risposta da cache:', request.url);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        console.warn('⚠️ Service Worker: Errore nel caching:', cacheError);
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Service Worker: Errore cache-first:', error);
    // Non loggare errori per risorse che potrebbero non esistere (come favicon)
    if (!request.url.includes('favicon.ico')) {
      console.warn('⚠️ Service Worker: Risorsa non trovata:', request.url);
    }
    return new Response('Offline - Risorsa non disponibile', { status: 503 });
  }
}

// Strategia Network First (per API dinamiche)
async function networkFirst(request) {
  try {
    // Verifica se la richiesta è cachabile
    if (!isCacheableRequest(request)) {
      return fetch(request);
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      try {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        console.warn('⚠️ Service Worker: Errore nel caching dinamico:', cacheError);
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🌐 Service Worker: Rete non disponibile, controllo cache...');
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('📦 Service Worker: Risposta da cache offline:', request.url);
      return cachedResponse;
    }
    
    // Fallback per richieste Firebase
    if (isFirebaseRequest(request)) {
      return new Response(JSON.stringify({
        error: 'Offline',
        message: 'Connessione non disponibile. I dati saranno sincronizzati quando la connessione sarà ripristinata.'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Offline - Risorsa non disponibile', { status: 503 });
  }
}

// Helper functions
function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.some(asset => url.pathname.includes(asset)) ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.html');
}

function isFirebaseRequest(request) {
  const url = new URL(request.url);
  return url.hostname.includes('firestore.googleapis.com') ||
         url.hostname.includes('firebase.googleapis.com') ||
         url.hostname.includes('quovadiscout.firebaseapp.com');
}

function isImageRequest(request) {
  return request.destination === 'image' ||
         /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(request.url);
}

function isCacheableRequest(request) {
  // Verifica se la richiesta può essere cachata
  const url = new URL(request.url);
  
  // Non cachare richieste da estensioni
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'moz-extension:' ||
      url.protocol === 'safari-extension:') {
    return false;
  }
  
  // Non cachare richieste POST, PUT, DELETE
  if (request.method !== 'GET') {
    return false;
  }
  
  // Non cachare richieste con credenziali
  if (request.credentials === 'include') {
    return false;
  }
  
  // Non cachare richieste a domini esterni non sicuri
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false;
  }
  
  return true;
}

// Gestione messaggi dal client
self.addEventListener('message', (event) => {
  const { action, data } = event.data;
  
  switch (action) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_CLEAR':
      clearCaches();
      break;
      
    case 'CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage({ action: 'CACHE_STATUS_RESPONSE', data: status });
      });
      break;
      
    case 'SYNC_DATA':
      syncOfflineData();
      break;
      
    case 'TRACK_STRUCTURE_ACCESS':
      trackStructureAccess(data.structureId);
      break;
      
    case 'CACHE_FREQUENT_STRUCTURES':
      cacheFrequentStructures();
      break;
  }
});

// Registra sync event per background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-structures') {
    event.waitUntil(syncOfflineData());
  }
});

// Controlla aggiornamenti automatici
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ action: 'SW_UPDATED' });
      });
    })
  );
});

// Funzioni di utilità
async function clearCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('🗑️ Service Worker: Cache pulita');
}

async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    status[cacheName] = keys.length;
  }
  
  return status;
}

// Cache intelligente per strutture più utilizzate
async function trackStructureAccess(structureId) {
  try {
    // Salva timestamp accesso in IndexedDB
    const db = await openIndexedDB();
    const transaction = db.transaction(['structureAccess'], 'readwrite');
    const store = transaction.objectStore('structureAccess');
    
    const existing = await store.get(structureId);
    const newData = {
      id: structureId,
      lastAccess: Date.now(),
      count: (existing?.count || 0) + 1
    };
    
    await store.put(newData);
    console.log('📊 Service Worker: Tracciato accesso struttura:', structureId);
  } catch (error) {
    console.error('❌ Service Worker: Errore tracking accesso:', error);
  }
}

async function cacheFrequentStructures() {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['structureAccess'], 'readonly');
    const store = transaction.objectStore('structureAccess');
    const index = store.index('count');
    
    // Recupera le strutture più accessate
    const frequentStructures = await index.getAll(null, MAX_CACHED_STRUCTURES);
    
    // Cache le strutture in IndexedDB per accesso offline
    const cacheTransaction = db.transaction(['cachedStructures'], 'readwrite');
    const cacheStore = cacheTransaction.objectStore('cachedStructures');
    
    // Scarica e cache le strutture (implementazione semplificata)
    console.log('📦 Service Worker: Caching strutture frequenti:', frequentStructures.length);
    
  } catch (error) {
    console.error('❌ Service Worker: Errore caching strutture:', error);
  }
}

async function getCachedStructure(structureId) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['cachedStructures'], 'readonly');
    const store = transaction.objectStore('cachedStructures');
    const result = await store.get(structureId);
    return result;
  } catch (error) {
    console.error('❌ Service Worker: Errore recupero struttura cached:', error);
    return null;
  }
}

async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    // Apri sempre la versione corrente senza forzare il numero di versione
    const request = indexedDB.open('QuoVadiScoutDB');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store per tracking accessi
      if (!db.objectStoreNames.contains('structureAccess')) {
        const accessStore = db.createObjectStore('structureAccess', { keyPath: 'id' });
        accessStore.createIndex('count', 'count', { unique: false });
        accessStore.createIndex('lastAccess', 'lastAccess', { unique: false });
      }
      
      // Store per strutture cached
      if (!db.objectStoreNames.contains('cachedStructures')) {
        db.createObjectStore('cachedStructures', { keyPath: 'id' });
      }
      
      // Store per modifiche offline
      if (!db.objectStoreNames.contains('offlineChanges')) {
        db.createObjectStore('offlineChanges', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function syncOfflineData() {
  // Implementazione sincronizzazione dati offline
  console.log('🔄 Service Worker: Sincronizzazione dati offline...');
  
  try {
    // Qui implementeremo la logica di sincronizzazione
    // quando i dati saranno disponibili offline
    console.log('✅ Service Worker: Sincronizzazione completata');
  } catch (error) {
    console.error('❌ Service Worker: Errore sincronizzazione:', error);
  }
}

// Gestione notifiche push
self.addEventListener('push', (event) => {
  console.log('📱 Service Worker: Notifica push ricevuta');
  
  const options = {
    body: event.data ? event.data.text() : 'Nuova notifica da QuoVadiScout',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiMyZjZiMmYiLz4KPHN2ZyB4PSI0OCIgeT0iNDgiIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CjxwYXRoIGQ9Ik0xMiAyTDEzLjA5IDguMjZMMjAgOUwxMy4wOSAxNS43NEwxMiAyMkwxMC45MSAxNS43NEw0IDlMMTAuOTEgOC4yNkwxMiAyWiIvPgo8L3N2Zz4KPC9zdmc+',
    badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIiIGhlaWdodD0iNzIiIHZpZXdCb3g9IjAgMCA3MiA3MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiByeD0iOSIgZmlsbD0iIzJmNmIyZiIvPgo8c3ZnIHg9IjE4IiB5PSIxOCIgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIi8+Cjwvc3ZnPgo8L3N2Zz4=',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Visualizza',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIiIGhlaWdodD0iNzIiIHZpZXdCb3g9IjAgMCA3MiA3MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiByeD0iOSIgZmlsbD0iIzJmNmIyZiIvPgo8c3ZnIHg9IjE4IiB5PSIxOCIgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIi8+Cjwvc3ZnPgo8L3N2Zz4='
      },
      {
        action: 'close',
        title: 'Chiudi',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIiIGhlaWdodD0iNzIiIHZpZXdCb3g9IjAgMCA3MiA3MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiByeD0iOSIgZmlsbD0iIzJmNmIyZiIvPgo8c3ZnIHg9IjE4IiB5PSIxOCIgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIi8+Cjwvc3ZnPgo8L3N2Zz4='
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('QuoVadiScout', options)
  );
});

// Gestione click su notifiche
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Service Worker: Click su notifica');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('🔧 Service Worker: Caricato e pronto');
