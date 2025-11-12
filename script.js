// === QuoVadiScout v1.3.0 - Cache Bust: 2024-12-19-12-00 ===

// === Sistema di Logging Condizionale ===
const DEBUG = false; // Impostare a true per debug in produzione
const log = {
  info: (...args) => DEBUG && console.log(...args),
  debug: (...args) => DEBUG && (console.debug ? console.debug(...args) : console.log('[DEBUG]', ...args)),
  warn: (...args) => (console.warn ? console.warn(...args) : console.log('[WARN]', ...args)),
  error: (...args) => console.error(...args) // Sempre attivo per errori
};
// Espone il logger globalmente per gli altri script non-modulari
window.log = log;

// === Firebase SDK Imports ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

// === Configurazione Firebase ===
// 🔒 SICUREZZA: Credenziali caricate dinamicamente da firebase-config.js
// Il file firebase-config.js deve essere escluso dal repository (.gitignore)

// Assicura che esista la funzione di validazione
if (typeof window.validateFirebaseConfig !== 'function') {
  window.validateFirebaseConfig = function(config) {
    return true;
  };
}

// Verifica che la configurazione Firebase sia disponibile
if (typeof FirebaseConfig === 'undefined') {
  console.warn('⚠️ Configurazione Firebase non trovata. In Vercel è servita da /api/firebase-config.js');
  // Fallback sicuro vuoto (evita chiavi hardcoded nel repository)
  window.FirebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: "",
    vapidKey: "",
    environment: "production",
    authorizedDomains: ["localhost", "127.0.0.1"],
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000
    }
  };
  // Funzione di validazione minimale
  window.validateFirebaseConfig = function(config) {
    console.warn('⚠️ Configurazione Firebase vuota in fallback');
    return true;
  };
}

// Valida configurazione Firebase
try {
  window.validateFirebaseConfig(FirebaseConfig);
  console.log('✅ Configurazione Firebase validata:', {
    projectId: FirebaseConfig.projectId,
    authDomain: FirebaseConfig.authDomain,
    apiKey: FirebaseConfig.apiKey.substring(0, 10) + '...',
    appId: FirebaseConfig.appId
  });
  
  // Verifica che le credenziali non siano demo
  if (FirebaseConfig.apiKey === "demo-api-key") {
    console.warn('⚠️ ATTENZIONE: Stai usando credenziali demo!');
  } else {
    console.log('✅ Credenziali Firebase reali caricate');
  }
  
  // Verifica che tutte le credenziali siano presenti
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingFields = requiredFields.filter(field => !FirebaseConfig[field] || FirebaseConfig[field].includes('YOUR_'));
  
  if (missingFields.length > 0) {
    console.error('❌ Credenziali Firebase incomplete:', missingFields);
  }
  
  // Verifica se il Service Worker potrebbe interferire
  if ('serviceWorker' in navigator) {
    console.log('⚠️ Service Worker attivo - potrebbe interferire con Firebase');
  }
} catch (error) {
  console.error('❌ Errore validazione configurazione Firebase:', error);
  throw error;
}

const firebaseConfig = FirebaseConfig;

// === Inizializzazione Firebase ===
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();
const colRef = collection(db, "strutture");

// Esponi Storage globalmente per media-manager.js
window.firebaseStorage = storage;
window.firebaseStorageRef = ref;
window.firebaseUploadBytes = uploadBytesResumable;
window.firebaseGetDownloadURL = getDownloadURL;
window.firebaseDeleteObject = deleteObject;
window.firebaseListAll = listAll;

// Esponi Firestore globalmente per export.js e altri script non-modulari
window.db = db;
window.firestore = {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  orderBy
};

// === Caricamento dati da Firestore ===
async function caricaStrutture() {
  // 🔒 SICUREZZA: Verifica autenticazione PRIMA di caricare dati
  
  if (!auth || !auth.currentUser) {
    console.log('🔒 Accesso negato: autenticazione richiesta');
    mostraSchermataLogin();
    return [];
  }
  
  const cacheKey = 'strutture_cache';
  const cacheTimestamp = 'strutture_cache_timestamp';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
  
  try {
    // Controlla cache prima di fare la query
    const cached = localStorage.getItem(cacheKey);
    const timestamp = localStorage.getItem(cacheTimestamp);
    
    if (cached && timestamp && (Date.now() - parseInt(timestamp)) < CACHE_DURATION) {
      console.log('📦 Carico strutture da cache');
      const dati = JSON.parse(cached);
      console.log(`✅ Caricate ${dati.length} strutture da cache (${Math.round((Date.now() - parseInt(timestamp)) / 1000)}s fa)`);
      return dati;
    }
    
    console.log('🔗 Connessione a Firestore...');
    console.log('📊 Progetto:', firebaseConfig.projectId);
    console.log('📁 Collezione: strutture');
    
    const snapshot = await getDocs(colRef);
    console.log('✅ Connessione Firestore riuscita');
    console.log('📄 Documenti trovati:', snapshot.docs.length);
    
    const dati = snapshot.docs.map((d) => {
      const docData = d.data();
      console.log(`📋 Documento ${d.id}:`, docData);
      
      // Sincronizza formato coordinate per compatibilità
      const struttura = { id: d.id, ...docData };
      if (struttura.coordinate_lat && struttura.coordinate_lng && !struttura.coordinate) {
        struttura.coordinate = { lat: struttura.coordinate_lat, lng: struttura.coordinate_lng };
      } else if (struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng && 
                 !struttura.coordinate_lat && !struttura.coordinate_lng) {
        struttura.coordinate_lat = struttura.coordinate.lat;
        struttura.coordinate_lng = struttura.coordinate.lng;
      }
      
      // Prova a ottenere coordinate da Google Maps se non ci sono coordinate precise
      if (!struttura.coordinate && !struttura.coordinate_lat && struttura.google_maps_link) {
        const coordinate = estraiCoordinateDaGoogleMaps(struttura.google_maps_link);
        if (coordinate) {
          struttura.coordinate = coordinate;
          struttura.coordinate_lat = coordinate.lat;
          struttura.coordinate_lng = coordinate.lng;
          console.log(`🗺️ Coordinate estratte da Google Maps per: ${struttura.Struttura}`);
        }
      }
      
      return struttura;
    });
    
    console.log(`✅ Caricate ${dati.length} strutture da Firestore`);
    
    // Salva in cache
    localStorage.setItem(cacheKey, JSON.stringify(dati));
    localStorage.setItem(cacheTimestamp, Date.now().toString());
    console.log('💾 Strutture salvate in cache');
    
    // Se Firestore è vuoto, prova con i dati locali
    if (dati.length === 0) {
      console.log('⚠️ Firestore vuoto, tentativo di caricamento da file locale...');
      return await caricaStruttureLocali();
    }
    
    return dati;
  } catch (error) {
    console.error('❌ Errore nel caricamento da Firestore:', error);
    console.log('🔄 Tentativo di caricamento da file locale...');
    return await caricaStruttureLocali();
  }
}

// === Caricamento dati locali di fallback ===
async function caricaStruttureLocali() {
  try {
    const response = await fetch('./data.json');
    if (!response.ok) {
      throw new Error('File data.json non trovato');
    }
    const dati = await response.json();
    console.log(`Caricate ${dati.length} strutture da file locale`);
    return dati;
  } catch (error) {
    console.error('Errore nel caricamento locale:', error);
    // Dati di esempio se tutto fallisce
    return [
      {
        id: 'demo-1',
        Struttura: 'Casa Scout Demo',
        Luogo: 'Milano',
        Prov: 'MI',
        Casa: true,
        Terreno: false,
        Referente: 'Mario Rossi',
        Contatto: '333-1234567',
        Info: 'Struttura di esempio per test'
      },
      {
        id: 'demo-2',
        Struttura: 'Terreno Scout Demo',
        Luogo: 'Bergamo',
        Prov: 'BG',
        Casa: false,
        Terreno: true,
        Referente: 'Giulia Bianchi',
        Contatto: 'giulia@scout.it',
        Info: 'Terreno di esempio per test'
      }
    ];
  }
}

// === Paginazione ===
let paginaCorrente = 1;
let elementiPerPagina = 20;

// === Gestione modalità visualizzazione ===
let isListViewMode = false;

function renderStrutture(lista) {
  // Log solo se DEBUG è attivo
  if (DEBUG) {
    console.log('🎨 renderStrutture chiamato con', lista.length, 'strutture');
  }
  
  const container = document.getElementById("results");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const emptyState = document.getElementById("emptyState");
  const resultsCount = document.getElementById("resultsCount");
  
  if (!container) {
    console.error('❌ Container results non trovato!');
    return;
  }
  
  // Nascondi loading indicator
  if (loadingIndicator) {
    loadingIndicator.classList.add('hidden');
  }
  
  // Aggiorna contatore risultati
  if (resultsCount) {
    resultsCount.textContent = `${lista.length} strutture`;
  }
  
  // Aggiorna mappa principale con le strutture filtrate
  updateMainMap(lista);
  
  if (container) {
    container.innerHTML = "";
    // Assicurati che il container mantenga sempre la classe CSS per il grid layout
    if (!container.classList.contains('results-container')) {
      container.classList.add('results-container');
    }
  }

  if (lista.length === 0) {
    if (emptyState) {
      emptyState.classList.remove('hidden');
    }
    return;
  } else {
    if (emptyState) {
      emptyState.classList.add('hidden');
    }
  }

  // Se la lista è molto lunga, usa virtual scrolling e mostra tutto senza paginazione
  if (lista.length > 100 && typeof window.createVirtualScroller === 'function' && container) {
    const buildCardElement = (s) => {
      const card = document.createElement("div");
      card.className = "card";
      const isInElenco = elencoPersonale.includes(s.id);
      if (isListViewMode) {
        card.innerHTML = `
        <div class="card-header">
          <h3 class="card-title clickable-title" data-id="${s.id}">${s.Struttura || "Suggerisci nome"}</h3>
          <div class="card-actions">
            <button class="btn btn-ghost toggle-elenco ${isInElenco ? 'in-elenco' : ''}" data-id="${s.id}">
              ${isInElenco ? '⭐' : '☆'}
            </button>
            <button class="btn btn-ghost notes-btn" onclick="mostraNotePersonali('${s.id}')" title="Note personali">
              📝
            </button>
          </div>
        </div>
        
        <div class="card-content">
          <div class="card-field">
            <span class="card-field-icon">📍</span>
            <span class="card-field-value">${s.Luogo || "Luogo non specificato"}, ${s.Prov || "Provincia non specificata"}</span>
          </div>
          
          <div class="card-badges">
            ${s.Casa ? '<span class="badge badge-primary">🏠 Casa</span>' : ''}
            ${s.Terreno ? '<span class="badge badge-primary">🌲 Terreno</span>' : ''}
            ${s.stato ? `<span class="status-badge ${s.stato}">${getStatoLabel(s.stato)}</span>` : ''}
            ${s.rating?.average ? `<span class="rating-badge">⭐ ${s.rating.average.toFixed(1)}</span>` : ''}
            ${s.segnalazioni?.length ? `<span class="reports-badge">⚠️ ${s.segnalazioni.length}</span>` : ''}
          </div>
          
          ${s.Referente || s.Contatto ? `
          <div class="card-field">
            <span class="card-field-icon">👤</span>
            <span class="card-field-value">${s.Referente || ''} ${s.Contatto ? `• ${s.Contatto}` : ''}</span>
          </div>` : ''}
          
          ${s.Info ? `<div class="card-field">
            <span class="card-field-icon">ℹ️</span>
            <span class="card-field-value">${s.Info.length > 100 ? s.Info.substring(0, 100) + '...' : s.Info}</span>
          </div>` : ''}
        </div>
      `;
      } else {
        card.innerHTML = `
        <div class="card-header">
          <h3 class="card-title clickable-title" data-id="${s.id}">${s.Struttura || "Suggerisci nome"}</h3>
          <div class="card-actions">
            <button class="btn btn-ghost toggle-elenco ${isInElenco ? 'in-elenco' : ''}" data-id="${s.id}">
              ${isInElenco ? '⭐' : '☆'}
            </button>
            <button class="btn btn-ghost notes-btn" onclick="mostraNotePersonali('${s.id}')" title="Note personali">
              📝
            </button>
          </div>
        </div>
        
        <div class="card-content">
          <div class="card-field">
            <span class="card-field-icon">📍</span>
            <span class="card-field-value">${s.Luogo || "Luogo non specificato"}, ${s.Prov || "Provincia non specificata"}</span>
          </div>
          
          ${s.Info ? `<div class="card-field">
            <span class="card-field-icon">ℹ️</span>
            <span class="card-field-value">${s.Info}</span>
          </div>` : ''}
          
          <div class="card-badges">
            ${s.Casa ? '<span class="badge badge-primary">🏠 Casa</span>' : ''}
            ${s.Terreno ? '<span class="badge badge-primary">🌲 Terreno</span>' : ''}
            ${s.stato ? `<span class="status-badge ${s.stato}">${getStatoLabel(s.stato)}</span>` : ''}
            ${s.rating?.average ? `<span class="rating-badge">⭐ ${s.rating.average.toFixed(1)}</span>` : ''}
            ${s.segnalazioni?.length ? `<span class="reports-badge">⚠️ ${s.segnalazioni.length}</span>` : ''}
          </div>
          
          ${s.Letti || s.Branco || s.Reparto || s.Compagnia ? `
          <div class="card-field">
            <span class="card-field-icon">🏕️</span>
            <span class="card-field-value">
              ${s.Letti ? `Letti: ${s.Letti}` : ''}
              ${s.Branco ? ` • Branco: ${s.Branco}` : ''}
              ${s.Reparto ? ` • Reparto: ${s.Reparto}` : ''}
              ${s.Compagnia ? ` • Compagnia: ${s.Compagnia}` : ''}
            </span>
          </div>` : ''}
          
          ${s.Referente ? `<div class="card-field">
            <span class="card-field-icon">👤</span>
            <span class="card-field-value">${s.Referente}</span>
          </div>` : ''}
          
          ${s.Email ? `<div class="card-field">
            <span class="card-field-icon">📧</span>
            <span class="card-field-value">${s.Email}</span>
          </div>` : ''}
          
          ${s.Sito ? `<div class="card-field">
            <span class="card-field-icon">🌐</span>
            <span class="card-field-value">${s.Sito}</span>
          </div>` : ''}
          
          ${s.Contatto ? `<div class="card-field">
            <span class="card-field-icon">📞</span>
            <span class="card-field-value">${s.Contatto}</span>
          </div>` : ''}
          
          ${s['Ultimo controllo'] ? `<div class="card-field">
            <span class="card-field-icon">📅</span>
            <span class="card-field-value">Ultimo controllo: ${s['Ultimo controllo']}</span>
          </div>` : ''}
        </div>
      `;
      }
      // Event listeners per la card
      const titleEl = card.querySelector('.clickable-title');
      if (titleEl) {
        titleEl.addEventListener('click', () => mostraSchedaCompleta(s.id));
      }
      const toggleBtn = card.querySelector('.toggle-elenco');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          const id = s.id;
          if (elencoPersonale.includes(id)) {
            rimuoviDallElenco(id);
            toggleBtn.classList.remove('in-elenco');
            toggleBtn.textContent = '☆';
          } else {
            aggiungiAllElenco(id);
            toggleBtn.classList.add('in-elenco');
            toggleBtn.textContent = '⭐';
          }
        });
      }
      return card;
    };
    // Inizializza virtual scroller
    container.style.position = 'relative';
    try {
      const scroller = window.createVirtualScroller(container, lista, buildCardElement, {
        placeholderHeight: isListViewMode ? 140 : 220,
        minItemsToVirtualize: 20,
        rootMargin: '400px'
      });
      scroller.init();
    } catch (error) {
      console.error('❌ Errore durante inizializzazione virtual scroller:', error);
      throw error;
    }
    // Niente paginazione in modalità virtualizzata
    return;
  }

  // Calcola paginazione
  const totalePagine = Math.ceil(lista.length / elementiPerPagina);
  const inizio = (paginaCorrente - 1) * elementiPerPagina;
  const fine = inizio + elementiPerPagina;
  const listaPagina = lista.slice(inizio, fine);

  listaPagina.forEach((s, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    const isInElenco = elencoPersonale.includes(s.id);
    if (isListViewMode) {
      // Modalità elenco - layout orizzontale compatto
      card.innerHTML = `
        <div class="card-header">
          <h3 class="card-title clickable-title" data-id="${s.id}">${s.Struttura || "Suggerisci nome"}</h3>
          <div class="card-actions">
            <button class="btn btn-ghost toggle-elenco ${isInElenco ? 'in-elenco' : ''}" data-id="${s.id}">
              ${isInElenco ? '⭐' : '☆'}
            </button>
            <button class="btn btn-ghost notes-btn" onclick="mostraNotePersonali('${s.id}')" title="Note personali">
              📝
            </button>
          </div>
        </div>
        
        <div class="card-content">
          <div class="card-field">
            <span class="card-field-icon">📍</span>
            <span class="card-field-value">${s.Luogo || "Luogo non specificato"}, ${s.Prov || "Provincia non specificata"}</span>
          </div>
          
          <div class="card-badges">
            ${s.Casa ? '<span class="badge badge-primary">🏠 Casa</span>' : ''}
            ${s.Terreno ? '<span class="badge badge-primary">🌲 Terreno</span>' : ''}
            ${s.stato ? `<span class="status-badge ${s.stato}">${getStatoLabel(s.stato)}</span>` : ''}
            ${s.rating?.average ? `<span class="rating-badge">⭐ ${s.rating.average.toFixed(1)}</span>` : ''}
            ${s.segnalazioni?.length ? `<span class="reports-badge">⚠️ ${s.segnalazioni.length}</span>` : ''}
          </div>
          
          ${s.Referente || s.Contatto ? `
          <div class="card-field">
            <span class="card-field-icon">👤</span>
            <span class="card-field-value">${s.Referente || ''} ${s.Contatto ? `• ${s.Contatto}` : ''}</span>
          </div>` : ''}
          
          ${s.Info ? `<div class="card-field">
            <span class="card-field-icon">ℹ️</span>
            <span class="card-field-value">${s.Info.length > 100 ? s.Info.substring(0, 100) + '...' : s.Info}</span>
          </div>` : ''}
          ${s.immagini?.length ? `<img src="${(s.immagini[0]?.thumbnailUrl || s.immagini[0]?.url) ?? ''}" alt="Anteprima" loading="lazy" ${idx===0 ? 'fetchpriority="high"' : ''} style="display:none;width:0;height:0;"/>` : ''}
        </div>
      `;
    } else {
      // Modalità schede - layout verticale completo
      card.innerHTML = `
        <div class="card-header">
          <h3 class="card-title clickable-title" data-id="${s.id}">${s.Struttura || "Suggerisci nome"}</h3>
          <div class="card-actions">
            <button class="btn btn-ghost toggle-elenco ${isInElenco ? 'in-elenco' : ''}" data-id="${s.id}">
              ${isInElenco ? '⭐' : '☆'}
            </button>
            <button class="btn btn-ghost notes-btn" onclick="mostraNotePersonali('${s.id}')" title="Note personali">
              📝
            </button>
          </div>
        </div>
        
        <div class="card-content">
          <div class="card-field">
            <span class="card-field-icon">📍</span>
            <span class="card-field-value">${s.Luogo || "Luogo non specificato"}, ${s.Prov || "Provincia non specificata"}</span>
          </div>
          
          ${s.Info ? `<div class="card-field">
            <span class="card-field-icon">ℹ️</span>
            <span class="card-field-value">${s.Info}</span>
          </div>` : ''}
          
          <div class="card-badges">
            ${s.Casa ? '<span class="badge badge-primary">🏠 Casa</span>' : ''}
            ${s.Terreno ? '<span class="badge badge-primary">🌲 Terreno</span>' : ''}
            ${s.stato ? `<span class="status-badge ${s.stato}">${getStatoLabel(s.stato)}</span>` : ''}
            ${s.rating?.average ? `<span class="rating-badge">⭐ ${s.rating.average.toFixed(1)}</span>` : ''}
            ${s.segnalazioni?.length ? `<span class="reports-badge">⚠️ ${s.segnalazioni.length}</span>` : ''}
          </div>
          
          ${s.Letti || s.Branco || s.Reparto || s.Compagnia ? `
          <div class="card-field">
            <span class="card-field-icon">🏕️</span>
            <span class="card-field-value">
              ${s.Letti ? `Letti: ${s.Letti}` : ''}
              ${s.Branco ? ` • Branco: ${s.Branco}` : ''}
              ${s.Reparto ? ` • Reparto: ${s.Reparto}` : ''}
              ${s.Compagnia ? ` • Compagnia: ${s.Compagnia}` : ''}
            </span>
          </div>` : ''}
          
          ${s.Referente ? `<div class="card-field">
            <span class="card-field-icon">👤</span>
            <span class="card-field-value">${s.Referente}</span>
          </div>` : ''}
          
          ${s.Email ? `<div class="card-field">
            <span class="card-field-icon">📧</span>
            <span class="card-field-value">${s.Email}</span>
          </div>` : ''}
          
          ${s.Sito ? `<div class="card-field">
            <span class="card-field-icon">🌐</span>
            <span class="card-field-value">${s.Sito}</span>
          </div>` : ''}
          ${s.immagini?.length ? `<img src="${(s.immagini[0]?.thumbnailUrl || s.immagini[0]?.url) ?? ''}" alt="Anteprima" loading="lazy" ${idx===0 ? 'fetchpriority="high"' : ''} style="display:none;width:0;height:0;"/>` : ''}
          
          ${s.Contatto ? `<div class="card-field">
            <span class="card-field-icon">📞</span>
            <span class="card-field-value">${s.Contatto}</span>
          </div>` : ''}
          
          ${s['Ultimo controllo'] ? `<div class="card-field">
            <span class="card-field-icon">📅</span>
            <span class="card-field-value">Ultimo controllo: ${s['Ultimo controllo']}</span>
          </div>` : ''}
        </div>
      `;
    }
    
    container.appendChild(card);
  });

  // Eventi pulsanti
  document.querySelectorAll(".clickable-title").forEach((title) => {
    title.addEventListener("click", () => {
      mostraSchedaCompleta(title.dataset.id);
    });
  });
  
  document.querySelectorAll(".toggle-elenco").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (elencoPersonale.includes(id)) {
        rimuoviDallElenco(id);
        btn.classList.remove('in-elenco');
        btn.textContent = '☆';
      } else {
        aggiungiAllElenco(id);
        btn.classList.add('in-elenco');
        btn.textContent = '⭐';
      }
    });
  });

  // Aggiungi controlli di paginazione
    const paginazione = document.createElement('div');
    paginazione.className = 'paginazione';
  
  // Selettore elementi per pagina
  const itemsPerPageSelector = `
    <div class="pagination-items-per-page">
      <label for="items-per-page">Elementi per pagina:</label>
      <select id="items-per-page" onchange="cambiaElementiPerPagina(this.value)">
        <option value="20" ${elementiPerPagina === 20 ? 'selected' : ''}>20</option>
        <option value="50" ${elementiPerPagina === 50 ? 'selected' : ''}>50</option>
        <option value="100" ${elementiPerPagina === 100 ? 'selected' : ''}>100</option>
        <option value="${lista.length}" ${elementiPerPagina === lista.length ? 'selected' : ''}>Tutte (${lista.length})</option>
      </select>
    </div>
  `;
  
  // Controlli di paginazione (solo se ci sono più pagine)
  const paginationControls = totalePagine > 1 ? `
      <div class="pagination-info">
        Mostrando ${inizio + 1}-${Math.min(fine, lista.length)} di ${lista.length} strutture
      </div>
      <div class="pagination-controls">
        <button ${paginaCorrente === 1 ? 'disabled' : ''} onclick="cambiaPagina(${paginaCorrente - 1})">« Precedente</button>
        <span class="pagination-numbers">
        ${generaNumeriPagina(totalePagine, paginaCorrente)}
        </span>
        <button ${paginaCorrente === totalePagine ? 'disabled' : ''} onclick="cambiaPagina(${paginaCorrente + 1})">Successiva »</button>
      </div>
  ` : `
    <div class="pagination-info">
      Mostrando tutte le ${lista.length} strutture
    </div>
    `;
  
  paginazione.innerHTML = itemsPerPageSelector + paginationControls;
    container.appendChild(paginazione);
}

function cambiaPagina(nuovaPagina) {
  paginaCorrente = Math.max(1, nuovaPagina);
  const listaFiltrata = filtra(strutture);
  renderStrutture(listaFiltrata);
}

function cambiaElementiPerPagina(nuovoValore) {
  elementiPerPagina = parseInt(nuovoValore);
  paginaCorrente = 1; // Reset alla prima pagina
  const listaFiltrata = filtra(strutture);
  renderStrutture(listaFiltrata);
}

function generaNumeriPagina(totalePagine, paginaCorrente) {
  const numeri = [];
  const maxNumeri = 5; // Numero massimo di numeri da mostrare
  
  if (totalePagine <= maxNumeri) {
    // Se ci sono poche pagine, mostra tutte
    for (let i = 1; i <= totalePagine; i++) {
      numeri.push(`<button class="${i === paginaCorrente ? 'active' : ''}" onclick="cambiaPagina(${i})">${i}</button>`);
    }
  } else {
    // Logica per pagine multiple
    let inizio = Math.max(1, paginaCorrente - 2);
    let fine = Math.min(totalePagine, inizio + maxNumeri - 1);
    
    // Aggiusta l'inizio se siamo vicini alla fine
    if (fine - inizio < maxNumeri - 1) {
      inizio = Math.max(1, fine - maxNumeri + 1);
    }
    
    // Aggiungi "..." se necessario
    if (inizio > 1) {
      numeri.push(`<button onclick="cambiaPagina(1)">1</button>`);
      if (inizio > 2) {
        numeri.push(`<span class="pagination-dots">...</span>`);
      }
    }
    
    // Aggiungi i numeri centrali
    for (let i = inizio; i <= fine; i++) {
      numeri.push(`<button class="${i === paginaCorrente ? 'active' : ''}" onclick="cambiaPagina(${i})">${i}</button>`);
    }
    
    // Aggiungi "..." se necessario
    if (fine < totalePagine) {
      if (fine < totalePagine - 1) {
        numeri.push(`<span class="pagination-dots">...</span>`);
      }
      numeri.push(`<button onclick="cambiaPagina(${totalePagine})">${totalePagine}</button>`);
    }
  }
  
  return numeri.join('');
}


// === Ricerca Avanzata ===
function mostraRicercaAvanzata() {
  console.log('🔍 Apertura ricerca avanzata...');
  
  // Chiudi il menu automaticamente
  closeMenu();
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('ricercaAvanzataModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'ricercaAvanzataModal';
  modal.className = 'modal-overlay'; // Usa classe per ereditare tema
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content'; // Usa classe per ereditare tema
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 95%;
    max-height: 95%;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
    position: relative;
    min-width: 320px;
    width: 100%;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--border-light);
  `;
  
  const title = document.createElement('h2');
  title.textContent = '🔍 Ricerca Avanzata';
  title.style.cssText = `
    margin: 0;
    color: var(--primary, #2f6b2f);
    font-size: 1.5rem;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => modal.remove();
  
  // Funzione helper per creare i pulsanti (per evitar duplicazione)
  const createActionButtons = () => {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `display: flex; gap: 10px; flex-wrap: wrap;`;
    
    const leftActions = document.createElement('div');
    leftActions.style.cssText = `display: flex; gap: 10px;`;
    
    const clearBtn = document.createElement('button');
    clearBtn.innerHTML = '🧹 Pulisci';
    clearBtn.type = 'button';
    clearBtn.style.cssText = `
      background: #6c757d;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    clearBtn.onclick = () => {
      form.reset();
      // Pulisci anche i filtri attivi
      document.getElementById('search').value = '';
      const provEl = document.getElementById('filter-prov');
      if (provEl) provEl.value = '';
      
      // Reset filtri avanzati
      window.filtriAvanzatiAttivi = null;
      const indicator = document.getElementById('indicatore-ricerca-avanzata');
      if (indicator) indicator.remove();
      
      renderStrutture(filtra(strutture));
    };
    
    const rightActions = document.createElement('div');
    rightActions.style.cssText = `display: flex; gap: 10px;`;
    
    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = '💾 Salva Filtri';
    saveBtn.type = 'button';
    saveBtn.style.cssText = `
      background: #17a2b8;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    saveBtn.onclick = () => {
      salvaFiltriAvanzati();
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = '❌ Annulla';
    cancelBtn.type = 'button';
    cancelBtn.style.cssText = `
      background: #dc3545;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    cancelBtn.onclick = () => modal.remove();
    
    const searchBtn = document.createElement('button');
    searchBtn.innerHTML = '🔍 Cerca';
    searchBtn.type = 'button';
    searchBtn.style.cssText = `
      background: #28a745;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    searchBtn.onclick = () => {
      const filtriAvanzati = raccogliFiltriAvanzati();
      applicaRicercaAvanzata(filtriAvanzati);
      modal.remove();
    };
    
    leftActions.appendChild(clearBtn);
    rightActions.appendChild(saveBtn);
    rightActions.appendChild(cancelBtn);
    rightActions.appendChild(searchBtn);
    
    buttonContainer.appendChild(leftActions);
    buttonContainer.appendChild(rightActions);
    
    return buttonContainer;
  };
  
  // Pulsanti in header (in cima)
  const headerButtons = createActionButtons();
  headerButtons.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid var(--border-light);
  `;
  
  const headerContent = document.createElement('div');
  headerContent.style.cssText = `width: 100%;`;
  headerContent.appendChild(title);
  headerContent.appendChild(headerButtons);
  
  header.appendChild(headerContent);
  header.appendChild(closeBtn);
  
  // Form di ricerca
  const form = document.createElement('form');
  form.style.cssText = `
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    margin-bottom: 20px;
  `;
  
  // Campi di ricerca organizzati per categoria
  const categorie = {
    'Informazioni Principali': [
      { campo: 'Struttura', tipo: 'text', placeholder: 'Nome della struttura' },
      { campo: 'Luogo', tipo: 'text', placeholder: 'Città o località' },
      { campo: 'Indirizzo', tipo: 'text', placeholder: 'Indirizzo completo' },
      { campo: 'Prov', tipo: 'text', placeholder: 'Sigla provincia (es. MI)' },
      { campo: 'Info', tipo: 'textarea', placeholder: 'Informazioni generali' }
    ],
    'Costi €': [
      { campo: 'A persona', tipo: 'text', placeholder: 'Costo a persona' },
      { campo: 'A giornata', tipo: 'text', placeholder: 'Costo a giornata' },
      { campo: 'A notte', tipo: 'text', placeholder: 'Prezzo per notte' },
      { campo: 'Offerta', tipo: 'text', placeholder: 'Basta fare una offerta' },
      { campo: 'Forfait', tipo: 'text', placeholder: 'Chiedono un forfait' },
      { campo: 'Riscaldamento', tipo: 'text', placeholder: 'Costo riscaldamento' },
      { campo: 'Cucina', tipo: 'text', placeholder: 'Costo cucina' },
      { campo: 'Altri costi', tipo: 'text', placeholder: 'Altri costi' },
      { campo: 'Altre info', tipo: 'textarea', placeholder: 'Informazioni aggiuntive' }
    ],
    'Caratteristiche Struttura': [
      { campo: 'Terreno', tipo: 'checkbox', placeholder: 'Disponibile terreno' },
      { campo: 'Casa', tipo: 'checkbox', placeholder: 'Disponibile casa' },
      { campo: 'Letti', tipo: 'checkbox', placeholder: 'Ha letti' },
      { campo: 'Letti', tipo: 'text', placeholder: 'Numero di letti' },
      { campo: 'Cucina', tipo: 'checkbox', placeholder: 'Ha cucina' },
      { campo: 'Cucina', tipo: 'text', placeholder: 'Tipo di cucina' },
      { campo: 'Spazi', tipo: 'checkbox', placeholder: 'Ha spazi per attività' },
      { campo: 'Spazi', tipo: 'text', placeholder: 'Spazi disponibili' },
      { campo: 'Fuochi', tipo: 'checkbox', placeholder: 'Si possono fare fuochi' },
      { campo: 'Fuochi', tipo: 'text', placeholder: 'Dettagli sui fuochi' },
      { campo: 'Hike', tipo: 'checkbox', placeholder: 'Hike disponibili' },
      { campo: 'Hike', tipo: 'text', placeholder: 'Hike disponibili' },
      { campo: 'Trasporti', tipo: 'text', placeholder: 'Come lo si può raggiungere' },
      { campo: 'Altre info', tipo: 'textarea', placeholder: 'Altre informazioni' }
    ],
    'Adatto per': [
      { campo: 'Branco', tipo: 'checkbox', placeholder: 'Adatto per branco' },
      { campo: 'Reparto', tipo: 'checkbox', placeholder: 'Adatto per reparto' },
      { campo: 'Compagnia', tipo: 'checkbox', placeholder: 'Adatto per compagnia' },
      { campo: 'Gruppo', tipo: 'checkbox', placeholder: '50-100 persone' },
      { campo: 'Sezione', tipo: 'checkbox', placeholder: '+100 persone' }
    ],
    'Contatti': [
      { campo: 'Referente', tipo: 'text', placeholder: 'Nome del referente' },
      { campo: 'Email', tipo: 'email', placeholder: 'Indirizzo email' },
      { campo: 'Sito', tipo: 'url', placeholder: 'Sito web o facebook' },
      { campo: 'Contatto', tipo: 'tel', placeholder: 'Numero di telefono principale' },
      { campo: 'IIcontatto', tipo: 'tel', placeholder: 'Contatto secondario' },
      { campo: 'Altre info', tipo: 'textarea', placeholder: 'Altre informazioni di contatto' }
    ],
    'Gestione': [
      { campo: 'Ultimo controllo', tipo: 'date', placeholder: 'Data ultimo controllo' },
      { campo: 'Da chi', tipo: 'text', placeholder: 'Chi ha controllato' },
            { campo: 'stato', tipo: 'select', placeholder: 'Stato struttura', options: [
        { value: '', label: 'Tutti gli stati' },
        { value: 'attiva', label: '🟢 Attiva' },
        { value: 'temporaneamente_non_attiva', label: '🟡 Temporaneamente non attiva' },
        { value: 'non_piu_attiva', label: '🔴 Non più attiva' }
      ]},
      { campo: 'rating_min', tipo: 'number', placeholder: 'Rating minimo (1-5)' },
      { campo: 'rating_max', tipo: 'number', placeholder: 'Rating massimo (1-5)' },
      { campo: 'has_images', tipo: 'checkbox', placeholder: 'Ha immagini' },
      { campo: 'has_reports', tipo: 'checkbox', placeholder: 'Ha segnalazioni' },
      { campo: 'Note', tipo: 'textarea', placeholder: 'Note aggiuntive' }
    ],
    'Posizione Geografica': [
      { campo: 'coordinate_lat', tipo: 'number', placeholder: 'Latitudine' },
      { campo: 'coordinate_lng', tipo: 'number', placeholder: 'Longitudine' },
      { campo: 'distance_km', tipo: 'number', placeholder: 'Distanza massima (km)' },
      { campo: 'near_me', tipo: 'checkbox', placeholder: 'Vicino alla mia posizione' },
      { campo: 'google_maps_link', tipo: 'url', placeholder: 'Link Google Maps' }
    ],
    'Date e Versioni': [
      { campo: 'created_after', tipo: 'date', placeholder: 'Creata dopo' },
      { campo: 'created_before', tipo: 'date', placeholder: 'Creata prima' },
      { campo: 'modified_after', tipo: 'date', placeholder: 'Modificata dopo' },
      { campo: 'modified_before', tipo: 'date', placeholder: 'Modificata prima' }
    ]
  };
  
  Object.entries(categorie).forEach(([nomeCategoria, campi]) => {
    const categoriaDiv = document.createElement('div');
    categoriaDiv.className = 'categoria-div';
    categoriaDiv.style.cssText = `
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-radius: 8px;
      padding: 15px;
      border-left: 4px solid #2f6b2f;
    `;
    
    const categoriaTitle = document.createElement('h3');
    categoriaTitle.className = 'categoria-title';
    categoriaTitle.textContent = nomeCategoria;
    categoriaTitle.style.cssText = `
      margin: 0 0 15px 0;
      color: var(--accent-color, #2f6b2f);
      font-size: 1.1rem;
    `;
    if (categoriaDiv && categoriaTitle) {
      categoriaDiv.appendChild(categoriaTitle);
    }
    
    campi.forEach(({ campo, tipo, placeholder, options }) => {
      const campoDiv = document.createElement('div');
      campoDiv.className = 'campo-div';
      campoDiv.style.cssText = `
        margin-bottom: 12px;
      `;
      
      const label = document.createElement('label');
      label.textContent = campo;
      label.style.cssText = `
        display: block;
        font-weight: 500;
        color: #495057;
        margin-bottom: 4px;
        font-size: 14px;
      `;
      
      let input;
      if (tipo === 'checkbox') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `search-${campo.replace(/\s+/g, '-')}`;
        input.style.cssText = `
          margin-right: 8px;
          transform: scale(1.1);
        `;
        
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'checkbox-div';
        checkboxDiv.style.cssText = `
          display: flex;
          align-items: center;
        `;
        checkboxDiv.appendChild(input);
        checkboxDiv.appendChild(label);
        campoDiv.appendChild(checkboxDiv);
      } else if (tipo === 'select') {
        input = document.createElement('select');
        input.id = `search-${campo.replace(/\s+/g, '-')}`;
        input.style.cssText = `
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        `;
        
        // Aggiungi opzioni
        if (options) {
          options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            input.appendChild(optionElement);
          });
        }
        
        campoDiv.appendChild(label);
        campoDiv.appendChild(input);
      } else if (tipo === 'textarea') {
        input = document.createElement('textarea');
        input.id = `search-${campo.replace(/\s+/g, '-')}`;
        input.placeholder = placeholder;
        input.rows = 3;
        input.style.cssText = `
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
        `;
        
        campoDiv.appendChild(label);
        campoDiv.appendChild(input);
      } else if (tipo === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        input.id = `search-${campo.replace(/\s+/g, '-')}`;
        input.placeholder = placeholder;
        input.style.cssText = `
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        `;
        
        // Aggiungi min/max per rating
        if (campo.includes('rating')) {
          input.min = 1;
          input.max = 5;
          input.step = 0.1;
        }
        
        campoDiv.appendChild(label);
        campoDiv.appendChild(input);
      } else {
        input = document.createElement('input');
        input.type = tipo;
        input.id = `search-${campo.replace(/\s+/g, '-')}`;
        input.placeholder = placeholder;
        input.style.cssText = `
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        `;
        
        campoDiv.appendChild(label);
        campoDiv.appendChild(input);
      }
      
      categoriaDiv.appendChild(campoDiv);
    });
    
    form.appendChild(categoriaDiv);
  });
  
  // Footer con pulsanti (duplicati in fondo)
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 15px;
    border-top: 1px solid var(--border-light);
    gap: 10px;
  `;
  
  // Riutilizza la funzione helper per creare i pulsanti del footer
  const footerButtons = createActionButtons();
  footerButtons.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    width: 100%;
  `;
  
  footer.appendChild(footerButtons);
  
  modalContent.appendChild(header);
  modalContent.appendChild(form);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function raccogliFiltriAvanzati() {
  const filtri = {};
  
  // Raccogli tutti i valori dai campi di ricerca avanzata
  document.querySelectorAll('#ricercaAvanzataModal input, #ricercaAvanzataModal textarea, #ricercaAvanzataModal select').forEach(input => {
    const campo = input.id.replace('search-', '').replace(/-/g, ' ');
    
    if (input.type === 'checkbox') {
      if (input.checked) {
        filtri[campo] = true;
      }
    } else if (input.type === 'number') {
      const value = parseFloat(input.value);
      if (!isNaN(value) && value !== '') {
        filtri[campo] = value;
      }
    } else if (input.type === 'date') {
      if (input.value) {
        filtri[campo] = new Date(input.value);
      }
    } else if (input.value.trim() !== '') {
      filtri[campo] = input.value.trim();
    }
  });
  
  return filtri;
}

function applicaRicercaAvanzata(filtriAvanzati) {
  // Salva i filtri avanzati per usarli nella funzione filtra
  window.filtriAvanzatiAttivi = filtriAvanzati;
  
  // Reset paginazione
  paginaCorrente = 1;
  
  // Applica i filtri
  const listaFiltrata = filtra(strutture);
  renderStrutture(listaFiltrata);
  
  // Mostra indicatore di ricerca avanzata attiva
  mostraIndicatoreRicercaAvanzata(Object.keys(filtriAvanzati).length);
}

// === Gestione Filtri Salvati ===
async function salvaFiltriAvanzati() {
  const filtri = raccogliFiltriAvanzati();
  
  if (Object.keys(filtri).length === 0) {
    alert('Non ci sono filtri da salvare!');
    return;
  }
  
  const nomeFiltro = prompt('Inserisci un nome per questi filtri:');
  if (!nomeFiltro || nomeFiltro.trim() === '') {
    return;
  }
  
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      alert('Devi essere loggato per salvare i filtri!');
      return;
    }
    
    // 🔒 Validazione server-side
    if (!await validateServerAuth()) {
      alert('❌ Sessione non valida. Effettua nuovamente il login.');
      return;
    }
    
    const filtroData = {
      userId: currentUser.uid,
      nome: nomeFiltro.trim(),
      filtri: filtri,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await secureFirestoreOperation(addDoc, collection(db, "user_filters"), filtroData);
    
    // Log attività
    await logActivity('filter_saved', nomeFiltro, currentUser.uid, {
      filterCount: Object.keys(filtri).length
    });
    
    alert('✅ Filtri salvati con successo!');
    console.log('✅ Filtri salvati:', nomeFiltro);
  } catch (error) {
    console.error('❌ Errore nel salvataggio filtri:', error);
    alert('Errore nel salvataggio dei filtri');
  }
}

async function caricaFiltriSalvati() {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.uid) {
      console.log('⚠️ Utente non autenticato, non posso caricare filtri salvati');
      return [];
    }
    
    console.log('🔍 Caricamento filtri salvati per utente:', currentUser.uid);
    
    // Verifica se l'utente ha permessi di lettura
    try {
      // 🔒 Validazione server-side
      if (!await validateServerAuth()) {
        console.warn('🔒 Sessione non valida per caricamento filtri');
        return [];
      }
      
      const filtersRef = collection(db, "user_filters");
      const q = query(
        filtersRef, 
        where("userId", "==", currentUser.uid)
      );
      const snapshot = await secureFirestoreOperation(getDocs, q);
      const filtri = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('✅ Filtri salvati caricati:', filtri.length);
      
      // Ordina localmente per evitare problemi di indice
      return filtri.sort((a, b) => {
        const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
        const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
        return dateB - dateA;
      });
    } catch (permissionError) {
      if (permissionError.code === 'permission-denied') {
        console.log('⚠️ Permessi negati per filtri salvati - utente potrebbe non avere ancora filtri salvati');
        return [];
      }
      throw permissionError;
    }
  } catch (error) {
    console.error('❌ Errore nel caricamento filtri salvati:', error);
    console.error('Dettagli errore:', error.code, error.message);
    return [];
  }
}

async function applicaFiltriSalvati(filtroId) {
  try {
    const filtroDoc = await getDoc(doc(db, "user_filters", filtroId));
    if (!filtroDoc.exists()) {
      alert('Filtro non trovato!');
      return;
    }
    
    const filtroData = filtroDoc.data();
    window.filtriAvanzatiAttivi = filtroData.filtri;
    
    // Reset paginazione
    paginaCorrente = 1;
    
    // Applica i filtri
    const listaFiltrata = filtra(strutture);
    renderStrutture(listaFiltrata);
    
    // Mostra indicatore
    mostraIndicatoreRicercaAvanzata(Object.keys(filtroData.filtri).length);
    
    // Chiudi il menu automaticamente dopo aver applicato i filtri
    closeMenu();
    
    console.log('✅ Filtri applicati:', filtroData.nome);
  } catch (error) {
    console.error('Errore nell\'applicazione filtri salvati:', error);
    alert('Errore nell\'applicazione dei filtri');
  }
}

function mostraIndicatoreRicercaAvanzata(numeroFiltri) {
  console.log('🔍 Mostra indicatore ricerca avanzata:', numeroFiltri);
  
  // Rimuovi indicatore esistente
  const existingIndicator = document.getElementById('indicatore-ricerca-avanzata');
  if (existingIndicator) {
    existingIndicator.remove();
  }
  
  if (numeroFiltri > 0) {
    const indicator = document.createElement('div');
    indicator.id = 'indicatore-ricerca-avanzata';
    indicator.style.cssText = `
      background: #17a2b8;
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      margin: 8px auto;
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: center;
      max-width: 300px;
    `;
    indicator.innerHTML = `
      🔍 Ricerca avanzata attiva (${numeroFiltri} filtri)
      <button onclick="rimuoviRicercaAvanzata()" style="background:none;border:none;color:white;cursor:pointer;font-size:14px;margin-left:4px;">✕</button>
    `;
    
    // Trova un elemento appropriato nella nuova UI per mostrare l'indicatore
    const searchSection = document.querySelector('.search-section');
    const resultsHeader = document.querySelector('.results-header');
    const mainContent = document.querySelector('.main-content');
    
    // Prova diversi elementi in ordine di priorità
    let targetElement = null;
    
    if (searchSection) {
      // Aggiungi dopo la search section
      targetElement = searchSection.parentNode;
      indicator.style.margin = '8px 0';
    } else if (resultsHeader) {
      targetElement = resultsHeader;
    } else if (mainContent) {
      targetElement = mainContent;
    } else {
      // Fallback: aggiungi al body
      targetElement = document.body;
      indicator.style.position = 'fixed';
      indicator.style.top = '70px';
      indicator.style.left = '50%';
      indicator.style.transform = 'translateX(-50%)';
      indicator.style.zIndex = '999';
    }
    
    if (targetElement) {
      try {
        if (searchSection && targetElement === searchSection.parentNode) {
          // Inserisci dopo search section
          searchSection.parentNode.insertBefore(indicator, searchSection.nextSibling);
        } else {
          // Aggiungi come primo elemento
          targetElement.insertBefore(indicator, targetElement.firstChild);
        }
        console.log('✅ Indicatore aggiunto con successo');
      } catch (error) {
        console.error('❌ Errore nell\'aggiunta dell\'indicatore:', error);
        // Fallback sicuro
        document.body.appendChild(indicator);
      }
    } else {
      console.error('❌ Nessun elemento target trovato per l\'indicatore');
    }
  }
}

function rimuoviRicercaAvanzata() {
  window.filtriAvanzatiAttivi = null;
  
  const indicator = document.getElementById('indicatore-ricerca-avanzata');
  if (indicator) {
    indicator.remove();
  }
  
  // Ricarica i risultati senza filtri avanzati
  const listaFiltrata = filtra(strutture);
  renderStrutture(listaFiltrata);
}

// === Filtri e ricerca ===

function filtra(lista) {
  // Controlli di sicurezza per evitare errori null reference
  const searchEl = document.getElementById("search");
  const provEl = document.getElementById("filter-prov");
  const casaEl = document.getElementById("filter-casa");
  const terrenoEl = document.getElementById("filter-terreno");
  const statoEl = document.getElementById("filter-stato");
  
  const q = searchEl ? searchEl.value.toLowerCase() : "";
  const prov = provEl ? provEl.value : "";
  const casa = casaEl ? casaEl.checked : false;
  const terreno = terrenoEl ? terrenoEl.checked : false;
  const stato = statoEl ? statoEl.value : "";

  let filtrata = lista.filter((s) => {
    // Filtri base
    const matchTesto =
      s.Struttura?.toLowerCase().includes(q) ||
      s.Luogo?.toLowerCase().includes(q) ||
      s.Info?.toLowerCase().includes(q) ||
      s.Referente?.toLowerCase().includes(q);
    const matchProv = !prov || s.Prov === prov;
    const matchCasa = !casa || s.Casa === true;
    const matchTerreno = !terreno || s.Terreno === true;
    const matchStato = !stato || s.stato === stato;
    
    // Filtri avanzati
    let matchAvanzati = true;
    if (window.filtriAvanzatiAttivi) {
      // Gestisci filtri dalla dashboard
      if (window.filtriAvanzatiAttivi.tipo) {
        const tipo = window.filtriAvanzatiAttivi.tipo;
        if (tipo === 'casa') {
          matchAvanzati = matchAvanzati && s.Casa && !s.Terreno;
        } else if (tipo === 'terreno') {
          matchAvanzati = matchAvanzati && s.Terreno && !s.Casa;
        } else if (tipo === 'entrambe') {
          matchAvanzati = matchAvanzati && s.Casa && s.Terreno;
        }
      }
      
      if (window.filtriAvanzatiAttivi.provincia) {
        matchAvanzati = matchAvanzati && s.Prov === window.filtriAvanzatiAttivi.provincia;
      }
      
      // Gestisci altri filtri avanzati
      for (const [campo, valore] of Object.entries(window.filtriAvanzatiAttivi)) {
        // Salta tipo e provincia che sono già gestiti sopra
        if (campo === 'tipo' || campo === 'provincia') continue;
        if (valore === true) {
          // Per checkbox, verifica che il valore sia true
          // Per i campi delle caratteristiche, verifica che il campo abbia un valore non vuoto
          if (['Letti', 'Spazi', 'Fuochi', 'Hike'].includes(campo)) {
            matchAvanzati = matchAvanzati && s[campo] && s[campo].toString().trim() !== '';
          } else if (campo === 'Cucina') {
            // Per il campo Cucina delle caratteristiche, verifica che abbia un valore non vuoto
            matchAvanzati = matchAvanzati && s[campo] && s[campo].toString().trim() !== '';
          } else {
            matchAvanzati = matchAvanzati && s[campo] === true;
          }
        } else if (typeof valore === 'string') {
          // Per campi di testo, verifica che contenga il valore (case insensitive)
          // Gestisci i campi dettaglio che mappano ai campi originali
          let campoOriginale = campo;
          if (campo.endsWith('_dettaglio')) {
            campoOriginale = campo.replace('_dettaglio', '');
          }
          
          matchAvanzati = matchAvanzati && 
            s[campoOriginale] && 
            s[campoOriginale].toString().toLowerCase().includes(valore.toLowerCase());
        } else if (typeof valore === 'number') {
          // Per numeri (rating, coordinate, etc.)
          if (campo === 'rating_min') {
            matchAvanzati = matchAvanzati && (s.rating?.average || 0) >= valore;
          } else if (campo === 'rating_max') {
            matchAvanzati = matchAvanzati && (s.rating?.average || 0) <= valore;
          } else if (campo === 'coordinate_lat') {
            matchAvanzati = matchAvanzati && s.coordinate?.lat && Math.abs(s.coordinate.lat - valore) < 0.01;
          } else if (campo === 'coordinate_lng') {
            matchAvanzati = matchAvanzati && s.coordinate?.lng && Math.abs(s.coordinate.lng - valore) < 0.01;
          } else if (campo === 'distance_km') {
            // Calcola distanza se coordinate disponibili
            if (s.coordinate?.lat && s.coordinate?.lng) {
              // Implementa calcolo distanza se necessario
              matchAvanzati = matchAvanzati && true; // Placeholder
            }
          }
        } else if (valore instanceof Date) {
          // Per date
          if (campo === 'created_after') {
            matchAvanzati = matchAvanzati && s.createdAt && new Date(s.createdAt) >= valore;
          } else if (campo === 'created_before') {
            matchAvanzati = matchAvanzati && s.createdAt && new Date(s.createdAt) <= valore;
          } else if (campo === 'modified_after') {
            matchAvanzati = matchAvanzati && s.lastModified && new Date(s.lastModified) >= valore;
          } else if (campo === 'modified_before') {
            matchAvanzati = matchAvanzati && s.lastModified && new Date(s.lastModified) <= valore;
          }
        }
        
        // Filtri speciali
        if (campo === 'has_images') {
          matchAvanzati = matchAvanzati && s.immagini && s.immagini.length > 0;
        } else if (campo === 'has_reports') {
          matchAvanzati = matchAvanzati && s.segnalazioni && s.segnalazioni.length > 0;
        } else if (campo === 'near_me') {
          // Implementa geolocalizzazione se necessario
          matchAvanzati = matchAvanzati && true; // Placeholder
        }
      }
    }
    
    return matchTesto && matchProv && matchCasa && matchTerreno && matchStato && matchAvanzati;
  });

  // Applica ordinamento
  const sortBy = document.getElementById("sort-by").value;
  filtrata.sort((a, b) => {
    switch (sortBy) {
      case 'struttura':
        return (a.Struttura || '').localeCompare(b.Struttura || '');
      case 'luogo':
        return (a.Luogo || '').localeCompare(b.Luogo || '');
      case 'provincia':
        return (a.Prov || '').localeCompare(b.Prov || '');
      default:
        return 0;
    }
  });

  return filtrata;
}


// === Modifica struttura ===
let strutturaCorrente = null;

async function modificaStruttura(id) {
  strutturaCorrente = strutture.find(s => s.id === id);
  if (!strutturaCorrente) return;
  
  const modal = document.getElementById('modal');
  const form = document.getElementById('editForm');
  
  // Popola il form
  form.innerHTML = `
    <label>
      Nome Struttura *
      <input type="text" id="edit-struttura" value="${strutturaCorrente.Struttura || ''}" required>
    </label>
    
    <label>
      Luogo
      <input type="text" id="edit-luogo" value="${strutturaCorrente.Luogo || ''}">
    </label>
    
    <label>
      Indirizzo
      <input type="text" id="edit-indirizzo" value="${strutturaCorrente.Indirizzo || ''}" placeholder="Via, numero civico, ecc.">
    </label>
    
    <label>
      Provincia
      <select id="edit-prov">
        <option value="">Seleziona provincia</option>
        ${[...new Set(strutture.map(s => s.Prov).filter(Boolean))].sort().map(prov => 
          `<option value="${prov}" ${strutturaCorrente.Prov === prov ? 'selected' : ''}>${prov}</option>`
        ).join('')}
      </select>
    </label>
    
    <label>
      Referente
      <input type="text" id="edit-referente" value="${strutturaCorrente.Referente || ''}">
    </label>
    
    <label>
      Contatto/Telefono
      <input type="text" id="edit-contatto" value="${strutturaCorrente.Contatto || ''}">
    </label>
    
    <label>
      Email
      <input type="email" id="edit-email" value="${strutturaCorrente.Email || ''}">
    </label>
    
    <fieldset>
      <legend>📍 Posizione Geografica</legend>
      <label>
        Latitudine
        <input type="number" id="edit-coordinate_lat" step="any" value="${strutturaCorrente.coordinate_lat || ''}" placeholder="es. 45.123456">
      </label>
      
      <label>
        Longitudine
        <input type="number" id="edit-coordinate_lng" step="any" value="${strutturaCorrente.coordinate_lng || ''}" placeholder="es. 9.123456">
      </label>
      
      <label>
        Link Google Maps
        <input type="url" id="edit-google_maps_link" value="${strutturaCorrente.google_maps_link || ''}" placeholder="https://maps.google.com/...">
      </label>
      
      <div style="margin-top: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 4px;">
        <button type="button" id="geocodeBtn" 
                style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; width: 100%;">
          🔍 Ottieni Coordinate da Indirizzo
        </button>
        <small style="display: block; margin-top: 5px; color: var(--text-secondary); font-size: 12px;">
          Compila Luogo, Indirizzo e Provincia, poi clicca qui per ottenere le coordinate automaticamente
        </small>
      </div>
    </fieldset>
    
    <label>
      Casa
      <input type="checkbox" id="edit-casa" ${strutturaCorrente.Casa ? 'checked' : ''}>
    </label>
    
    <label>
      Terreno
      <input type="checkbox" id="edit-terreno" ${strutturaCorrente.Terreno ? 'checked' : ''}>
    </label>
    
    <label>
      Stato Struttura
      <select id="edit-stato">
        <option value="attiva" ${strutturaCorrente.stato === 'attiva' ? 'selected' : ''}>🟢 Attiva</option>
        <option value="temporaneamente_non_attiva" ${strutturaCorrente.stato === 'temporaneamente_non_attiva' ? 'selected' : ''}>🟡 Temporaneamente non attiva</option>
        <option value="non_piu_attiva" ${strutturaCorrente.stato === 'non_piu_attiva' ? 'selected' : ''}>🔴 Non più attiva</option>
      </select>
    </label>
    
    <label class="full-width">
      Informazioni aggiuntive
      <textarea id="edit-info" rows="3" placeholder="Informazioni dettagliate sulla struttura...">${strutturaCorrente.Info || ''}</textarea>
    </label>
  `;
  
  modal.classList.remove('hidden');
}

async function salvaModifiche() {
  if (!strutturaCorrente) return;
  
  const coordinate_lat = document.getElementById('edit-coordinate_lat').value ? parseFloat(document.getElementById('edit-coordinate_lat').value) : null;
  const coordinate_lng = document.getElementById('edit-coordinate_lng').value ? parseFloat(document.getElementById('edit-coordinate_lng').value) : null;
  
  const formData = {
    Struttura: document.getElementById('edit-struttura').value.trim(),
    Luogo: document.getElementById('edit-luogo').value.trim(),
    Indirizzo: document.getElementById('edit-indirizzo') ? document.getElementById('edit-indirizzo').value.trim() : (strutturaCorrente.Indirizzo || ''),
    Prov: document.getElementById('edit-prov').value,
    Referente: document.getElementById('edit-referente').value.trim(),
    Contatto: document.getElementById('edit-contatto').value.trim(),
    Email: document.getElementById('edit-email').value.trim(),
    coordinate_lat: coordinate_lat,
    coordinate_lng: coordinate_lng,
    // Sincronizza anche il formato coordinate per compatibilità
    coordinate: coordinate_lat && coordinate_lng ? { lat: coordinate_lat, lng: coordinate_lng } : null,
    google_maps_link: document.getElementById('edit-google_maps_link').value.trim(),
    Casa: document.getElementById('edit-casa').checked,
    Terreno: document.getElementById('edit-terreno').checked,
    stato: document.getElementById('edit-stato').value,
    Info: document.getElementById('edit-info').value.trim(),
    // Aggiorna metadati
    lastModified: new Date(),
    lastModifiedBy: getCurrentUser()?.uid || null,
    version: (strutturaCorrente.version || 1) + 1
  };
  
  // Validazione
  if (!formData.Struttura) {
    alert('Il nome della struttura è obbligatorio!');
    return;
  }
  
  try {
    // Salva versione precedente prima di modificare
    // 🔒 SICUREZZA: Verifica autenticazione
    if (!auth.currentUser) {
      showError('🔒 Autenticazione richiesta per modificare strutture');
      mostraSchermataLogin();
      return;
    }
    
    await salvaVersione(strutturaCorrente, getCurrentUser()?.uid);
    
    // 🔒 Validazione server-side per operazioni critiche
    if (!await validateServerAuth()) {
      alert('❌ Sessione non valida. Effettua nuovamente il login.');
      return;
    }
    
    // Aggiorna struttura
    await secureFirestoreOperation(updateDoc, doc(db, "strutture", strutturaCorrente.id), formData);
    
    // INVALIDARE CACHE LOCALE per forzare ricaricamento
    localStorage.removeItem('strutture_cache');
    localStorage.removeItem('strutture_cache_timestamp');
    console.log('🗑️ Cache invalidata dopo modifica struttura');
    
    // Log attività
    await logActivity('structure_updated', strutturaCorrente.id, getCurrentUser()?.uid, {
      changes: Object.keys(formData).filter(key => formData[key] !== strutturaCorrente[key])
    });
    
    // Se ci sono Luogo + Indirizzo + Prov e mancano le coordinate, prova geocoding automatico
    const haDatiPosizione = formData.Luogo && formData.Indirizzo && formData.Prov;
    const mancanoCoordinate = !formData.coordinate_lat || !formData.coordinate_lng;
    
    if (haDatiPosizione && mancanoCoordinate) {
      console.log('🔄 Dati posizione completi (Luogo + Indirizzo + Prov), tentativo geocoding automatico...');
      
      // Aggiorna la struttura locale con i nuovi dati
      const strutturaAggiornata = { ...strutturaCorrente, ...formData };
      const strutturaConCoordinate = await geocodificaStrutturaAutomatico(strutturaAggiornata);
      
      if (strutturaConCoordinate.coordinate || strutturaConCoordinate.coordinate_lat) {
        // Salva le coordinate ottenute automaticamente
        await updateDoc(doc(db, "strutture", strutturaCorrente.id), {
          coordinate: strutturaConCoordinate.coordinate,
          coordinate_lat: strutturaConCoordinate.coordinate_lat,
          coordinate_lng: strutturaConCoordinate.coordinate_lng
        });
        
        // Aggiorna anche i campi nel formData per sincronizzazione
        formData.coordinate = strutturaConCoordinate.coordinate;
        formData.coordinate_lat = strutturaConCoordinate.coordinate_lat;
        formData.coordinate_lng = strutturaConCoordinate.coordinate_lng;
        
        // Aggiorna i campi nel form visivamente
        const latInput = document.getElementById('edit-coordinate_lat');
        const lngInput = document.getElementById('edit-coordinate_lng');
        if (latInput) latInput.value = strutturaConCoordinate.coordinate_lat || '';
        if (lngInput) lngInput.value = strutturaConCoordinate.coordinate_lng || '';
        
        console.log('✅ Coordinate ottenute automaticamente e salvate:', {
          lat: strutturaConCoordinate.coordinate_lat,
          lng: strutturaConCoordinate.coordinate_lng
        });
        
        // Mostra notifica all'utente
        if (window.showNotification) {
          window.showNotification('✅ Coordinate ottenute automaticamente', {
            body: `Lat: ${strutturaConCoordinate.coordinate_lat?.toFixed(6)}, Lng: ${strutturaConCoordinate.coordinate_lng?.toFixed(6)}`,
            icon: '📍'
          });
        }
      } else {
        console.warn('⚠️ Impossibile ottenere coordinate automaticamente per questa struttura');
      }
    }
    
    chiudiModale();
    // Forza ricaricamento completo da Firestore
    await aggiornaLista();
  } catch (error) {
    console.error('Errore nel salvataggio:', error);
    alert('Errore nel salvataggio delle modifiche');
  }
}

function chiudiModale() {
  document.getElementById('modal').classList.add('hidden');
  strutturaCorrente = null;
}

// === Elimina struttura ===
async function eliminaStruttura(id) {
  // 🔒 SICUREZZA: Verifica autenticazione
  if (!auth.currentUser) {
    showError('🔒 Autenticazione richiesta per eliminare strutture');
    mostraSchermataLogin();
    return;
  }
  
  if (confirm("Vuoi davvero eliminare questa struttura?")) {
    await deleteDoc(doc(db, "strutture", id));
    aggiornaLista();
  }
}

async function eliminaStrutturaConConferma(id) {
  const struttura = strutture.find(s => s.id === id);
  if (!struttura) {
    console.error('Struttura non trovata:', id);
    return;
  }
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('confirmDeleteModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'confirmDeleteModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10003;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 30px;
    max-width: 95%;
    width: 90%;
    min-width: 320px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    text-align: center;
  `;
  
  modalContent.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
      <h2 style="color: #dc3545; margin: 0 0 10px 0;">Conferma Eliminazione</h2>
      <p style="color: #666; margin: 0;">
        Sei sicuro di voler eliminare la struttura:
      </p>
    </div>
    
    <div style="background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
      <h3 style="margin: 0 0 8px 0; color: #2f6b2f;">${struttura.Struttura || 'Senza nome'}</h3>
      <p style="margin: 0; color: #666; font-size: 14px;">
        📍 ${struttura.Luogo || 'N/A'}, ${struttura.Prov || 'N/A'}
        ${struttura.Referente ? `<br>👤 Referente: ${struttura.Referente}` : ''}
      </p>
    </div>
    
    <div style="background: #fff5f5; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
      <p style="margin: 0; color: #721c24; font-size: 14px; font-weight: bold;">
        ⚠️ ATTENZIONE: Questa azione non può essere annullata!
      </p>
    </div>
    
    <div style="display: flex; gap: 10px; justify-content: center;">
      <button id="cancelDeleteBtn" 
              style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
        ❌ Annulla
      </button>
      <button id="confirmDeleteBtn" 
              style="background: #dc3545; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">
        🗑️ Elimina Definitivamente
      </button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Event listeners
  document.getElementById('cancelDeleteBtn').onclick = () => {
    modal.remove();
  };
  
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
      modal.remove();
      // Chiudi anche la scheda completa se aperta
      if (modalScheda) {
        modalScheda.remove();
      }
      await deleteDoc(doc(db, "strutture", id));
      aggiornaLista();
      
      // Mostra messaggio di successo
      const successModal = document.createElement('div');
      successModal.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10004;
        animation: slideIn 0.3s ease-out;
      `;
      successModal.innerHTML = '✅ Struttura eliminata con successo!';
      
      // Aggiungi CSS per animazione
      if (!document.getElementById('deleteSuccessStyles')) {
        const style = document.createElement('style');
        style.id = 'deleteSuccessStyles';
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }
      
      document.body.appendChild(successModal);
      
      // Rimuovi messaggio dopo 3 secondi
      setTimeout(() => {
        if (successModal.parentNode) {
          successModal.remove();
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione:', error);
      alert('❌ Errore nell\'eliminazione: ' + error.message);
    }
  };
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}






// === Aggiungi nuova struttura ===
async function aggiungiStruttura() {
  // Crea una struttura vuota per la nuova struttura
  const nuovaStruttura = {
    id: 'new_' + Date.now(), // ID temporaneo
    Struttura: '',
    Luogo: '',
    Indirizzo: '',
    Prov: '',
    Info: '',
    'A persona': '',
    'A giornata': '',
    'A notte': '',
    Offerta: '',
    Forfait: '',
    Riscaldamento: '',
    Cucina: '',
    'Altri costi': '',
    'Altre info': '',
    Terreno: false,
    Casa: false,
    Letti: '',
    Cucina: '',
    Spazi: '',
    Fuochi: '',
    Hike: '',
    Escursioni: '',
    Trasporti: '',
    Branco: false,
    Reparto: false,
    Compagnia: false,
    Gruppo: false,
    Sezione: false,
    Referente: '',
    Email: '',
    Sito: '',
    Contatto: '',
    IIcontatto: '',
    'Ultimo controllo': '',
    'Da chi': '',
    Note: '',
    'Altre info': '',
    // Nuovi campi per il sistema avanzato
    stato: 'attiva',
    coordinate_lat: null,
    coordinate_lng: null,
    google_maps_link: '',
    coordinate: { lat: null, lng: null },
    rating: { total: 0, count: 0, average: 0 },
    segnalazioni: [],
    immagini: [],
    lastModified: new Date(),
    lastModifiedBy: auth.currentUser?.uid || null,
    createdAt: new Date(),
    createdBy: auth.currentUser?.uid || null,
    version: 1
  };
  
  // Aggiungi la struttura temporanea all'array
  strutture.push(nuovaStruttura);
  
  // Aggiorna le strutture globali
  window.strutture = strutture;
  
  // Apri la scheda in modalità creazione
  mostraSchedaCompleta(nuovaStruttura.id);
}

// === Sezione Aiuto ===
function mostraAiuto() {
  console.log('📚 Apertura sezione Aiuto...');
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('aiutoModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'aiutoModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 95%;
    max-height: 95%;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    position: relative;
    min-width: 320px;
    width: 100%;
  `;
  
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #2f6b2f;">
      <h2 style="margin: 0; color: #2f6b2f; font-size: 1.5rem;">📚 Guida Rapida</h2>
      <button onclick="this.closest('#aiutoModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
    </div>
    
    <div style="line-height: 1.6; color: #333;">
      <h3 style="color: #2f6b2f; margin-top: 20px;">🔍 Come Cercare Strutture</h3>
      <ul>
        <li><strong>Ricerca Base:</strong> Digita nella barra di ricerca per nome, luogo o informazioni</li>
        <li><strong>Ricerca Avanzata:</strong> Usa i filtri dettagliati per criteri specifici</li>
        <li><strong>Filtri:</strong> Filtra per provincia, tipo (casa/terreno), stato</li>
        <li><strong>Mappa:</strong> Visualizza strutture su mappa interattiva</li>
      </ul>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">📋 Elenco Personale</h3>
      <ul>
        <li><strong>Aggiungere:</strong> Tocca l'icona ➕ sulla scheda struttura</li>
        <li><strong>Gestire:</strong> Accedi dal menu "Le Mie Liste"</li>
        <li><strong>Esportare:</strong> Scarica in Excel o PDF</li>
        <li><strong>Note:</strong> Aggiungi note personali a ogni struttura</li>
      </ul>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">➕ Aggiungere Strutture</h3>
      <ul>
        <li><strong>Nuova Struttura:</strong> Menu → "Aggiungi Struttura"</li>
        <li><strong>Modificare:</strong> Tocca l'icona ✏️ sulla scheda</li>
        <li><strong>Eliminare:</strong> Apri struttura → icona cestino</li>
        <li><strong>Coordinate:</strong> Aggiungi GPS per navigazione</li>
      </ul>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">🗺️ Mappa e Navigazione</h3>
      <ul>
        <li><strong>Visualizzare:</strong> Menu → "Visualizza Mappa"</li>
        <li><strong>Navigare:</strong> Tocca "Naviga" su una struttura</li>
        <li><strong>Vicinanza:</strong> Trova strutture vicine alla tua posizione</li>
        <li><strong>Filtri Mappa:</strong> Mostra solo case, terreni o entrambi</li>
      </ul>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">📤 Esportazione Dati</h3>
      <ul>
        <li><strong>Formati:</strong> Excel, PDF, JSON</li>
        <li><strong>Opzioni:</strong> Elenco personale, risultati filtrati, tutto</li>
        <li><strong>Layout:</strong> Completo, compatto, solo contatti</li>
        <li><strong>Accesso:</strong> Menu → "Esporta Dati"</li>
      </ul>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">⚙️ Impostazioni</h3>
      <ul>
        <li><strong>Tema:</strong> Cambia tra chiaro e scuro</li>
        <li><strong>Notifiche:</strong> Configura avvisi personalizzati</li>
        <li><strong>Account:</strong> Login per sincronizzazione</li>
        <li><strong>Backup:</strong> Gestisci salvataggi automatici</li>
      </ul>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">🔧 Risoluzione Problemi</h3>
      <ul>
        <li><strong>App non carica:</strong> Ricarica la pagina (F5)</li>
        <li><strong>Dati non aggiornano:</strong> Menu → "Sincronizza"</li>
        <li><strong>Mappa non funziona:</strong> Attiva geolocalizzazione</li>
        <li><strong>Test sistema:</strong> Menu → "Test Sistemi"</li>
      </ul>
      
      <div style="background: var(--bg-secondary); color: var(--text-primary); padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #2f6b2f;">
        <h4 style="margin: 0 0 10px 0; color: #2f6b2f;">💡 Suggerimenti</h4>
        <ul style="margin: 0;">
          <li>Usa i <strong>filtri salvati</strong> per ricerche frequenti</li>
          <li>Attiva le <strong>notifiche</strong> per non perdere aggiornamenti</li>
          <li>Esporta regolarmente i tuoi <strong>dati personali</strong></li>
          <li>Usa la <strong>mappa</strong> per pianificare itinerari</li>
        </ul>
      </div>
    </div>
    
    <div style="display: flex; justify-content: flex-end; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e9ecef;">
      <button onclick="this.closest('#aiutoModal').remove()" style="background: #2f6b2f; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
        Chiudi
      </button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// === Sezione About ===
function mostraAbout() {
  console.log('ℹ️ Apertura sezione About...');
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('aboutModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'aboutModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 95%;
    max-height: 95%;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    position: relative;
    min-width: 320px;
    width: 100%;
  `;
  
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #2f6b2f;">
      <h2 style="margin: 0; color: #2f6b2f; font-size: 1.5rem;">ℹ️ Informazioni</h2>
      <button onclick="this.closest('#aboutModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
    </div>
    
    <div style="line-height: 1.6; color: #333;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 48px; margin-bottom: 10px;">🏕️</div>
        <h3 style="color: #2f6b2f; margin: 0;">QuoVadiScout</h3>
        <p style="margin: 5px 0; color: #666;">Sistema avanzato per la gestione di strutture e terreni scout</p>
        <p style="margin: 5px 0; color: #888; font-size: 14px;">Versione 1.3.0</p>
      </div>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">🚀 Funzionalità Principali</h3>
      <ul>
        <li><strong>Database Strutture:</strong> Gestione completa di case e terreni scout</li>
        <li><strong>Ricerca Avanzata:</strong> Filtri multipli e ricerca intelligente</li>
        <li><strong>Mappa Interattiva:</strong> Visualizzazione geografica e navigazione</li>
        <li><strong>Elenco Personale:</strong> Strutture preferite con note personali</li>
        <li><strong>Esportazione:</strong> Excel, PDF e formati multipli</li>
        <li><strong>Notifiche:</strong> Avvisi intelligenti e personalizzati</li>
        <li><strong>Sincronizzazione:</strong> Dati sempre aggiornati tra dispositivi</li>
        <li><strong>Modalità Offline:</strong> Funziona anche senza connessione</li>
      </ul>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">👨‍💻 Sviluppatore</h3>
      <div style="background: var(--bg-secondary); color: var(--text-primary); padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Davide Rossi</strong></p>
        <p style="margin: 0 0 15px 0; color: #666;">Sviluppatore e mantainer del progetto QuoVadiScout</p>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="https://wa.me/393888182045" target="_blank" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #25D366; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
            <span style="font-size: 20px;">📱</span>
            <span>WhatsApp: 388 818 2045</span>
          </a>
          
          <a href="mailto:davide.rossi@cngei.it" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
            <span style="font-size: 20px;">📧</span>
            <span>Email: davide.rossi@cngei.it</span>
          </a>
        </div>
      </div>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">🛠️ Tecnologie</h3>
      <ul>
        <li><strong>Frontend:</strong> HTML5, CSS3, JavaScript ES6+</li>
        <li><strong>Database:</strong> Firebase Firestore</li>
        <li><strong>Mappe:</strong> Leaflet + OpenStreetMap</li>
        <li><strong>PWA:</strong> Service Worker, Manifest</li>
        <li><strong>Esportazione:</strong> SheetJS, jsPDF</li>
        <li><strong>Notifiche:</strong> Web Push API</li>
      </ul>
      
      <h3 style="color: #2f6b2f; margin-top: 20px;">📊 Statistiche</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0;">
        <div style="text-align: center; padding: 15px; background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #2f6b2f;" id="totalStructuresAbout">-</div>
          <div style="font-size: 12px; color: #666;">Strutture Totali</div>
        </div>
        <div style="text-align: center; padding: 15px; background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #2f6b2f;" id="totalUsersAbout">-</div>
          <div style="font-size: 12px; color: #666;">Utenti Attivi</div>
        </div>
        <div style="text-align: center; padding: 15px; background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #2f6b2f;" id="totalExportsAbout">-</div>
          <div style="font-size: 12px; color: #666;">Esportazioni</div>
        </div>
      </div>
      
      <div style="background: var(--bg-secondary); color: var(--text-primary); padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #2f6b2f;">
        <h4 style="margin: 0 0 10px 0; color: #2f6b2f;">💡 Supporto e Feedback</h4>
        <p style="margin: 0; font-size: 14px;">
          Hai domande, suggerimenti o hai trovato un bug? Non esitare a contattarmi! 
          Il tuo feedback è fondamentale per migliorare l'app.
        </p>
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e9ecef;">
      <button onclick="mostraAiuto()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
        📚 Guida
      </button>
      <button onclick="this.closest('#aboutModal').remove()" style="background: #2f6b2f; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
        Chiudi
      </button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Carica statistiche
  setTimeout(() => {
    const totalStructures = strutture ? strutture.length : 0;
    const totalUsers = localStorage.getItem('totalUsers') || 'N/A';
    const totalExports = localStorage.getItem('totalExports') || '0';
    
    const totalStructuresEl = document.getElementById('totalStructuresAbout');
    const totalUsersEl = document.getElementById('totalUsersAbout');
    const totalExportsEl = document.getElementById('totalExportsAbout');
    
    if (totalStructuresEl) totalStructuresEl.textContent = totalStructures;
    if (totalUsersEl) totalUsersEl.textContent = totalUsers;
    if (totalExportsEl) totalExportsEl.textContent = totalExports;
  }, 100);
}

// === Rendere funzioni globali ===
window.mostraAiuto = mostraAiuto;
window.mostraAbout = mostraAbout;

// === Sistema di Versioning e Activity Log ===
async function salvaVersione(struttura, userId) {
  try {
    const versionData = {
      strutturaId: struttura.id,
      version: struttura.version || 1,
      data: { ...struttura },
      savedAt: new Date(),
      savedBy: userId
    };
    
    await addDoc(collection(db, "structure_versions"), versionData);
    console.log(`✅ Versione ${struttura.version} salvata per struttura ${struttura.id}`);
  } catch (error) {
    console.error('❌ Errore nel salvataggio versione:', error);
  }
}

async function getVersionHistory(strutturaId) {
  try {
    const versionsRef = collection(db, "structure_versions");
    const q = query(versionsRef, where("strutturaId", "==", strutturaId), orderBy("savedAt", "desc"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ Errore nel recupero cronologia:', error);
    return [];
  }
}

async function ripristinaVersione(strutturaId, version) {
  try {
    const versionsRef = collection(db, "structure_versions");
    const q = query(versionsRef, where("strutturaId", "==", strutturaId), where("version", "==", version));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error('Versione non trovata');
    }
    
    const versionData = snapshot.docs[0].data();
    const docRef = doc(db, "strutture", strutturaId);
    
    // Aggiorna la struttura con i dati della versione
    await updateDoc(docRef, {
      ...versionData.data,
      lastModified: new Date(),
      lastModifiedBy: getCurrentUser()?.uid || null,
      version: versionData.version + 1
    });
    
    console.log(`✅ Struttura ${strutturaId} ripristinata alla versione ${version}`);
    return true;
  } catch (error) {
    console.error('❌ Errore nel ripristino versione:', error);
    return false;
  }
}

async function logActivity(action, entity, userId, details = {}) {
  try {
    // Ottieni informazioni utente correnti
    const currentUser = getCurrentUser();
    const userInfo = currentUser ? {
      userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Utente',
      userEmail: currentUser.email || 'N/A'
    } : {
      userName: 'Utente sconosciuto',
      userEmail: 'N/A'
    };
    
    const activityData = {
      action,
      entity,
      userId,
      ...userInfo,
      details,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      ip: await getClientIP() // Funzione helper per IP
    };
    
    await addDoc(collection(db, "activity_log"), activityData);
    console.log(`📝 Attività loggata: ${action} su ${entity}`);
  } catch (error) {
    console.error('❌ Errore nel logging attività:', error);
  }
}

// Helper function per ottenere IP client (semplificata)
async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

// Helper functions per stati strutture
function getStatoIcon(stato) {
  switch (stato) {
    case 'attiva': return '🟢';
    case 'temporaneamente_non_attiva': return '🟡';
    case 'non_piu_attiva': return '🔴';
    default: return '⚪';
  }
}

function getStatoLabel(stato) {
  switch (stato) {
    case 'attiva': return 'Attiva';
    case 'temporaneamente_non_attiva': return 'Temporaneamente non attiva';
    case 'non_piu_attiva': return 'Non più attiva';
    default: return 'Stato sconosciuto';
  }
}

// === Gestione Note Personali ===
// Funzione per caricare note personali per l'elenco personale
async function loadPersonalNotesForElenco(struttureElenco) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    // Usa le funzioni Firestore importate direttamente (siamo in script.js)
    // Non abbiamo bisogno di window.firestore qui perché siamo nello stesso modulo
    const db = window.db || getFirestore(app);
    
    if (!db) {
      console.error('❌ Firestore db non disponibile');
      return;
    }
    
    // Carica tutte le note personali dell'utente
    const notesRef = collection(db, "user_notes");
    const q = query(notesRef, where("userId", "==", currentUser.uid));
    const snapshot = await getDocs(q);
    
    const noteMap = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!noteMap[data.strutturaId]) {
        noteMap[data.strutturaId] = [];
      }
      noteMap[data.strutturaId].push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)) : new Date()
      });
    });
    
    // Aggiungi le note alle strutture
    struttureElenco.forEach(struttura => {
      if (noteMap[struttura.id]) {
        struttura.personalNotes = noteMap[struttura.id];
        // Ordina le note per data di creazione (più recenti prima)
        struttura.personalNotes.sort((a, b) => b.createdAt - a.createdAt);
        console.log(`📝 Note trovate per ${struttura.Struttura}:`, struttura.personalNotes.length);
      } else {
        struttura.personalNotes = [];
      }
    });
    
  } catch (error) {
    console.error('Errore nel caricamento note personali per elenco:', error);
  }
}

async function mostraNotePersonali(strutturaId) {
  const struttura = strutture.find(s => s.id === strutturaId);
  if (!struttura) return;
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('noteModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'noteModal';
  modal.setAttribute('data-struttura-id', strutturaId);
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 90%;
    width: 500px;
    max-height: 80%;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `;
  
  // Carica note esistenti
  const noteEsistenti = await caricaNotePersonali(strutturaId);
  
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="margin: 0; color: #2f6b2f;">📝 Note Personali</h3>
      <button id="closeNoteModal" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
    </div>
    
    <div style="margin-bottom: 15px; padding: 10px; background: var(--bg-secondary); color: var(--text-primary); border-radius: 6px;">
      <strong>${struttura.Struttura || 'Struttura senza nome'}</strong><br>
      <span style="color: #666;">📍 ${struttura.Luogo || 'N/A'}, ${struttura.Prov || 'N/A'}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 8px; font-weight: bold;">Aggiungi nuova nota:</label>
      <textarea id="nuovaNota" placeholder="Scrivi qui le tue note personali su questa struttura..." 
                style="width: 100%; height: 100px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
    </div>
    
    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
      <button id="salvaNota" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
        💾 Salva Nota
      </button>
      <button id="cancellaNota" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
        🗑️ Cancella Testo
      </button>
    </div>
    
    <div id="noteEsistenti" style="max-height: 300px; overflow-y: auto;">
      ${noteEsistenti.length > 0 ? 
        noteEsistenti.map(nota => `
          <div style="background: var(--bg-secondary); color: var(--text-primary); border-left: 4px solid #28a745; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
              📅 ${new Date(nota.createdAt).toLocaleString('it-IT')}
            </div>
            <div style="white-space: pre-wrap;">${nota.nota}</div>
            <button onclick="eliminaNota('${nota.id}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px; margin-top: 5px;">
              🗑️ Elimina
            </button>
          </div>
        `).join('') : 
        '<div style="text-align: center; color: #666; padding: 20px;">Nessuna nota personale salvata</div>'
      }
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Event listeners
  document.getElementById('closeNoteModal').onclick = () => modal.remove();
  document.getElementById('cancellaNota').onclick = () => {
    document.getElementById('nuovaNota').value = '';
  };
  
  document.getElementById('salvaNota').onclick = async () => {
    const testoNota = document.getElementById('nuovaNota').value.trim();
    if (!testoNota) {
      alert('Inserisci una nota prima di salvarla!');
      return;
    }
    
    try {
      await salvaNotaPersonale(strutturaId, testoNota);
      document.getElementById('nuovaNota').value = '';
      modal.remove();
      mostraNotePersonali(strutturaId); // Ricarica il modal con le nuove note
    } catch (error) {
      console.error('Errore nel salvataggio nota:', error);
      alert('Errore nel salvataggio della nota');
    }
  };
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function caricaNotePersonali(strutturaId) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];
    
    // 🔒 Validazione server-side
    if (!await validateServerAuth()) {
      console.warn('🔒 Sessione non valida per caricamento note');
      return [];
    }
    
    const notesRef = collection(db, "user_notes");
    const q = query(
      notesRef, 
      where("userId", "==", currentUser.uid),
      where("strutturaId", "==", strutturaId)
    );
    const snapshot = await secureFirestoreOperation(getDocs, q);
    
    const note = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Converti timestamp Firestore in Date JavaScript
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)) : new Date()
      };
    });
    
    // Ordina localmente per data di creazione (più recenti prima)
    note.sort((a, b) => {
      return b.createdAt - a.createdAt;
    });
    
    return note;
  } catch (error) {
    console.error('Errore nel caricamento note:', error);
    return [];
  }
}

async function salvaNotaPersonale(strutturaId, nota) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      alert('Devi essere loggato per salvare note personali');
      return;
    }
    
    // 🔒 Validazione server-side
    if (!await validateServerAuth()) {
      alert('❌ Sessione non valida. Effettua nuovamente il login.');
      return;
    }
    
    const noteData = {
      userId: currentUser.uid,
      strutturaId: strutturaId,
      nota: nota,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await secureFirestoreOperation(addDoc, collection(db, "user_notes"), noteData);
    
    // Log attività
    await logActivity('note_created', strutturaId, currentUser.uid, {
      noteLength: nota.length
    });
    
    console.log('✅ Nota personale salvata');
  } catch (error) {
    console.error('Errore nel salvataggio nota:', error);
    throw error;
  }
}

async function eliminaNota(notaId) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      alert('Devi essere loggato per eliminare note');
      return;
    }
    
    // 🔒 Validazione server-side
    if (!await validateServerAuth()) {
      alert('❌ Sessione non valida. Effettua nuovamente il login.');
      return;
    }
    
    if (!confirm('Sei sicuro di voler eliminare questa nota?')) {
      return;
    }
    
    await secureFirestoreOperation(deleteDoc, doc(db, "user_notes", notaId));
    
    // Log attività
    await logActivity('note_deleted', notaId, currentUser.uid);
    
    // Ricarica il modal delle note
    const modal = document.getElementById('noteModal');
    if (modal) {
      // Trova la strutturaId dal modal per ricaricare
      const strutturaId = modal.querySelector('[data-struttura-id]')?.dataset.strutturaId;
      if (strutturaId) {
        // Ricarica le note
        const noteEsistenti = await caricaNotePersonali(strutturaId);
        const noteContainer = document.getElementById('noteEsistenti');
        if (noteContainer) {
          noteContainer.innerHTML = noteEsistenti.length > 0 ? 
            noteEsistenti.map(nota => `
              <div style="background: var(--bg-secondary); color: var(--text-primary); border-left: 4px solid #28a745; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
                  📅 ${nota.createdAt.toLocaleString('it-IT')}
                </div>
                <div style="white-space: pre-wrap;">${nota.nota}</div>
                <button onclick="eliminaNota('${nota.id}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px; margin-top: 5px;">
                  🗑️ Elimina
                </button>
              </div>
            `).join('') : 
            '<div style="text-align: center; color: #666; padding: 20px;">Nessuna nota personale salvata</div>';
        }
      }
    }
    
    console.log('✅ Nota eliminata con successo');
  } catch (error) {
    console.error('Errore nell\'eliminazione nota:', error);
    alert('Errore nell\'eliminazione della nota');
  }
}

// Rendi le funzioni accessibili globalmente
window.eliminaNota = eliminaNota;
window.mostraFeedAttivita = mostraFeedAttivita;
window.trovaVicinoAMe = trovaVicinoAMe;
window.geocodificaTutteStrutture = geocodificaTutteStrutture;
window.loginWithEmail = loginWithEmail;
window.registerWithEmail = registerWithEmail;
window.loginWithGoogle = loginWithGoogle;
window.logoutUser = logoutUser;
window.aggiungiStruttura = aggiungiStruttura;
window.modificaStruttura = modificaStruttura;
window.eliminaStruttura = eliminaStruttura;
window.eliminaStrutturaConConferma = eliminaStrutturaConConferma;
window.filtra = filtra;
window.mostraRicercaAvanzata = mostraRicercaAvanzata;
window.rimuoviRicercaAvanzata = rimuoviRicercaAvanzata;
window.esportaElencoPersonale = esportaElencoPersonale;
window.mostraGestioneElencoPersonale = mostraGestioneElencoPersonale;
window.mostraSchedaUtente = mostraSchedaUtente;
window.mostraNotePersonali = mostraNotePersonali;
window.salvaNotaPersonale = salvaNotaPersonale;

// === Helper per Modali Responsive ===
function createResponsiveModal(id, title, content) {
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById(id);
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = id;
  modal.className = 'modal-overlay';
  // Usa solo variabili CSS, senza fallback hardcoded
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 10px;
    box-sizing: border-box;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 100%;
    max-height: 95vh;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
    position: relative;
    width: 100%;
    box-sizing: border-box;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--border-light);
  `;
  
  const titleEl = document.createElement('h2');
  titleEl.textContent = title;
  titleEl.style.cssText = `
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.className = 'modal-close';
  closeBtn.style.cssText = `
    background: transparent;
    color: var(--text-tertiary);
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `;
  closeBtn.onclick = () => modal.remove();
  
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  
  modalContent.appendChild(header);
  modalContent.appendChild(content);
  modal.appendChild(modalContent);
  
  // Chiudi modal cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Media query per mobile
  const mediaQuery = window.matchMedia('(max-width: 768px)');
  function handleMobileView(e) {
    if (e.matches) {
      // Mobile: modal a schermo intero
      modalContent.style.cssText = `
        background: var(--bg-primary);
        color: var(--text-primary);
        border-radius: 0;
        padding: 15px;
        max-width: 100%;
        max-height: 100vh;
        overflow-y: auto;
        box-shadow: none;
        position: relative;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      `;
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--bg-primary);
        display: flex;
        align-items: stretch;
        justify-content: stretch;
        z-index: 10000;
        padding: 0;
        box-sizing: border-box;
      `;
    } else {
      // Desktop: modal centrato
      modalContent.style.cssText = `
        background: var(--bg-primary);
        color: var(--text-primary);
        border-radius: 12px;
        padding: 20px;
        max-width: 90%;
        max-height: 95vh;
        overflow-y: auto;
        box-shadow: var(--shadow-xl);
        position: relative;
        width: 100%;
        box-sizing: border-box;
      `;
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--bg-overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 10px;
        box-sizing: border-box;
      `;
    }
  }
  
  // Applica stili iniziali
  handleMobileView(mediaQuery);
  
  // Ascolta cambiamenti di viewport
  mediaQuery.addListener(handleMobileView);
  
  // Pulisci listener quando il modal viene rimosso
  const observer = new MutationObserver(() => {
    if (!document.getElementById(id)) {
      mediaQuery.removeListener(handleMobileView);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  
  document.body.appendChild(modal);
  return modal;
}

// === Gestione Mappe ===

// Variabile globale per la mappa principale
let mainMapInstance = null;

// Inizializza la mappa principale nella schermata
async function initializeMainMap() {
  try {
    const mapContainer = document.getElementById('mainMap');
    if (!mapContainer) {
      console.warn('⚠️ Container mappa principale non trovato');
      return;
    }

    // Controlla se la mappa è già inizializzata
    if (mainMapInstance && mainMapInstance.map && !mainMapInstance.map._container) {
      console.log('🗺️ Mappa già inizializzata, riutilizzo istanza esistente');
      return;
    }

    // Inizializza il MapsManager se non esiste
    if (!window.mapsManager) {
      window.mapsManager = new MapsManager();
    }

    // Controlla se la mappa è già inizializzata nel container
    if (window.mapsManager.map && window.mapsManager.isInitialized) {
      console.log('🗺️ Mappa già inizializzata, aggiorno solo i marker');
      mainMapInstance = window.mapsManager;
    } else {
      // Inizializza la mappa nel container principale
      await window.mapsManager.initialize('mainMap');
      mainMapInstance = window.mapsManager;
    }
    
    // Centra la mappa sul Piemonte (Torino)
    if (mainMapInstance.map) {
      mainMapInstance.map.setView([45.0703, 7.6869], 8.5);
      console.log('✅ Mappa principale inizializzata e centrata sul Piemonte');
    } else {
      console.log('✅ Mappa principale inizializzata');
    }

    // Mostra le strutture sulla mappa se disponibili
    if (strutture && strutture.length > 0) {
      updateMainMap(strutture);
    }

  } catch (error) {
    console.error('❌ Errore inizializzazione mappa principale:', error);
  }
}

// Aggiorna la mappa principale con le strutture filtrate
function updateMainMap(struttureList) {
  try {
    if (!mainMapInstance || !mainMapInstance.map) {
      // Warning solo se DEBUG è attivo, altrimenti silenzioso
      if (DEBUG) {
        console.warn('⚠️ Mappa principale non inizializzata');
      }
      return;
    }

    // Mostra le strutture sulla mappa
    if (window.showStructuresOnMap && typeof window.showStructuresOnMap === 'function') {
      window.showStructuresOnMap(struttureList);
      console.log(`✅ Mappa principale aggiornata con ${struttureList.length} strutture`);
    }
  } catch (error) {
    console.error('❌ Errore aggiornamento mappa principale:', error);
  }
}

// Gestione pulsanti mappa principale
function setupMainMapControls() {
  // Sistema di layer overlay
  if (!window.mapsManager) {
    window.mapsManager = { overlayLayers: {} };
  }
  
  // Definizione layer disponibili (solo overlay funzionanti)
  const layerConfigs = {
    railway: {
      name: 'Rete Ferroviaria',
      url: 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>',
      opacity: 0.9, // Aumentata opacità per maggiore contrasto
      // Applica filtri CSS per aumentare contrasto e saturazione
      className: 'railway-layer-high-contrast'
    },
    hiking: {
      name: 'Sentieri Escursionistici',
      url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.waymarkedtrails.org/">Waymarked Trails</a>',
      opacity: 0.7
    },
    mtb: {
      name: 'Percorsi MTB',
      url: 'https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.waymarkedtrails.org/">Waymarked Trails</a>',
      opacity: 0.7
    },
    cycling: {
      name: 'Piste Ciclabili',
      url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.waymarkedtrails.org/">Waymarked Trails</a>',
      opacity: 0.7
    }
  };
  
  // Funzione per creare/ottenere un layer
  const getOrCreateLayer = (layerId) => {
    if (!window.mapsManager || !window.mapsManager.map) {
      console.warn('⚠️ Mappa non ancora inizializzata');
      return null;
    }
    
    const config = layerConfigs[layerId];
    if (!config) {
      console.error('❌ Configurazione layer non trovata:', layerId);
      return null;
    }
    
    // Se il layer esiste già, restituiscilo
    if (window.mapsManager.overlayLayers && window.mapsManager.overlayLayers[layerId]) {
      return window.mapsManager.overlayLayers[layerId];
    }
    
    // Crea il nuovo layer
    try {
      const layerOptions = {
        attribution: config.attribution,
        maxZoom: 19,
        opacity: config.opacity || 0.7
      };
      
      // Aggiungi classe CSS per filtri se specificata
      if (config.className) {
        layerOptions.className = config.className;
      }
      
      const layer = L.tileLayer(config.url, layerOptions);
      
      // Applica filtri CSS per aumentare contrasto (solo per layer ferroviario)
      if (layerId === 'railway' && config.className) {
        // Aggiungi stile CSS per aumentare contrasto
        if (!document.getElementById('railway-layer-styles')) {
          const style = document.createElement('style');
          style.id = 'railway-layer-styles';
          style.textContent = `
            .railway-layer-high-contrast img {
              filter: contrast(1.4) saturate(1.3) brightness(0.95);
              -webkit-filter: contrast(1.4) saturate(1.3) brightness(0.95);
            }
          `;
          document.head.appendChild(style);
        }
      }
      
      if (!window.mapsManager.overlayLayers) {
        window.mapsManager.overlayLayers = {};
      }
      window.mapsManager.overlayLayers[layerId] = layer;
      console.log(`✅ Layer ${config.name} creato`);
      return layer;
    } catch (error) {
      console.error(`❌ Errore creazione layer ${layerId}:`, error);
      return null;
    }
  };
  
  // Menu dropdown layer
  const layersMenuBtn = document.getElementById('layersMenuBtn');
  const layersMenu = document.getElementById('layersMenu');
  
  if (layersMenuBtn && layersMenu) {
    // Toggle menu
    layersMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      layersMenu.classList.toggle('hidden');
    });
    
    // Chiudi menu quando si clicca fuori
    document.addEventListener('click', (e) => {
      if (!layersMenu.contains(e.target) && e.target !== layersMenuBtn) {
        layersMenu.classList.add('hidden');
      }
    });
    
    // Gestione checkbox layer
    Object.keys(layerConfigs).forEach(layerId => {
      const checkbox = document.getElementById(`layer-${layerId}`);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          if (!window.mapsManager || !window.mapsManager.map) {
            console.warn('⚠️ Mappa non ancora inizializzata');
            alert('La mappa non è ancora caricata. Attendi qualche secondo e riprova.');
            e.target.checked = false;
            return;
          }
          
          const layer = getOrCreateLayer(layerId);
          if (!layer) {
            console.error(`❌ Impossibile creare il layer ${layerId}`);
            e.target.checked = false;
            return;
          }
          
          if (e.target.checked) {
            window.mapsManager.map.addLayer(layer);
            console.log(`✅ Layer ${layerConfigs[layerId].name} attivato`);
          } else {
            window.mapsManager.map.removeLayer(layer);
            console.log(`❌ Layer ${layerConfigs[layerId].name} disattivato`);
          }
        });
      }
    });
    
    // Pulsante rimuovi tutti i layer
    const clearAllLayersBtn = document.getElementById('clearAllLayersBtn');
    if (clearAllLayersBtn) {
      clearAllLayersBtn.addEventListener('click', () => {
        if (!window.mapsManager || !window.mapsManager.map) {
          console.warn('⚠️ Mappa non ancora inizializzata');
          return;
        }
        
        let removedCount = 0;
        
        // Rimuovi tutti i layer attivi e deseleziona le checkbox
        Object.keys(layerConfigs).forEach(layerId => {
          const checkbox = document.getElementById(`layer-${layerId}`);
          if (checkbox && checkbox.checked) {
            const layer = window.mapsManager.overlayLayers && window.mapsManager.overlayLayers[layerId];
            if (layer && window.mapsManager.map.hasLayer(layer)) {
              window.mapsManager.map.removeLayer(layer);
              removedCount++;
            }
            checkbox.checked = false;
          }
        });
        
        if (removedCount > 0) {
          console.log(`🗑️ Rimossi ${removedCount} layer attivi`);
        } else {
          console.log('ℹ️ Nessun layer attivo da rimuovere');
        }
      });
    }
  }

  // Pulsante centro su di me
  const centerMapBtn = document.getElementById('centerMapBtn');
  if (centerMapBtn) {
    centerMapBtn.addEventListener('click', async () => {
      try {
        if (window.centerMapOnUser && typeof window.centerMapOnUser === 'function') {
          await window.centerMapOnUser();
        }
      } catch (error) {
        alert('Impossibile ottenere la tua posizione');
      }
    });
  }

  // Pulsante mostra/nascondi mappa
  const toggleMapBtn = document.getElementById('toggleMapBtn');
  if (toggleMapBtn) {
    toggleMapBtn.addEventListener('click', () => {
      const mapContainer = document.getElementById('mainMapContainer');
      if (mapContainer) {
        mapContainer.classList.toggle('collapsed');
        // Cambia icona
        toggleMapBtn.textContent = mapContainer.classList.contains('collapsed') ? '👁️' : '🙈';
      }
    });
  }
}

async function mostraMappa() {
  // Chiudi il menu automaticamente
  closeMenu();
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('mapModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'mapModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 95%;
    max-height: 95%;
    width: 100%;
    height: 90%;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    position: relative;
    display: flex;
    flex-direction: column;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--border-light);
  `;
  
  const title = document.createElement('h2');
  title.textContent = '🗺️ Mappa Strutture';
  title.style.cssText = `
    margin: 0;
    color: #2f6b2f;
    font-size: 1.5rem;
  `;
  
  const controls = document.createElement('div');
  controls.style.cssText = `
    display: flex;
    gap: 10px;
    align-items: center;
  `;
  
  const centerBtn = document.createElement('button');
  centerBtn.innerHTML = '📍 Centro su di me';
  centerBtn.style.cssText = `
    background: #007bff;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  centerBtn.onclick = async () => {
    try {
      await window.centerMapOnUser();
    } catch (error) {
      alert('Impossibile ottenere la tua posizione');
    }
  };
  
  const syncBtn = document.createElement('button');
  syncBtn.innerHTML = '🔄 Sincronizza';
  syncBtn.style.cssText = `
    background: #28a745;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  syncBtn.onclick = () => {
    mostraModaleSincronizzazione();
  };
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => modal.remove();
  
  controls.appendChild(centerBtn);
  controls.appendChild(syncBtn);
  controls.appendChild(closeBtn);
  
  header.appendChild(title);
  header.appendChild(controls);
  
  // Container mappa
  const mapContainer = document.createElement('div');
  mapContainer.id = 'map';
  mapContainer.style.cssText = `
    flex: 1;
    min-height: 400px;
    border-radius: 8px;
    overflow: hidden;
  `;
  
  modalContent.appendChild(header);
  modalContent.appendChild(mapContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Inizializza mappa
  try {
    // Debug: verifica se la funzione esiste
    if (typeof window.initializeMap !== 'function') {
      console.error('❌ window.initializeMap non è disponibile');
      console.log('🔍 Funzioni disponibili su window:', Object.keys(window).filter(key => key.includes('Map')));
      console.log('🔍 window.mapsManager disponibile:', typeof window.mapsManager);
      console.log('🔍 Leaflet disponibile:', typeof L !== 'undefined');
      throw new Error('Funzione initializeMap non disponibile');
    }
    
    // Debug: verifica Leaflet prima dell'inizializzazione
    console.log('🗺️ Debug: Leaflet disponibile prima init:', typeof L !== 'undefined');
    if (typeof L === 'undefined') {
      console.error('❌ Leaflet non disponibile durante inizializzazione mappa');
      throw new Error('Leaflet non disponibile');
    }
    
    await window.initializeMap('map');
    
    // Assicurati che i dati locali siano caricati
    if (!window.strutture || window.strutture.length === 0) {
      console.log('📦 Caricamento dati locali...');
      try {
        const datiCache = localStorage.getItem('strutture_cache');
        if (datiCache) {
          window.strutture = JSON.parse(datiCache);
          console.log('✅ Dati locali caricati da cache:', window.strutture.length, 'strutture');
        } else {
          console.log('ℹ️ Nessuna cache disponibile, inizializzo array vuoto');
          window.strutture = [];
        }
      } catch (error) {
        console.warn('⚠️ Errore caricamento cache, inizializzo array vuoto:', error);
        window.strutture = [];
      }
    }
    
    const struttureLocali = window.strutture || [];
    console.log('🗺️ Dati locali disponibili:', struttureLocali.length, 'strutture');
    
    // Inizializza la mappa con i dati locali
    if (window.showStructuresOnMap && typeof window.showStructuresOnMap === 'function') {
      window.showStructuresOnMap(struttureLocali);
      console.log('✅ Mappa inizializzata con', struttureLocali.length, 'strutture (dati locali)');
    } else {
      console.warn('⚠️ Funzione showStructuresOnMap non disponibile');
    }
  } catch (error) {
    console.error('❌ Errore inizializzazione mappa:', error);
    mapContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Errore nel caricamento della mappa</div>';
  }
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Modale di avviso per sincronizzazione
function mostraModaleSincronizzazione() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 30px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    text-align: center;
  `;
  
  modalContent.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
    <h2 style="margin: 0 0 15px 0; color: #2f6b2f;">Sincronizzazione con Firestore</h2>
    <div style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-medium); border-radius: 8px; padding: 15px; margin: 20px 0; text-align: left;">
      <div style="font-weight: bold; color: #856404; margin-bottom: 10px;">⚠️ Avviso Importante</div>
      <div style="color: #856404; font-size: 14px; line-height: 1.5;">
        • La sincronizzazione può durare <strong>diversi minuti</strong><br>
        • È consigliabile utilizzare una <strong>connessione WiFi</strong><br>
        • Durante la sincronizzazione l'app potrebbe risultare lenta<br>
        • Puoi interrompere il processo in qualsiasi momento
      </div>
    </div>
    <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
      <button id="rimandaSync" style="
        background: #6c757d;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">⏰ Rimanda</button>
      <button id="procediSync" style="
        background: #28a745;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">🚀 Procedi</button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Event listeners
  document.getElementById('rimandaSync').onclick = () => {
    modal.remove();
  };
  
  document.getElementById('procediSync').onclick = async () => {
    modal.remove();
    await eseguiSincronizzazione();
  };
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Flag per evitare sincronizzazioni multiple
let sincronizzazioneInCorso = false;

// Funzione per eseguire la sincronizzazione
async function eseguiSincronizzazione() {
  // Evita sincronizzazioni multiple
  if (sincronizzazioneInCorso) {
    console.log('⚠️ Sincronizzazione già in corso, ignoro richiesta');
    return;
  }
  
  sincronizzazioneInCorso = true;
  
  try {
    // Mostra indicatore di caricamento
    const loadingModal = document.createElement('div');
    loadingModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10002;
    `;
    
    loadingModal.innerHTML = `
      <div style="background: var(--bg-primary); color: var(--text-primary); border-radius: 12px; padding: 30px; text-align: center; max-width: 400px;">
        <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
        <h3 style="margin: 0 0 15px 0; color: #2f6b2f;">Sincronizzazione in corso...</h3>
        <div style="color: #666; margin-bottom: 20px;">Caricamento dati da Firestore</div>
        <div style="background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px; padding: 15px; margin: 15px 0;">
          <div style="font-size: 12px; color: #666;">Questo processo può richiedere alcuni minuti</div>
        </div>
        <button id="annullaSync" style="
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">❌ Annulla</button>
      </div>
    `;
    
    document.body.appendChild(loadingModal);
    
    // Pulsante annulla
    document.getElementById('annullaSync').onclick = () => {
      loadingModal.remove();
      return;
    };
    
    // Esegui sincronizzazione
    console.log('🔄 Inizio sincronizzazione con Firestore...');
    const struttureFresche = await aggiornaMappaConDatiFreschi();
    
    console.log('✅ Sincronizzazione dati completata:', struttureFresche.length, 'strutture');
    
    // Aggiorna la mappa se è aperta (solo se diversa dai dati attuali)
    if (window.showStructuresOnMap && typeof window.showStructuresOnMap === 'function') {
      const struttureAttuali = window.strutture || [];
      if (struttureFresche.length !== struttureAttuali.length) {
        console.log('🔄 Aggiornamento mappa con dati freschi');
        window.showStructuresOnMap(struttureFresche);
      } else {
        console.log('ℹ️ Mappa già aggiornata, nessun cambiamento necessario');
      }
    }
    
    // Aggiorna la lista principale solo se necessario
    const struttureAttuali = window.strutture || [];
    if (struttureFresche.length !== struttureAttuali.length) {
      console.log('🔄 Aggiornamento lista principale');
      await aggiornaLista();
    } else {
      console.log('ℹ️ Lista già aggiornata, nessun cambiamento necessario');
    }
    
    // Mostra messaggio di successo solo dopo aver completato tutto
    const successModal = document.createElement('div');
    successModal.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10003;
      animation: slideInRight 0.3s ease-out;
    `;
    successModal.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">✅</span>
        <div>
          <div style="font-weight: 500;">Sincronizzazione completata!</div>
          <div style="font-size: 12px; opacity: 0.9;">${struttureFresche.length} strutture aggiornate</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(successModal);
    
    // Rimuovi il loading modal
    loadingModal.remove();
    
    // Rimuovi messaggio dopo 5 secondi
    setTimeout(() => {
      if (successModal.parentNode) {
        successModal.remove();
      }
    }, 5000);
    
    console.log('✅ Sincronizzazione completata con successo');
    
  } catch (error) {
    console.error('❌ Errore durante sincronizzazione:', error);
    
    // Rimuovi loading modal se esiste
    const loadingModal = document.querySelector('[style*="z-index: 10002"]');
    if (loadingModal) {
      loadingModal.remove();
    }
    
    // Mostra messaggio di errore
    alert('❌ Errore durante la sincronizzazione. Riprova più tardi.');
  } finally {
    // Reset flag di sincronizzazione
    sincronizzazioneInCorso = false;
  }
}

// Funzione per forzare aggiornamento mappa con dati freschi
async function aggiornaMappaConDatiFreschi() {
  try {
    // Invalida cache e ricarica dati
    localStorage.removeItem('strutture_cache');
    localStorage.removeItem('strutture_cache_timestamp');
    
    // Ricarica strutture da Firestore
    const struttureFresche = await caricaStrutture();
    window.strutture = struttureFresche;
    
    console.log('🔄 Mappa aggiornata con dati freschi da Firestore');
    return struttureFresche;
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento mappa:', error);
    return window.strutture || [];
  }
}

// Funzione per estrarre coordinate da link Google Maps
function estraiCoordinateDaGoogleMaps(googleMapsLink) {
  if (!googleMapsLink) return null;
  
  try {
    // Pattern per diversi formati di link Google Maps
    const patterns = [
      // https://maps.google.com/maps?q=lat,lng
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // https://maps.google.com/?q=lat,lng
      /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // https://www.google.com/maps/place/.../@lat,lng
      /@(-?\d+\.?\d*),(-?\d+\.?\d*),\d+z/,
      // https://maps.google.com/maps/place/.../@lat,lng
      /@(-?\d+\.?\d*),(-?\d+\.?\d*),\d+\.?\d*z/
    ];
    
    for (const pattern of patterns) {
      const match = googleMapsLink.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        
        // Valida coordinate
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          console.log(`🗺️ Coordinate estratte da Google Maps: ${lat}, ${lng}`);
          return { lat, lng };
        }
      }
    }
    
    console.log('⚠️ Nessuna coordinate valida trovata nel link Google Maps');
    return null;
  } catch (error) {
    console.error('❌ Errore nell\'estrazione coordinate da Google Maps:', error);
    return null;
  }
}

// Funzione per geocoding automatico di una struttura
async function geocodificaStrutturaAutomatico(struttura) {
  // Se ha già coordinate precise, non fare nulla
  if ((struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng) ||
      (struttura.coordinate_lat && struttura.coordinate_lng)) {
    return struttura;
  }
  
  // Prova prima a estrarre da Google Maps
  if (struttura.google_maps_link) {
    const coordinate = estraiCoordinateDaGoogleMaps(struttura.google_maps_link);
    if (coordinate) {
      struttura.coordinate = coordinate;
      struttura.coordinate_lat = coordinate.lat;
      struttura.coordinate_lng = coordinate.lng;
      console.log(`✅ Coordinate estratte da Google Maps per: ${struttura.Struttura}`);
      return struttura;
    }
  }
  
  // Prova geocoding per indirizzo completo
  if (struttura.Indirizzo && struttura.Luogo && struttura.Prov) {
    const address = `${struttura.Indirizzo}, ${struttura.Luogo}, ${struttura.Prov}, Italia`;
    try {
      const coordinate = await geocodificaStruttura(struttura);
      if (coordinate) {
        struttura.coordinate = coordinate;
        struttura.coordinate_lat = coordinate.lat;
        struttura.coordinate_lng = coordinate.lng;
        console.log(`✅ Coordinate ottenute da geocoding per: ${struttura.Struttura}`);
        return struttura;
      }
    } catch (error) {
      console.warn(`⚠️ Geocoding fallito per ${struttura.Struttura}:`, error.message);
    }
  }
  
  // Prova geocoding per luogo + provincia
  if (struttura.Luogo && struttura.Prov) {
    const address = `${struttura.Luogo}, ${struttura.Prov}, Italia`;
    try {
      const coordinate = await geocodificaStruttura({ ...struttura, Indirizzo: address });
      if (coordinate) {
        struttura.coordinate = coordinate;
        struttura.coordinate_lat = coordinate.lat;
        struttura.coordinate_lng = coordinate.lng;
        console.log(`✅ Coordinate ottenute da luogo per: ${struttura.Struttura}`);
        return struttura;
      }
    } catch (error) {
      console.warn(`⚠️ Geocoding luogo fallito per ${struttura.Struttura}:`, error.message);
    }
  }
  
  console.log(`⚠️ Nessuna coordinate ottenuta per: ${struttura.Struttura}`);
  return struttura;
}

// Funzione di debug per verificare coordinate strutture
function debugCoordinateStrutture() {
  const strutture = window.strutture || [];
  console.log('🔍 Debug coordinate strutture:');
  
  strutture.forEach(struttura => {
    const hasCoordinateObj = struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng;
    const hasCoordinateFields = struttura.coordinate_lat && struttura.coordinate_lng;
    
    console.log(`📍 ${struttura.Struttura}:`, {
      coordinate: struttura.coordinate,
      coordinate_lat: struttura.coordinate_lat,
      coordinate_lng: struttura.coordinate_lng,
      hasBoth: hasCoordinateObj && hasCoordinateFields,
      hasEither: hasCoordinateObj || hasCoordinateFields,
      google_maps_link: struttura.google_maps_link,
      Indirizzo: struttura.Indirizzo,
      Luogo: struttura.Luogo,
      Prov: struttura.Prov
    });
  });
}

// Funzione per processare tutte le strutture senza coordinate
async function processaStruttureSenzaCoordinate() {
  console.log('🔄 Avvio processamento strutture senza coordinate...');
  
  const strutture = window.strutture || [];
  let processate = 0;
  let coordinateOttenute = 0;
  
  for (const struttura of strutture) {
    // Salta se già ha coordinate precise
    if ((struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng) ||
        (struttura.coordinate_lat && struttura.coordinate_lng)) {
      continue;
    }
    
    // Prova a ottenere coordinate automaticamente
    const strutturaConCoordinate = await geocodificaStrutturaAutomatico(struttura);
    
    if (strutturaConCoordinate.coordinate || strutturaConCoordinate.coordinate_lat) {
      try {
        // Salva su Firestore
        await updateDoc(doc(db, "strutture", struttura.id), {
          coordinate: strutturaConCoordinate.coordinate,
          coordinate_lat: strutturaConCoordinate.coordinate_lat,
          coordinate_lng: strutturaConCoordinate.coordinate_lng,
          lastModified: new Date(),
          lastModifiedBy: getCurrentUser()?.uid || null
        });
        
        // Aggiorna struttura locale
        struttura.coordinate = strutturaConCoordinate.coordinate;
        struttura.coordinate_lat = strutturaConCoordinate.coordinate_lat;
        struttura.coordinate_lng = strutturaConCoordinate.coordinate_lng;
        
        coordinateOttenute++;
        console.log(`✅ Coordinate ottenute per: ${struttura.Struttura}`);
      } catch (error) {
        console.error(`❌ Errore salvataggio coordinate per ${struttura.Struttura}:`, error);
      }
    }
    
    processate++;
    
    // Pausa per evitare rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Invalida cache per forzare ricaricamento
  localStorage.removeItem('strutture_cache');
  localStorage.removeItem('strutture_cache_timestamp');
  
  console.log(`🏁 Processamento completato: ${coordinateOttenute} coordinate ottenute su ${processate} strutture processate`);
  
  if (coordinateOttenute > 0) {
    alert(`✅ Processamento completato!\n${coordinateOttenute} strutture ora hanno coordinate GPS`);
    // Ricarica la lista
    await aggiornaLista();
  } else {
    alert('ℹ️ Nessuna nuova coordinate è stata ottenuta automaticamente');
  }
}

// Funzione per centrare la mappa su una struttura specifica
function centerMapOnStructure(strutturaId, retryCount = 0) {
  console.log('🎯 Tentativo di centrare mappa su struttura:', strutturaId, '(retry:', retryCount, ')');
  
  const struttureLocali = window.strutture || [];
  const struttura = struttureLocali.find(s => s.id === strutturaId);
  
  if (!struttura) {
    console.warn('❌ Struttura non trovata:', strutturaId);
    return;
  }
  
  console.log('📍 Struttura trovata:', struttura.Struttura);
  
  // Cerca coordinate in diversi formati
  let lat, lng;
  
  // Formato 1: coordinate_lat e coordinate_lng
  if (struttura.coordinate_lat && struttura.coordinate_lng) {
    lat = parseFloat(struttura.coordinate_lat);
    lng = parseFloat(struttura.coordinate_lng);
    console.log('📍 Coordinate trovate (lat/lng):', lat, lng);
  }
  // Formato 2: oggetto coordinate
  else if (struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng) {
    lat = parseFloat(struttura.coordinate.lat);
    lng = parseFloat(struttura.coordinate.lng);
    console.log('📍 Coordinate trovate (oggetto):', lat, lng);
  }
  // Formato 3: stringa Coordinate
  else if (struttura.Coordinate) {
    const coords = struttura.Coordinate.split(',').map(coord => parseFloat(coord.trim()));
    if (coords.length === 2) {
      lat = coords[0];
      lng = coords[1];
      console.log('📍 Coordinate trovate (stringa):', lat, lng);
    }
  }
  
  // Verifica che le coordinate siano valide
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    console.warn('❌ Coordinate non valide per struttura:', struttura.Struttura);
    console.log('📍 Dati struttura:', {
      coordinate_lat: struttura.coordinate_lat,
      coordinate_lng: struttura.coordinate_lng,
      coordinate: struttura.coordinate,
      Coordinate: struttura.Coordinate
    });
    return;
  }
  
  // Se la mappa è già inizializzata, centra su questa struttura
  if (window.mapsManager && window.mapsManager.map) {
    console.log('🗺️ Centrando mappa su:', lat, lng);
    window.mapsManager.map.setView([lat, lng], 15);
    
    // Evidenzia il marker se esiste
    if (window.mapsManager.markers) {
      const marker = window.mapsManager.markers.find(m => m.structureId === strutturaId);
      if (marker) {
        console.log('📍 Apertura popup marker');
        marker.openPopup();
      } else {
        console.log('⚠️ Marker non trovato per struttura:', strutturaId);
      }
    }
    
    console.log('✅ Mappa centrata con successo');
  } else {
    if (retryCount < 5) {
      console.warn('❌ Mappa non inizializzata, retry in 500ms (tentativo', retryCount + 1, '/5)');
      // Retry dopo 500ms se la mappa non è ancora pronta
      setTimeout(() => {
        centerMapOnStructure(strutturaId, retryCount + 1);
      }, 500);
    } else {
      console.error('❌ Impossibile centrare mappa dopo 5 tentativi');
    }
  }
}

// Rendi le funzioni accessibili globalmente
window.mostraMappa = mostraMappa;
window.aggiornaMappaConDatiFreschi = aggiornaMappaConDatiFreschi;
window.debugCoordinateStrutture = debugCoordinateStrutture;
window.processaStruttureSenzaCoordinate = processaStruttureSenzaCoordinate;
window.centerMapOnStructure = centerMapOnStructure;
window.mostraModaleSincronizzazione = mostraModaleSincronizzazione;
window.eseguiSincronizzazione = eseguiSincronizzazione;
window.aggiornaListaLocale = aggiornaListaLocale;

// === Sistema Rating ===
async function voteStructure(strutturaId, rating) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      alert('Devi essere loggato per votare una struttura');
      return;
    }
    
    // 🔒 Validazione server-side
    if (!await validateServerAuth()) {
      alert('❌ Sessione non valida. Effettua nuovamente il login.');
      return;
    }

    const struttura = strutture.find(s => s.id === strutturaId);
    if (!struttura) {
      console.error('Struttura non trovata:', strutturaId);
      return;
    }

    // Inizializza rating se non esiste
    if (!struttura.rating) {
      struttura.rating = { total: 0, count: 0, average: 0 };
    }

    // Salva il voto su Firestore
    const voteData = {
      userId: currentUser.uid,
      strutturaId: strutturaId,
      rating: rating,
      createdAt: new Date(),
      userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Utente'
    };

    await secureFirestoreOperation(addDoc, collection(db, "structure_ratings"), voteData);

    // Aggiorna il rating della struttura
    struttura.rating.count += 1;
    struttura.rating.total += rating;
    struttura.rating.average = struttura.rating.total / struttura.rating.count;

    // Salva su Firestore
    await secureFirestoreOperation(updateDoc, doc(db, "strutture", strutturaId), {
      rating: struttura.rating,
      lastModified: new Date(),
      lastModifiedBy: currentUser.uid
    });

    // Log attività
    await logActivity('structure_rated', strutturaId, currentUser.uid, {
      rating: rating,
      newAverage: struttura.rating.average
    });

    // Aggiorna la scheda se è aperta
    const modalScheda = document.getElementById('schedaCompletaModal');
    if (modalScheda) {
      // Chiudi e riapri la scheda per mostrare il rating aggiornato
      modalScheda.remove();
      // Ri-apri la scheda con i dati aggiornati
      setTimeout(() => {
        mostraSchedaCompleta(strutturaId);
      }, 100);
    }

    // Aggiorna la lista
    const listaFiltrata = filtra(strutture);
    renderStrutture(listaFiltrata);

    console.log(`✅ Voto ${rating}/5 registrato per ${struttura.Struttura}`);
    
    // Mostra notifica
    if (window.showNotification) {
      window.showNotification(
        '⭐ Voto registrato!',
        {
          body: `Hai votato ${rating}/5 stelle per ${struttura.Struttura}`,
          tag: 'vote-success'
        }
      );
    }
  } catch (error) {
    console.error('❌ Errore nel salvataggio voto:', error);
    alert('Errore nel salvataggio del voto');
  }
}

// Rendi la funzione accessibile globalmente
window.voteStructure = voteStructure;

// === Sistema Segnalazioni ===
async function mostraSegnalazione(strutturaId) {
  const struttura = strutture.find(s => s.id === strutturaId);
  if (!struttura) {
    console.error('Struttura non trovata:', strutturaId);
    return;
  }
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('reportModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'reportModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 90%;
    width: 500px;
    max-height: 80%;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-light);
  `;
  
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="margin: 0; color: var(--danger-color, #dc3545);">⚠️ Segnala Problema</h3>
      <button id="closeReportModal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-primary);">✕</button>
    </div>
    
    <div style="margin-bottom: 15px; padding: 10px; background: var(--bg-secondary); color: var(--text-primary); border-radius: 6px;">
      <strong>Struttura:</strong> ${struttura.Struttura || 'Senza nome'}<br>
      <span style="color: var(--text-secondary, #666);">📍 ${struttura.Luogo || 'N/A'}, ${struttura.Prov || 'N/A'}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 8px; font-weight: bold; color: var(--text-primary);">Tipo di problema:</label>
      <select id="reportType" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
        <option value="dati_obsoleti">Dati obsoleti o non aggiornati</option>
        <option value="struttura_chiusa">Struttura chiusa o non più disponibile</option>
        <option value="info_errate">Informazioni errate o incomplete</option>
        <option value="contatto_non_funzionante">Contatti non funzionanti</option>
        <option value="prezzi_aggiornati">Prezzi non aggiornati</option>
        <option value="altro">Altro</option>
      </select>
    </div>
    
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 8px; font-weight: bold; color: var(--text-primary);">Descrizione del problema:</label>
      <textarea id="reportDescription" placeholder="Descrivi il problema riscontrato..." 
                style="width: 100%; height: 100px; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; resize: vertical; background: var(--bg-primary); color: var(--text-primary);"></textarea>
    </div>
    
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button id="cancelReport" style="background: var(--secondary-color, #6c757d); color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
        ❌ Annulla
      </button>
      <button id="submitReport" style="background: var(--danger-color, #dc3545); color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
        📤 Invia Segnalazione
      </button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Event listeners
  document.getElementById('closeReportModal').onclick = () => modal.remove();
  document.getElementById('cancelReport').onclick = () => modal.remove();
  
  document.getElementById('submitReport').onclick = async () => {
    const reportType = document.getElementById('reportType').value;
    const description = document.getElementById('reportDescription').value.trim();
    
    if (!description) {
      alert('Inserisci una descrizione del problema!');
      return;
    }
    
    try {
      await inviaSegnalazione(strutturaId, reportType, description);
      modal.remove();
    } catch (error) {
      console.error('Errore nell\'invio segnalazione:', error);
      alert('Errore nell\'invio della segnalazione');
    }
  };
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function inviaSegnalazione(strutturaId, tipo, descrizione) {
  try {
    const struttura = strutture.find(s => s.id === strutturaId);
    if (!struttura) {
      throw new Error('Struttura non trovata');
    }

    // Crea la segnalazione
    const reportData = {
      strutturaId: strutturaId,
      strutturaNome: struttura.Struttura || 'Senza nome',
      tipo: tipo,
      descrizione: descrizione,
      userId: getCurrentUser()?.uid || null,
      userName: getCurrentUser()?.displayName || getCurrentUser()?.email?.split('@')[0] || 'Utente anonimo',
      userEmail: getCurrentUser()?.email || null,
      createdAt: new Date(),
      status: 'pending', // pending, reviewed, resolved
      reviewedBy: null,
      reviewedAt: null
    };

    // Salva su Firestore
    await addDoc(collection(db, "structure_reports"), reportData);

    // Aggiorna il contatore segnalazioni nella struttura
    if (!struttura.segnalazioni) {
      struttura.segnalazioni = [];
    }
    
    struttura.segnalazioni.push({
      tipo: tipo,
      descrizione: descrizione,
      createdAt: new Date(),
      userId: getCurrentUser()?.uid || null
    });

    // Aggiorna su Firestore
    await updateDoc(doc(db, "strutture", strutturaId), {
      segnalazioni: struttura.segnalazioni,
      lastModified: new Date(),
      lastModifiedBy: getCurrentUser()?.uid || null
    });

    // Log attività
    await logActivity('report_submitted', strutturaId, getCurrentUser()?.uid || 'anonymous', {
      reportType: tipo,
      reportDescription: descrizione.substring(0, 100)
    });

    console.log('✅ Segnalazione inviata per:', struttura.Struttura);
    
    // Mostra notifica
    if (window.showNotification) {
      window.showNotification(
        '⚠️ Segnalazione inviata',
        {
          body: `La tua segnalazione per ${struttura.Struttura} è stata inviata`,
          tag: 'report-success'
        }
      );
    }
    
    alert('✅ Segnalazione inviata con successo! Grazie per il tuo contributo.');
  } catch (error) {
    console.error('❌ Errore nell\'invio segnalazione:', error);
    throw error;
  }
}

// Rendi le funzioni accessibili globalmente
window.mostraSegnalazione = mostraSegnalazione;
window.inviaSegnalazione = inviaSegnalazione;

// === Ottimizzazioni Performance ===
function setupLazyLoading() {
  // Verifica se l'Intersection Observer è supportato
  if (!('IntersectionObserver' in window)) {
    console.log('⚠️ Intersection Observer non supportato, caricamento immagini normale');
    return;
  }

  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        
        // Carica l'immagine
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          img.classList.add('loaded');
        }
        
        // Rimuovi l'observer per questa immagine
        imageObserver.unobserve(img);
      }
    });
  }, {
    root: null,
    rootMargin: '50px',
    threshold: 0.1
  });

  // Osserva tutte le immagini lazy
  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });

  console.log('✅ Lazy loading configurato');
}

// Funzione per creare immagini lazy
function createLazyImage(src, alt = '', className = '') {
  const img = document.createElement('img');
  img.dataset.src = src;
  img.alt = alt;
  img.className = `lazy ${className}`;
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjhmOWZhIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yzc1N2QiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn5GvIENhcmljYW1lbnRvLi4uPC90ZXh0Pgo8L3N2Zz4='; // Placeholder SVG
  
  // Stili per il placeholder
  img.style.cssText = `
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    transition: opacity 0.3s ease;
  `;
  
  img.onload = () => {
    img.style.opacity = '1';
  };
  
  return img;
}

// Cache intelligente per i dati
class DataCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minuti
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Verifica se è scaduto
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  clear() {
    this.cache.clear();
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
}

// Inizializza cache globale
window.dataCache = new DataCache();

// Funzione per caricare dati con cache
async function loadDataWithCache(key, loaderFunction) {
  // Verifica cache
  if (window.dataCache.has(key)) {
    console.log(`📦 Dati caricati da cache: ${key}`);
    return window.dataCache.get(key);
  }

  // Carica dati
  console.log(`🌐 Caricamento dati da server: ${key}`);
  const data = await loaderFunction();
  
  // Salva in cache
  window.dataCache.set(key, data);
  
  return data;
}

// Paginazione ottimizzata con virtual scrolling
function setupVirtualScrolling(container, items, itemsPerPage = 20) {
  let currentPage = 1;
  const totalPages = Math.ceil(items.length / itemsPerPage);
  
  function renderPage(page) {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = items.slice(start, end);
    
    container.innerHTML = '';
    pageItems.forEach(item => {
      // Renderizza l'item
      const itemElement = document.createElement('div');
      itemElement.className = 'virtual-item';
      // Aggiungi contenuto dell'item
      container.appendChild(itemElement);
    });
  }
  
  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      renderPage(currentPage);
    }
  }
  
  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
      renderPage(currentPage);
    }
  }
  
  // Inizializza prima pagina
  renderPage(1);
  
  return {
    nextPage,
    prevPage,
    currentPage: () => currentPage,
    totalPages: () => totalPages
  };
}

// Skeleton screens per caricamento
function showSkeletonScreen(container, type = 'cards') {
  const skeletonHTML = {
    cards: `
      <div class="skeleton-card">
        <div class="skeleton-header"></div>
        <div class="skeleton-content">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>
    `,
    list: `
      <div class="skeleton-list-item">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-content">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    `
  };
  
  container.innerHTML = skeletonHTML[type].repeat(5);
}

// Rendi le funzioni accessibili globalmente
window.setupLazyLoading = setupLazyLoading;
window.createLazyImage = createLazyImage;
window.loadDataWithCache = loadDataWithCache;
window.setupVirtualScrolling = setupVirtualScrolling;
window.showSkeletonScreen = showSkeletonScreen;

// === Gestione Temi ===
class ThemeManager {
  constructor() {
    this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
    this.applyTheme(this.currentTheme);
  }

  getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  getStoredTheme() {
    return localStorage.getItem('theme');
  }

  storeTheme(theme) {
    localStorage.setItem('theme', theme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    this.storeTheme(theme);
    
    // Aggiorna l'icona del toggle
    this.updateToggleIcon(theme);
    
    console.log(`🎨 Tema applicato: ${theme}`);
  }

  updateToggleIcon(theme) {
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      const menuIcon = toggle.querySelector('.menu-icon');
      if (menuIcon) {
        menuIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
    }
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    
    // Chiudi il menu automaticamente
    if (typeof window.closeMenu === 'function') {
      window.closeMenu();
    }
    
    // Mostra notifica
    if (window.showNotification) {
      window.showNotification(
        `🎨 Tema ${newTheme === 'dark' ? 'scuro' : 'chiaro'} attivato`,
        {
          body: `L'interfaccia è stata aggiornata al tema ${newTheme === 'dark' ? 'scuro' : 'chiaro'}`,
          tag: 'theme-change'
        }
      );
    }
  }

  getCurrentTheme() {
    return this.currentTheme;
  }
}

// Inizializza il gestore dei temi
const themeManager = new ThemeManager();

// Funzione per il toggle del tema
function toggleTheme() {
  themeManager.toggleTheme();
}

// Rendi le funzioni accessibili globalmente
window.toggleTheme = toggleTheme;
window.themeManager = themeManager;

// === Gestione Utenti Firebase ===
// 🔒 SICUREZZA: Variabili private per prevenire bypass da console
const _authState = {
  user: null,
  profile: null,
  isAuthenticated: false,
  sessionToken: null,
  lastValidation: 0
};

// 🔒 SICUREZZA: Getters sicuri per l'autenticazione
function getCurrentUser() {
  if (!_authState.isAuthenticated || !_authState.user) {
    return null;
  }
  
  // Verifica che il token di sessione sia ancora valido
  if (!_authState.sessionToken || Date.now() - _authState.lastValidation > 300000) { // 5 minuti
    console.warn('🔒 Token di sessione scaduto o non valido');
    _authState.isAuthenticated = false;
    _authState.user = null;
    _authState.profile = null;
    _authState.sessionToken = null;
    return null;
  }
  
  return _authState.user;
}

// Esponi globalmente per uso in altri moduli
window.getCurrentUser = getCurrentUser;

function getUserProfile() {
  if (!_authState.isAuthenticated || !_authState.profile) {
    return null;
  }
  
  // Verifica che il token di sessione sia ancora valido
  if (!_authState.sessionToken || Date.now() - _authState.lastValidation > 300000) { // 5 minuti
    console.warn('🔒 Token di sessione scaduto o non valido');
    _authState.isAuthenticated = false;
    _authState.user = null;
    _authState.profile = null;
    _authState.sessionToken = null;
    return null;
  }
  
  return _authState.profile;
}

function isUserAuthenticated() {
  return _authState.isAuthenticated && _authState.user !== null && _authState.sessionToken !== null;
}

// 🔒 SICUREZZA: Funzione per aggiornare lo stato di autenticazione
function updateAuthState(user, profile = null, sessionToken = null) {
  if (user) {
    _authState.user = user;
    _authState.profile = profile;
    _authState.isAuthenticated = true;
    _authState.sessionToken = sessionToken || generateSessionToken();
    _authState.lastValidation = Date.now();
  } else {
    _authState.user = null;
    _authState.profile = null;
    _authState.isAuthenticated = false;
    _authState.sessionToken = null;
    _authState.lastValidation = 0;
  }
}

// 🔒 SICUREZZA: Genera token di sessione sicuro
function generateSessionToken() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const userAgent = navigator.userAgent.substring(0, 20);
  return btoa(`${timestamp}-${random}-${userAgent}`).replace(/[^a-zA-Z0-9]/g, '');
}

// 🔒 SICUREZZA: Valida token di sessione
function validateSessionToken(token) {
  if (!token) return false;
  
  try {
    const decoded = atob(token);
    const parts = decoded.split('-');
    if (parts.length !== 3) return false;
    
    const timestamp = parseInt(parts[0]);
    const userAgent = parts[2];
    
    // Verifica che il token non sia più vecchio di 30 minuti
    if (Date.now() - timestamp > 1800000) { // 30 minuti
      return false;
    }
    
    // Verifica che l'user agent sia lo stesso
    if (userAgent !== navigator.userAgent.substring(0, 20)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// 🔒 SICUREZZA: Funzione per forzare il logout
function forceLogout() {
  console.log('🔒 Forzando logout per sicurezza');
  updateAuthState(null);
  
  // Pulisci localStorage
  localStorage.removeItem('userSession');
  localStorage.removeItem('loginAttempts');
  
  // Mostra schermata di login
  mostraSchermataLogin();
  
  // Disconnetti da Firebase
  if (auth.currentUser) {
    signOut(auth).catch(console.error);
  }
}

// 🔒 SICUREZZA: Validazione continua dell'autenticazione
function startAuthValidation() {
  setInterval(() => {
    if (_authState.isAuthenticated && _authState.sessionToken) {
      if (!validateSessionToken(_authState.sessionToken)) {
        console.warn('🔒 Token di sessione non valido, disconnessione forzata');
        forceLogout();
      } else {
        // Aggiorna timestamp di validazione
        _authState.lastValidation = Date.now();
      }
    }
  }, 60000); // Controlla ogni minuto
}

// 🔒 SICUREZZA: Proteggi le funzioni critiche
function requireAuth(callback) {
  if (!isUserAuthenticated()) {
    console.error('🔒 Accesso negato: autenticazione richiesta');
    mostraSchermataLogin();
    return;
  }
  
  if (typeof callback === 'function') {
    callback();
  }
}

// 🔒 SICUREZZA: Validazione server-side per operazioni critiche
async function validateServerAuth() {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('Utente non autenticato');
    }
    
    // Verifica che l'utente sia ancora valido su Firebase
    const idToken = await currentUser.getIdToken(true); // Forza refresh del token
    
    // Verifica che il token sia valido
    if (!idToken) {
      throw new Error('Token non valido');
    }
    
    // Verifica che l'email sia verificata
    if (!currentUser.emailVerified) {
      console.warn('🔒 Email non verificata, accesso limitato');
      // Non bloccare completamente, ma limitare le operazioni
    }
    
    return true;
  } catch (error) {
    console.error('🔒 Validazione server-side fallita:', error);
    forceLogout();
    return false;
  }
}

// 🔒 SICUREZZA: Wrapper per operazioni Firestore con validazione
async function secureFirestoreOperation(operation, ...args) {
  if (!await validateServerAuth()) {
    throw new Error('Operazione non autorizzata');
  }
  
  return await operation(...args);
}

// 🔒 SICUREZZA: Override delle variabili globali per prevenire modifiche
Object.defineProperty(window, 'utenteCorrente', {
  get: () => {
    console.warn('🔒 Accesso diretto a utenteCorrente bloccato per sicurezza');
    return null;
  },
  set: () => {
    console.warn('🔒 Modifica di utenteCorrente bloccata per sicurezza');
  }
});

Object.defineProperty(window, 'userProfile', {
  get: () => {
    console.warn('🔒 Accesso diretto a userProfile bloccato per sicurezza');
    return null;
  },
  set: () => {
    console.warn('🔒 Modifica di userProfile bloccata per sicurezza');
  }
});

// 🔒 SICUREZZA: Nascondi funzioni critiche dalla console
const _protectedFunctions = {
  updateAuthState,
  generateSessionToken,
  validateSessionToken,
  forceLogout,
  startAuthValidation
};

// Rimuovi le funzioni protette dall'oggetto window
Object.keys(_protectedFunctions).forEach(key => {
  delete window[key];
});

// === SICUREZZA: Rate Limiting per Login ===
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minuti

class LoginSecurity {
  constructor() {
    this.attempts = this.loadAttempts();
  }

  loadAttempts() {
    try {
      return JSON.parse(localStorage.getItem('loginAttempts') || '{}');
    } catch {
      return {};
    }
  }

  saveAttempts() {
    localStorage.setItem('loginAttempts', JSON.stringify(this.attempts));
  }

  recordFailedAttempt(email) {
    const key = email.toLowerCase();
    const attempt = this.attempts[key] || { count: 0, firstAttempt: Date.now(), lockouts: 0 };
    
    attempt.count++;
    
    // Blocco temporaneo dopo troppi tentativi
    if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
      attempt.lockouts++;
      attempt.lockedUntil = Date.now() + LOCKOUT_DURATION;
      attempt.count = 0; // Reset counter
      
      this.attempts[key] = attempt;
      this.saveAttempts();
      
      return { 
        blocked: true, 
        duration: LOCKOUT_DURATION,
        reason: `Troppi tentativi falliti. Account bloccato per ${LOCKOUT_DURATION / 60000} minuti.`
      };
    }
    
    this.attempts[key] = attempt;
    this.saveAttempts();
    
    return { 
      blocked: false, 
      remaining: MAX_LOGIN_ATTEMPTS - attempt.count 
    };
  }

  recordSuccess(email) {
    const key = email.toLowerCase();
    delete this.attempts[key];
    this.saveAttempts();
  }

  isBlocked(email) {
    const key = email.toLowerCase();
    const attempt = this.attempts[key];
    
    if (!attempt || !attempt.lockedUntil) {
      return { blocked: false };
    }
    
    if (attempt.lockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      return { 
        blocked: true, 
        minutesLeft,
        reason: `Account bloccato. Riprova tra ${minutesLeft} minuti.`
      };
    }
    
    // Blocco scaduto, reset
    delete this.attempts[key];
    this.saveAttempts();
    
    return { blocked: false };
  }
}

// Instanza globale di LoginSecurity
const loginSecurity = new LoginSecurity();

// === SICUREZZA: Validazione Password Robusta ===
function validatePasswordStrength(password) {
  const checks = {
    length: password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=]/.test(password),
    noCommonPatterns: !hasCommonPatterns(password),
    noCommonWords: !hasCommonWords(password)
  };
  
  const passed = Object.values(checks).filter(v => v).length;
  const strength = 
    passed === 7 ? 'strong' :
    passed >= 5 ? 'medium' :
    'weak';
  
  return {
    valid: strength !== 'weak',
    strength,
    checks,
    feedback: generatePasswordFeedback(checks)
  };
}

function hasCommonPatterns(password) {
  const patterns = [
    /12345678/,
    /abcdefgh/,
    /qwerty/,
    /password/i,
    /admin/i,
    /welcome/i
  ];
  
  return patterns.some(pattern => pattern.test(password));
}

function hasCommonWords(password) {
  const commonWords = [
    'password', 'password123', 'admin', 'welcome', 'hello',
    'monkey', '123456', 'letmein', 'trustno1', 'dragon'
  ];
  
  return commonWords.some(word => password.toLowerCase().includes(word));
}

function generatePasswordFeedback(checks) {
  const feedback = [];
  
  if (!checks.length) feedback.push('La password deve essere di almeno 12 caratteri');
  if (!checks.lowercase) feedback.push('Includi almeno una lettera minuscola');
  if (!checks.uppercase) feedback.push('Includi almeno una lettera maiuscola');
  if (!checks.number) feedback.push('Includi almeno un numero');
  if (!checks.special) feedback.push('Includi almeno un carattere speciale (!@#$%^&*...)');
  if (!checks.noCommonPatterns) feedback.push('Evita sequenze comuni (1234, abcd...)');
  if (!checks.noCommonWords) feedback.push('Evita parole comuni o prevedibili');
  
  return feedback;
}

// === SICUREZZA: Session Timeout ===
let sessionManager = null;

class SessionManager {
  constructor(timeoutMinutes = 30) {
    this.timeoutMs = timeoutMinutes * 60 * 1000;
    this.idleTimer = null;
    this.warningTimer = null;
    this.isShowingWarning = false;
    this.init();
  }
  
  init() {
    // Reset timer su qualsiasi interazione utente
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, () => this.resetTimer(), true);
    });
    
    this.resetTimer();
  }
  
  resetTimer() {
    clearTimeout(this.idleTimer);
    clearTimeout(this.warningTimer);
    this.isShowingWarning = false;
    
    // Warning dopo 25 minuti
    this.warningTimer = setTimeout(() => {
      this.showWarning();
    }, this.timeoutMs - (5 * 60 * 1000)); // 5 minuti prima del timeout
    
    // Timeout completo dopo 30 minuti
    this.idleTimer = setTimeout(() => {
      this.onTimeout();
    }, this.timeoutMs);
  }
  
  showWarning() {
    if (this.isShowingWarning) return;
    this.isShowingWarning = true;
    
    // Mostra avviso con opzione di restare connesso
    const confirmed = confirm(
      '⚠️ Sei inattivo da 25 minuti.\n\n' +
      'Sarai disconnesso tra 5 minuti per sicurezza.\n\n' +
      'Clicca OK per restare connesso.'
    );
    
    if (confirmed) {
      this.resetTimer();
    }
  }
  
  onTimeout() {
    clearTimeout(this.idleTimer);
    clearTimeout(this.warningTimer);
    
    console.log('⏰ Session timeout - Disconnessione automatica');
    
    // Logout Firebase
    if (window.auth && window.signOut) {
      signOut(window.auth).then(() => {
        window.location.href = '/index.html';
      }).catch(error => {
        console.error('Errore logout:', error);
        window.location.href = '/index.html';
      });
    } else {
      window.location.href = '/index.html';
    }
  }
  
  destroy() {
    clearTimeout(this.idleTimer);
    clearTimeout(this.warningTimer);
    this.isShowingWarning = false;
  }
}

// === SICUREZZA: Inizializza Session Timeout ===
function initSessionTimeout() {
  if (sessionManager) {
    sessionManager.destroy();
  }
  sessionManager = new SessionManager(30); // 30 minuti timeout
}

// === SICUREZZA: Cleanup Session ===
function cleanupSession() {
  if (sessionManager) {
    sessionManager.destroy();
    sessionManager = null;
  }
}

// === SICUREZZA: Sanitizzazione Input ===
class InputSanitizer {
  static sanitizeHTML(input) {
    if (!input) return '';
    
    // Creare elemento temporaneo per escape HTML
    const div = document.createElement('div');
    div.textContent = input;
    const sanitized = div.innerHTML;
    
    // Rimuovere possibili script tag
    return sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  
  static sanitizeEmail(email) {
    if (!email) return '';
    
    // Validazione email base
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Email non valida');
    }
    
    return email.toLowerCase().trim();
  }
  
  static sanitizePhone(phone) {
    if (!phone) return '';
    
    // Rimuovere tutti i caratteri non numerici
    return phone.replace(/\D/g, '');
  }
  
  static sanitizeText(input, maxLength = 1000) {
    if (!input) return '';
    
    // Trim e limit lunghezza
    let sanitized = input.trim();
    
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    // Escape HTML
    return this.sanitizeHTML(sanitized);
  }
  
  static sanitizeCoordinate(value) {
    const num = parseFloat(value);
    
    if (isNaN(num)) {
      throw new Error('Coordinate non valide');
    }
    
    // Valori validi per latitudine e longitudine
    if (Math.abs(num) > 180) {
      throw new Error('Coordinate fuori range');
    }
    
    return num;
  }
  
  static sanitizeURL(url) {
    if (!url) return '';
    
    try {
      const parsed = new URL(url);
      // Permetti solo http e https
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Protocollo non valido');
      }
      return parsed.href;
    } catch {
      return '';
    }
  }
  
  static sanitizeNome(nome) {
    if (!nome) return '';
    
    // Rimuovi caratteri pericolosi, mantieni solo lettere, numeri, spazi e alcuni caratteri speciali
    return nome.replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ\s'-]/g, '').trim().substring(0, 100);
  }
}

// Inizializza il sistema di autenticazione
function inizializzaAuth() {
  onAuthStateChanged(auth, async (user) => {
    console.log('🔐 Auth state changed:', user ? 'User logged in' : 'User logged out');
    if (user) {
      // Utente autenticato
      updateAuthState(user);
      console.log('✅ Utente autenticato:', user.email);
      
      // Nascondi schermata di login
      nascondiSchermataLogin();
      
      // Carica profilo utente da Firestore
      await caricaProfiloUtente(user.uid);
      
      // Aggiorna UI
      aggiornaUIUtente();
      caricaElencoPersonaleUtente();
      
      // Aggiorna contatore elenco
      aggiornaContatoreElenco();
      
      // Carica strutture dopo l'autenticazione
      try {
        strutture = await caricaStrutture();
        window.strutture = strutture;
        
        if (!strutture || strutture.length === 0) {
          console.warn('⚠️ Nessuna struttura caricata!');
          // Mostra empty state invece di non fare nulla
          const container = document.getElementById("results");
          const emptyState = document.getElementById("emptyState");
          if (container) {
            container.innerHTML = "";
          }
          if (emptyState) {
            emptyState.classList.remove('hidden');
          }
          return;
        }
        
        // Applica filtro provincia preferita se impostata
        const preferredProvince = localStorage.getItem('preferredProvince');
        if (preferredProvince && preferredProvince !== '') {
          const struttureFiltrate = strutture.filter(s => s.Prov === preferredProvince);
          renderStrutture(struttureFiltrate);
        } else {
          renderStrutture(strutture);
        }
        aggiornaContatoreElenco();
        console.log('✅ Strutture caricate e visualizzate');
        
        // Inizializza mappa principale dopo caricamento strutture (post-first-paint)
        const scheduleInit = () => {
          try { initializeMainMap(); } catch (e) { console.warn('⚠️ Init mappa posticipato:', e?.message); }
        };
        if ('requestIdleCallback' in window) {
          requestIdleCallback(scheduleInit, { timeout: 1000 });
        } else {
          setTimeout(scheduleInit, 0);
        }
      } catch (error) {
        console.error('❌ Errore nel caricamento strutture:', error);
        // Mostra errore anche in UI
        const container = document.getElementById("results");
        if (container) {
          container.innerHTML = `<div class="error" style="padding: 20px; text-align: center;">
            <h3>⚠️ Errore nel caricamento</h3>
            <p>Impossibile caricare le strutture. Errore: ${error.message}</p>
            <button onclick="location.reload()" class="btn-primary">Ricarica pagina</button>
          </div>`;
        }
      }
      
      // Carica filtri salvati (con delay per assicurarsi che l'utente sia completamente autenticato)
      setTimeout(async () => {
        try {
          await caricaFiltriSalvatiDropdown();
        } catch (error) {
          console.warn('⚠️ Errore nel caricamento filtri salvati (non critico):', error);
        }
      }, 1000);
      
      // 🔒 Inizializza session timeout
      initSessionTimeout();
      
      // 🔒 Inizializza validazione continua dell'autenticazione
      startAuthValidation();
    } else {
      // Utente non autenticato
      updateAuthState(null);
      elencoPersonale = [];
      console.log('❌ Nessun utente autenticato');
      
      // 🔒 Cleanup session timeout
      cleanupSession();
      
      // Mostra schermata di login
      mostraSchermataLogin();
    }
  });
}

async function caricaProfiloUtente(uid) {
  try {
    // 🔒 Validazione server-side
    if (!await validateServerAuth()) {
      console.warn('🔒 Sessione non valida per caricamento profilo');
      return;
    }
    
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await secureFirestoreOperation(getDoc, userDocRef);
    
    if (userDoc.exists()) {
      const profile = userDoc.data();
      updateAuthState(getCurrentUser(), profile);
      console.log('📋 Profilo utente caricato:', profile);
      
      // Assicurati che i campi nuovi esistano (retrocompatibilità)
      if (!profile.cognome) profile.cognome = '';
      if (!profile.telefono) profile.telefono = '';
      if (!profile.gruppo) profile.gruppo = '';
      if (!profile.ruolo) profile.ruolo = '';
      if (!profile.preferenzeNotifiche) {
        profile.preferenzeNotifiche = {
          newStructures: true,
          structureUpdates: true,
          personalListUpdates: true,
          nearbyStructures: false,
          reports: true,
          distance: 10
        };
      }
      
      // Aggiorna lo stato con il profilo corretto
      updateAuthState(getCurrentUser(), profile);
    } else {
      // Crea profilo utente se non esiste (per utenti esistenti)
      const currentUser = getCurrentUser();
      const newProfile = {
        nome: currentUser.displayName || currentUser.email.split('@')[0],
        cognome: '',
        email: currentUser.email,
        telefono: '',
        gruppo: '',
        ruolo: '',
        dataCreazione: new Date().toISOString(),
        elencoPersonale: [],
        preferenzeNotifiche: {
          newStructures: true,
          structureUpdates: true,
          personalListUpdates: true,
          nearbyStructures: false,
          reports: true,
          distance: 10
        }
      };
      
      await secureFirestoreOperation(setDoc, userDocRef, newProfile);
      updateAuthState(currentUser, newProfile);
      console.log('✅ Nuovo profilo utente creato');
    }
  } catch (error) {
    console.error('❌ Errore caricamento profilo:', error);
  }
}

// === Scheda Utente ===
async function mostraSchedaUtente() {
  // Chiudi il menu automaticamente
  closeMenu();
  
  // Nascondi il modale "Le Mie Liste" se è aperto
  const elencoModal = document.getElementById('elencoPersonaleModal');
  if (elencoModal) {
    elencoModal.remove();
  }
  
  // Verifica e ricarica il profilo se necessario
  const currentUser = getCurrentUser();
  if (!currentUser) {
    alert('❌ Errore: utente non autenticato');
    return;
  }
  
  let userProfile = getUserProfile();
  
  // Se il profilo non è disponibile, ricaricalo da Firestore
  if (!userProfile) {
    console.log('🔄 Profilo non disponibile, ricarico da Firestore...');
    try {
      await caricaProfiloUtente(currentUser.uid);
      userProfile = getUserProfile();
      
      if (!userProfile) {
        console.warn('⚠️ Impossibile caricare il profilo utente');
        alert('⚠️ Impossibile caricare il profilo utente. Riprova più tardi.');
        return;
      }
    } catch (error) {
      console.error('❌ Errore nel caricamento del profilo:', error);
      alert('❌ Errore nel caricamento del profilo utente');
      return;
    }
  }
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('userProfileModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'userProfileModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 95%;
    max-height: 95%;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    position: relative;
    min-width: 400px;
    width: 100%;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--accent-color, #2f6b2f);
  `;
  
  const title = document.createElement('h2');
  title.textContent = '👤 Scheda Utente';
  title.style.cssText = `
    margin: 0;
    color: var(--accent-color, #2f6b2f);
    font-size: 1.5rem;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => modal.remove();
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Form
  const form = document.createElement('form');
  form.style.cssText = `
    display: grid;
    gap: 15px;
    grid-template-columns: 1fr 1fr;
  `;
  
  form.innerHTML = `
    <div>
      <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-primary);">Nome *</label>
      <input type="text" id="userNome" value="${userProfile?.nome || ''}" 
             style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);" required>
    </div>
    
    <div>
      <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-primary);">Cognome *</label>
      <input type="text" id="userCognome" value="${userProfile?.cognome || ''}" 
             style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);" required>
    </div>
    
    <div>
      <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-primary);">Email *</label>
      <input type="email" id="userEmail" value="${userProfile?.email || ''}" readonly
             style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-secondary); color: var(--text-primary);">
    </div>
    
    <div>
      <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-primary);">Telefono *</label>
      <input type="tel" id="userTelefono" value="${userProfile?.telefono || ''}" 
             style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);" required>
    </div>
    
    <div>
      <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-primary);">Gruppo *</label>
      <select id="userGruppo" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);" required>
        <option value="">Seleziona Gruppo</option>
        <option value="TO1" ${userProfile?.gruppo === 'TO1' ? 'selected' : ''}>TO1</option>
        <option value="TO2" ${userProfile?.gruppo === 'TO2' ? 'selected' : ''}>TO2</option>
        <option value="TO3" ${userProfile?.gruppo === 'TO3' ? 'selected' : ''}>TO3</option>
        <option value="TO4" ${userProfile?.gruppo === 'TO4' ? 'selected' : ''}>TO4</option>
        <option value="Gassino" ${userProfile?.gruppo === 'Gassino' ? 'selected' : ''}>Gassino</option>
        <option value="Chivasso" ${userProfile?.gruppo === 'Chivasso' ? 'selected' : ''}>Chivasso</option>
        <option value="San Mauro" ${userProfile?.gruppo === 'San Mauro' ? 'selected' : ''}>San Mauro</option>
      </select>
    </div>
    
    <div>
      <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-primary);">Ruolo *</label>
      <select id="userRuolo" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);" required>
        <option value="">Seleziona Ruolo</option>
        <option value="Senior" ${userProfile?.ruolo === 'Senior' ? 'selected' : ''}>Senior</option>
        <option value="SiSB" ${userProfile?.ruolo === 'SiSB' ? 'selected' : ''}>SiSB</option>
        <option value="SiSR" ${userProfile?.ruolo === 'SiSR' ? 'selected' : ''}>SiSR</option>
        <option value="VCB" ${userProfile?.ruolo === 'VCB' ? 'selected' : ''}>VCB</option>
        <option value="VCR" ${userProfile?.ruolo === 'VCR' ? 'selected' : ''}>VCR</option>
        <option value="CB" ${userProfile?.ruolo === 'CB' ? 'selected' : ''}>CB</option>
        <option value="CR" ${userProfile?.ruolo === 'CR' ? 'selected' : ''}>CR</option>
        <option value="CC" ${userProfile?.ruolo === 'CC' ? 'selected' : ''}>CC</option>
        <option value="CG" ${userProfile?.ruolo === 'CG' ? 'selected' : ''}>CG</option>
        <option value="COS" ${userProfile?.ruolo === 'COS' ? 'selected' : ''}>COS</option>
      </select>
    </div>
    
    <div style="grid-column: 1 / -1;">
      <h3 style="margin: 20px 0 10px 0; color: #2f6b2f; border-top: 2px solid var(--border-light); padding-top: 20px;">🔐 Cambia Password</h3>
      <div style="display: grid; gap: 15px; margin-bottom: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-primary);">Password Attuale *</label>
          <div style="position: relative;">
            <input type="password" id="currentPassword" placeholder="Inserisci la password attuale" 
                   style="width: 100%; padding: 10px 40px 10px 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);">
            <button type="button" id="toggleCurrentPassword" 
                    style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 16px; color: #666;">
              👁️
            </button>
          </div>
        </div>
        
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-primary);">Nuova Password *</label>
          <div style="position: relative;">
            <input type="password" id="newPassword" placeholder="Minimo 6 caratteri" 
                   style="width: 100%; padding: 10px 40px 10px 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);">
            <button type="button" id="toggleNewPassword" 
                    style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 16px; color: #666;">
              👁️
            </button>
          </div>
        </div>
        
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: 500; color: var(--text-primary);">Conferma Nuova Password *</label>
          <div style="position: relative;">
            <input type="password" id="confirmNewPassword" placeholder="Reinserisci la nuova password" 
                   style="width: 100%; padding: 10px 40px 10px 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);">
            <button type="button" id="toggleConfirmPassword" 
                    style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 16px; color: #666;">
              👁️
            </button>
          </div>
        </div>
        
        <button id="changePasswordBtn" 
                style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; width: 100%;">
          🔄 Cambia Password
        </button>
        
        <div id="passwordChangeMessage" style="display: none; padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 14px;"></div>
      </div>
    </div>
    
    <div style="grid-column: 1 / -1;">
      <h3 style="margin: 20px 0 10px 0; color: #2f6b2f;">🔔 Preferenze Notifiche</h3>
      <div style="display: grid; gap: 10px; grid-template-columns: 1fr 1fr;">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="notifNewStructures" ${userProfile?.preferenzeNotifiche?.newStructures ? 'checked' : ''}>
          Nuove strutture
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="notifStructureUpdates" ${userProfile?.preferenzeNotifiche?.structureUpdates ? 'checked' : ''}>
          Aggiornamenti strutture
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="notifPersonalList" ${userProfile?.preferenzeNotifiche?.personalListUpdates ? 'checked' : ''}>
          Aggiornamenti elenco personale
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="notifNearby" ${userProfile?.preferenzeNotifiche?.nearbyStructures ? 'checked' : ''}>
          Strutture nelle vicinanze
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="notifReports" ${userProfile?.preferenzeNotifiche?.reports ? 'checked' : ''}>
          Report e statistiche
        </label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label for="notifDistance">Distanza notifiche (km):</label>
          <input type="number" id="notifDistance" value="${userProfile?.preferenzeNotifiche?.distance || 10}" min="1" max="100" style="width: 80px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
      </div>
    </div>
  `;
  
  // Footer con pulsanti
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    gap: 10px;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid var(--border-light);
    justify-content: flex-end;
  `;
  
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '💾 Salva Profilo';
  saveBtn.style.cssText = `
    background: var(--success-color, #28a745);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  saveBtn.onclick = async () => {
    await salvaProfiloUtente();
    modal.remove();
  };
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '❌ Annulla';
  cancelBtn.style.cssText = `
    background: var(--secondary-color, #6c757d);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  cancelBtn.onclick = () => modal.remove();
  
  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = '🚪 Logout';
  logoutBtn.style.cssText = `
    background: var(--danger-color, #dc3545);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    margin-left: auto;
  `;
  logoutBtn.onclick = async () => {
    if (confirm('Sei sicuro di voler effettuare il logout?')) {
      await logoutUser();
      modal.remove();
    }
  };
  
  footer.appendChild(saveBtn);
  footer.appendChild(cancelBtn);
  footer.appendChild(logoutBtn);
  
  // Assembla il modal
  modalContent.appendChild(header);
  modalContent.appendChild(form);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Toggle visualizzazione password per cambio password
  document.getElementById('toggleCurrentPassword').addEventListener('click', () => {
    const passwordInput = document.getElementById('currentPassword');
    const toggleBtn = document.getElementById('toggleCurrentPassword');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      passwordInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });
  
  document.getElementById('toggleNewPassword').addEventListener('click', () => {
    const passwordInput = document.getElementById('newPassword');
    const toggleBtn = document.getElementById('toggleNewPassword');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      passwordInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });
  
  document.getElementById('toggleConfirmPassword').addEventListener('click', () => {
    const passwordInput = document.getElementById('confirmNewPassword');
    const toggleBtn = document.getElementById('toggleConfirmPassword');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      passwordInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });
  
  // Cambio password
  document.getElementById('changePasswordBtn').onclick = async () => {
    const messageDiv = document.getElementById('passwordChangeMessage');
    messageDiv.style.display = 'none';
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      messageDiv.textContent = '⚠️ Compila tutti i campi';
      messageDiv.style.display = 'block';
      messageDiv.style.background = '#f8d7da';
      messageDiv.style.color = '#721c24';
      messageDiv.style.border = '1px solid #f5c6cb';
      return;
    }
    
    if (newPassword.length < 6) {
      messageDiv.textContent = '⚠️ La nuova password deve essere di almeno 6 caratteri';
      messageDiv.style.display = 'block';
      messageDiv.style.background = '#f8d7da';
      messageDiv.style.color = '#721c24';
      messageDiv.style.border = '1px solid #f5c6cb';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      messageDiv.textContent = '⚠️ Le password non corrispondono';
      messageDiv.style.display = 'block';
      messageDiv.style.background = '#f8d7da';
      messageDiv.style.color = '#721c24';
      messageDiv.style.border = '1px solid #f5c6cb';
      return;
    }
    
    try {
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.email) {
        messageDiv.textContent = '❌ Utente non autenticato';
        messageDiv.style.display = 'block';
        messageDiv.style.background = '#f8d7da';
        messageDiv.style.color = '#721c24';
        messageDiv.style.border = '1px solid #f5c6cb';
        return;
      }
      
      // Verifica che l'utente non sia loggato con Google
      if (currentUser.providerData && currentUser.providerData.some(provider => provider.providerId === 'google.com')) {
        messageDiv.textContent = '⚠️ Gli utenti loggati con Google non possono cambiare la password qui';
        messageDiv.style.display = 'block';
        messageDiv.style.background = '#fff3cd';
        messageDiv.style.color = '#856404';
        messageDiv.style.border = '1px solid #ffeeba';
        return;
      }
      
      // Re-autentica l'utente con la password corrente
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // Aggiorna la password
      await updatePassword(currentUser, newPassword);
      
      messageDiv.textContent = '✅ Password cambiata con successo!';
      messageDiv.style.display = 'block';
      messageDiv.style.background = '#d4edda';
      messageDiv.style.color = '#155724';
      messageDiv.style.border = '1px solid #c3e6cb';
      
      // Pulisci i campi
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmNewPassword').value = '';
      
      console.log('✅ Password cambiata con successo');
      
    } catch (error) {
      console.error('❌ Errore cambio password:', error);
      let errorMessage = '❌ Errore nel cambio password';
      
      switch (error.code) {
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorMessage = '⚠️ Password attuale non corretta';
          break;
        case 'auth/weak-password':
          errorMessage = '⚠️ La nuova password è troppo debole';
          break;
        case 'auth/requires-recent-login':
          errorMessage = '⚠️ Per sicurezza, effettua nuovamente il login prima di cambiare la password';
          break;
      }
      
      messageDiv.textContent = errorMessage;
      messageDiv.style.display = 'block';
      messageDiv.style.background = '#f8d7da';
      messageDiv.style.color = '#721c24';
      messageDiv.style.border = '1px solid #f5c6cb';
    }
  };
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function salvaProfiloUtente() {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      alert('❌ Errore: utente non autenticato');
      return;
    }
    
    // 🔒 Validazione server-side
    if (!await validateServerAuth()) {
      alert('❌ Sessione non valida. Effettua nuovamente il login.');
      return;
    }
    
    const nome = document.getElementById('userNome').value.trim();
    const cognome = document.getElementById('userCognome').value.trim();
    const telefono = document.getElementById('userTelefono').value.trim();
    const gruppo = document.getElementById('userGruppo').value;
    const ruolo = document.getElementById('userRuolo').value;
    
    if (!nome || !cognome || !telefono || !gruppo || !ruolo) {
      alert('⚠️ Compila tutti i campi obbligatori');
      return;
    }
    
    // Ottieni il profilo corrente (o creane uno nuovo se non esiste)
    let userProfile = getUserProfile();
    
    // Se il profilo non esiste, caricalo da Firestore o creane uno nuovo
    if (!userProfile) {
      console.log('🔄 Profilo non disponibile, ricarico da Firestore...');
      await caricaProfiloUtente(currentUser.uid);
      userProfile = getUserProfile();
      
      // Se ancora non esiste, crea un profilo base
      if (!userProfile) {
        userProfile = {
          nome: currentUser.displayName || currentUser.email.split('@')[0],
          cognome: '',
          email: currentUser.email,
          telefono: '',
          gruppo: '',
          ruolo: '',
          dataCreazione: new Date().toISOString(),
          elencoPersonale: [],
          preferenzeNotifiche: {
            newStructures: true,
            structureUpdates: true,
            personalListUpdates: true,
            nearbyStructures: false,
            reports: true,
            distance: 10
          }
        };
      }
    }
    
    // Crea nuovo profilo aggiornato
    const updatedProfile = {
      ...userProfile,
      nome: nome,
      cognome: cognome,
      telefono: telefono,
      gruppo: gruppo,
      ruolo: ruolo,
      email: currentUser.email, // Mantieni sempre l'email corrente
      preferenzeNotifiche: {
        newStructures: document.getElementById('notifNewStructures')?.checked ?? (userProfile.preferenzeNotifiche?.newStructures ?? true),
        structureUpdates: document.getElementById('notifStructureUpdates')?.checked ?? (userProfile.preferenzeNotifiche?.structureUpdates ?? true),
        personalListUpdates: document.getElementById('notifPersonalList')?.checked ?? (userProfile.preferenzeNotifiche?.personalListUpdates ?? true),
        nearbyStructures: document.getElementById('notifNearby')?.checked ?? (userProfile.preferenzeNotifiche?.nearbyStructures ?? false),
        reports: document.getElementById('notifReports')?.checked ?? (userProfile.preferenzeNotifiche?.reports ?? true),
        distance: parseInt(document.getElementById('notifDistance')?.value) || (userProfile.preferenzeNotifiche?.distance ?? 10)
      },
      ultimoAggiornamento: new Date().toISOString()
    };
    
    // Salva in Firestore PRIMA di aggiornare lo stato locale
    const userDocRef = doc(db, 'users', currentUser.uid);
    await secureFirestoreOperation(setDoc, userDocRef, updatedProfile);
    
    console.log('✅ Profilo utente salvato su Firestore:', updatedProfile);
    
    // Aggiorna lo stato locale DOPO il salvataggio
    updateAuthState(currentUser, updatedProfile);
    
    console.log('✅ Profilo utente aggiornato nello stato locale');
    alert('✅ Profilo salvato con successo!');
    
    // Chiudi il modale dopo il salvataggio
    const modal = document.getElementById('userProfileModal');
    if (modal) {
      modal.remove();
    }
    
  } catch (error) {
    console.error('❌ Errore salvataggio profilo:', error);
    console.error('Dettagli errore:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    alert('❌ Errore nel salvataggio del profilo: ' + error.message);
  }
}

function mostraSchermataLogin() {
  // Nascondi il contenuto principale
  const main = document.querySelector('main');
  const header = document.querySelector('header');
  if (main) main.style.display = 'none';
  if (header) header.style.display = 'none';
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('loginModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'loginModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #2f6b2f 0%, #28a745 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 16px;
    padding: 40px;
    max-width: 95%;
    width: 90%;
    min-width: 320px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    text-align: center;
  `;
  
  modalContent.innerHTML = `
    <div style="margin-bottom: 30px;">
      <h1 style="color: #2f6b2f; margin: 0 0 10px 0; font-size: 2rem;">🏕️ QuoVadiScout</h1>
      <p style="color: #666; margin: 0;">Strutture e Terreni per Scout</p>
    </div>
    
    <div id="loginForm" style="margin-bottom: 20px;">
      <input type="email" id="loginEmail" placeholder="Email" 
             style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; margin-bottom: 15px; box-sizing: border-box;">
      
      <div style="position: relative; margin-bottom: 20px;">
        <input type="password" id="loginPassword" placeholder="Password" 
               style="width: 100%; padding: 15px 50px 15px 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
        <button type="button" id="toggleLoginPassword" 
                style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 18px; color: #666;">
          👁️
        </button>
      </div>
      
      <button id="loginBtn" 
              style="background: #28a745; color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; margin-bottom: 15px;">
        🔑 Accedi
      </button>
      
      <button id="googleLoginBtn" 
              style="background: #4285f4; color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; margin-bottom: 15px;">
        🌐 Accedi con Google
      </button>
      
      <button id="showRegisterBtn" 
              style="background: transparent; color: #666; border: 1px solid #ddd; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; margin-bottom: 10px;">
        📝 Crea Account
      </button>
      
      <button id="forgotPasswordBtn" 
              style="background: transparent; color: #007bff; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 14px; width: 100%; text-decoration: underline;">
        🔑 Password dimenticata?
      </button>
    </div>
    
    <div id="registerForm" style="margin-bottom: 20px; display: none;">
      <input type="text" id="registerNome" placeholder="Nome *" 
             style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; margin-bottom: 15px; box-sizing: border-box;" required>
      
      <input type="text" id="registerCognome" placeholder="Cognome *" 
             style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; margin-bottom: 15px; box-sizing: border-box;" required>
      
      <input type="email" id="registerEmail" placeholder="Email *" 
             style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; margin-bottom: 15px; box-sizing: border-box;" required>
      
      <input type="tel" id="registerTelefono" placeholder="Telefono *" 
             style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; margin-bottom: 15px; box-sizing: border-box;" required>
      
      <div style="position: relative; margin-bottom: 15px;">
        <input type="password" id="registerPassword" placeholder="Password (min. 6 caratteri) *" 
               style="width: 100%; padding: 15px 50px 15px 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; box-sizing: border-box;" required>
        <button type="button" id="toggleRegisterPassword" 
                style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 18px; color: #666;">
          👁️
        </button>
      </div>
      
      <select id="registerGruppo" 
              style="width: 100%; padding: 15px; border: 2px solid var(--border-medium); border-radius: 8px; font-size: 16px; margin-bottom: 15px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);" required>
        <option value="">Seleziona Gruppo *</option>
        <option value="TO1">TO1</option>
        <option value="TO2">TO2</option>
        <option value="TO3">TO3</option>
        <option value="TO4">TO4</option>
        <option value="Gassino">Gassino</option>
        <option value="Chivasso">Chivasso</option>
        <option value="San Mauro">San Mauro</option>
      </select>
      
      <select id="registerRuolo" 
              style="width: 100%; padding: 15px; border: 2px solid var(--border-medium); border-radius: 8px; font-size: 16px; margin-bottom: 20px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary);" required>
        <option value="">Seleziona Ruolo *</option>
        <option value="Senior">Senior</option>
        <option value="SiSB">SiSB</option>
        <option value="SiSR">SiSR</option>
        <option value="VCB">VCB</option>
        <option value="VCR">VCR</option>
        <option value="CB">CB</option>
        <option value="CR">CR</option>
        <option value="CC">CC</option>
        <option value="CG">CG</option>
        <option value="COS">COS</option>
      </select>
      
      <button id="registerBtn" 
              style="background: #007bff; color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; margin-bottom: 15px;">
        ✨ Registrati
      </button>
      
      <button id="showLoginBtn" 
              style="background: transparent; color: #666; border: 1px solid #ddd; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%;">
        ← Torna al Login
      </button>
    </div>
    
    <div id="resetPasswordForm" style="margin-bottom: 20px; display: none;">
      <h3 style="color: #2f6b2f; margin-bottom: 15px;">🔑 Recupero Password</h3>
      <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
        Inserisci la tua email e ti invieremo un link per reimpostare la password.
      </p>
      
      <input type="email" id="resetEmail" placeholder="Email" 
             style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; margin-bottom: 15px; box-sizing: border-box;">
      
      <button id="resetPasswordBtn" 
              style="background: #007bff; color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; margin-bottom: 15px;">
        📧 Invia Link di Recupero
      </button>
      
      <button id="backToLoginBtn" 
              style="background: transparent; color: #666; border: 1px solid #ddd; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%;">
        ← Torna al Login
      </button>
    </div>
    
    <div id="loadingMessage" style="display: none; color: #28a745; font-weight: bold;">
      <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #28a745; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px;"></div>
      Caricamento...
    </div>
    
    <div id="errorMessage" style="display: none; color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin-top: 20px;"></div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Aggiungi CSS per animazione
  if (!document.getElementById('authStyles')) {
    const style = document.createElement('style');
    style.id = 'authStyles';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Event listeners
  setupAuthEventListeners();
}

function setupAuthEventListeners() {
  // Toggle tra login e registrazione
  document.getElementById('showRegisterBtn').onclick = () => {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    hideError();
  };
  
  document.getElementById('showLoginBtn').onclick = () => {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('resetPasswordForm').style.display = 'none';
    hideError();
  };
  
  // Password dimenticata
  document.getElementById('forgotPasswordBtn').onclick = () => {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('resetPasswordForm').style.display = 'block';
    hideError();
  };
  
  // Login con email/password
  document.getElementById('loginBtn').onclick = async () => {
    try {
      const email = InputSanitizer.sanitizeEmail(document.getElementById('loginEmail').value);
      const password = document.getElementById('loginPassword').value;
      
      if (!email || !password) {
        showError('⚠️ Inserisci email e password');
        return;
      }
      
      await loginWithEmail(email, password);
    } catch (error) {
      showError('⚠️ Email non valida');
    }
  };
  
  // Registrazione
  document.getElementById('registerBtn').onclick = async () => {
    try {
      const nome = InputSanitizer.sanitizeNome(document.getElementById('registerNome').value);
      const cognome = InputSanitizer.sanitizeNome(document.getElementById('registerCognome').value);
      const email = InputSanitizer.sanitizeEmail(document.getElementById('registerEmail').value);
      const telefono = document.getElementById('registerTelefono').value;
      const gruppo = document.getElementById('registerGruppo').value;
      const ruolo = document.getElementById('registerRuolo').value;
      const password = document.getElementById('registerPassword').value;
      
      if (!nome || !cognome || !email || !telefono || !gruppo || !ruolo || !password) {
        showError('⚠️ Compila tutti i campi obbligatori');
        return;
      }
      
      // Validazione password robusta
      const passwordCheck = validatePasswordStrength(password);
      if (!passwordCheck.valid) {
        const feedback = passwordCheck.feedback.join('\n');
        showError(`⚠️ Password troppo debole:\n${feedback}`);
        return;
      }
      
      await registerWithEmail(nome, cognome, email, telefono, gruppo, ruolo, password);
    } catch (error) {
      showError('⚠️ Dati non validi. Controlla i campi inseriti.');
    }
  };
  
  // Login con Google
  document.getElementById('googleLoginBtn').onclick = async () => {
    await loginWithGoogle();
  };
  
  // Enter per login
  document.getElementById('loginPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('loginBtn').click();
    }
  });
  
  // Toggle visualizzazione password login
  document.getElementById('toggleLoginPassword').addEventListener('click', () => {
    const passwordInput = document.getElementById('loginPassword');
    const toggleBtn = document.getElementById('toggleLoginPassword');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      passwordInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });
  
  // Toggle visualizzazione password registrazione
  document.getElementById('toggleRegisterPassword').addEventListener('click', () => {
    const passwordInput = document.getElementById('registerPassword');
    const toggleBtn = document.getElementById('toggleRegisterPassword');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      passwordInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });
  
  // Back to login dal reset password
  document.getElementById('backToLoginBtn').onclick = () => {
    document.getElementById('resetPasswordForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    hideError();
  };
  
  // Reset password
  document.getElementById('resetPasswordBtn').onclick = async () => {
    try {
      const email = InputSanitizer.sanitizeEmail(document.getElementById('resetEmail').value);
      
      if (!email) {
        showError('⚠️ Inserisci un indirizzo email valido');
        return;
      }
      
      showLoading(true);
      hideError();
      
      await sendPasswordResetEmail(auth, email);
      
      // Mostra messaggio di successo
      const errorDiv = document.getElementById('errorMessage');
      errorDiv.textContent = '✅ Email di recupero inviata! Controlla la tua casella di posta e segui le istruzioni per reimpostare la password.';
      errorDiv.style.display = 'block';
      errorDiv.style.color = '#155724';
      errorDiv.style.background = '#d4edda';
      errorDiv.style.border = '1px solid #c3e6cb';
      
      // Torna al login dopo 3 secondi
      setTimeout(() => {
        document.getElementById('resetPasswordForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('resetEmail').value = '';
        hideError();
      }, 3000);
      
    } catch (error) {
      console.error('❌ Errore recupero password:', error);
      let errorMessage = '❌ Errore nell\'invio dell\'email di recupero';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = '⚠️ Nessun account trovato con questa email';
          break;
        case 'auth/invalid-email':
          errorMessage = '⚠️ Indirizzo email non valido';
          break;
        case 'auth/too-many-requests':
          errorMessage = '⚠️ Troppi tentativi, riprova più tardi';
          break;
      }
      
      showError(errorMessage);
    } finally {
      showLoading(false);
    }
  };
}

async function loginWithEmail(email, password) {
  try {
    
    // 1. Verifica se account è bloccato (Rate Limiting)
    const blocked = loginSecurity.isBlocked(email);
    if (blocked.blocked) {
      showError(blocked.reason);
      return;
    }
    
    showLoading(true);
    hideError();
    
    // 2. Tentativo login Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Login riuscito:', userCredential.user.email);
    
    // 3. Successo - reset tentativi falliti
    loginSecurity.recordSuccess(email);
    
    // La UI si aggiornerà automaticamente tramite onAuthStateChanged
    
  } catch (error) {
    console.error('❌ Errore login:', error);
    
    // 4. Record tentativo fallito
    const result = loginSecurity.recordFailedAttempt(email);
    
    let errorMessage = '❌ Credenziali non valide';
    
    // Messaggi generici per evitare enumerazione utenti
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        // Messaggio generico per non rivelare quale campo è errato
        errorMessage = '❌ Credenziali non valide. Verifica email e password. Se il problema persiste, controlla che: 1) L\'autenticazione sia abilitata nel progetto Firebase, 2) Le credenziali Firebase siano corrette, 3) Il dominio sia autorizzato.';
        break;
      case 'auth/invalid-email':
        errorMessage = '❌ Email non valida';
        break;
      case 'auth/too-many-requests':
        errorMessage = '❌ Troppi tentativi, riprova più tardi';
        break;
      case 'auth/user-disabled':
        errorMessage = '❌ Account disabilitato';
        break;
    }
    
    // Se il blocco è stato attivato, mostra quel messaggio
    if (result.blocked) {
      errorMessage = result.reason;
    }
    
    showError(errorMessage);
  } finally {
    showLoading(false);
  }
}

async function registerWithEmail(nome, cognome, email, telefono, gruppo, ruolo, password) {
  try {
    showLoading(true);
    hideError();
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Aggiorna il profilo con il nome
    await userCredential.user.updateProfile({
      displayName: nome
    });
    
    // Crea profilo utente completo
    const userProfile = {
      nome: nome,
      cognome: cognome,
      email: email,
      telefono: telefono,
      gruppo: gruppo,
      ruolo: ruolo,
      dataCreazione: new Date().toISOString(),
      elencoPersonale: [],
      preferenzeNotifiche: {
        newStructures: true,
        structureUpdates: true,
        personalListUpdates: true,
        nearbyStructures: false,
        reports: true,
        distance: 10
      }
    };
    
    // Salva profilo in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
    
    console.log('✅ Registrazione riuscita:', userCredential.user.email);
    console.log('✅ Profilo utente creato con tutti i campi');
    
  } catch (error) {
    console.error('❌ Errore registrazione:', error);
    let errorMessage = 'Errore durante la registrazione';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = '❌ Email già in uso';
        break;
      case 'auth/weak-password':
        errorMessage = '❌ Password troppo debole';
        break;
      case 'auth/invalid-email':
        errorMessage = '❌ Email non valida';
        break;
    }
    
    showError(errorMessage);
  } finally {
    showLoading(false);
  }
}

async function loginWithGoogle() {
  try {
    showLoading(true);
    hideError();
    
    const result = await signInWithPopup(auth, googleProvider);
    console.log('✅ Login Google riuscito:', result.user.email);
    
    // La UI si aggiornerà automaticamente tramite onAuthStateChanged
    
  } catch (error) {
    console.error('❌ Errore login Google:', error);
    
    if (error.code === 'auth/popup-closed-by-user') {
      showError('❌ Login annullato');
    } else {
      showError('❌ Errore durante il login con Google');
    }
  } finally {
    showLoading(false);
  }
}

async function logoutUser() {
  try {
    // Salva l'elenco personale SOLO in localStorage (nessuna operazione Firestore)
    const currentUser = getCurrentUser();
    const userProfile = getUserProfile();
    
    if (currentUser && userProfile && elencoPersonale) {
      // Salva in localStorage come backup
      localStorage.setItem(`elenco_personale_${currentUser.uid}`, JSON.stringify(elencoPersonale));
      console.log('✅ Elenco personale salvato in localStorage');
    }
    
    // 🔒 Pulisci stato di autenticazione
    updateAuthState(null);
    
    // Effettua il logout
    await signOut(auth);
    console.log('✅ Logout riuscito');
    
    // La UI si aggiornerà automaticamente tramite onAuthStateChanged
    
  } catch (error) {
    console.error('❌ Errore logout:', error);
    alert('Errore durante il logout');
  }
}

function showLoading(show) {
  const loading = document.getElementById('loadingMessage');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const googleBtn = document.getElementById('googleLoginBtn');
  
  if (loading) loading.style.display = show ? 'block' : 'none';
  if (loginBtn) loginBtn.disabled = show;
  if (registerBtn) registerBtn.disabled = show;
  if (googleBtn) googleBtn.disabled = show;
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

function hideError() {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

// Funzioni rimosse - ora gestite da Firebase Auth

// === Gestione Errori UI ===
function safeUpdateElement(elementId, updateFunction) {
  const element = document.getElementById(elementId);
  if (element) {
    try {
      updateFunction(element);
    } catch (error) {
      console.warn(`⚠️ Errore aggiornamento elemento ${elementId}:`, error.message);
    }
  } else {
    console.warn(`⚠️ Elemento ${elementId} non trovato`);
  }
}

function safeQuerySelector(selector, updateFunction) {
  const element = document.querySelector(selector);
  if (element) {
    try {
      updateFunction(element);
    } catch (error) {
      console.warn(`⚠️ Errore aggiornamento elemento ${selector}:`, error.message);
    }
  } else {
    console.warn(`⚠️ Elemento ${selector} non trovato`);
  }
}

function aggiornaUIUtente() {
  const userBtn = document.getElementById('userBtn');
  if (!userBtn) {
    console.warn('⚠️ Pulsante utente non trovato');
    return;
  }
  
  const userIcon = userBtn.querySelector('.user-icon') || userBtn.querySelector('.user-avatar');
  const userName = userBtn.querySelector('.user-name');
  
  const currentUser = getCurrentUser();
  const userProfile = getUserProfile();
  
  if (currentUser) {
    const displayName = userProfile?.nome || currentUser.displayName || currentUser.email.split('@')[0];
    if (userName) userName.textContent = displayName;
    if (userIcon) userIcon.textContent = '👤';
    userBtn.title = `Utente: ${displayName} (${elencoPersonale.length} strutture) - Clicca per disconnetterti`;
    
    // Rimuovi stili personalizzati per mantenere lo stile standard del menu
    userBtn.style.background = '';
    userBtn.style.color = '';
    userBtn.style.borderColor = '';
  } else {
    if (userName) userName.textContent = 'Accedi';
    if (userIcon) userIcon.textContent = '🔑';
    userBtn.title = 'Accedi o registrati';
    
    // Rimuovi stili personalizzati per mantenere lo stile standard del menu
    userBtn.style.background = '';
    userBtn.style.color = '';
    userBtn.style.borderColor = '';
  }
}

function caricaElencoPersonaleUtente() {
  const userProfile = getUserProfile();
  const currentUser = getCurrentUser();
  
  if (userProfile) {
    elencoPersonale = userProfile.elencoPersonale || [];
  } else if (currentUser) {
    // Prova a caricare dal localStorage come backup
    try {
      const backupElenco = localStorage.getItem(`elenco_personale_${currentUser.uid}`);
      if (backupElenco) {
        elencoPersonale = JSON.parse(backupElenco);
        console.log('✅ Elenco personale ripristinato da localStorage');
      } else {
        elencoPersonale = [];
      }
    } catch (error) {
      console.warn('⚠️ Errore caricamento elenco da localStorage:', error);
      elencoPersonale = [];
    }
  } else {
    elencoPersonale = [];
  }
}

async function salvaElencoPersonaleUtente() {
  const currentUser = getCurrentUser();
  const userProfile = getUserProfile();
  
  if (currentUser && userProfile) {
    try {
      // Salva sempre in localStorage come backup
      localStorage.setItem(`elenco_personale_${currentUser.uid}`, JSON.stringify(elencoPersonale));
      
      // 🔒 Validazione server-side
      if (!await validateServerAuth()) {
        console.warn('🔒 Sessione non valida per salvataggio elenco personale');
        return;
      }
      
      // Aggiorna il profilo locale
      userProfile.elencoPersonale = elencoPersonale;
      
      // Salva su Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);
      await secureFirestoreOperation(updateDoc, userDocRef, {
        elencoPersonale: elencoPersonale,
        ultimoAggiornamento: new Date().toISOString()
      });
      
      console.log('✅ Elenco personale salvato su Firestore');
    } catch (error) {
      console.error('❌ Errore salvataggio elenco personale:', error);
      // L'elenco è già salvato in localStorage, quindi non è critico
    }
  }
}

function cambiaUtente() {
  const currentUser = getCurrentUser();
  if (currentUser) {
    // Mostra scheda utente completa
    mostraSchedaUtente();
  } else {
    // Se non c'è utente, mostra direttamente la schermata di login
    mostraSchermataLogin();
  }
}

function mostraModaleProfiloUtente() {
  // Chiudi il menu automaticamente
  closeMenu();
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('profiloUtenteModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'profiloUtenteModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.3s ease-out;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.style.cssText = `
    background: var(--bg-primary, white);
    border-radius: 12px;
    padding: 0;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1));
    animation: slideUp 0.3s ease-out;
    position: relative;
  `;
  
  // Carica dati utente dal localStorage
  const profiloUtente = JSON.parse(localStorage.getItem('userProfile') || '{}');
  const preferenzeNotifiche = JSON.parse(localStorage.getItem('notificationPreferences') || '{}');
  const provinciaPreferita = localStorage.getItem('preferredProvince') || '';
  
  // Ottieni province uniche dal database
  const provinceNelDB = [...new Set(strutture.map(s => s.Prov).filter(p => p))].sort();
  
  const currentUser = getCurrentUser();
  const userProfile = getUserProfile();
  const displayName = userProfile?.nome || currentUser?.displayName || currentUser?.email?.split('@')[0];
  
  modalContent.innerHTML = `
    <!-- Header -->
    <div style="position: sticky; top: 0; background: var(--bg-primary, white); border-radius: 12px 12px 0 0; padding: 20px; border-bottom: 1px solid var(--border-color, #e5e7eb); z-index: 10;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; color: var(--text-primary, #1f2937); font-size: 1.5rem; font-weight: 600;">👤 Profilo Utente</h2>
        <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary, #6b7280); padding: 8px; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;" onmouseover="this.style.background='var(--bg-secondary, #f3f4f6)'" onmouseout="this.style.background='none'">×</button>
      </div>
    </div>
    
    <!-- Contenuto -->
    <div style="padding: 20px;">
      <!-- Informazioni Profilo -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--text-primary, #374151); margin-bottom: 16px; font-size: 1.1rem; font-weight: 600;">📋 Informazioni Profilo</h3>
        
        <div style="display: grid; gap: 12px;">
          <div>
            <label style="display: block; margin-bottom: 4px; color: var(--text-secondary, #6b7280); font-size: 0.875rem; font-weight: 500;">Nome</label>
            <input type="text" id="userNome" value="${profiloUtente.nome || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #1f2937); font-size: 1rem;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 4px; color: var(--text-secondary, #6b7280); font-size: 0.875rem; font-weight: 500;">Cognome</label>
            <input type="text" id="userCognome" value="${profiloUtente.cognome || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #1f2937); font-size: 1rem;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 4px; color: var(--text-secondary, #6b7280); font-size: 0.875rem; font-weight: 500;">Email</label>
            <input type="email" id="userEmail" value="${getCurrentUser().email || ''}" readonly style="width: 100%; padding: 10px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; background: var(--bg-disabled, #f3f4f6); color: var(--text-secondary, #6b7280); font-size: 1rem;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 4px; color: var(--text-secondary, #6b7280); font-size: 0.875rem; font-weight: 500;">Cellulare</label>
            <input type="tel" id="userCell" value="${profiloUtente.cell || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #1f2937); font-size: 1rem;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 4px; color: var(--text-secondary, #6b7280); font-size: 0.875rem; font-weight: 500;">Gruppo</label>
            <select id="userGruppo" style="width: 100%; padding: 10px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #1f2937); font-size: 1rem;">
              <option value="">Seleziona gruppo</option>
              <option value="TO1" ${profiloUtente.gruppo === 'TO1' ? 'selected' : ''}>TO1</option>
              <option value="TO2" ${profiloUtente.gruppo === 'TO2' ? 'selected' : ''}>TO2</option>
              <option value="TO3" ${profiloUtente.gruppo === 'TO3' ? 'selected' : ''}>TO3</option>
              <option value="TO4" ${profiloUtente.gruppo === 'TO4' ? 'selected' : ''}>TO4</option>
              <option value="Gassino" ${profiloUtente.gruppo === 'Gassino' ? 'selected' : ''}>Gassino</option>
              <option value="Chivasso" ${profiloUtente.gruppo === 'Chivasso' ? 'selected' : ''}>Chivasso</option>
              <option value="San Mauro" ${profiloUtente.gruppo === 'San Mauro' ? 'selected' : ''}>San Mauro</option>
            </select>
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 4px; color: var(--text-secondary, #6b7280); font-size: 0.875rem; font-weight: 500;">Ruolo</label>
            <select id="userRuolo" style="width: 100%; padding: 10px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #1f2937); font-size: 1rem;">
              <option value="">Seleziona ruolo</option>
              <option value="SiSB" ${profiloUtente.ruolo === 'SiSB' ? 'selected' : ''}>SiSB</option>
              <option value="SiSR" ${profiloUtente.ruolo === 'SiSR' ? 'selected' : ''}>SiSR</option>
              <option value="VCB" ${profiloUtente.ruolo === 'VCB' ? 'selected' : ''}>VCB</option>
              <option value="VCR" ${profiloUtente.ruolo === 'VCR' ? 'selected' : ''}>VCR</option>
              <option value="CB" ${profiloUtente.ruolo === 'CB' ? 'selected' : ''}>CB</option>
              <option value="CR" ${profiloUtente.ruolo === 'CR' ? 'selected' : ''}>CR</option>
              <option value="CC" ${profiloUtente.ruolo === 'CC' ? 'selected' : ''}>CC</option>
            </select>
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 4px; color: var(--text-secondary, #6b7280); font-size: 0.875rem; font-weight: 500;">Provincia di Ricerca Preferita</label>
            <select id="preferredProvince" style="width: 100%; padding: 10px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #1f2937); font-size: 1rem;">
              <option value="">Nessuna</option>
              ${provinceNelDB.map(prov => `<option value="${prov}" ${provinciaPreferita === prov ? 'selected' : ''}>${prov}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      
      <!-- Preferenze Notifiche -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--text-primary, #374151); margin-bottom: 16px; font-size: 1.1rem; font-weight: 600;">🔔 Preferenze Notifiche</h3>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--bg-secondary, #f9fafb); border-radius: 12px; border: 1px solid var(--border-color, #e5e7eb);">
            <div style="flex: 1; margin-right: 12px;">
              <div style="font-weight: 500; color: var(--text-primary, #1f2937); margin-bottom: 4px;">🏕️ Nuove Strutture</div>
              <div style="font-size: 0.875rem; color: var(--text-secondary, #6b7280);">Notifica quando viene aggiunta una nuova struttura</div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
              <input type="checkbox" id="newStructures" ${preferenzeNotifiche.newStructures !== false ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
              <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #d1d5db; border-radius: 24px; transition: 0.3s;"></span>
              <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s;"></span>
            </label>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--bg-secondary, #f9fafb); border-radius: 12px; border: 1px solid var(--border-color, #e5e7eb);">
            <div style="flex: 1; margin-right: 12px;">
              <div style="font-weight: 500; color: var(--text-primary, #1f2937); margin-bottom: 4px;">📝 Aggiornamenti Strutture</div>
              <div style="font-size: 0.875rem; color: var(--text-secondary, #6b7280);">Notifica quando una struttura viene modificata</div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
              <input type="checkbox" id="structureUpdates" ${preferenzeNotifiche.structureUpdates !== false ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
              <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #d1d5db; border-radius: 24px; transition: 0.3s;"></span>
              <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s;"></span>
            </label>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--bg-secondary, #f9fafb); border-radius: 12px; border: 1px solid var(--border-color, #e5e7eb);">
            <div style="flex: 1; margin-right: 12px;">
              <div style="font-weight: 500; color: var(--text-primary, #1f2937); margin-bottom: 4px;">📍 Strutture Vicine</div>
              <div style="font-size: 0.875rem; color: var(--text-secondary, #6b7280);">Notifica strutture nelle vicinanze</div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
              <input type="checkbox" id="nearbyStructures" ${preferenzeNotifiche.nearbyStructures !== false ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
              <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #d1d5db; border-radius: 24px; transition: 0.3s;"></span>
              <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s;"></span>
            </label>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 20px; border-top: 1px solid var(--border-color, #e5e7eb);">
        <button id="salvaProfiloBtn" style="background: var(--primary, #2f6b2f); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 500;">
          💾 Salva Modifiche
        </button>
        <button id="logoutBtn" style="background: #dc3545; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 500;">
          🚪 Logout
        </button>
      </div>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Event listeners
  document.getElementById('salvaProfiloBtn').onclick = () => {
    salvaProfiloUtente();
    modal.remove();
  };
  
  document.getElementById('logoutBtn').onclick = async () => {
    modal.remove();
    await logoutUser();
  };
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // CSS per toggle switches
  const style = document.createElement('style');
  style.textContent = `
    #profiloUtenteModal input[type="checkbox"]:checked + span {
      background-color: var(--primary, #2f6b2f) !important;
    }
    #profiloUtenteModal input[type="checkbox"]:checked + span + span {
      transform: translateX(20px);
    }
  `;
  document.head.appendChild(style);
}

// Funzione salvaProfiloUtente rimossa - duplicata, mantenuta solo la versione async alla riga 4426

function nascondiSchermataLogin() {
  // Mostra il contenuto principale
  const main = document.querySelector('main');
  const header = document.querySelector('header');
  if (main) main.style.display = 'block';
  if (header) header.style.display = 'flex';
  
  // Rimuovi modal di login
  const loginModal = document.getElementById('loginModal');
  if (loginModal) {
    loginModal.remove();
  }
}

// Funzioni globali rimosse - ora gestite da Firebase Auth

// === Elenco personale ===
let elencoPersonale = [];

function aggiungiAllElenco(id) {
  if (!elencoPersonale.includes(id)) {
    elencoPersonale.push(id);
    salvaElencoPersonaleUtente();
    aggiornaContatoreElenco();
  }
}

function rimuoviDallElenco(id) {
  elencoPersonale = elencoPersonale.filter(item => item !== id);
  salvaElencoPersonaleUtente();
  aggiornaContatoreElenco();
}

function aggiornaContatoreElenco() {
  // Aggiorna contatore principale
  safeUpdateElement('contatore-elenco', (element) => {
    element.textContent = elencoPersonale.length;
  });
  
  // Aggiorna badge nel menu
  safeQuerySelector('.menu-badge', (element) => {
    element.textContent = elencoPersonale.length;
  });
  
  // Aggiorna anche l'UI utente per riflettere il nuovo numero di strutture
  aggiornaUIUtente();
}

// === Gestione Elenco Personale ===
async function esportaElencoPersonale() {
  console.log('📤 Avvio esportazione elenco personale...');
  console.log('📋 Strutture in elenco personale:', elencoPersonale.length);
  
  if (elencoPersonale.length === 0) {
    alert('❌ L\'elenco personale è vuoto. Aggiungi alcune strutture prima di esportare.');
    return;
  }
  
  await mostraGestioneElencoPersonale();
}

async function mostraGestioneElencoPersonale() {
  console.log('📋 Apertura gestione elenco personale...');
  const struttureElenco = strutture.filter(s => elencoPersonale.includes(s.id));
  console.log('📊 Strutture trovate:', struttureElenco.length);
  
  // Carica le note personali per tutte le strutture dell'elenco
  await loadPersonalNotesForElenco(struttureElenco);
  
  // Nascondi la scheda utente se è aperta
  const userModal = document.getElementById('userProfileModal');
  if (userModal) {
    userModal.remove();
  }
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('gestioneElencoModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'gestioneElencoModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 95%;
    max-height: 95%;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    position: relative;
    min-width: 320px;
    width: 100%;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--border-light);
  `;
  
  const title = document.createElement('h2');
  title.textContent = `📋 Elenco Personale`;
  title.style.cssText = `
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  `;
  
  // Toggle visualizzazione per elenco personale
  const headerActions = document.createElement('div');
  headerActions.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'modalViewToggle';
  toggleBtn.className = 'btn-view-toggle';
  toggleBtn.innerHTML = `
    <span class="view-icon">📄</span>
    <span class="view-label">Schede</span>
  `;
  toggleBtn.title = 'Cambia visualizzazione';
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => modal.remove();
  
  headerActions.appendChild(toggleBtn);
  headerActions.appendChild(closeBtn);
  
  header.appendChild(title);
  header.appendChild(headerActions);
  
  // Contenuto principale
  const content = document.createElement('div');
  content.style.cssText = `
    margin-bottom: 20px;
  `;
  
  if (struttureElenco.length === 0) {
    content.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #6c757d;">
        <div style="font-size: 3rem; margin-bottom: 20px;">📝</div>
        <h3>Elenco personale vuoto</h3>
        <p>Non hai ancora aggiunto strutture al tuo elenco personale.</p>
        <p>Clicca sulla stella ⭐ nelle schede delle strutture per aggiungerle.</p>
      </div>
    `;
  } else {
    // Lista strutture
    const listaContainer = document.createElement('div');
    listaContainer.className = 'lista-container';
    listaContainer.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 10px;
    `;
    
    // Funzione per creare elementi dell'elenco
    const createElencoItem = (struttura, isListMode) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'item-div';
      
      if (isListMode) {
        // Modalità elenco - layout compatto
        itemDiv.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          margin-bottom: 8px;
          background: var(--bg-secondary);
          border-radius: 6px;
          border: 1px solid var(--border-light);
        `;
        
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `flex: 1;`;
        // Controlla se ci sono note personali
        const hasNotes = struttura.personalNotes && struttura.personalNotes.length > 0;
        const notesCount = hasNotes ? struttura.personalNotes.length : 0;
        const latestNote = hasNotes ? struttura.personalNotes[0] : null;
        
        infoDiv.innerHTML = `
          <div style="font-weight: bold; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            ${struttura.Struttura || 'Senza nome'}
            ${hasNotes ? `<span style="background: var(--accent); color: var(--text-inverse); padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;">📝 ${notesCount}</span>` : ''}
          </div>
          <div style="font-size: 0.9rem; color: var(--text-secondary);">
            📍 ${struttura.Luogo || 'N/A'}, ${struttura.Prov || 'N/A'}
            ${struttura.Referente ? ` | 👤 ${struttura.Referente}` : ''}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
            ${struttura.Casa ? '🏠 Casa' : ''} ${struttura.Terreno ? '🌱 Terreno' : ''}
            ${!struttura.Casa && !struttura.Terreno ? '❓ Senza categoria' : ''}
          </div>
          ${hasNotes && latestNote ? `
          <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px; padding: 6px; background: var(--bg-tertiary); border-radius: 4px; border-left: 3px solid var(--accent);">
            <strong style="color: var(--text-primary);">📝 Ultima nota:</strong> ${latestNote.nota.length > 80 ? latestNote.nota.substring(0, 80) + '...' : latestNote.nota}
            <div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 2px;">
              ${latestNote.createdAt.toLocaleDateString('it-IT')} alle ${latestNote.createdAt.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}
            </div>
          </div>` : ''}
        `;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions-div';
        actionsDiv.style.cssText = `
          display: flex;
          gap: 8px;
          align-items: center;
        `;
        
        const viewBtn = document.createElement('button');
        viewBtn.innerHTML = '👁️';
        viewBtn.title = 'Visualizza scheda completa';
        viewBtn.style.cssText = `
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          border-radius: 4px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 14px;
        `;
        viewBtn.onclick = () => {
          modal.remove();
          mostraSchedaCompleta(struttura.id);
        };
        
        const notesBtn = document.createElement('button');
        notesBtn.innerHTML = '📝';
        notesBtn.title = 'Note personali';
        notesBtn.style.cssText = `
          background: var(--accent);
          color: var(--text-inverse);
          border: none;
          border-radius: 4px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 14px;
        `;
        notesBtn.onclick = () => {
          mostraNotePersonali(struttura.id);
        };
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '🗑️';
        removeBtn.title = 'Rimuovi dall\'elenco';
        removeBtn.style.cssText = `
          background: var(--danger);
          color: var(--text-inverse);
          border: none;
          border-radius: 4px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 14px;
        `;
        removeBtn.onclick = async () => {
          rimuoviDallElenco(struttura.id);
          modal.remove();
          await mostraGestioneElencoPersonale();
        };
        
        actionsDiv.appendChild(viewBtn);
        actionsDiv.appendChild(notesBtn);
        actionsDiv.appendChild(removeBtn);
        
        itemDiv.appendChild(infoDiv);
        itemDiv.appendChild(actionsDiv);
        
      } else {
        // Modalità schede - layout verticale completo
        itemDiv.style.cssText = `
          display: flex;
          flex-direction: column;
          padding: 16px;
          margin-bottom: 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
        `;
        
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        `;
        
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
          font-weight: bold;
          color: var(--text-primary);
          font-size: 1.1rem;
          cursor: pointer;
        `;
        titleDiv.textContent = struttura.Struttura || 'Senza nome';
        titleDiv.onclick = () => {
          modal.remove();
          mostraSchedaCompleta(struttura.id);
        };
        
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = `
          display: flex;
          gap: 8px;
        `;
        
        const viewBtn = document.createElement('button');
        viewBtn.innerHTML = '👁️ Visualizza';
        viewBtn.title = 'Visualizza scheda completa';
        viewBtn.style.cssText = `
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          border-radius: 6px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 12px;
        `;
        viewBtn.onclick = () => {
          modal.remove();
          mostraSchedaCompleta(struttura.id);
        };
        
        const notesBtn = document.createElement('button');
        notesBtn.innerHTML = '📝 Note';
        notesBtn.title = 'Note personali';
        notesBtn.style.cssText = `
          background: var(--accent);
          color: var(--text-inverse);
          border: none;
          border-radius: 6px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 12px;
        `;
        notesBtn.onclick = () => {
          modal.remove();
          mostraNotePersonali(struttura.id);
        };
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '🗑️ Rimuovi';
        removeBtn.title = 'Rimuovi dall\'elenco';
        removeBtn.style.cssText = `
          background: var(--danger);
          color: var(--text-inverse);
          border: none;
          border-radius: 6px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 12px;
        `;
        removeBtn.onclick = async () => {
          rimuoviDallElenco(struttura.id);
          modal.remove();
          await mostraGestioneElencoPersonale();
        };
        
        actionsDiv.appendChild(viewBtn);
        actionsDiv.appendChild(notesBtn);
        actionsDiv.appendChild(removeBtn);
        
        headerDiv.appendChild(titleDiv);
        headerDiv.appendChild(actionsDiv);
        
        // Controlla se ci sono note personali
        const hasNotes = struttura.personalNotes && struttura.personalNotes.length > 0;
        const notesCount = hasNotes ? struttura.personalNotes.length : 0;
        const latestNote = hasNotes ? struttura.personalNotes[0] : null;
        
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = `
          <div style="margin-bottom: 8px; color: var(--text-secondary);">
            📍 ${struttura.Luogo || 'N/A'}, ${struttura.Prov || 'N/A'}
            ${hasNotes ? `<span style="background: var(--accent); color: var(--text-inverse); padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; margin-left: 8px;">📝 ${notesCount} note</span>` : ''}
          </div>
          ${struttura.Referente ? `<div style="margin-bottom: 8px; color: var(--text-secondary);">
            👤 <strong style="color: var(--text-primary);">Referente:</strong> ${struttura.Referente}
          </div>` : ''}
          ${struttura.Contatto ? `<div style="margin-bottom: 8px; color: var(--text-secondary);">
            📞 <strong style="color: var(--text-primary);">Contatto:</strong> ${struttura.Contatto}
          </div>` : ''}
          <div style="margin-bottom: 8px;">
            ${struttura.Casa ? '<span style="background: var(--primary-light); color: var(--primary); padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">🏠 Casa</span>' : ''}
            ${struttura.Terreno ? '<span style="background: var(--primary-light); color: var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 12px;">🌱 Terreno</span>' : ''}
          </div>
          ${hasNotes && latestNote ? `
          <div style="margin-bottom: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: 6px; border-left: 4px solid var(--accent);">
            <div style="font-size: 12px; font-weight: bold; color: var(--accent); margin-bottom: 4px;">📝 Ultima nota personale:</div>
            <div style="font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">
              ${latestNote.nota.length > 120 ? latestNote.nota.substring(0, 120) + '...' : latestNote.nota}
            </div>
            <div style="font-size: 11px; color: var(--text-tertiary);">
              ${latestNote.createdAt.toLocaleDateString('it-IT')} alle ${latestNote.createdAt.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}
              ${notesCount > 1 ? ` • ${notesCount - 1} altre note` : ''}
            </div>
          </div>` : ''}
          ${struttura.Info ? `<div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
            ${struttura.Info.length > 150 ? struttura.Info.substring(0, 150) + '...' : struttura.Info}
          </div>` : ''}
        `;
        
        itemDiv.appendChild(headerDiv);
        itemDiv.appendChild(contentDiv);
      }
      
      return itemDiv;
    };
    
    // Variabile per tracciare la modalità corrente del modale
    let modalListMode = false;
    
    // Genera gli elementi iniziali
    const generateElencoItems = () => {
      listaContainer.innerHTML = '';
      struttureElenco.forEach(struttura => {
        listaContainer.appendChild(createElencoItem(struttura, modalListMode));
      });
    };
    
    // Event listener per il toggle del modale
    toggleBtn.addEventListener('click', () => {
      modalListMode = !modalListMode;
      
      const viewIcon = toggleBtn.querySelector('.view-icon');
      const viewLabel = toggleBtn.querySelector('.view-label');
      
      if (modalListMode) {
        viewIcon.textContent = '📄';
        viewLabel.textContent = 'Schede';
        toggleBtn.classList.add('active');
      } else {
        viewIcon.textContent = '📋';
        viewLabel.textContent = 'Elenco';
        toggleBtn.classList.remove('active');
      }
      
      generateElencoItems();
    });
    
    // Genera gli elementi iniziali
    generateElencoItems();
    
    if (content && listaContainer) {
      content.appendChild(listaContainer);
    }
  }
  
  // Footer con azioni
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 15px;
    border-top: 1px solid var(--border-light);
    gap: 10px;
  `;
  
  const leftActions = document.createElement('div');
  leftActions.style.cssText = `display: flex; gap: 10px;`;
  
  const clearAllBtn = document.createElement('button');
  clearAllBtn.innerHTML = '🧹 Svuota Elenco';
  clearAllBtn.style.cssText = `
    background: #ffc107;
    color: #212529;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  clearAllBtn.onclick = async () => {
    if (confirm('Sei sicuro di voler svuotare completamente l\'elenco personale?')) {
      elencoPersonale = [];
      salvaElencoPersonaleUtente();
      aggiornaContatoreElenco();
      modal.remove();
      await mostraGestioneElencoPersonale();
    }
  };
  
  const rightActions = document.createElement('div');
  rightActions.style.cssText = `display: flex; gap: 10px;`;
  
  const exportBtn = document.createElement('button');
  exportBtn.innerHTML = '📤 Esporta';
  exportBtn.style.cssText = `
    background: #28a745;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  exportBtn.disabled = struttureElenco.length === 0;
  exportBtn.onclick = async () => {
    console.log('📤 Pulsante esportazione cliccato');
    console.log('📊 Strutture da esportare:', struttureElenco.length);
    
    if (struttureElenco.length > 0) {
      console.log('✅ Rimuovo modal e apro menu esportazione');
      modal.remove();
      await mostraMenuEsportazione(struttureElenco);
    } else {
      console.log('❌ Nessuna struttura da esportare');
    }
  };
  
  const printBtn = document.createElement('button');
  printBtn.innerHTML = '🖨️ Stampa';
  printBtn.style.cssText = `
    background: #17a2b8;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  printBtn.disabled = struttureElenco.length === 0;
  printBtn.onclick = async () => {
    if (struttureElenco.length > 0) {
      await stampaElenco(struttureElenco);
      modal.remove();
    }
  };
  
  leftActions.appendChild(clearAllBtn);
  rightActions.appendChild(printBtn);
  rightActions.appendChild(exportBtn);
  
  footer.appendChild(leftActions);
  footer.appendChild(rightActions);
  
  modalContent.appendChild(header);
  modalContent.appendChild(content);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function mostraMenuEsportazione(struttureElenco) {
  console.log('📋 Apertura menu esportazione...');
  console.log('📊 Strutture ricevute:', struttureElenco.length);
  
  // Usa direttamente la funzione unificata, passando l'elenco personale
  if (typeof window.mostraOpzioniEsportazione === 'function') {
    window.mostraOpzioniEsportazione(struttureElenco, { forcePersonalList: true });
  } else {
    console.error('Funzione mostraOpzioniEsportazione non trovata');
    alert('Funzione di export non disponibile');
  }
}

// Funzione per export generale (tutte le strutture) - definita più sotto

async function stampaElenco(struttureElenco) {
  // Carica le note personali per tutte le strutture
  await loadPersonalNotesForElenco(struttureElenco);
  
  const printWindow = window.open('', '_blank');
  const printContent = generaContenutoStampa(struttureElenco);
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.print();
}

function generaContenutoStampa(struttureElenco) {
  const data = new Date().toLocaleDateString('it-IT');
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Elenco Personale Strutture - ${data}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2f6b2f; border-bottom: 2px solid #2f6b2f; padding-bottom: 10px; }
        .struttura { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .struttura h3 { color: #2f6b2f; margin: 0 0 10px 0; }
        .info { margin: 5px 0; }
        .tags { margin: 10px 0; }
        .tag { display: inline-block; background: #f0f6ef; padding: 4px 8px; margin: 2px; border-radius: 12px; font-size: 12px; }
        .tag.casa { background: #e8f4fd; color: #1e5a8a; }
        .tag.terreno { background: #f0f9f0; color: #2d5a2d; }
        @media print { body { margin: 0; } .struttura { page-break-inside: avoid; } }
      </style>
    </head>
    <body>
      <h1>Elenco Personale Strutture</h1>
      <p><strong>Data:</strong> ${data} | <strong>Totale:</strong> ${struttureElenco.length} strutture</p>
      
      ${struttureElenco.map(s => `
        <div class="struttura">
          <h3>${s.Struttura || 'Senza nome'}</h3>
          <div class="info"><strong>📍 Luogo:</strong> ${s.Luogo || 'Non specificato'}, ${s.Prov || 'Provincia non specificata'}</div>
          ${s.Referente ? `<div class="info"><strong>👤 Referente:</strong> ${s.Referente}</div>` : ''}
          ${s.Contatto || s.Email ? `<div class="info"><strong>📞 Contatti:</strong> ${s.Contatto || s.Email}</div>` : ''}
          ${s.Info ? `<div class="info"><strong>ℹ️ Info:</strong> ${s.Info}</div>` : ''}
          ${s.personalNotes && s.personalNotes.length > 0 ? `
          <div class="info">
            <strong>📝 Note personali (${s.personalNotes.length}):</strong>
            ${s.personalNotes.map(nota => `
              <div style="margin: 5px 0; padding: 8px; background: #f8f9fa; border-left: 3px solid #28a745; border-radius: 4px;">
                <div style="font-size: 14px; margin-bottom: 4px;">${nota.nota}</div>
                <div style="font-size: 12px; color: #6c757d;">${nota.createdAt.toLocaleDateString('it-IT')} alle ${nota.createdAt.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}</div>
              </div>
            `).join('')}
          </div>` : ''}
          <div class="tags">
            ${s.Casa ? '<span class="tag casa">🏠 Casa</span>' : ''}
            ${s.Terreno ? '<span class="tag terreno">🌱 Terreno</span>' : ''}
            ${s.personalNotes && s.personalNotes.length > 0 ? `<span class="tag" style="background: #d4edda; color: #155724;">📝 ${s.personalNotes.length} note</span>` : ''}
          </div>
        </div>
      `).join('')}
    </body>
    </html>
  `;
}

// === Scheda Completa Struttura (Visualizzazione + Modifica) ===
let modalScheda = null;
let isEditMode = false;

async function mostraSchedaCompleta(strutturaId) {
  const struttura = strutture.find(s => s.id === strutturaId);
  if (!struttura) {
    console.error('Struttura non trovata:', strutturaId);
    return;
  }

  // Track analytics
  if (window.analyticsManager) {
    window.analyticsManager.trackStructureView(strutturaId, struttura.Struttura, 'modal');
  }
  
  // Trigger evento per preloading predittivo
  document.dispatchEvent(new CustomEvent('cardOpened', {
    detail: { structureId: strutturaId }
  }));
  
  const isNewStructure = strutturaId.startsWith('new_');
  
  // Rimuovi modal esistente se presente
  if (modalScheda) {
    modalScheda.remove();
  }
  
  // Crea modal per scheda completa
  modalScheda = document.createElement('div');
  modalScheda.id = 'schedaCompletaModal';
  modalScheda.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 95%;
    max-height: 95%;
    min-width: 320px;
    width: 100%;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
    position: relative;
    border: 1px solid var(--border-light);
  `;
  
  // Header con titolo e controlli
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--border-light);
  `;
  
  const title = document.createElement('h2');
  title.textContent = isNewStructure ? '📋 Nuova Struttura' : `📋 Scheda: ${struttura.Struttura || 'Senza nome'}`;
  title.style.cssText = `
    margin: 0;
    color: var(--accent-color, #2f6b2f);
    font-size: 1.5rem;
  `;
  
  const controls = document.createElement('div');
  controls.style.cssText = `
    display: flex;
    gap: 10px;
    align-items: center;
  `;
  
  const editBtn = document.createElement('button');
  editBtn.innerHTML = isNewStructure ? '✏️ Compila' : '✏️ Modifica';
  editBtn.style.cssText = `
    background: var(--primary-color, #007bff);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  `;
  editBtn.onclick = () => toggleEditMode();
  
  const saveBtn = document.createElement('button');
  saveBtn.innerHTML = isNewStructure ? '💾 Crea' : '💾 Salva';
  saveBtn.style.cssText = `
    background: var(--success-color, #28a745);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    display: none;
  `;
  saveBtn.onclick = () => salvaModificheScheda(strutturaId);
  
  const cancelBtn = document.createElement('button');
  cancelBtn.innerHTML = '❌ Annulla';
  cancelBtn.style.cssText = `
    background: var(--secondary-color, #6c757d);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    display: none;
  `;
  cancelBtn.onclick = () => {
    if (isNewStructure) {
      // Rimuovi la struttura temporanea e chiudi il modal
      const index = strutture.findIndex(s => s.id === strutturaId);
      if (index !== -1) {
        strutture.splice(index, 1);
        // Aggiorna le strutture globali
        window.strutture = strutture;
      }
      modalScheda.remove();
    } else {
      toggleEditMode();
    }
  };
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '← Indietro';
  closeBtn.style.cssText = `
    background: var(--secondary-color, #6c757d);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => {
    if (isNewStructure) {
      // Rimuovi la struttura temporanea
      const index = strutture.findIndex(s => s.id === strutturaId);
      if (index !== -1) {
        strutture.splice(index, 1);
        // Aggiorna le strutture globali
        window.strutture = strutture;
      }
    }
    modalScheda.remove();
  };
  
  const mapBtn = document.createElement('button');
  mapBtn.innerHTML = '🗺️ Vedi su mappa';
  mapBtn.style.cssText = `
    background: var(--primary-color, #007bff);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  `;
  mapBtn.onclick = () => {
    // Chiudi la scheda
    modalScheda.remove();
    // Apri la mappa
    mostraMappa();
    // Centra sulla struttura (aumentato timeout per inizializzazione completa)
    setTimeout(() => {
      centerMapOnStructure(strutturaId);
    }, 1500);
  };
  
  controls.appendChild(editBtn);
  controls.appendChild(mapBtn);
  controls.appendChild(saveBtn);
  controls.appendChild(cancelBtn);
  controls.appendChild(closeBtn);
  
  header.appendChild(title);
  header.appendChild(controls);
  
  // Galleria immagini
  const galleryContainer = document.createElement('div');
  galleryContainer.id = 'imageGallery';
  galleryContainer.style.cssText = `
    margin-bottom: 20px;
    border-radius: 8px;
    overflow: hidden;
  `;
  
  // Contenuto scheda
  const content = document.createElement('div');
  content.id = 'schedaContent';
  content.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  `;
  
  // Funzione per creare la galleria immagini
  async function creaGalleriaImmagini() {
    galleryContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
        <h3 style="margin: 0; color: var(--text-primary); font-size: 1.1rem;">📸 Galleria Immagini</h3>
        ${isEditMode ? `
          <div style="display: flex; gap: 8px;">
            <input type="file" id="imageUpload" accept="image/*" multiple style="display: none;">
            <button onclick="document.getElementById('imageUpload').click()" style="background: var(--primary); color: var(--text-inverse); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
              📷 Aggiungi Foto
            </button>
          </div>
        ` : ''}
      </div>
      <div id="galleryGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; min-height: 60px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 0.9rem;">
          Caricamento immagini...
        </div>
      </div>
    `;
    
    // Carica immagini esistenti
    await caricaImmaginiEsistenti();
    
    // Event listener per upload
    if (isEditMode) {
      const fileInput = document.getElementById('imageUpload');
      fileInput.addEventListener('change', handleImageUpload);
    }
  }
  
  async function caricaImmaginiEsistenti() {
    const galleryGrid = document.getElementById('galleryGrid');
    
    if (!galleryGrid) {
      console.warn('⚠️ GalleryGrid non trovato, skip caricamento immagini');
      return;
    }
    
    try {
      // Carica galleria da MediaManager
      const images = await window.mediaManager?.getGallery(strutturaId) || [];
      
      if (images.length === 0) {
        galleryGrid.innerHTML = `
          <div style="grid-column: 1/-1; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 0.9rem; padding: 20px;">
            ${isEditMode ? 'Nessuna immagine. Clicca "Aggiungi Foto" per iniziare.' : 'Nessuna immagine disponibile.'}
          </div>
        `;
        return;
      }
      
      galleryGrid.innerHTML = images.map(img => `
        <div style="position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onclick="if(typeof apriLightbox === 'function') apriLightbox('${img.id}'); else console.warn('apriLightbox non disponibile')">
          <img src="${img.thumbnailUrl || img.url}" 
               alt="${img.name || 'Immagine struttura'}" 
               loading="lazy"
               width="300" height="300"
               style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s;"
               onmouseover="this.style.transform='scale(1.05)'"
               onmouseout="this.style.transform='scale(1)'"
               onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00NSA0NUg3NVY3NUg0NVY0NVoiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2Zz4K'">
          ${isEditMode ? `
            <button onclick="event.stopPropagation(); eliminaImmagine('${img.id}')" 
                    style="position: absolute; top: 4px; right: 4px; background: rgba(220,53,69,0.9); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;">
              ×
            </button>
          ` : ''}
          ${img.geoData?.lat ? `
            <div style="position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.7); color: white; padding: 2px 4px; border-radius: 3px; font-size: 8px;">
              📍 GPS
            </div>
          ` : ''}
        </div>
      `).join('');
      
    } catch (error) {
      console.error('❌ Errore caricamento galleria:', error);
      if (galleryGrid) {
        galleryGrid.innerHTML = `
          <div style="grid-column: 1/-1; display: flex; align-items: center; justify-content: center; color: var(--danger); font-size: 0.9rem; padding: 20px;">
            Errore nel caricamento delle immagini
          </div>
        `;
      }
    }
  }
  
  async function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    const galleryGrid = document.getElementById('galleryGrid');
    
    // Mostra indicatore di caricamento
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = `
      grid-column: 1/-1; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      color: var(--text-primary); 
      font-size: 0.9rem; 
      padding: 20px;
    `;
    loadingDiv.innerHTML = `📤 Caricamento ${files.length} immagine/i...`;
    galleryGrid.appendChild(loadingDiv);
    
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          console.warn('⚠️ File non supportato:', file.name);
          continue;
        }
        
        // Upload immagine
        const uploadedImage = await window.mediaManager.uploadImage(file, strutturaId, {
          uploadedBy: window.getCurrentUser()?.uid || 'anonymous'
        });
        
        console.log('✅ Immagine caricata:', uploadedImage.id);
      }
      
      // Ricarica galleria
      await caricaImmaginiEsistenti();
      
      // Notifica successo
      window.showNotification('✅ Immagini caricate', {
        body: `${files.length} immagini aggiunte alla galleria`,
        tag: 'images-uploaded'
      });
      
    } catch (error) {
      console.error('❌ Errore upload immagini:', error);
      alert('Errore durante il caricamento delle immagini: ' + error.message);
      
      // Rimuovi indicatore di caricamento e ricarica
      loadingDiv.remove();
      await caricaImmaginiEsistenti();
    }
  }
  
  async function eliminaImmagine(imageId) {
    if (!confirm('Sei sicuro di voler eliminare questa immagine?')) {
      return;
    }
    
    try {
      await window.mediaManager.deleteImage(imageId, strutturaId);
      await caricaImmaginiEsistenti();
      
      window.showNotification('✅ Immagine eliminata', {
        body: 'L\'immagine è stata rimossa dalla galleria',
        tag: 'image-deleted'
      });
      
    } catch (error) {
      console.error('❌ Errore eliminazione immagine:', error);
      alert('Errore durante l\'eliminazione dell\'immagine: ' + error.message);
    }
  }
  
  // Esponi funzione globalmente per uso inline
  window.eliminaImmagine = eliminaImmagine;
  
  // Funzione per aprire lightbox
  function apriLightbox(imageId) {
    // Implementazione lightbox semplificata
    const lightbox = document.createElement('div');
    lightbox.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      padding: 20px;
    `;
    
    lightbox.innerHTML = `
      <div style="position: relative; max-width: 90%; max-height: 90%;">
        <img id="lightboxImage" src="" alt="Immagine" style="max-width: 100%; max-height: 100%; object-fit: contain;">
        <button onclick="this.closest('div').remove()" style="position: absolute; top: -40px; right: 0; background: none; border: none; color: white; font-size: 2rem; cursor: pointer;">×</button>
      </div>
    `;
    
    document.body.appendChild(lightbox);
    
    // Carica immagine full-size
    window.mediaManager.getGallery(strutturaId).then(images => {
      const image = images.find(img => img.id === imageId);
      if (image) {
        document.getElementById('lightboxImage').src = image.url;
      }
    });
    
    // Chiudi con ESC
    lightbox.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        lightbox.remove();
      }
    });
    
    // Focus per ricevere eventi tastiera
    lightbox.focus();
    lightbox.tabIndex = -1;
  }
  
  // Esponi funzione globalmente per uso inline
  window.apriLightbox = apriLightbox;
  
  // Funzione per creare il contenuto
  function creaContenutoScheda() {
    content.innerHTML = '';
    
    // Organizza i campi per categoria
    const categorie = {
      'Informazioni Principali': [
        'Struttura', 'Luogo', 'Indirizzo', 'Prov', 'Info'
      ],
      'Costi €': [
        'A persona', 'A giornata', 'A notte', 'Offerta', 'Forfait', 'Riscaldamento', 'Cucina', 'Altri costi', 'Altre info'
      ],
    'Caratteristiche Struttura': [
      'Terreno', 'Casa', 'Letti', 'Letti', 'Cucina', 'Cucina', 'Spazi', 'Spazi', 'Fuochi', 'Fuochi',
      'Hike', 'Hike', 'Trasporti', 'Altre info'
    ],
      'Adatto per': [
        'Branco', 'Reparto', 'Compagnia', 'Gruppo', 'Sezione'
      ],
      'Contatti': [
        'Referente', 'Email', 'Sito', 'Contatto', 'IIcontatto', 'Altre info'
      ],
      'Posizione Geografica': [
        'coordinate_lat', 'coordinate_lng', 'google_maps_link'
      ],
      'Gestione': [
        'Ultimo controllo', 'Da chi', 'stato'
      ],
      'Valutazioni': [
        'rating'
      ]
    };
    
    // Aggiungi campi per categoria
    Object.entries(categorie).forEach(([nomeCategoria, campi]) => {
      const categoriaDiv = document.createElement('div');
      categoriaDiv.style.cssText = `
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 15px;
        border-left: 4px solid var(--primary);
        border: 1px solid var(--border-light);
      `;
      
      const categoriaTitle = document.createElement('h3');
      categoriaTitle.textContent = nomeCategoria;
      categoriaTitle.style.cssText = `
        margin: 0 0 15px 0;
        color: var(--text-primary);
        font-size: 1.1rem;
      `;
      if (categoriaDiv && categoriaTitle) {
      categoriaDiv.appendChild(categoriaTitle);
    }
      
      // Traccia le occorrenze dei campi per gestire i duplicati
      const campoOccorrenze = {};
      
      campi.forEach(campo => {
        // Conta le occorrenze del campo
        campoOccorrenze[campo] = (campoOccorrenze[campo] || 0) + 1;
        const isSecondaOccorrenza = campoOccorrenze[campo] > 1;
        
        const campoDiv = document.createElement('div');
        campoDiv.style.cssText = `
          margin-bottom: 10px;
          padding: 8px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          border-radius: 4px;
          border: 1px solid var(--border-light);
        `;
        
        const label = document.createElement('strong');
        // Per i campi duplicati, aggiungi "info" alle etichette dei campi text
        const labelText = (['Letti', 'Cucina', 'Spazi', 'Fuochi', 'Hike'].includes(campo) && isSecondaOccorrenza) 
          ? `${campo} info: ` 
          : `${campo}: `;
        label.textContent = labelText;
        label.style.color = 'var(--text-primary)';
        
        if (isEditMode) {
          // Modalità modifica
          // Per i campi duplicati, la prima occorrenza è checkbox, la seconda è text
          const isCheckboxField = ['Terreno', 'Casa', 'Branco', 'Reparto', 'Compagnia', 'Gruppo', 'Sezione'].includes(campo) || 
                                 (['Letti', 'Cucina', 'Spazi', 'Fuochi', 'Hike'].includes(campo) && !isSecondaOccorrenza);
          const isGeoField = ['coordinate_lat', 'coordinate_lng'].includes(campo);
          const isUrlField = ['google_maps_link'].includes(campo);
          const isWebsiteField = campo === 'Sito';
          const isEmailField = campo === 'Email';
          const isPhoneField = ['Contatto', 'IIcontatto'].includes(campo);
          const isStateField = campo === 'stato';
          
          if (isCheckboxField) {
            // Campo checkbox
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = struttura[campo] === true || struttura[campo] === 'true' || struttura[campo] === 'Sì' || struttura[campo] === 'sì';
            input.style.cssText = `
              margin-left: 10px;
              transform: scale(1.2);
            `;
            input.onchange = (e) => {
              struttura[campo] = e.target.checked;
            };
            
            campoDiv.appendChild(label);
            campoDiv.appendChild(input);
          } else if (isStateField) {
            // Campo select per stato
            const select = document.createElement('select');
            select.style.cssText = `
              width: 100%;
              padding: 8px;
              border: 1px solid #ced4da;
              border-radius: 4px;
              background: var(--bg-primary);
              color: var(--text-primary);
              border: 1px solid var(--border-medium);
            `;
            
            const options = [
              { value: 'attiva', text: '🟢 Attiva' },
              { value: 'temporaneamente_non_attiva', text: '🟡 Temporaneamente non attiva' },
              { value: 'non_piu_attiva', text: '🔴 Non più attiva' }
            ];
            
            options.forEach(option => {
              const optionElement = document.createElement('option');
              optionElement.value = option.value;
              optionElement.textContent = option.text;
              if (struttura[campo] === option.value) {
                optionElement.selected = true;
              }
              select.appendChild(optionElement);
            });
            
            select.onchange = (e) => {
              struttura[campo] = e.target.value;
            };
            
            campoDiv.appendChild(label);
            campoDiv.appendChild(select);
          } else if (isGeoField) {
            // Campo numerico per coordinate
            const input = document.createElement('input');
            input.type = 'number';
            input.step = 'any';
            input.value = struttura[campo] || '';
            input.placeholder = campo === 'coordinate_lat' ? 'es. 45.123456' : 'es. 9.123456';
            input.style.cssText = `
              width: 100%;
              padding: 4px 8px;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              font-size: 14px;
              background: var(--bg-primary);
              color: var(--text-primary);
            `;
            input.onchange = (e) => {
              struttura[campo] = e.target.value ? parseFloat(e.target.value) : null;
            };
            
            campoDiv.appendChild(label);
            campoDiv.appendChild(input);
          } else if (isUrlField) {
            // Campo URL
            const input = document.createElement('input');
            input.type = 'url';
            input.value = struttura[campo] || '';
            input.placeholder = campo === 'google_maps_link' ? 'https://maps.google.com/...' : 'https://...';
            input.style.cssText = `
              width: 100%;
              padding: 4px 8px;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              font-size: 14px;
              background: var(--bg-primary);
              color: var(--text-primary);
            `;
            input.onchange = (e) => {
              struttura[campo] = e.target.value;
            };
            
            campoDiv.appendChild(label);
            campoDiv.appendChild(input);
          } else if (isWebsiteField) {
            // Campo sito web con pulsante
            const inputContainer = document.createElement('div');
            inputContainer.style.cssText = `
              display: flex;
              gap: 8px;
              align-items: center;
            `;
            
            const input = document.createElement('input');
            input.type = 'url';
            input.value = struttura[campo] || '';
            input.placeholder = 'https://www.esempio.com';
            input.style.cssText = `
              flex: 1;
              padding: 4px 8px;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              font-size: 14px;
              background: var(--bg-primary);
              color: var(--text-primary);
            `;
            input.onchange = (e) => {
              struttura[campo] = e.target.value;
            };
            
            const websiteBtn = document.createElement('button');
            websiteBtn.innerHTML = '🌐';
            websiteBtn.title = 'Apri sito web';
            websiteBtn.style.cssText = `
              background: var(--secondary-color, #6c757d);
              color: white;
              border: none;
              border-radius: 4px;
              padding: 6px 10px;
              cursor: pointer;
              font-size: 14px;
              transition: all 0.2s;
            `;
            websiteBtn.onclick = () => {
              if (struttura[campo] && struttura[campo].trim() !== '') {
                window.open(struttura[campo], '_blank');
              }
            };
            websiteBtn.onmouseover = () => {
              websiteBtn.style.backgroundColor = '#5a6268';
            };
            websiteBtn.onmouseout = () => {
              websiteBtn.style.backgroundColor = '#6c757d';
            };
            
            inputContainer.appendChild(input);
            inputContainer.appendChild(websiteBtn);
            
            campoDiv.appendChild(label);
            campoDiv.appendChild(inputContainer);
          } else if (isEmailField) {
            // Campo email con pulsante
            const inputContainer = document.createElement('div');
            inputContainer.style.cssText = `
              display: flex;
              gap: 8px;
              align-items: center;
            `;
            
            const input = document.createElement('input');
            input.type = 'email';
            input.value = struttura[campo] || '';
            input.placeholder = 'email@esempio.com';
            input.style.cssText = `
              flex: 1;
              padding: 4px 8px;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              font-size: 14px;
              background: var(--bg-primary);
              color: var(--text-primary);
            `;
            input.onchange = (e) => {
              struttura[campo] = e.target.value;
            };
            
            const emailBtn = document.createElement('button');
            emailBtn.innerHTML = '📧';
            emailBtn.title = 'Scrivi email';
            emailBtn.style.cssText = `
              background: var(--primary-color, #007bff);
              color: white;
              border: none;
              border-radius: 4px;
              padding: 6px 10px;
              cursor: pointer;
              font-size: 14px;
              transition: all 0.2s;
            `;
            emailBtn.onclick = () => {
              if (struttura[campo] && struttura[campo].trim() !== '') {
                const subject = encodeURIComponent(`Informazioni su ${struttura.Struttura || 'struttura'}`);
                const body = encodeURIComponent(`Ciao!\n\nSono interessato alla struttura "${struttura.Struttura || 'questa struttura'}" e vorrei avere maggiori informazioni.\n\nGrazie!`);
                window.open(`mailto:${struttura[campo]}?subject=${subject}&body=${body}`, '_blank');
              }
            };
            emailBtn.onmouseover = () => {
              emailBtn.style.backgroundColor = '#0056b3';
            };
            emailBtn.onmouseout = () => {
              emailBtn.style.backgroundColor = '#007bff';
            };
            
            inputContainer.appendChild(input);
            inputContainer.appendChild(emailBtn);
            
            campoDiv.appendChild(label);
            campoDiv.appendChild(inputContainer);
          } else if (isPhoneField) {
            // Campo telefono con pulsante WhatsApp
            const inputContainer = document.createElement('div');
            inputContainer.style.cssText = `
              display: flex;
              gap: 8px;
              align-items: center;
            `;
            
            const input = document.createElement('input');
            input.type = 'tel';
            input.value = struttura[campo] || '';
            input.placeholder = 'Numero di telefono';
            input.style.cssText = `
              flex: 1;
              padding: 4px 8px;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              font-size: 14px;
              background: var(--bg-primary);
              color: var(--text-primary);
            `;
            input.onchange = (e) => {
              struttura[campo] = e.target.value;
            };
            
            const whatsappBtn = document.createElement('button');
            whatsappBtn.innerHTML = '💬';
            whatsappBtn.title = 'Contatta via WhatsApp';
            whatsappBtn.style.cssText = `
              background: #25d366;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 6px 10px;
              cursor: pointer;
              font-size: 14px;
              transition: all 0.2s;
            `;
            whatsappBtn.onclick = () => {
              if (struttura[campo] && struttura[campo].trim() !== '') {
                const phone = struttura[campo].replace(/\D/g, '');
                const message = encodeURIComponent(`Ciao! Sono interessato alla struttura "${struttura.Struttura || 'questa struttura'}" e vorrei avere maggiori informazioni.`);
                window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
              }
            };
            whatsappBtn.onmouseover = () => {
              whatsappBtn.style.backgroundColor = '#128c7e';
            };
            whatsappBtn.onmouseout = () => {
              whatsappBtn.style.backgroundColor = '#25d366';
            };
            
            inputContainer.appendChild(input);
            inputContainer.appendChild(whatsappBtn);
            
            campoDiv.appendChild(label);
            campoDiv.appendChild(inputContainer);
          } else if (campo === 'rating') {
            // Gestione speciale per il rating - anche in modalità modifica
            const ratingDiv = document.createElement('div');
            ratingDiv.style.cssText = `
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 8px 0;
            `;
            
            const starsContainer = document.createElement('div');
            starsContainer.style.cssText = `
              display: flex;
              gap: 2px;
            `;
            
            const currentRating = struttura.rating?.average || 0;
            const totalVotes = struttura.rating?.count || 0;
            
            // Crea le stelle
            for (let i = 1; i <= 5; i++) {
              const star = document.createElement('span');
              star.style.cssText = `
                font-size: 20px;
                color: ${i <= currentRating ? '#ffc107' : '#e9ecef'};
                cursor: pointer;
                transition: color 0.2s;
              `;
              star.textContent = '★';
              star.title = `Vota ${i} stelle`;
              star.onclick = () => voteStructure(struttura.id, i);
              star.onmouseover = () => {
                star.style.color = '#ffc107';
              };
              star.onmouseout = () => {
                star.style.color = i <= currentRating ? '#ffc107' : '#e9ecef';
              };
              starsContainer.appendChild(star);
            }
            
            const ratingInfo = document.createElement('span');
            ratingInfo.textContent = ` (${currentRating.toFixed(1)}/5 - ${totalVotes} voti)`;
            ratingInfo.style.color = 'var(--text-secondary)';
            ratingInfo.style.fontSize = '14px';
            
            ratingDiv.appendChild(label);
            ratingDiv.appendChild(starsContainer);
            ratingDiv.appendChild(ratingInfo);
            
            campoDiv.appendChild(ratingDiv);
          } else {
            // Campo di testo normale
            const input = document.createElement('input');
            input.type = 'text';
            input.value = struttura[campo] || '';
            input.placeholder = 'Non specificato';
            input.style.cssText = `
              width: 100%;
              padding: 4px 8px;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              font-size: 14px;
              background: var(--bg-primary);
              color: var(--text-primary);
            `;
            input.onchange = (e) => {
              struttura[campo] = e.target.value;
            };
            
            campoDiv.appendChild(label);
            campoDiv.appendChild(input);
          }
        } else {
          // Modalità visualizzazione
          // Per i campi duplicati, la prima occorrenza è checkbox, la seconda è text
          const isCheckboxField = ['Terreno', 'Casa', 'Branco', 'Reparto', 'Compagnia', 'Gruppo', 'Sezione'].includes(campo) || 
                                 (['Letti', 'Cucina', 'Spazi', 'Fuochi', 'Hike'].includes(campo) && !isSecondaOccorrenza);
          
          if (campo === 'rating') {
            // Gestione speciale per il rating
            const ratingDiv = document.createElement('div');
            ratingDiv.style.cssText = `
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 8px 0;
            `;
            
            const ratingLabel = document.createElement('strong');
            ratingLabel.textContent = 'Rating: ';
            ratingLabel.style.color = 'var(--text-primary)';
            
            const starsContainer = document.createElement('div');
            starsContainer.style.cssText = `
              display: flex;
              gap: 2px;
            `;
            
            const currentRating = struttura.rating?.average || 0;
            const totalVotes = struttura.rating?.count || 0;
            
            // Crea le stelle
            for (let i = 1; i <= 5; i++) {
              const star = document.createElement('span');
              star.style.cssText = `
                font-size: 20px;
                color: ${i <= currentRating ? '#ffc107' : '#e9ecef'};
                cursor: pointer;
                transition: color 0.2s;
              `;
              star.textContent = '★';
              star.title = `Vota ${i} stelle`;
              star.onclick = () => voteStructure(struttura.id, i);
              star.onmouseover = () => {
                star.style.color = '#ffc107';
              };
              star.onmouseout = () => {
                star.style.color = i <= currentRating ? '#ffc107' : '#e9ecef';
              };
              starsContainer.appendChild(star);
            }
            
            const ratingInfo = document.createElement('span');
            ratingInfo.textContent = ` (${currentRating.toFixed(1)}/5 - ${totalVotes} voti)`;
            ratingInfo.style.color = 'var(--text-secondary)';
            ratingInfo.style.fontSize = '14px';
            
            ratingDiv.appendChild(ratingLabel);
            ratingDiv.appendChild(starsContainer);
            ratingDiv.appendChild(ratingInfo);
            
            campoDiv.appendChild(ratingDiv);
          } else if (campo === 'stato') {
            // Gestione speciale per lo stato
            const statoDiv = document.createElement('div');
            statoDiv.style.cssText = `
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 8px 0;
            `;
            
            const statoLabel = document.createElement('strong');
            statoLabel.textContent = 'Stato: ';
            statoLabel.style.color = 'var(--text-primary)';
            
            const statoValue = document.createElement('span');
            const stato = struttura[campo];
            
            if (stato) {
              let statoText = '';
              let statoColor = '';
              
              switch (stato) {
                case 'attiva':
                  statoText = '🟢 Attiva';
                  statoColor = '#28a745';
                  break;
                case 'temporaneamente_non_attiva':
                  statoText = '🟡 Temporaneamente non attiva';
                  statoColor = '#ffc107';
                  break;
                case 'non_piu_attiva':
                  statoText = '🔴 Non più attiva';
                  statoColor = '#dc3545';
                  break;
                default:
                  statoText = '❓ Stato sconosciuto';
                  statoColor = '#6c757d';
              }
              
              statoValue.textContent = statoText;
              statoValue.style.cssText = `
                color: ${statoColor};
                font-weight: 500;
                padding: 4px 8px;
                background: ${statoColor}20;
                border-radius: 4px;
                border: 1px solid ${statoColor};
              `;
            } else {
              statoValue.textContent = 'Non specificato';
              statoValue.style.cssText = `
                color: var(--text-secondary);
                font-style: italic;
              `;
            }
            
            statoDiv.appendChild(statoLabel);
            statoDiv.appendChild(statoValue);
            campoDiv.appendChild(statoDiv);
          } else if (campo === 'google_maps_link') {
            // Gestione speciale per il link Google Maps
            const linkDiv = document.createElement('div');
            linkDiv.style.cssText = `
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 8px 0;
            `;
            
            const linkLabel = document.createElement('strong');
            linkLabel.textContent = 'Google Maps: ';
            linkLabel.style.color = 'var(--text-primary)';
            
            const valore = struttura[campo];
            
            if (valore && valore.trim() !== '') {
              const link = document.createElement('a');
              link.href = valore;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.textContent = 'Apri su Google Maps';
              link.style.cssText = `
                color: #007bff;
                text-decoration: none;
                padding: 4px 8px;
                border: 1px solid #007bff;
                border-radius: 4px;
                font-size: 14px;
                transition: all 0.2s;
              `;
              link.onmouseover = () => {
                link.style.backgroundColor = '#007bff';
                link.style.color = 'white';
              };
              link.onmouseout = () => {
                link.style.backgroundColor = 'transparent';
                link.style.color = '#007bff';
              };
              
              linkDiv.appendChild(linkLabel);
              linkDiv.appendChild(link);
            } else {
              const noLink = document.createElement('span');
              noLink.textContent = 'Non specificato';
              noLink.style.color = 'var(--text-secondary)';
              noLink.style.fontStyle = 'italic';
              
              linkDiv.appendChild(linkLabel);
              linkDiv.appendChild(noLink);
            }
            
            // Aggiungi pulsanti di navigazione se abbiamo coordinate
            if (struttura.coordinate_lat && struttura.coordinate_lng) {
              const navButtonsDiv = document.createElement('div');
              navButtonsDiv.style.cssText = `
                display: flex;
                gap: 8px;
                margin-top: 8px;
                flex-wrap: wrap;
              `;
              
              // Pulsante Apri in Mappe
              const mapsBtn = document.createElement('button');
              mapsBtn.innerHTML = '🗺️ Apri in Mappe';
              mapsBtn.style.cssText = `
                background: #28a745;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
              `;
              mapsBtn.onclick = () => {
                window.navigationIntegrations.openInMaps(
                  parseFloat(struttura.coordinate_lat),
                  parseFloat(struttura.coordinate_lng),
                  struttura.Struttura || 'Struttura'
                );
              };
              mapsBtn.onmouseover = () => mapsBtn.style.backgroundColor = '#218838';
              mapsBtn.onmouseout = () => mapsBtn.style.backgroundColor = '#28a745';
              
              // Pulsante Calcola Percorso
              const routeBtn = document.createElement('button');
              routeBtn.innerHTML = '🧭 Percorso';
              routeBtn.style.cssText = `
                background: #007bff;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
              `;
              routeBtn.onclick = async () => {
                if (window.mapsManager && window.mapsManager.userLocation) {
                  await window.calculateRouteToStructure(struttura.id);
                  // Apri la mappa se non è già aperta
                  if (!window.mapsManager.isInitialized) {
                    window.mostraMappaStrutture();
                  }
                } else {
                  alert('Posizione utente non disponibile. Abilita la geolocalizzazione per calcolare il percorso.');
                }
              };
              routeBtn.onmouseover = () => routeBtn.style.backgroundColor = '#0056b3';
              routeBtn.onmouseout = () => routeBtn.style.backgroundColor = '#007bff';
              
              // Pulsante Aggiungi a Calendario
              const calendarBtn = document.createElement('button');
              calendarBtn.innerHTML = '📅 Calendario';
              calendarBtn.style.cssText = `
                background: #6f42c1;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
              `;
              calendarBtn.onclick = () => {
                window.calendarIntegrations.createICalEvent(struttura);
              };
              calendarBtn.onmouseover = () => calendarBtn.style.backgroundColor = '#5a32a3';
              calendarBtn.onmouseout = () => calendarBtn.style.backgroundColor = '#6f42c1';
              
              navButtonsDiv.appendChild(mapsBtn);
              navButtonsDiv.appendChild(routeBtn);
              navButtonsDiv.appendChild(calendarBtn);
              
              linkDiv.appendChild(navButtonsDiv);
            }
            
            campoDiv.appendChild(linkDiv);
          } else if (campo === 'Sito') {
            // Campo sito web con pulsante nella modalità visualizzazione
            const websiteDiv = document.createElement('div');
            websiteDiv.style.cssText = `
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 8px 0;
            `;
            
            const websiteLabel = document.createElement('strong');
            websiteLabel.textContent = 'Sito: ';
            websiteLabel.style.color = 'var(--text-primary)';
            
            const valore = struttura[campo];
            
            if (valore && valore.trim() !== '') {
              const websiteValue = document.createElement('span');
              websiteValue.textContent = valore;
              websiteValue.style.color = 'var(--text-primary)';
              
              const websiteBtn = document.createElement('button');
              websiteBtn.innerHTML = '🌐';
              websiteBtn.title = 'Apri sito web';
              websiteBtn.style.cssText = `
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 6px 10px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
              `;
              websiteBtn.onclick = () => {
                window.open(valore, '_blank');
              };
              websiteBtn.onmouseover = () => {
                websiteBtn.style.backgroundColor = '#5a6268';
              };
              websiteBtn.onmouseout = () => {
                websiteBtn.style.backgroundColor = '#6c757d';
              };
              
              websiteDiv.appendChild(websiteLabel);
              websiteDiv.appendChild(websiteValue);
              websiteDiv.appendChild(websiteBtn);
            } else {
              websiteDiv.appendChild(websiteLabel);
              const noValue = document.createElement('span');
              noValue.textContent = 'Non specificato';
              noValue.style.color = 'var(--text-secondary)';
              websiteDiv.appendChild(noValue);
            }
            
            campoDiv.appendChild(websiteDiv);
          } else if (campo === 'Email') {
            // Campo email con pulsante nella modalità visualizzazione
            const emailDiv = document.createElement('div');
            emailDiv.style.cssText = `
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 8px 0;
            `;
            
            const emailLabel = document.createElement('strong');
            emailLabel.textContent = 'Email: ';
            emailLabel.style.color = 'var(--text-primary)';
            
            const valore = struttura[campo];
            
            if (valore && valore.trim() !== '') {
              const emailValue = document.createElement('span');
              emailValue.textContent = valore;
              emailValue.style.color = 'var(--text-primary)';
              
              const emailBtn = document.createElement('button');
              emailBtn.innerHTML = '📧';
              emailBtn.title = 'Scrivi email';
              emailBtn.style.cssText = `
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 6px 10px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
              `;
              emailBtn.onclick = () => {
                const subject = encodeURIComponent(`Informazioni su ${struttura.Struttura || 'struttura'}`);
                const body = encodeURIComponent(`Ciao!\n\nSono interessato alla struttura "${struttura.Struttura || 'questa struttura'}" e vorrei avere maggiori informazioni.\n\nGrazie!`);
                window.open(`mailto:${valore}?subject=${subject}&body=${body}`, '_blank');
              };
              emailBtn.onmouseover = () => {
                emailBtn.style.backgroundColor = '#0056b3';
              };
              emailBtn.onmouseout = () => {
                emailBtn.style.backgroundColor = '#007bff';
              };
              
              emailDiv.appendChild(emailLabel);
              emailDiv.appendChild(emailValue);
              emailDiv.appendChild(emailBtn);
            } else {
              emailDiv.appendChild(emailLabel);
              const noValue = document.createElement('span');
              noValue.textContent = 'Non specificato';
              noValue.style.color = 'var(--text-secondary)';
              emailDiv.appendChild(noValue);
            }
            
            campoDiv.appendChild(emailDiv);
          } else if (['Contatto', 'IIcontatto'].includes(campo)) {
            // Campo telefono con pulsante WhatsApp nella modalità visualizzazione
            const phoneDiv = document.createElement('div');
            phoneDiv.style.cssText = `
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 8px 0;
            `;
            
            const phoneLabel = document.createElement('strong');
            phoneLabel.textContent = `${campo}: `;
            phoneLabel.style.color = 'var(--text-primary)';
            
            const valore = struttura[campo];
            
            if (valore && valore.trim() !== '') {
              const phoneValue = document.createElement('span');
              phoneValue.textContent = valore;
              phoneValue.style.color = 'var(--text-primary)';
              
              const whatsappBtn = document.createElement('button');
              whatsappBtn.innerHTML = '💬';
              whatsappBtn.title = 'Contatta via WhatsApp';
              whatsappBtn.style.cssText = `
                background: #25d366;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 6px 10px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
              `;
              whatsappBtn.onclick = () => {
                const phone = valore.replace(/\D/g, '');
                const message = encodeURIComponent(`Ciao! Sono interessato alla struttura "${struttura.Struttura || 'questa struttura'}" e vorrei avere maggiori informazioni.`);
                window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
              };
              whatsappBtn.onmouseover = () => {
                whatsappBtn.style.backgroundColor = '#128c7e';
              };
              whatsappBtn.onmouseout = () => {
                whatsappBtn.style.backgroundColor = '#25d366';
              };
              
              phoneDiv.appendChild(phoneLabel);
              phoneDiv.appendChild(phoneValue);
              phoneDiv.appendChild(whatsappBtn);
            } else {
              phoneDiv.appendChild(phoneLabel);
              const noValue = document.createElement('span');
              noValue.textContent = 'Non specificato';
              noValue.style.color = 'var(--text-secondary)';
              phoneDiv.appendChild(noValue);
            }
            
            campoDiv.appendChild(phoneDiv);
          } else {
          const value = document.createElement('span');
          const valore = struttura[campo];
          
          if (valore === undefined || valore === null || valore === '') {
            value.textContent = 'Non specificato';
            value.style.color = 'var(--text-secondary)';
            value.style.fontStyle = 'italic';
          } else if (typeof valore === 'boolean') {
            value.textContent = valore ? 'Sì' : 'No';
            value.style.color = valore ? '#28a745' : '#dc3545';
            value.style.fontWeight = 'bold';
          } else {
            value.textContent = valore;
            value.style.color = 'var(--text-primary)';
          }
          
          campoDiv.appendChild(label);
          campoDiv.appendChild(value);
          }
        }
        
        if (categoriaDiv && campoDiv) {
          categoriaDiv.appendChild(campoDiv);
        }
      });
      
      if (content && categoriaDiv) {
        content.appendChild(categoriaDiv);
      }
    });
    
    // Sezione WhatsApp rimossa - ora integrata nella sezione Contatti
    
    // Aggiungi campo Note
    const noteDiv = document.createElement('div');
    noteDiv.style.cssText = `
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 15px;
      border-left: 4px solid var(--text-secondary);
      grid-column: 1 / -1;
    `;
    
    const noteTitle = document.createElement('h3');
    noteTitle.textContent = 'Note';
    noteTitle.style.cssText = `
      margin: 0 0 15px 0;
      color: var(--text-secondary);
      font-size: 1.1rem;
    `;
    noteDiv.appendChild(noteTitle);
    
    const campoDiv = document.createElement('div');
    campoDiv.style.cssText = `
      margin-bottom: 10px;
      padding: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-radius: 4px;
      border: 1px solid var(--border-light);
    `;
    
    const label = document.createElement('strong');
    label.textContent = 'Note: ';
    label.style.color = 'var(--text-primary)';
    
    if (isEditMode) {
      // Modalità modifica - textarea per note
      const textarea = document.createElement('textarea');
      textarea.value = struttura.Note || '';
      textarea.placeholder = 'Aggiungi note aggiuntive...';
      textarea.rows = 4;
      textarea.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        min-height: 80px;
        background: var(--bg-primary);
        color: var(--text-primary);
      `;
      textarea.onchange = (e) => {
        struttura.Note = e.target.value;
      };
      
      if (campoDiv) {
        campoDiv.appendChild(label);
        campoDiv.appendChild(textarea);
      }
    } else {
      // Modalità visualizzazione
      const value = document.createElement('span');
      const valore = struttura.Note;
      
      if (valore === undefined || valore === null || valore === '') {
        value.textContent = 'Nessuna nota';
        value.style.color = 'var(--text-secondary)';
        value.style.fontStyle = 'italic';
      } else {
        value.textContent = valore;
        value.style.color = 'var(--text-primary)';
        value.style.whiteSpace = 'pre-wrap';
      }
      
      if (campoDiv) {
        campoDiv.appendChild(label);
        campoDiv.appendChild(value);
      }
    }
    
    if (noteDiv && campoDiv) {
      noteDiv.appendChild(campoDiv);
    }
    if (content && noteDiv) {
      content.appendChild(noteDiv);
    }
    
    // Aggiungi bottone Elimina solo se non è una nuova struttura
    if (!isNewStructure) {
      const deleteSection = document.createElement('div');
      deleteSection.style.cssText = `
        background: #fff5f5;
        border-radius: 8px;
        padding: 15px;
        border-left: 4px solid #dc3545;
        grid-column: 1 / -1;
        text-align: center;
      `;
      
      const deleteTitle = document.createElement('h3');
      deleteTitle.textContent = 'Zona Pericolosa';
      deleteTitle.style.cssText = `
        margin: 0 0 15px 0;
        color: #dc3545;
        font-size: 1.1rem;
      `;
      if (deleteSection && deleteTitle) {
        deleteSection.appendChild(deleteTitle);
      }
      
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '🗑️ Elimina Struttura';
      deleteBtn.style.cssText = `
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 12px 24px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
        transition: background-color 0.2s;
      `;
      
      deleteBtn.onmouseover = () => {
        deleteBtn.style.background = '#c82333';
      };
      
      deleteBtn.onmouseout = () => {
        deleteBtn.style.background = '#dc3545';
      };
      
      deleteBtn.onclick = () => {
        eliminaStrutturaConConferma(strutturaId);
      };
      
      // Aggiungi pulsante Segnala nella sezione Zona Pericolosa
      const reportBtn = document.createElement('button');
      reportBtn.innerHTML = '⚠️ Segnala';
      reportBtn.style.cssText = `
        background: #ffc107;
        color: #212529;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        margin-left: 10px;
      `;
      reportBtn.onclick = () => mostraSegnalazione(strutturaId);
      
      if (deleteSection && deleteBtn) {
        deleteSection.appendChild(deleteBtn);
        deleteSection.appendChild(reportBtn);
      }
      if (content && deleteSection) {
        content.appendChild(deleteSection);
      }
    }
  }
  
  // Funzione per alternare modalità
  async function toggleEditMode() {
    isEditMode = !isEditMode;
    editBtn.style.display = isEditMode ? 'none' : 'inline-block';
    saveBtn.style.display = isEditMode ? 'inline-block' : 'none';
    cancelBtn.style.display = isEditMode ? 'inline-block' : 'none';
    await creaGalleriaImmagini();
    creaContenutoScheda();
  }
  
  // Per le nuove strutture, inizia direttamente in modalità modifica
  if (isNewStructure) {
    isEditMode = true;
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';
  }
  
  // Funzione per salvare modifiche
  async function salvaModificheScheda(strutturaId) {
    try {
      if (isNewStructure) {
        // Aggiorna metadati per nuova struttura
        struttura.lastModified = new Date();
        struttura.lastModifiedBy = getCurrentUser()?.uid || null;
        struttura.createdAt = new Date();
        struttura.createdBy = getCurrentUser()?.uid || null;
        struttura.version = 1;
        
        // Crea nuova struttura in Firestore
        const docRef = await addDoc(colRef, struttura);
        
        // Aggiorna l'ID locale con quello di Firestore
        struttura.id = docRef.id;
        const index = strutture.findIndex(s => s.id === strutturaId);
        if (index !== -1) {
          strutture[index] = { ...struttura };
        }
        
        // Aggiorna le strutture globali
        window.strutture = strutture;
        
        // Log attività
        await logActivity('structure_created', docRef.id, getCurrentUser()?.uid, {
          name: struttura.Struttura,
          location: struttura.Luogo
        });
        
        // Notifica push per nuova struttura
        if (window.notifyNewStructure) {
          await window.notifyNewStructure(struttura);
        }
        
        alert('✅ Nuova struttura creata con successo!');
        
        // Sincronizzazione automatica dopo creazione struttura
        console.log('🔄 Avvio sincronizzazione automatica dopo creazione struttura...');
        try {
          // Aggiorna la mappa se è aperta (usa dati locali aggiornati)
          if (window.showStructuresOnMap && typeof window.showStructuresOnMap === 'function') {
            // Usa i dati locali già aggiornati, non ricaricare da Firestore
            const struttureLocali = window.strutture || [];
            window.showStructuresOnMap(struttureLocali);
            console.log('✅ Mappa aggiornata con dati locali');
          }
          
          // Aggiorna la lista principale (usa dati locali)
          aggiornaListaLocale();
          console.log('✅ Lista principale aggiornata con dati locali');
        } catch (syncError) {
          console.warn('⚠️ Errore durante sincronizzazione automatica:', syncError);
          // Non bloccare l'utente per errori di sincronizzazione
        }
        
        modalScheda.remove();
        
      } else {
        // Salva versione precedente prima di modificare
        await salvaVersione(struttura, getCurrentUser()?.uid);
        
        // Sincronizza formato coordinate se presenti
        if (struttura.coordinate_lat && struttura.coordinate_lng) {
          struttura.coordinate = { lat: struttura.coordinate_lat, lng: struttura.coordinate_lng };
        } else if (struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng) {
          struttura.coordinate_lat = struttura.coordinate.lat;
          struttura.coordinate_lng = struttura.coordinate.lng;
        }
        
        // Aggiorna metadati
        struttura.lastModified = new Date();
        struttura.lastModifiedBy = getCurrentUser()?.uid || null;
        struttura.version = (struttura.version || 1) + 1;
        
        // Aggiorna struttura esistente
        const docRef = doc(db, "strutture", strutturaId);
        await updateDoc(docRef, struttura);
        
        // INVALIDARE CACHE LOCALE per forzare ricaricamento
        localStorage.removeItem('strutture_cache');
        localStorage.removeItem('strutture_cache_timestamp');
        console.log('🗑️ Cache invalidata dopo modifica scheda completa');
        
        // Aggiorna la struttura locale
        const index = strutture.findIndex(s => s.id === strutturaId);
        if (index !== -1) {
          strutture[index] = { ...struttura };
        }
        
        // Aggiorna le strutture globali
        window.strutture = strutture;
        
        // Log attività
        await logActivity('structure_updated', strutturaId, getCurrentUser()?.uid, {
          version: struttura.version
        });
        
        alert('✅ Modifiche salvate con successo!');
        
        // Sincronizzazione automatica dopo modifica struttura
        console.log('🔄 Avvio sincronizzazione automatica dopo modifica struttura...');
        try {
          // Aggiorna la mappa se è aperta (usa dati locali aggiornati)
          if (window.showStructuresOnMap && typeof window.showStructuresOnMap === 'function') {
            // Usa i dati locali già aggiornati, non ricaricare da Firestore
            const struttureLocali = window.strutture || [];
            window.showStructuresOnMap(struttureLocali);
            console.log('✅ Mappa aggiornata con dati locali');
          }
          
          // Aggiorna la lista principale (usa dati locali)
          aggiornaListaLocale();
          console.log('✅ Lista principale aggiornata con dati locali');
        } catch (syncError) {
          console.warn('⚠️ Errore durante sincronizzazione automatica:', syncError);
          // Non bloccare l'utente per errori di sincronizzazione
        }
        
        toggleEditMode();
      }
      
    } catch (error) {
      console.error('❌ Errore nel salvataggio:', error);
      alert('❌ Errore nel salvataggio: ' + error.message);
    }
  }
  
  // Funzione per aprire lightbox immagini
  async function apriLightbox(imageId) {
    console.log('🖼️ Apertura lightbox per immagine:', imageId);
    try {
      // Carica le immagini dal MediaManager
      const images = await window.mediaManager?.getGallery(strutturaId) || [];
      const img = images.find(i => i.id === imageId);
      if (img) {
        window.open(img.url || img.thumbnailUrl, '_blank');
      } else {
        console.warn('⚠️ Immagine non trovata:', imageId);
      }
    } catch (error) {
      console.error('❌ Errore apertura lightbox:', error);
    }
  }
  
  // Costruisci DOM prima di caricare contenuto asincrono
  modalContent.appendChild(header);
  modalContent.appendChild(galleryContainer);
  modalContent.appendChild(content);
  modalScheda.appendChild(modalContent);
  document.body.appendChild(modalScheda);
  
  // Ora che il modal è nel DOM, carica il contenuto
  creaContenutoScheda();
  await creaGalleriaImmagini();
  
  // Chiudi modal cliccando fuori
  modalScheda.addEventListener('click', (e) => {
    if (e.target === modalScheda) {
      if (isNewStructure) {
        // Rimuovi la struttura temporanea
        const index = strutture.findIndex(s => s.id === strutturaId);
        if (index !== -1) {
          strutture.splice(index, 1);
          // Aggiorna le strutture globali
          window.strutture = strutture;
        }
      }
      modalScheda.remove();
    }
  });
}

// Rendi la funzione globale per essere accessibile dalla dashboard
window.mostraSchedaCompleta = mostraSchedaCompleta;

// === Toggle modalità visualizzazione ===
function toggleViewMode() {
  isListViewMode = !isListViewMode;
  
  // Aggiorna il toggle button
  const toggleBtn = document.getElementById('viewToggle');
  const viewIcon = toggleBtn.querySelector('.view-icon');
  const viewLabel = toggleBtn.querySelector('.view-label');
  
  if (isListViewMode) {
    viewIcon.textContent = '📄';
    viewLabel.textContent = 'Schede';
    toggleBtn.classList.add('active');
    
    // Aggiungi classe al body per stili CSS
    document.body.classList.add('list-view');
  } else {
    viewIcon.textContent = '📋';
    viewLabel.textContent = 'Elenco';
    toggleBtn.classList.remove('active');
    
    // Rimuovi classe dal body
    document.body.classList.remove('list-view');
  }
  
  // Ricarica i risultati con la nuova modalità
  const listaFiltrata = filtra(strutture);
  renderStrutture(listaFiltrata);
  
  // Salva preferenza utente
  localStorage.setItem('viewMode', isListViewMode ? 'list' : 'cards');
}

// === Reset filtri ===
function resetFiltri() {
  document.getElementById('search').value = '';
  const provEl = document.getElementById('filter-prov');
  if (provEl) provEl.value = '';
  
  // Reset filtri avanzati
  window.filtriAvanzatiAttivi = null;
  const indicator = document.getElementById('indicatore-ricerca-avanzata');
  if (indicator) indicator.remove();
  
  // Reset contatore
  const contatore = document.getElementById('contatore-risultati');
  if (contatore) contatore.remove();
  
  renderStrutture(filtra(strutture));
}

// === Aggiorna lista ===
let strutture = [];
async function aggiornaLista() {
  strutture = await caricaStrutture();
  
  // Rendi le strutture globali per accesso dalla dashboard
  window.strutture = strutture;
  renderStrutture(filtra(strutture));
}

// === Aggiorna lista locale (senza ricaricare da Firestore) ===
function aggiornaListaLocale() {
  // Usa i dati locali già presenti
  const struttureLocali = window.strutture || [];
  renderStrutture(filtra(struttureLocali));
  console.log('✅ Lista aggiornata con dati locali:', struttureLocali.length, 'strutture');
}

// === Indicatore di caricamento ===
function mostraCaricamento() {
  const resultsContainer = document.getElementById('results');
  const loadingIndicator = document.getElementById('loadingIndicator');
  
  if (resultsContainer) {
    resultsContainer.innerHTML = '';
  }
  
  if (loadingIndicator) {
    loadingIndicator.classList.remove('hidden');
  }
}

// Inizializzazione nuova UI mobile-first
function initializeNewUI() {
  console.log('🎨 Inizializzazione UI mobile-first...');
  
  // Menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const mainMenu = document.getElementById('mainMenu');
  
  if (menuToggle && mainMenu) {
    console.log('📱 Menu toggle trovato, aggiungo event listener');
    console.log('📱 Stato iniziale menu:', mainMenu.classList.toString());
    menuToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📱 Toggle menu clicked');
      const isOpen = !mainMenu.classList.contains('hidden');
      console.log('📱 Menu attualmente aperto:', !isOpen);
      mainMenu.classList.toggle('hidden');
      console.log('📱 Nuovo stato menu:', mainMenu.classList.toString());
      menuToggle.setAttribute('aria-expanded', !isOpen);
      document.body.style.overflow = !isOpen ? 'hidden' : '';
    });
    
    // Chiudi menu cliccando fuori
    mainMenu.addEventListener('click', (e) => {
      if (e.target === mainMenu) {
        console.log('📱 Menu chiuso cliccando fuori');
        mainMenu.classList.add('hidden');
        menuToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });

    // Chiudi menu con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !mainMenu.classList.contains('hidden')) {
        console.log('📱 Menu chiuso con ESC');
        mainMenu.classList.add('hidden');
        menuToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  } else {
    console.warn('⚠️ Menu toggle o main menu non trovati');
    console.log('📱 Menu toggle element:', menuToggle);
    console.log('📱 Main menu element:', mainMenu);
  }
  
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    console.log('🌙 Theme toggle trovato, aggiungo event listener');
    themeToggle.addEventListener('click', () => {
      console.log('🌙 Toggle theme clicked');
      if (typeof window.toggleTheme === 'function') {
        window.toggleTheme();
      } else {
        const themeManager = new ThemeManager();
        themeManager.toggleTheme();
      }
    });
  } else {
    console.warn('⚠️ Theme toggle non trovato');
  }
  
  // Empty state button
  const addBtnEmpty = document.getElementById('addBtnEmpty');
  const addBtn = document.getElementById('add-btn');
  if (addBtnEmpty && addBtn) {
    addBtnEmpty.addEventListener('click', () => {
      addBtn.click();
    });
  }
  
  console.log('✅ Nuova UI inizializzata');
}

// Prima dichiarazione di initializeUIEventListeners rimossa per evitare ridichiarazione
// Cache fix: 2024-12-19 11:20:00

// === Gestione Preferenze Notifiche ===
function mostraPreferenzeNotifiche() {
  // Chiudi il menu automaticamente
  closeMenu();
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('preferenzeNotificheModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'preferenzeNotificheModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000;
    padding: 0;
    animation: fadeIn 0.3s ease-out;
  `;

  const modalContent = document.createElement('div');
  modalContent.className = 'modal';
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 20px 20px 0 0;
    padding: 0;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.3s ease-out;
    position: relative;
  `;

  modalContent.innerHTML = `
    <!-- Header con handle per drag -->
    <div style="
      position: sticky;
      top: 0;
      background: var(--bg-primary);
      color: var(--text-primary);
      border-radius: 20px 20px 0 0;
      padding: 16px 20px 20px 20px;
      border-bottom: 1px solid #e5e7eb;
      z-index: 10;
    ">
      <!-- Handle per drag -->
      <div style="
        width: 40px;
        height: 4px;
        background: #d1d5db;
        border-radius: 2px;
        margin: 0 auto 16px auto;
      "></div>
      
      <!-- Titolo centrato -->
      <div style="text-align: center; margin-bottom: 8px;">
        <h2 style="margin: 0; color: #1f2937; font-size: 1.5rem; font-weight: 600;">🔔 Preferenze Notifiche</h2>
      </div>
      
      <!-- Pulsante chiusura posizionato in alto a destra -->
      <button onclick="this.closest('.modal-overlay').remove()" style="
        position: absolute;
        top: 16px;
        right: 20px;
        background: none; 
        border: none; 
        font-size: 1.5rem; 
        cursor: pointer; 
        color: #6b7280;
        padding: 8px;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      " onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='none'">×</button>
    </div>
    
    <!-- Contenuto scrollabile -->
    <div style="padding: 20px;">
      <!-- Tipi di Notifiche -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: #374151; margin-bottom: 16px; font-size: 1.1rem; font-weight: 600;">Tipi di Notifiche</h3>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 16px; 
            background: #f9fafb; 
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            transition: all 0.2s ease;
          ">
            <div style="flex: 1; margin-right: 12px;">
              <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">🏕️ Nuove Strutture</div>
              <div style="font-size: 0.875rem; color: #6b7280; line-height: 1.4;">Notifica quando viene aggiunta una nuova struttura</div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
              <input type="checkbox" id="newStructures" style="opacity: 0; width: 0; height: 0;">
              <span style="
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #d1d5db;
                border-radius: 24px;
                transition: 0.3s;
              "></span>
              <span style="
                position: absolute;
                content: '';
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                border-radius: 50%;
                transition: 0.3s;
              "></span>
            </label>
          </div>
          
          <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 16px; 
            background: #f9fafb; 
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            transition: all 0.2s ease;
          ">
            <div style="flex: 1; margin-right: 12px;">
              <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">📝 Aggiornamenti Strutture</div>
              <div style="font-size: 0.875rem; color: #6b7280; line-height: 1.4;">Notifica quando una struttura viene modificata</div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
              <input type="checkbox" id="structureUpdates" style="opacity: 0; width: 0; height: 0;">
              <span style="
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #d1d5db;
                border-radius: 24px;
                transition: 0.3s;
              "></span>
              <span style="
                position: absolute;
                content: '';
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                border-radius: 50%;
                transition: 0.3s;
              "></span>
            </label>
          </div>
          
          <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 16px; 
            background: #f9fafb; 
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            transition: all 0.2s ease;
          ">
            <div style="flex: 1; margin-right: 12px;">
              <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">⭐ Elenco Personale</div>
              <div style="font-size: 0.875rem; color: #6b7280; line-height: 1.4;">Notifica per aggiornamenti del tuo elenco personale</div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
              <input type="checkbox" id="personalListUpdates" style="opacity: 0; width: 0; height: 0;">
              <span style="
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #d1d5db;
                border-radius: 24px;
                transition: 0.3s;
              "></span>
              <span style="
                position: absolute;
                content: '';
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                border-radius: 50%;
                transition: 0.3s;
              "></span>
            </label>
          </div>
          
          <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 16px; 
            background: #f9fafb; 
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            transition: all 0.2s ease;
          ">
            <div style="flex: 1; margin-right: 12px;">
              <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">📍 Strutture Vicine</div>
              <div style="font-size: 0.875rem; color: #6b7280; line-height: 1.4;">Notifica per strutture nelle vicinanze</div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
              <input type="checkbox" id="nearbyStructures" style="opacity: 0; width: 0; height: 0;">
              <span style="
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #d1d5db;
                border-radius: 24px;
                transition: 0.3s;
              "></span>
              <span style="
                position: absolute;
                content: '';
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                border-radius: 50%;
                transition: 0.3s;
              "></span>
            </label>
          </div>
          
          <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 16px; 
            background: #f9fafb; 
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            transition: all 0.2s ease;
          ">
            <div style="flex: 1; margin-right: 12px;">
              <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">⚠️ Segnalazioni</div>
              <div style="font-size: 0.875rem; color: #6b7280; line-height: 1.4;">Notifica per nuove segnalazioni</div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
              <input type="checkbox" id="reports" style="opacity: 0; width: 0; height: 0;">
              <span style="
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #d1d5db;
                border-radius: 24px;
                transition: 0.3s;
              "></span>
              <span style="
                position: absolute;
                content: '';
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                border-radius: 50%;
                transition: 0.3s;
              "></span>
            </label>
          </div>
        </div>
      </div>
      
      <!-- Distanza per Notifiche Vicinanza -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: #374151; margin-bottom: 16px; font-size: 1.1rem; font-weight: 600;">Distanza per Notifiche Vicinanza</h3>
        <div style="
          padding: 20px; 
          background: #f9fafb; 
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span style="color: #374151; font-weight: 500;">Raggio notifiche:</span>
            <span id="distanceValue" style="
              font-weight: 600; 
              color: #2f6b2f; 
              background: #dcfce7; 
              padding: 4px 12px; 
              border-radius: 20px;
              font-size: 0.875rem;
            ">10 km</span>
          </div>
          <input type="range" id="distanceSlider" min="1" max="50" value="10" style="
            width: 100%; 
            height: 6px;
            border-radius: 3px;
            background: #e5e7eb;
            outline: none;
            -webkit-appearance: none;
          ">
        </div>
      </div>
      
      <!-- Pulsanti azione -->
      <div style="
        display: flex; 
        flex-direction: column; 
        gap: 12px; 
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
      ">
        <button onclick="testNotification()" style="
          padding: 14px 20px; 
          background: #6b7280; 
          color: white; 
          border: none; 
          border-radius: 12px; 
          cursor: pointer;
          font-weight: 500;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        ">
          🔔 Test Notifica
        </button>
        <button onclick="salvaPreferenzeNotifiche()" style="
          padding: 14px 20px; 
          background: #2f6b2f; 
          color: white; 
          border: none; 
          border-radius: 12px; 
          cursor: pointer;
          font-weight: 500;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        ">
          💾 Salva Preferenze
        </button>
      </div>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Aggiungi stili CSS per animazioni e toggle
  if (!document.getElementById('notificationModalStyles')) {
    const style = document.createElement('style');
    style.id = 'notificationModalStyles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      
      /* Toggle switch styles */
      input[type="checkbox"]:checked + span {
        background-color: #2f6b2f !important;
      }
      
      input[type="checkbox"]:checked + span span {
        transform: translateX(20px) !important;
      }
      
      /* Range slider styles */
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #2f6b2f;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      input[type="range"]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #2f6b2f;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      /* Hover effects */
      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      /* Mobile responsive */
      @media (max-width: 480px) {
        .modal {
          border-radius: 16px 16px 0 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Carica preferenze attuali
  caricaPreferenzeNotifiche();
  
  // Event listener per slider distanza
  const distanceSlider = document.getElementById('distanceSlider');
  const distanceValue = document.getElementById('distanceValue');
  
  distanceSlider.addEventListener('input', (e) => {
    distanceValue.textContent = `${e.target.value} km`;
  });

  // Chiudi modal cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function caricaPreferenzeNotifiche() {
  if (!window.pushManager?.preferences) return;
  
  const prefs = window.pushManager.preferences.preferences;
  
  // Carica toggle switches (solo se esistono)
  const newStructuresEl = document.getElementById('newStructures');
  const structureUpdatesEl = document.getElementById('structureUpdates');
  const personalListUpdatesEl = document.getElementById('personalListUpdates');
  const nearbyStructuresEl = document.getElementById('nearbyStructures');
  const reportsEl = document.getElementById('reports');
  
  if (newStructuresEl) newStructuresEl.checked = prefs.newStructures;
  if (structureUpdatesEl) structureUpdatesEl.checked = prefs.structureUpdates;
  if (personalListUpdatesEl) personalListUpdatesEl.checked = prefs.personalListUpdates;
  if (nearbyStructuresEl) nearbyStructuresEl.checked = prefs.nearbyStructures;
  if (reportsEl) reportsEl.checked = prefs.reports;
  
  // Carica slider distanza
  document.getElementById('distanceSlider').value = prefs.distance;
  document.getElementById('distanceValue').textContent = `${prefs.distance} km`;
}

async function salvaPreferenzeNotifiche() {
  if (!window.pushManager?.preferences || !window.getCurrentUser()) {
    alert('Errore: Utente non autenticato');
    return;
  }
  
  // Aggiorna preferenze (solo se gli elementi esistono)
  const prefs = window.pushManager.preferences.preferences;
  const newStructuresEl = document.getElementById('newStructures');
  const structureUpdatesEl = document.getElementById('structureUpdates');
  const personalListUpdatesEl = document.getElementById('personalListUpdates');
  const nearbyStructuresEl = document.getElementById('nearbyStructures');
  const reportsEl = document.getElementById('reports');
  const distanceSliderEl = document.getElementById('distanceSlider');
  
  if (newStructuresEl) prefs.newStructures = newStructuresEl.checked;
  if (structureUpdatesEl) prefs.structureUpdates = structureUpdatesEl.checked;
  if (personalListUpdatesEl) prefs.personalListUpdates = personalListUpdatesEl.checked;
  if (nearbyStructuresEl) prefs.nearbyStructures = nearbyStructuresEl.checked;
  if (reportsEl) prefs.reports = reportsEl.checked;
  if (distanceSliderEl) prefs.distance = parseInt(distanceSliderEl.value);
  
  // Salva su Firestore
  await window.pushManager.preferences.save(window.getCurrentUser().uid);
  
  // Chiudi modal
  document.getElementById('preferenzeNotificheModal').remove();
  
  // Mostra conferma
  window.showNotification('✅ Preferenze salvate', {
    body: 'Le tue preferenze notifiche sono state aggiornate',
    tag: 'preferences-saved'
  });
}

function testNotification() {
  window.showNotification('🔔 Test Notifica', {
    body: 'Questa è una notifica di test per verificare che tutto funzioni correttamente',
    tag: 'test-notification'
  });
}

// === Preloading Predittivo ===
function preloadNearbyStructures(currentStructureId) {
  if (!currentStructureId || !window.strutture) return;
  
  const currentStructure = window.strutture.find(s => s.id === currentStructureId);
  if (!currentStructure) return;
  
  // Trova strutture vicine (stessa provincia o coordinate simili)
  const nearby = window.strutture.filter(s => {
    if (s.id === currentStructureId) return false;
    
    // Stessa provincia
    if (s.Prov === currentStructure.Prov) return true;
    
    // Coordinate simili (se disponibili)
    if (currentStructure.coordinate?.lat && currentStructure.coordinate?.lng && 
        s.coordinate?.lat && s.coordinate?.lng) {
      const distance = calculateDistance(
        currentStructure.coordinate, 
        s.coordinate
      );
      return distance < 10; // 10 km
    }
    
    return false;
  });
  
  // Preload prime 5 strutture vicine
  nearby.slice(0, 5).forEach(s => {
    if (s.immagini?.[0]) {
      const img = new Image();
      img.src = s.immagini[0].thumbnailUrl || s.immagini[0].url;
      console.log('🔄 Preloading immagine per:', s.Struttura);
    }
  });
  
  console.log(`🔄 Preloaded ${nearby.slice(0, 5).length} strutture vicine`);
}

// Calcola distanza tra due coordinate (formula di Haversine)
function calculateDistance(coord1, coord2) {
  const R = 6371; // Raggio della Terra in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Trigger preloading quando si apre una scheda
document.addEventListener('cardOpened', (e) => {
  if (e.detail && e.detail.structureId) {
    preloadNearbyStructures(e.detail.structureId);
  }
});

// === Funzioni Download Offline Rimosse ===
// Funzione mostraGestioneOffline rimossa
// La gestione download offline è stata disabilitata

async function caricaStruttureOfflineList() {
  const listContainer = document.getElementById('offlineStructuresList');
  
  try {
    // Carica elenco personale
    const elencoPersonale = JSON.parse(localStorage.getItem('elencoPersonale') || '[]');
    
    if (elencoPersonale.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: #666; padding: 20px;">
          Nessuna struttura nell'elenco personale
        </div>
      `;
      return;
    }
    
    // Trova le strutture corrispondenti
    const struttureElenco = strutture.filter(s => elencoPersonale.includes(s.id));
    
    listContainer.innerHTML = struttureElenco.map(struttura => `
      <div style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #f3f4f6;">
        <input type="checkbox" id="offline_${struttura.id}" style="margin-right: 12px;" checked>
        <div style="flex: 1;">
          <div style="font-weight: 500;">${struttura.Struttura}</div>
          <div style="font-size: 0.9rem; color: #666;">${struttura.Luogo}, ${struttura.Prov}</div>
        </div>
        <div style="font-size: 0.8rem; color: #9ca3af;">
          ${struttura.immagini?.length || 0} foto
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('❌ Errore caricamento strutture offline:', error);
    listContainer.innerHTML = `
      <div style="text-align: center; color: #dc3545; padding: 20px;">
        Errore nel caricamento delle strutture
      </div>
    `;
  }
}

// Funzione downloadForOffline rimossa
// La gestione download offline è stata disabilitata
async function downloadForOffline_DISABLED() {
  const checkboxes = document.querySelectorAll('#offlineStructuresList input[type="checkbox"]:checked');
  const selectedIds = Array.from(checkboxes).map(cb => cb.id.replace('offline_', ''));
  
  if (selectedIds.length === 0) {
    alert('Seleziona almeno una struttura da scaricare');
    return;
  }
  
  const progressModal = document.createElement('div');
  progressModal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  `;
  
  progressModal.innerHTML = `
    <div style="background: var(--bg-primary); color: var(--text-primary); padding: 24px; border-radius: 12px; text-align: center; min-width: 300px;">
      <h3 style="margin: 0 0 16px 0; color: #2f6b2f;">📥 Download in corso...</h3>
      <div style="margin-bottom: 16px;">
        <div style="width: 100%; background: #e5e7eb; border-radius: 4px; height: 8px;">
          <div id="downloadProgress" style="height: 100%; background: #2f6b2f; border-radius: 4px; width: 0%; transition: width 0.3s;"></div>
        </div>
      </div>
      <div id="downloadStatus" style="color: #666;">Preparazione...</div>
    </div>
  `;
  
  document.body.appendChild(progressModal);
  
  try {
    let completed = 0;
    
    for (const structureId of selectedIds) {
      const struttura = strutture.find(s => s.id === structureId);
      if (!struttura) continue;
      
      // Aggiorna status
      document.getElementById('downloadStatus').textContent = `Scaricando ${struttura.Struttura}...`;
      
      // Salva struttura in IndexedDB
      await salvaStrutturaOffline(struttura);
      
      // Scarica immagini se presenti
      if (struttura.immagini && struttura.immagini.length > 0) {
        for (const img of struttura.immagini) {
          await salvaImmagineOffline(img.url, structureId);
        }
      }
      
      completed++;
      const progress = (completed / selectedIds.length) * 100;
      document.getElementById('downloadProgress').style.width = `${progress}%`;
    }
    
    // Completato
    document.getElementById('downloadStatus').textContent = 'Download completato!';
    
    setTimeout(() => {
      progressModal.remove();
      aggiornaInfoCache();
      window.showNotification('✅ Download completato', {
        body: `${selectedIds.length} strutture scaricate per uso offline`,
        tag: 'offline-download-complete'
      });
    }, 1500);
    
  } catch (error) {
    console.error('❌ Errore download offline:', error);
    progressModal.remove();
    alert('Errore durante il download: ' + error.message);
  }
}

// Funzione salvaStrutturaOffline disabilitata
async function salvaStrutturaOffline_DISABLED(struttura) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QuoVadiScoutDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['cachedStructures'], 'readwrite');
      const store = transaction.objectStore('cachedStructures');
      
      const offlineStructure = {
        ...struttura,
        downloadedAt: Date.now(),
        offline: true
      };
      
      store.put(offlineStructure).onsuccess = () => resolve();
      store.put(offlineStructure).onerror = () => reject(store.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function salvaImmagineOffline(imageUrl, structureId) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('QuoVadiScoutDB', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        
        // Crea store per immagini se non esiste
        if (!db.objectStoreNames.contains('cachedImages')) {
          const transaction = db.transaction(['cachedImages'], 'readwrite');
          db.createObjectStore('cachedImages', { keyPath: 'url' });
        }
        
        const transaction = db.transaction(['cachedImages'], 'readwrite');
        const store = transaction.objectStore('cachedImages');
        
        const imageData = {
          url: imageUrl,
          blob: blob,
          structureId: structureId,
          downloadedAt: Date.now()
        };
        
        store.put(imageData).onsuccess = () => resolve();
        store.put(imageData).onerror = () => reject(store.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('⚠️ Errore download immagine:', imageUrl, error);
    // Non bloccare il processo per errori di singole immagini
  }
}

// Funzione aggiornaInfoCache disabilitata
async function aggiornaInfoCache_DISABLED() {
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('QuoVadiScoutDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Calcola spazio utilizzato
    let cacheSize = 0;
    
    if (db.objectStoreNames.contains('cachedStructures')) {
      const transaction = db.transaction(['cachedStructures'], 'readonly');
      const store = transaction.objectStore('cachedStructures');
      const structures = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
      });
      cacheSize += JSON.stringify(structures).length;
    }
    
    if (db.objectStoreNames.contains('cachedImages')) {
      const transaction = db.transaction(['cachedImages'], 'readonly');
      const store = transaction.objectStore('cachedImages');
      const images = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
      });
      cacheSize += images.reduce((total, img) => total + (img.blob?.size || 0), 0);
    }
    
    const sizeMB = (cacheSize / (1024 * 1024)).toFixed(2);
    const maxSize = 50; // MB limite stimato
    const percentage = Math.min((sizeMB / maxSize) * 100, 100);
    
    document.getElementById('cacheSize').textContent = `${sizeMB} MB`;
    document.getElementById('cacheBar').style.width = `${percentage}%`;
    
  } catch (error) {
    console.error('❌ Errore aggiornamento info cache:', error);
    document.getElementById('cacheSize').textContent = 'Errore';
  }
}

// Funzione pulisciCacheOffline disabilitata
async function pulisciCacheOffline_DISABLED() {
  if (!confirm('Sei sicuro di voler cancellare tutta la cache offline? Questa azione non può essere annullata.')) {
    return;
  }
  
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('QuoVadiScoutDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Pulisci strutture cached
    if (db.objectStoreNames.contains('cachedStructures')) {
      const transaction = db.transaction(['cachedStructures'], 'readwrite');
      const store = transaction.objectStore('cachedStructures');
      await store.clear();
    }
    
    // Pulisci immagini cached
    if (db.objectStoreNames.contains('cachedImages')) {
      const transaction = db.transaction(['cachedImages'], 'readwrite');
      const store = transaction.objectStore('cachedImages');
      await store.clear();
    }
    
    aggiornaInfoCache();
    
    window.showNotification('✅ Cache pulita', {
      body: 'Tutti i dati offline sono stati rimossi',
      tag: 'cache-cleared'
    });
    
  } catch (error) {
    console.error('❌ Errore pulizia cache:', error);
    alert('Errore durante la pulizia della cache: ' + error.message);
  }
}

// === Inizializzazione pagina ===
window.addEventListener("DOMContentLoaded", async () => {
  try {
  mostraCaricamento();
  
  // 🔒 Inizializza sistema di sicurezza
  console.log('🔒 Sistema di sicurezza attivato');
  
  // Attiva lazy loading immagini dopo caricamento DOM
  if (typeof setupLazyLoading === 'function') {
    setupLazyLoading();
  }
  
  // Gestisci parametri URL dalla dashboard
  const urlParams = new URLSearchParams(window.location.search);
  const filtro = urlParams.get('filtro');
  const provincia = urlParams.get('provincia');
  
  if (filtro && provincia) {
    console.log(`🔍 Filtro dalla dashboard: ${filtro} in ${provincia}`);
    // Applica il filtro automaticamente dopo il caricamento
    window.dashboardFilter = { filtro, provincia };
  }
  
  // Inizializza push notifications
  if (window.pushManager) {
    await window.initializePushNotifications();
  }
  
  // Carica preferenza modalità visualizzazione
  const savedViewMode = localStorage.getItem('viewMode');
  if (savedViewMode === 'list') {
    isListViewMode = true;
    document.body.classList.add('list-view');
    
    // Aggiorna il toggle button
    const toggleBtn = document.getElementById('viewToggle');
    if (toggleBtn) {
    const viewIcon = toggleBtn.querySelector('.view-icon');
    const viewLabel = toggleBtn.querySelector('.view-label');
    
      if (viewIcon) viewIcon.textContent = '📄';
      if (viewLabel) viewLabel.textContent = 'Schede';
    toggleBtn.classList.add('active');
    }
  }
  
  // Inizializza UI event listeners
  initializeNewUI();
  initializeUIEventListeners();
  
  // Inizializza controlli mappa principale
  setupMainMapControls();
  
  // Inizializza sistema autenticazione Firebase
  inizializzaAuth();
  
  // Il caricamento delle strutture è ora gestito in onAuthStateChanged
  // try {
  //   strutture = await caricaStrutture();
  //   // ... resto del codice
  // }
    
  try {
    // Applica filtro dalla dashboard se presente
    if (window.dashboardFilter) {
      const { filtro, provincia } = window.dashboardFilter;
      console.log(`🔍 Applicando filtro dashboard: ${filtro} in ${provincia}`);
      
      // Applica i filtri direttamente senza cercare elementi UI
      window.filtriAvanzatiAttivi = {
        tipo: filtro,
        provincia: provincia
      };
      
      // Applica il filtro
      const struttureFiltrate = filtra(strutture);
      renderStrutture(struttureFiltrate);
      
      // Mostra indicatore di ricerca avanzata
      mostraIndicatoreRicercaAvanzata(2);
      
      // Mostra messaggio informativo
      const container = document.getElementById("results");
      if (container && container.firstChild !== null) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `
          background: #e8f5e8;
          border: 1px solid #2f6b2f;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 20px;
          color: #2f6b2f;
          font-weight: 500;
        `;
        infoDiv.innerHTML = `
          🔍 <strong>Filtro applicato dalla dashboard:</strong> 
          ${filtro === 'casa' ? 'Case' : filtro === 'terreno' ? 'Terreni' : 'Case e Terreni'} 
          in provincia di ${provincia}
          <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: #2f6b2f; cursor: pointer; font-size: 16px;">✕</button>
        `;
        container.insertBefore(infoDiv, container.firstChild);
      } else if (container) {
        // Se container esiste ma non ha firstChild, usa appendChild
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `
          background: #e8f5e8;
          border: 1px solid #2f6b2f;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 20px;
          color: #2f6b2f;
          font-weight: 500;
        `;
        infoDiv.innerHTML = `
          🔍 <strong>Filtro applicato dalla dashboard:</strong> 
          ${filtro === 'casa' ? 'Case' : filtro === 'terreno' ? 'Terreni' : 'Case e Terreni'} 
          in provincia di ${provincia}
          <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: #2f6b2f; cursor: pointer; font-size: 16px;">✕</button>
        `;
        container.appendChild(infoDiv);
      }
      
      // Pulisci il filtro dashboard
      delete window.dashboardFilter;
    }
    
    // Mostra messaggio informativo se si usano dati locali
    if (strutture.length > 0 && strutture[0].id.startsWith('demo-')) {
      const container = document.getElementById("results");
      if (container && container.firstChild !== null) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info-message';
        infoDiv.innerHTML = `
          <div class="info-banner">
            <strong>ℹ️ Modalità Demo</strong> - Stai visualizzando dati di esempio. 
            <button onclick="this.parentElement.parentElement.remove()">✕</button>
          </div>
        `;
        container.insertBefore(infoDiv, container.firstChild);
      } else if (container) {
        // Se container esiste ma non ha firstChild, usa appendChild
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info-message';
        infoDiv.innerHTML = `
          <div class="info-banner">
            <strong>ℹ️ Modalità Demo</strong> - Stai visualizzando dati di esempio. 
            <button onclick="this.parentElement.parentElement.remove()">✕</button>
          </div>
        `;
        container.appendChild(infoDiv);
      }
    }
  } catch (error) {
    console.error('Errore nel caricamento:', error);
    const container = document.getElementById("results");
    if (container) {
      container.innerHTML = `
        <div class="error">
          <h3>⚠️ Errore nel caricamento</h3>
          <p>Impossibile caricare le strutture. Controlla la connessione e riprova.</p>
          <button onclick="location.reload()">🔄 Ricarica pagina</button>
        </div>
      `;
    }
  }

  // Popola le province
  const province = [...new Set(strutture.map(s => s.Prov).filter(Boolean))].sort();
  const provSelect = document.getElementById("filter-prov");
  if (provSelect) {
    province.forEach(prov => {
      const option = document.createElement("option");
      option.value = prov;
      option.textContent = prov;
      provSelect.appendChild(option);
    });
  }

  // Event listeners
  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderStrutture(filtra(strutture));
    });
  }
  const filterProv = document.getElementById("filter-prov");
  if (filterProv) {
    filterProv.addEventListener("change", () => {
      renderStrutture(filtra(strutture));
    });
  }
  
  // Filtri casa e terreno gestiti tramite ricerca avanzata
  // const filterCasa = document.getElementById("filter-casa");
  // const filterTerreno = document.getElementById("filter-terreno");
  
  const sortBy = document.getElementById("sort-by");
  if (sortBy) {
    sortBy.addEventListener("change", () => {
      paginaCorrente = 1; // Reset alla prima pagina
      renderStrutture(filtra(strutture));
      // Chiudi il menu automaticamente dopo l'ordinamento
      closeMenu();
    });
  }
  
  const addBtn = document.getElementById("add-btn");
  if (addBtn) {
    addBtn.addEventListener("click", aggiungiStruttura);
  }
  
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetFiltri);
  }
  // exportBtn gestito in initializeUIEventListeners()
  
  // Event listener per toggle visualizzazione
  const viewToggle = document.getElementById("viewToggle");
  if (viewToggle) {
    viewToggle.addEventListener("click", toggleViewMode);
  }
  
  // Event listener per ricerca avanzata
  const advancedSearchBtn = document.getElementById("advancedSearchBtn");
  if (advancedSearchBtn) {
    console.log('✅ Pulsante ricerca avanzata trovato, aggiungo event listener');
    advancedSearchBtn.addEventListener("click", mostraRicercaAvanzata);
  } else {
    console.log('ℹ️ Pulsante ricerca avanzata non presente (opzionale)');
  }
  
  // Event listener per pulsante utente
  const userBtn = document.getElementById("userBtn");
  if (userBtn) {
    console.log('✅ Pulsante utente trovato, aggiungo event listener');
    userBtn.addEventListener("click", cambiaUtente);
  } else {
    console.error('❌ Pulsante utente non trovato!');
  }
  
  // Event listeners per il modale
  document.getElementById("closeModal").addEventListener("click", chiudiModale);
  document.getElementById("cancelBtn").addEventListener("click", chiudiModale);
  document.getElementById("saveBtn").addEventListener("click", salvaModifiche);
  document.getElementById("deleteBtn").addEventListener("click", () => {
    if (strutturaCorrente && confirm("Vuoi davvero eliminare questa struttura?")) {
      eliminaStruttura(strutturaCorrente.id);
      chiudiModale();
    }
  });
  
  // Chiudi modale cliccando fuori
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") chiudiModale();
  });
  
  // Carica filtri salvati (solo se utente autenticato)
  // await caricaFiltriSalvatiDropdown(); // Spostato in onAuthStateChanged
  
  // Inizializza ottimizzazioni performance
  setupLazyLoading();
  
  // Inizializza gestione temi - RIMOSSO: già gestito in initializeNewUI()
  } catch (error) {
    console.error('❌ Errore durante il bootstrap dell\'app:', error);
    if (window && window.errorHandler) {
      window.errorHandler.handleGenericError(error, 'bootstrap');
    }
    try {
      const container = document.getElementById("results");
      if (container) {
        container.innerHTML = `
          <div class="error">
            <h3>⚠️ Errore di avvio</h3>
            <p>Si è verificato un problema nell\'inizializzazione. Riprova a ricaricare.</p>
            <button onclick="location.reload()">🔄 Ricarica pagina</button>
          </div>
        `;
      }
    } catch (_) {}
  }
});

// === Gestione Filtri Salvati Dropdown ===
async function caricaFiltriSalvatiDropdown() {
  try {
    const filtriSalvati = await caricaFiltriSalvati();
    const dropdown = document.getElementById('saved-filters');
    
    if (!dropdown) return;
    
    // Pulisci dropdown
    dropdown.innerHTML = '<option value="">Filtri salvati</option>';
    
    if (filtriSalvati.length > 0) {
      filtriSalvati.forEach(filtro => {
        const option = document.createElement('option');
        option.value = filtro.id;
        option.textContent = `${filtro.nome} (${Object.keys(filtro.filtri).length} filtri)`;
        dropdown.appendChild(option);
      });
    }
    
    // Event listener per applicare filtri salvati
    dropdown.addEventListener('change', async (e) => {
      if (e.target.value) {
        await applicaFiltriSalvati(e.target.value);
        e.target.value = ''; // Reset dropdown
      }
    });
    
  } catch (error) {
    console.error('Errore nel caricamento filtri salvati:', error);
  }
}

// === Modale Opzioni Esportazione ===
function mostraOpzioniEsportazioneGenerale() {
  // Chiudi il menu automaticamente
  closeMenu();
  
  // Usa la stessa funzione unificata, passando tutte le strutture
  if (typeof window.mostraOpzioniEsportazione === 'function') {
    window.mostraOpzioniEsportazione(strutture, { forcePersonalList: false });
  } else {
    alert('Funzione di esportazione non disponibile');
  }
}

// === Feed Attività ===
async function mostraFeedAttivita() {
  // Chiudi il menu automaticamente
  closeMenu();
  
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('feedAttivitaModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'feedAttivitaModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 95%;
    max-height: 95%;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    position: relative;
    min-width: 400px;
    width: 100%;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--border-light);
  `;
  
  const title = document.createElement('h2');
  title.textContent = '📋 Feed Attività';
  title.style.cssText = `
    margin: 0;
    color: #2f6b2f;
    font-size: 1.5rem;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => modal.remove();
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Filtri
  const filtriDiv = document.createElement('div');
  filtriDiv.style.cssText = `
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    align-items: center;
  `;
  
  const tipoSelect = document.createElement('select');
  tipoSelect.id = 'filtroTipo';
  tipoSelect.style.cssText = `
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  tipoSelect.innerHTML = `
    <option value="">Tutti i tipi</option>
    <option value="structure_created">Struttura creata</option>
    <option value="structure_updated">Struttura modificata</option>
    <option value="structure_deleted">Struttura eliminata</option>
    <option value="note_created">Nota creata</option>
    <option value="note_deleted">Nota eliminata</option>
    <option value="filter_saved">Filtro salvato</option>
  `;
  
  const periodoSelect = document.createElement('select');
  periodoSelect.id = 'filtroPeriodo';
  periodoSelect.style.cssText = `
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  periodoSelect.innerHTML = `
    <option value="today">Oggi</option>
    <option value="week">Ultima settimana</option>
    <option value="month">Ultimo mese</option>
    <option value="all">Tutto</option>
  `;
  
  const refreshBtn = document.createElement('button');
  refreshBtn.innerHTML = '🔄 Aggiorna';
  refreshBtn.style.cssText = `
    background: #17a2b8;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  refreshBtn.onclick = () => caricaAttivita();
  
  filtriDiv.appendChild(document.createElement('label')).textContent = 'Tipo:';
  filtriDiv.appendChild(tipoSelect);
  filtriDiv.appendChild(document.createElement('label')).textContent = 'Periodo:';
  filtriDiv.appendChild(periodoSelect);
  filtriDiv.appendChild(refreshBtn);
  
  // Contenuto attività
  const contentDiv = document.createElement('div');
  contentDiv.id = 'attivitaContent';
  contentDiv.style.cssText = `
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 10px;
  `;
  
  // Assembla il modal
  modalContent.appendChild(header);
  modalContent.appendChild(filtriDiv);
  modalContent.appendChild(contentDiv);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Carica attività iniziali
  await caricaAttivita();
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function caricaAttivita() {
  try {
    const contentDiv = document.getElementById('attivitaContent');
    if (!contentDiv) return;
    
    contentDiv.innerHTML = '<div style="text-align: center; padding: 20px;">🔄 Caricamento attività...</div>';
    
    const tipoFiltro = document.getElementById('filtroTipo')?.value || '';
    const periodoFiltro = document.getElementById('filtroPeriodo')?.value || 'week';
    
    // Calcola data limite
    let dataLimite = new Date();
    switch (periodoFiltro) {
      case 'today':
        dataLimite.setHours(0, 0, 0, 0);
        break;
      case 'week':
        dataLimite.setDate(dataLimite.getDate() - 7);
        break;
      case 'month':
        dataLimite.setMonth(dataLimite.getMonth() - 1);
        break;
      case 'all':
        dataLimite = null;
        break;
    }
    
    // Carica attività da Firestore
    const activitiesRef = collection(db, "activity_log");
    let q = query(activitiesRef, orderBy("timestamp", "desc"));
    
    if (dataLimite) {
      q = query(activitiesRef, where("timestamp", ">=", dataLimite), orderBy("timestamp", "desc"));
    }
    
    const snapshot = await getDocs(q);
    let attivita = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Filtra per tipo se specificato
    if (tipoFiltro) {
      attivita = attivita.filter(a => a.action === tipoFiltro);
    }
    
    // Limita a 50 attività
    attivita = attivita.slice(0, 50);
    
    if (attivita.length === 0) {
      contentDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Nessuna attività trovata</div>';
      return;
    }
    
    // Renderizza attività
    contentDiv.innerHTML = attivita.map(attivita => {
      const icona = getAttivitaIcona(attivita.action);
      const descrizione = getAttivitaDescrizione(attivita);
      
      // Gestione corretta delle date Firestore
      let data;
      try {
        if (attivita.timestamp && attivita.timestamp.toDate) {
          // Timestamp Firestore
          data = attivita.timestamp.toDate().toLocaleString('it-IT');
        } else if (attivita.timestamp) {
          // Stringa o numero
          data = new Date(attivita.timestamp).toLocaleString('it-IT');
        } else {
          data = 'Data non disponibile';
        }
      } catch (error) {
        console.warn('Errore nel parsing data:', error);
        data = 'Data non disponibile';
      }
      
      // Informazioni utente
      const utente = attivita.userName || attivita.userEmail || 'Utente sconosciuto';
      
      return `
        <div style="display: flex; align-items: center; gap: 12px; padding: 10px; border-bottom: 1px solid #f0f0f0;">
          <div style="font-size: 24px;">${icona}</div>
          <div style="flex: 1;">
            <div style="font-weight: 500; margin-bottom: 4px;">${descrizione}</div>
            <div style="font-size: 12px; color: #666;">
              📅 ${data} | 👤 ${utente}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Errore nel caricamento attività:', error);
    const contentDiv = document.getElementById('attivitaContent');
    if (contentDiv) {
      contentDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Errore nel caricamento delle attività</div>';
    }
  }
}

function getAttivitaIcona(action) {
  const icone = {
    'structure_created': '<i class="fas fa-plus-circle"></i>',
    'structure_updated': '<i class="fas fa-edit"></i>',
    'structure_deleted': '<i class="fas fa-trash"></i>',
    'note_created': '<i class="fas fa-sticky-note"></i>',
    'note_deleted': '<i class="fas fa-trash"></i>',
    'filter_saved': '<i class="fas fa-bookmark"></i>'
  };
  return icone[action] || '<i class="fas fa-list"></i>';
}

function getAttivitaDescrizione(attivita) {
  const descrizioni = {
    'structure_created': 'Nuova struttura creata',
    'structure_updated': 'Struttura modificata',
    'structure_deleted': 'Struttura eliminata',
    'note_created': 'Nota personale creata',
    'note_deleted': 'Nota personale eliminata',
    'filter_saved': 'Filtro salvato'
  };
  
  let descrizione = descrizioni[attivita.action] || 'Attività sconosciuta';
  
  if (attivita.details && attivita.details.structureName) {
    descrizione += `: ${attivita.details.structureName}`;
  }
  
  return descrizione;
}

// === Geocoding Automatico ===
// Cache per geocoding
const geocodingCache = new Map();
let geocodingQueue = [];
let isProcessingGeocoding = false;
let lastGeocodingRequest = 0;
const GEOCODING_DELAY = 1200; // 1.2 secondi tra richieste

async function geocodificaStruttura(struttura) {
  try {
    if (!struttura.Indirizzo && !struttura.Luogo) {
      console.log('⚠️ Nessun indirizzo disponibile per geocoding');
      return null;
    }
    
    // Costruisci query di ricerca
    let query = '';
    if (struttura.Indirizzo) {
      query = `${struttura.Indirizzo}, ${struttura.Luogo || ''}, ${struttura.Prov || ''}, Italia`;
    } else if (struttura.Luogo) {
      query = `${struttura.Luogo}, ${struttura.Prov || ''}, Italia`;
    }
    
    query = query.replace(/,\s*,/g, ',').replace(/,$/, '').trim();
    
    // Controlla cache
    if (geocodingCache.has(query)) {
      const cached = geocodingCache.get(query);
      if (cached) {
        console.log(`📋 Geocoding da cache per: ${query}`);
        return cached;
      } else {
        console.log(`❌ Geocoding fallito in precedenza per: ${query}`);
        return null;
      }
    }
    
    console.log(`🔍 Geocoding per: ${query}`);
    
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastGeocodingRequest;
    if (timeSinceLastRequest < GEOCODING_DELAY) {
      await new Promise(resolve => 
        setTimeout(resolve, GEOCODING_DELAY - timeSinceLastRequest)
      );
    }
    
    // Usa proxy CORS per evitare errori
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    const targetUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=it`;
    
    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    lastGeocodingRequest = Date.now();
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const coordinates = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
      
      // Valida coordinate
      if (isNaN(coordinates.lat) || isNaN(coordinates.lng) || 
          coordinates.lat < -90 || coordinates.lat > 90 || 
          coordinates.lng < -180 || coordinates.lng > 180) {
        console.warn('⚠️ Coordinate non valide per:', query);
        geocodingCache.set(query, null);
        return null;
      }
      
      // Salva in cache
      geocodingCache.set(query, coordinates);
      
      console.log(`✅ Coordinate trovate: ${coordinates.lat}, ${coordinates.lng}`);
      return coordinates;
    } else {
      console.log('❌ Nessun risultato trovato per:', query);
      // Salva fallimento in cache per evitare richieste ripetute
      geocodingCache.set(query, null);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Errore nel geocoding:', error);
    
    // Gestione errori specifici
    if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
      console.warn('⚠️ Errore CORS, geocoding non disponibile');
    } else if (error.message.includes('HTTP')) {
      console.warn('⚠️ Errore server geocoding:', error.message);
    }
    
    return null;
  }
}

async function geocodificaTutteStrutture() {
  console.log('🌍 Avvio geocoding di tutte le strutture...');
  
  const strutture = window.strutture || [];
  let processed = 0;
  let success = 0;
  
  for (const struttura of strutture) {
    // Salta se già ha coordinate
    if (struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng) {
      console.log(`⏭️ Struttura ${struttura.Struttura} già ha coordinate`);
      continue;
    }
    
    const coordinates = await geocodificaStruttura(struttura);
    
    if (coordinates) {
      try {
      // Aggiorna la struttura su Firestore
      await updateDoc(doc(db, "strutture", struttura.id), {
        coordinate: coordinates,
        coordinate_lat: coordinates.lat,
        coordinate_lng: coordinates.lng,
        lastModified: new Date(),
        lastModifiedBy: getCurrentUser()?.uid || null
      });
      
      // INVALIDARE CACHE LOCALE per forzare ricaricamento
      localStorage.removeItem('strutture_cache');
      localStorage.removeItem('strutture_cache_timestamp');
      
      // Aggiorna anche l'array locale
      struttura.coordinate = coordinates;
      struttura.coordinate_lat = coordinates.lat;
      struttura.coordinate_lng = coordinates.lng;
      success++;
        
        console.log(`✅ Coordinate salvate per: ${struttura.Struttura}`);
      } catch (error) {
        console.error(`❌ Errore nel salvataggio coordinate per ${struttura.Struttura}:`, error);
      }
    }
    
    processed++;
    
    // Pausa per evitare rate limiting (già gestito nella funzione geocodificaStruttura)
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`🏁 Geocoding completato: ${success} successi su ${processed} strutture processate`);
  
  // Mostra notifica di completamento
  if (success > 0) {
    alert(`✅ Geocoding completato!\n${success} strutture aggiornate con coordinate GPS`);
  } else {
    alert('⚠️ Nessuna struttura è stata aggiornata con coordinate GPS');
  }
}

// Funzione per geocoding manuale di una singola struttura
async function geocodificaSingolaStruttura(strutturaId) {
  const struttura = strutture.find(s => s.id === strutturaId);
  if (!struttura) {
    alert('Struttura non trovata!');
    return;
  }
  
  console.log(`🔍 Geocoding manuale per: ${struttura.Struttura}`);
  
  const coordinates = await geocodificaStruttura(struttura);
  
  if (coordinates) {
    try {
      // Aggiorna la struttura su Firestore
      await updateDoc(doc(db, "strutture", strutturaId), {
        coordinate: coordinates,
        coordinate_lat: coordinates.lat,
        coordinate_lng: coordinates.lng,
        lastModified: new Date(),
        lastModifiedBy: getCurrentUser()?.uid || null
      });
      
      // INVALIDARE CACHE LOCALE per forzare ricaricamento
      localStorage.removeItem('strutture_cache');
      localStorage.removeItem('strutture_cache_timestamp');
      
      // Aggiorna anche l'array locale
      struttura.coordinate = coordinates;
      struttura.coordinate_lat = coordinates.lat;
      struttura.coordinate_lng = coordinates.lng;
      
      alert(`✅ Coordinate aggiornate per: ${struttura.Struttura}\nLat: ${coordinates.lat}, Lng: ${coordinates.lng}`);
      
      // Log attività
      await logActivity('geocoding_updated', strutturaId, getCurrentUser()?.uid, {
        coordinates: coordinates
      });
      
    } catch (error) {
      console.error('❌ Errore nel salvataggio coordinate:', error);
      alert('Errore nel salvataggio delle coordinate');
    }
  } else {
    alert('❌ Impossibile trovare coordinate per questa struttura');
  }
}

// === Geolocalizzazione Utente ===
async function trovaVicinoAMe() {
  try {
    console.log('📍 Richiesta geolocalizzazione utente...');
    
    // Verifica se la geolocalizzazione è supportata
    if (!navigator.geolocation) {
      alert('❌ La geolocalizzazione non è supportata dal tuo browser');
      return;
    }
    
    // Richiedi permesso per la geolocalizzazione
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minuti
      });
    });
    
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    
    console.log(`✅ Posizione utente: ${userLat}, ${userLng}`);
    
    // Calcola distanze per tutte le strutture
    const struttureConDistanza = strutture
      .filter(struttura => struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng)
      .map(struttura => {
        const distanza = calcolaDistanza(userLat, userLng, struttura.coordinate.lat, struttura.coordinate.lng);
        return {
          ...struttura,
          distanza: distanza
        };
      })
      .sort((a, b) => a.distanza - b.distanza);
    
    if (struttureConDistanza.length === 0) {
      alert('❌ Nessuna struttura con coordinate GPS disponibile');
      return;
    }
    
    // Mostra le prime 10 strutture più vicine
    const struttureVicine = struttureConDistanza.slice(0, 10);
    
    // Crea modale con risultati
    mostraRisultatiVicinoAMe(struttureVicine, userLat, userLng);
    
  } catch (error) {
    console.error('❌ Errore nella geolocalizzazione:', error);
    
    let errorMessage = '❌ Errore nella geolocalizzazione: ';
    
    if (error.code === error.PERMISSION_DENIED) {
      errorMessage = '❌ Permesso geolocalizzazione negato.\n\nPer utilizzare questa funzione:\n1. Clicca sull\'icona del lucchetto nella barra degli indirizzi\n2. Abilita "Posizione"\n3. Ricarica la pagina e riprova';
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      errorMessage = '❌ Posizione non disponibile.\n\nVerifica che:\n- Il GPS sia attivo\n- La connessione internet sia stabile\n- Il browser abbia accesso ai servizi di localizzazione';
    } else if (error.code === error.TIMEOUT) {
      errorMessage = '❌ Timeout nella geolocalizzazione.\n\nLa richiesta ha impiegato troppo tempo.\nRiprova in un momento con migliore connessione.';
    } else {
      errorMessage += error.message;
    }
    
    // Mostra modale invece di alert per messaggi più lunghi
    if (error.code === error.PERMISSION_DENIED || error.code === error.POSITION_UNAVAILABLE) {
      mostraModaleErroreGeolocalizzazione(errorMessage);
    } else {
      alert(errorMessage);
    }
  }
}

function mostraModaleErroreGeolocalizzazione(message) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h2>📍 Geolocalizzazione</h2>
        <button class="close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="white-space: pre-line; line-height: 1.6;">
          ${message}
        </div>
        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
          <strong>💡 Suggerimento:</strong><br>
          Puoi comunque utilizzare la funzione "Trova Vicino a Me" selezionando manualmente una posizione sulla mappa.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Chiudi</button>
        <button class="btn btn-primary" onclick="this.closest('.modal').remove(); mostraMappa();">
          🗺️ Apri Mappa
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function calcolaDistanza(lat1, lng1, lat2, lng2) {
  const R = 6371; // Raggio della Terra in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function mostraRisultatiVicinoAMe(struttureVicine, userLat, userLng) {
  // Rimuovi modal esistente se presente
  const existingModal = document.getElementById('vicinoAMeModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'vicinoAMeModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 20px;
    max-width: 90%;
    max-height: 90%;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    position: relative;
    min-width: 400px;
    width: 100%;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--border-light);
  `;
  
  const title = document.createElement('h2');
  title.textContent = '📍 Strutture Vicino a Te';
  title.style.cssText = `
    margin: 0;
    color: #2f6b2f;
    font-size: 1.5rem;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => modal.remove();
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Lista strutture
  const listaDiv = document.createElement('div');
  listaDiv.style.cssText = `
    max-height: 400px;
    overflow-y: auto;
  `;
  
  if (struttureVicine.length === 0) {
    listaDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Nessuna struttura trovata nelle vicinanze</div>';
  } else {
    listaDiv.innerHTML = struttureVicine.map((struttura, index) => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;" onclick="mostraSchedaCompleta('${struttura.id}')">
        <div style="font-size: 24px; color: #2f6b2f; font-weight: bold;">${index + 1}</div>
        <div style="flex: 1;">
          <div style="font-weight: 500; margin-bottom: 4px; color: #2f6b2f;">${struttura.Struttura || 'Senza nome'}</div>
          <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">
            📍 ${struttura.Luogo || 'N/A'}, ${struttura.Prov || 'N/A'}
          </div>
          <div style="font-size: 0.8rem; color: #888;">
            ${struttura.Casa ? '🏠 Casa' : ''} ${struttura.Terreno ? '🌱 Terreno' : ''}
            ${!struttura.Casa && !struttura.Terreno ? '❓ Senza categoria' : ''}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.2rem; font-weight: bold; color: #2f6b2f;">${struttura.distanza.toFixed(1)} km</div>
          <div style="font-size: 0.8rem; color: #666;">distanza</div>
        </div>
      </div>
    `).join('');
  }
  
  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid var(--border-light);
    text-align: center;
  `;
  
  const mapBtn = document.createElement('button');
  mapBtn.innerHTML = '🗺️ Visualizza su Mappa';
  mapBtn.style.cssText = `
    background: #17a2b8;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  mapBtn.onclick = () => {
    modal.remove();
    // Apri dashboard con filtri per strutture vicine
    window.open(`dashboard.html?filter=nearby&lat=${userLat}&lng=${userLng}`, '_blank');
  };
  
  footer.appendChild(mapBtn);
  
  // Assembla il modal
  modalContent.appendChild(header);
  modalContent.appendChild(listaDiv);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// === UI Initialization Functions ===
// Funzione initializeNewUI già definita sopra alla linea 4687

function initializeUIEventListeners() {
  console.log('🎯 Inizializzazione event listeners UI...');
  
  // Search functionality
  const searchInput = document.getElementById('search');
  const clearSearchBtn = document.getElementById('clearSearch');
  
  if (searchInput) {
    // Funzione per aggiornare la visibilità del pulsante clear
    const updateClearButton = () => {
      if (clearSearchBtn) {
        if (searchInput.value.trim().length > 0) {
          clearSearchBtn.style.display = 'flex';
        } else {
          clearSearchBtn.style.display = 'none';
        }
      }
    };
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = strutture.filter(s => 
        s.Struttura?.toLowerCase().includes(query) ||
        s.Luogo?.toLowerCase().includes(query) ||
        s.Provincia?.toLowerCase().includes(query)
      );
      renderStrutture(filtered);
      updateClearButton();
    });
    
    // Inizializza visibilità pulsante clear
    updateClearButton();
  }
  
  // Funzionalità pulsante clear
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        // Trigger evento input per aggiornare i risultati
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        // Mostra tutte le strutture
        renderStrutture(filtra(strutture));
      }
    });
  }
  
  // Filter functionality (now in menu)
  const filterProv = document.getElementById('filter-prov');
  const filterStato = document.getElementById('filter-stato');
  // Filtri casa e terreno gestiti tramite ricerca avanzata
  // const filterCasa = document.getElementById('filter-casa');
  // const filterTerreno = document.getElementById('filter-terreno');
  
  if (filterProv) {
    filterProv.addEventListener('change', () => {
      paginaCorrente = 1;
      renderStrutture(filtra(strutture));
    });
  }
  
  if (filterStato) {
    filterStato.addEventListener('change', () => {
      paginaCorrente = 1;
      renderStrutture(filtra(strutture));
    });
  }
  
  // Filtri casa e terreno gestiti tramite ricerca avanzata
  // if (filterCasa) {
  //   filterCasa.addEventListener('change', () => {
  //     paginaCorrente = 1;
  //     renderStrutture(filtra(strutture));
  //   });
  // }
  // 
  // if (filterTerreno) {
  //   filterTerreno.addEventListener('change', () => {
  //     paginaCorrente = 1;
  //     renderStrutture(filtra(strutture));
  //   });
  // }
  
  // Action buttons
  const addBtn = document.getElementById('add-btn');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportBtn');
  
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (typeof window.aggiungiStruttura === 'function') {
        window.aggiungiStruttura();
      }
    });
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (typeof window.resetFiltri === 'function') {
        window.resetFiltri();
      }
    });
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (typeof window.esportaElencoPersonale === 'function') {
        window.esportaElencoPersonale();
      }
    });
  }
  
  // View toggle
  const viewToggle = document.getElementById('viewToggle');
  if (viewToggle) {
    viewToggle.addEventListener('click', () => {
      if (typeof window.toggleViewMode === 'function') {
        window.toggleViewMode();
      }
    });
  }
  
  // Advanced search
  const advancedSearchBtn = document.getElementById('advancedSearchBtn');
  if (advancedSearchBtn) {
    advancedSearchBtn.addEventListener('click', () => {
      if (typeof window.mostraRicercaAvanzata === 'function') {
        window.mostraRicercaAvanzata();
      }
    });
  }
  
  // User button - rimosso listener per elenco personale, ora gestito da cambiaUtente()
  // const userBtn = document.getElementById('userBtn');
  // if (userBtn) {
  //   userBtn.addEventListener('click', () => {
  //     if (typeof window.mostraGestioneElencoPersonale === 'function') {
  //       window.mostraGestioneElencoPersonale();
  //     }
  //   });
  // }
  
  // Saved filters dropdown
  const savedFiltersSelect = document.getElementById('savedFiltersSelect');
  if (savedFiltersSelect) {
    savedFiltersSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        if (typeof window.applicaFiltriSalvati === 'function') {
          window.applicaFiltriSalvati(e.target.value);
        }
      }
    });
  }
}

// === Esposizione Funzioni Globali ===
// Esponi tutte le funzioni necessarie per compatibilità con HTML onclick
window.cambiaPagina = cambiaPagina;
window.cambiaElementiPerPagina = cambiaElementiPerPagina;
window.mostraRicercaAvanzata = mostraRicercaAvanzata;
window.mostraGestioneElencoPersonale = mostraGestioneElencoPersonale;
window.mostraSchedaUtente = mostraSchedaUtente;
window.mostraMappa = mostraMappa;
window.trovaVicinoAMe = trovaVicinoAMe;
window.geocodificaTutteStrutture = geocodificaTutteStrutture;
window.mostraOpzioniEsportazioneGenerale = mostraOpzioniEsportazioneGenerale;
window.mostraFeedAttivita = mostraFeedAttivita;

// === FUNZIONE STATISTICHE APP ===
function mostraStatisticheApp() {
  // Chiudi il menu automaticamente
  closeMenu();
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  // Genera statistiche
  const stats = window.analyticsManager ? window.analyticsManager.generateUserReport() : {
    sessionId: 'N/A',
    sessionDuration: 0,
    totalEvents: 0,
    totalActions: 0,
    totalErrors: 0,
    eventBreakdown: {},
    actionBreakdown: {},
    performanceMetrics: {},
    mostUsedFeatures: []
  };

  const smartStats = window.smartNotificationManager ? window.smartNotificationManager.getNotificationStats() : {
    todayNotifications: 0,
    weekNotifications: 0,
    nearbyStructures: 0,
    visitedStructures: 0,
    totalNotifications: 0
  };

  const backupStats = window.backupSyncManager ? {
    lastSync: window.backupSyncManager.lastSyncTime,
    backupCount: window.backupSyncManager.backupHistory.length,
    storageUsed: window.backupSyncManager.getStorageUsage()
  } : {
    lastSync: null,
    backupCount: 0,
    storageUsed: { localStorage: 0, estimated: 0 }
  };

  modal.innerHTML = `
    <div class="modal" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #2f6b2f; font-size: 1.5rem;">📊 Statistiche App</h2>
        <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">×</button>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        
        <!-- Sessione Corrente -->
        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <h3 style="margin: 0 0 15px 0; color: #2f6b2f;">⏱️ Sessione Corrente</h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div><strong>ID Sessione:</strong> ${stats.sessionId}</div>
            <div><strong>Durata:</strong> ${stats.sessionDuration}s</div>
            <div><strong>Eventi:</strong> ${stats.totalEvents}</div>
            <div><strong>Azioni:</strong> ${stats.totalActions}</div>
            <div><strong>Errori:</strong> ${stats.totalErrors}</div>
          </div>
        </div>

        <!-- Performance -->
        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <h3 style="margin: 0 0 15px 0; color: #2f6b2f;">⚡ Performance</h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div><strong>Tempo Caricamento:</strong> ${stats.performanceMetrics.loadTime ? Math.round(stats.performanceMetrics.loadTime) + 'ms' : 'N/A'}</div>
            <div><strong>LCP:</strong> ${stats.performanceMetrics.lcp ? Math.round(stats.performanceMetrics.lcp) + 'ms' : 'N/A'}</div>
            <div><strong>FID:</strong> ${stats.performanceMetrics.fid ? Math.round(stats.performanceMetrics.fid) + 'ms' : 'N/A'}</div>
            <div><strong>CLS:</strong> ${stats.performanceMetrics.cls ? stats.performanceMetrics.cls.toFixed(3) : 'N/A'}</div>
          </div>
        </div>

        <!-- Notifiche Intelligenti -->
        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <h3 style="margin: 0 0 15px 0; color: #2f6b2f;">🧠 Notifiche Intelligenti</h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div><strong>Oggi:</strong> ${smartStats.todayNotifications}</div>
            <div><strong>Settimana:</strong> ${smartStats.weekNotifications}</div>
            <div><strong>Strutture Vicine:</strong> ${smartStats.nearbyStructures}</div>
            <div><strong>Strutture Visitate:</strong> ${smartStats.visitedStructures}</div>
          </div>
        </div>

        <!-- Backup & Sync -->
        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <h3 style="margin: 0 0 15px 0; color: #2f6b2f;">💾 Backup & Sync</h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div><strong>Ultima Sync:</strong> ${backupStats.lastSync ? backupStats.lastSync.toLocaleString() : 'Mai'}</div>
            <div><strong>Backup Disponibili:</strong> ${backupStats.backupCount}</div>
            <div><strong>Spazio Usato:</strong> ${Math.round(backupStats.storageUsed.localStorage / 1024)}KB</div>
            <div><strong>Stima Totale:</strong> ${Math.round(backupStats.storageUsed.estimated / 1024)}KB</div>
          </div>
        </div>

      </div>

      <!-- Funzioni Più Utilizzate -->
      <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <h3 style="margin: 0 0 15px 0; color: #2f6b2f;">🏆 Funzioni Più Utilizzate</h3>
        ${stats.mostUsedFeatures.length > 0 ? 
          stats.mostUsedFeatures.map(f => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-secondary); color: var(--text-primary); border-radius: 4px; margin-bottom: 8px;">
              <span>${f.feature}</span>
              <span style="background: #2f6b2f; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${f.count}</span>
            </div>
          `).join('') : 
          '<p style="color: #666; text-align: center;">Nessun dato disponibile</p>'
        }
      </div>

      <!-- Azioni -->
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
        <!-- Funzioni backup rimosse dal menu -->
        <button onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">
          ✅ Chiudi
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Funzione di utilità per mostrare notifiche
function showNotification(title, options = {}) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiMyZjZiMmYiLz4KPHN2ZyB4PSI0OCIgeT0iNDgiIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CjxwYXRoIGQ9Ik0xMiAyTDEzLjA5IDguMjZMMjAgOUwxMy4wOSAxNS43NEwxMiAyMkwxMC45MSAxNS43NEw0IDlMMTAuOTEgOC4yNkwxMiAyWiIvPgo8L3N2Zz4KPC9zdmc+',
      badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIiIGhlaWdodD0iNzIiIHZpZXdCb3g9IjAgMCA3MiA3MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiByeD0iOSIgZmlsbD0iIzJmNmIyZiIvPgo8c3ZnIHg9IjE4IiB5PSIxOCIgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIi8+Cjwvc3ZnPgo8L3N2Zz4=',
      tag: 'quovadiscout',
      ...options
    });
  } else {
    // Fallback: mostra alert o toast
    console.log('🔔 Notifica:', title, options.body);
  }
}

// Funzione per chiudere il menu automaticamente
function closeMenu() {
  const mainMenu = document.getElementById('mainMenu');
  const menuToggle = document.getElementById('menuToggle');
  
  if (mainMenu && !mainMenu.classList.contains('hidden')) {
    console.log('📱 Chiusura automatica menu');
    mainMenu.classList.add('hidden');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
    }
    document.body.style.overflow = '';
  }
}

// Funzione di test per il menu
function testMenuToggle() {
  const menuToggle = document.getElementById('menuToggle');
  const mainMenu = document.getElementById('mainMenu');
  
  console.log('🧪 Test menu toggle:');
  console.log('- Menu toggle:', menuToggle);
  console.log('- Main menu:', mainMenu);
  console.log('- Menu classes:', mainMenu?.classList.toString());
  
  if (mainMenu) {
    const isHidden = mainMenu.classList.contains('hidden');
    console.log('- Menu nascosto:', isHidden);
    
    if (isHidden) {
      mainMenu.classList.remove('hidden');
      console.log('- Menu aperto manualmente');
    } else {
      mainMenu.classList.add('hidden');
      console.log('- Menu chiuso manualmente');
    }
  }
}

// Esponi funzioni globalmente
window.mostraStatisticheApp = mostraStatisticheApp;
window.showNotification = showNotification;
window.testMenuToggle = testMenuToggle;
window.mostraPreferenzeNotifiche = mostraPreferenzeNotifiche;
window.testNotification = testNotification;
// window.mostraGestioneOffline = mostraGestioneOffline; // Funzione rimossa
window.getUserLocation = trovaVicinoAMe; // Alias per compatibilità test

console.log('✅ Funzioni globali esposte per compatibilità HTML onclick');

// === DOM Ready Initialization ===
// Event listener DOMContentLoaded rimosso per evitare conflitti
// L'inizializzazione principale è gestita da window.addEventListener("DOMContentLoaded", ...)
