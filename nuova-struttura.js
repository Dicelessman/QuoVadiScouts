import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  sanitizeStructureForFirestore,
  calculateStructureCompleteness,
  deduplicateStructures,
  normalizeFirestoreStructureDoc
} from "./utils/structure.js";
import {
  extractCoordinatesFromGoogleMapsLink,
  findCityCoordinates
} from "./utils/geo.js";
import {
  mostraPopupConfermaSalvataggio,
  hasStructureChanges
} from "./utils/unsaved-changes.js";

const DRAFT_STORAGE_KEY = 'quovadiscout_new_structure_draft';

const ITALIAN_PROVINCES = [
  'AG', 'AL', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AT', 'AV', 'BA', 'BG', 'BI', 'BL', 'BN', 'BO',
  'BR', 'BS', 'BT', 'BZ', 'CA', 'CB', 'CE', 'CH', 'CL', 'CN', 'CO', 'CR', 'CS', 'CT', 'CZ',
  'EN', 'FC', 'FE', 'FG', 'FI', 'FM', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'KR', 'LC', 'LE',
  'LI', 'LO', 'LT', 'LU', 'MB', 'MC', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NA', 'NO', 'NU',
  'OR', 'PA', 'PC', 'PD', 'PE', 'PG', 'PI', 'PN', 'PO', 'PR', 'PT', 'PU', 'PV', 'PZ', 'RA',
  'RC', 'RE', 'RG', 'RI', 'RM', 'RN', 'RO', 'SA', 'SI', 'SO', 'SP', 'SR', 'SS', 'SU', 'SV',
  'TA', 'TE', 'TN', 'TO', 'TP', 'TR', 'TS', 'TV', 'UD', 'VA', 'VB', 'VC', 'VE', 'VI', 'VR',
  'VT', 'VV'
];

let db = null;
let auth = null;
let currentUser = null;
let isSaving = false;
let isFormDirty = false;
let allowUnloadWithoutPrompt = false;

function formatTodayItalian() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function initFirebase() {
  const cfg = window.FirebaseConfig;
  if (cfg && cfg.apiKey && cfg.apiKey.length > 5 && !cfg.apiKey.includes('YOUR_')) {
    try {
      const app = initializeApp(cfg);
      db = getFirestore(app);
      auth = getAuth(app);
      onAuthStateChanged(auth, (user) => {
        currentUser = user;
        const authBanner = document.getElementById('authWarningBanner');
        if (authBanner) {
          if (user) {
            authBanner.classList.add('hidden');
          } else {
            authBanner.classList.remove('hidden');
          }
        }
      });
    } catch (err) {
      console.warn('Inizializzazione Firebase non riuscita:', err);
    }
  }
}

function populateProvinceDatalist() {
  const datalist = document.getElementById('provinceOptions');
  if (!datalist) return;
  datalist.innerHTML = ITALIAN_PROVINCES
    .map(p => `<option value="${p}"></option>`)
    .join('');
}

function readFormData() {
  const data = {
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
    stato: 'attiva',
    coordinate_lat: null,
    coordinate_lng: null,
    google_maps_link: '',
    coordinate: { lat: null, lng: null }
  };

  document.querySelectorAll('[data-field]').forEach((el) => {
    const field = el.dataset.field;
    if (!field) return;
    if (el.type === 'checkbox') {
      data[field] = el.checked;
    } else if (el.type === 'number') {
      const parsed = parseFloat(el.value);
      data[field] = el.value !== '' && !Number.isNaN(parsed) ? parsed : null;
    } else if (field === 'Prov') {
      data[field] = el.value.trim().toUpperCase();
    } else {
      data[field] = el.value.trim();
    }
  });

  document.querySelectorAll('[data-feature-text]').forEach((textEl) => {
    const feat = textEl.dataset.featureText;
    if (!feat) return;
    const chkEl = document.querySelector(`[data-feature-check="${feat}"]`);
    const txt = textEl.value.trim();
    if (txt) {
      data[feat] = txt;
    } else if (chkEl && chkEl.checked) {
      data[feat] = 'Sì';
    } else {
      data[feat] = '';
    }
  });

  if (data.coordinate_lat !== null && data.coordinate_lng !== null) {
    data.coordinate = { lat: data.coordinate_lat, lng: data.coordinate_lng };
  }

  return data;
}

function applyDataToForm(data) {
  if (!data || typeof data !== 'object') return;

  document.querySelectorAll('[data-field]').forEach((el) => {
    const field = el.dataset.field;
    if (!field || !(field in data)) return;
    if (el.type === 'checkbox') {
      el.checked = Boolean(data[field]);
    } else if (data[field] === null || data[field] === undefined) {
      el.value = '';
    } else {
      el.value = String(data[field]);
    }
  });

  document.querySelectorAll('[data-feature-text]').forEach((textEl) => {
    const feat = textEl.dataset.featureText;
    if (!feat) return;
    const chkEl = document.querySelector(`[data-feature-check="${feat}"]`);
    const val = data[feat];
    if (val === true) {
      if (chkEl) chkEl.checked = true;
      textEl.value = '';
    } else if (typeof val === 'string' && val.trim() !== '') {
      if (chkEl) chkEl.checked = true;
      textEl.value = val.trim() === 'Sì' ? '' : val;
    } else {
      if (chkEl) chkEl.checked = false;
      textEl.value = '';
    }
  });
}

function updateCompletenessUI(data) {
  const { score, missing } = calculateStructureCompleteness(data);
  const fill = document.getElementById('completenessBarFill');
  const scoreEl = document.getElementById('completenessScoreText');
  const missingEl = document.getElementById('completenessMissingList');

  let color = '#dc2626';
  if (score >= 80) {
    color = '#16a34a';
  } else if (score >= 50) {
    color = '#d97706';
  }

  if (fill) {
    fill.style.width = `${score}%`;
    fill.style.backgroundColor = color;
  }
  if (scoreEl) {
    scoreEl.textContent = `${score}%`;
    scoreEl.style.color = color;
  }
  if (missingEl) {
    if (missing.length === 0) {
      missingEl.innerHTML = '<span style="color: #16a34a; font-weight: 600;">✅ Tutti i campi principali completi</span>';
    } else {
      missingEl.innerHTML = `<span>Consigliati per superare il 50%:</span> ${missing
        .map(m => `<span class="missing-chip">${m}</span>`)
        .join('')}`;
    }
  }
}

function saveDraft(data) {
  const statusEl = document.getElementById('draftStatusText');
  try {
    const payload = {
      data,
      updatedAt: Date.now()
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    if (statusEl) {
      const timeStr = new Date().toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      statusEl.textContent = `💾 Bozza salvata automaticamente (${timeStr})`;
    }
  } catch (err) {
    console.warn('Impossibile salvare la bozza:', err);
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch {
    return null;
  }
}

function clearStoredDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (_) {}
}

function updateLatLngInputs(lat, lng, zoom = null) {
  const latInput = document.getElementById('field-coordinate_lat');
  const lngInput = document.getElementById('field-coordinate_lng');
  if (latInput) latInput.value = Number(lat).toFixed(6);
  if (lngInput) lngInput.value = Number(lng).toFixed(6);

  if (typeof window.updateDraggableMarker === 'function') {
    window.updateDraggableMarker(Number(lat), Number(lng), zoom);
  }

  isFormDirty = true;
  const current = readFormData();
  updateCompletenessUI(current);
  saveDraft(current);
}

async function queryGeocoder(queryText) {
  const cleanQuery = (queryText || '').trim();
  if (!cleanQuery) return null;

  // 1. Serverless endpoint Vercel (/api/geocode)
  try {
    const resp = await fetch(`/api/geocode?q=${encodeURIComponent(cleanQuery)}`);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          return { lat, lng };
        }
      }
    }
  } catch (_) {}

  // 2. Fallback Nominatim diretto
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1&countrycodes=it`
    );
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          return { lat, lng };
        }
      }
    }
  } catch (_) {}

  return null;
}

function getCachedStructures() {
  try {
    const raw = localStorage.getItem('strutture_cache');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? deduplicateStructures(parsed) : [];
  } catch {
    return [];
  }
}

async function fetchExistingStructuresForDuplicateCheck() {
  if (db && currentUser) {
    try {
      const snap = await getDocs(collection(db, 'strutture'));
      const docs = snap.docs.map(d => normalizeFirestoreStructureDoc(d.id, d.data()));
      return deduplicateStructures(docs);
    } catch (err) {
      console.warn('Verifica duplicati da Firestore fallita, uso cache locale:', err);
    }
  }
  return getCachedStructures();
}

function isDuplicateOfExisting(newData, existingList) {
  const norm = (val) => String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const name = norm(newData.Struttura);
  const luogo = norm(newData.Luogo);
  const prov = norm(newData.Prov);

  if (!name) return false;

  return existingList.some((s) => {
    if (!s) return false;
    const sName = norm(s.Struttura);
    const sLuogo = norm(s.Luogo);
    const sProv = norm(s.Prov);
    if (sName !== name) return false;
    if (luogo && sLuogo && luogo === sLuogo) {
      return !prov || !sProv || prov === sProv;
    }
    return luogo === sLuogo && prov === sProv;
  });
}

async function saveNewStructure() {
  if (isSaving) return false;

  const data = readFormData();
  if (!data.Struttura) {
    alert('Il nome della struttura è obbligatorio!');
    document.getElementById('field-Struttura')?.focus();
    return false;
  }

  if (auth && !currentUser) {
    alert('Devi effettuare il login dalla pagina principale prima di creare una struttura. La bozza rimane salvata.');
    return false;
  }

  const saveBtn = document.getElementById('saveNewStructureBtn');
  const prevHtml = saveBtn ? saveBtn.innerHTML : '';
  isSaving = true;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '🔄 Creazione in corso...';
  }

  try {
    const existingList = await fetchExistingStructuresForDuplicateCheck();
    if (isDuplicateOfExisting(data, existingList)) {
      alert('⚠️ Una struttura con questo nome e località esiste già!');
      return false;
    }

    const now = new Date();
    const cleanPayload = sanitizeStructureForFirestore({
      ...data,
      rating: { total: 0, count: 0, average: 0 },
      segnalazioni: [],
      immagini: [],
      lastModified: now,
      lastModifiedBy: currentUser?.uid || null,
      createdAt: now,
      createdBy: currentUser?.uid || null,
      version: 1
    });

    if (db) {
      const docRef = await addDoc(collection(db, 'strutture'), cleanPayload);

      // Log attività (best-effort)
      try {
        await addDoc(collection(db, 'activity_log'), {
          action: 'structure_created',
          targetId: docRef.id,
          userId: currentUser?.uid || null,
          userName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Utente',
          userEmail: currentUser?.email || null,
          details: {
            structureName: cleanPayload.Struttura,
            location: cleanPayload.Luogo
          },
          timestamp: new Date()
        });
      } catch (_) {}

      localStorage.removeItem('strutture_cache');
      localStorage.removeItem('strutture_cache_timestamp');
    } else {
      // Fallback locale/demo se Firebase non è configurato
      const cached = getCachedStructures();
      cached.push({
        ...cleanPayload,
        id: 'local_' + Date.now()
      });
      localStorage.setItem('strutture_cache', JSON.stringify(cached));
      localStorage.setItem('strutture_cache_timestamp', String(Date.now()));
    }

    clearStoredDraft();
    isFormDirty = false;
    allowUnloadWithoutPrompt = true;

    alert('✅ Nuova struttura creata con successo!');
    window.location.href = 'index.html?created=1';
    return true;
  } catch (err) {
    console.error('❌ Errore durante la creazione della struttura:', err);
    alert('❌ Errore durante la creazione: ' + (err?.message || 'Riprova'));
    return false;
  } finally {
    isSaving = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = prevHtml;
    }
  }
}

function handleExitRequest() {
  const data = readFormData();
  const hasContent = hasStructureChanges({}, data, true, isFormDirty);

  if (!hasContent) {
    clearStoredDraft();
    allowUnloadWithoutPrompt = true;
    window.location.href = 'index.html';
    return;
  }

  mostraPopupConfermaSalvataggio({
    title: 'Salvare la nuova struttura?',
    message: 'Hai inserito dei dati nella bozza. Vuoi creare la struttura ora o uscire (la bozza rimane comunque disponibile)?',
    saveText: '💾 Crea ed esci',
    discardText: '🗑️ Scarta bozza ed esci',
    cancelText: '↩️ Continua a compilare',
    onSave: async () => {
      await saveNewStructure();
    },
    onDiscard: () => {
      clearStoredDraft();
      isFormDirty = false;
      allowUnloadWithoutPrompt = true;
      window.location.href = 'index.html';
    },
    onCancel: () => {}
  });
}

async function initPage() {
  initFirebase();
  populateProvinceDatalist();

  const draftData = loadDraft();
  if (draftData) {
    applyDataToForm(draftData);
    isFormDirty = true;
    const statusEl = document.getElementById('draftStatusText');
    if (statusEl) {
      statusEl.textContent = '💾 Bozza precedente ripristinata';
    }
  } else {
    const lastCheckInput = document.getElementById('field-Ultimo-controllo');
    if (lastCheckInput && !lastCheckInput.value) {
      lastCheckInput.value = formatTodayItalian();
    }
  }

  const initialData = readFormData();
  updateCompletenessUI(initialData);

  // Inizializza mappa con segnaposto trascinabile
  if (typeof window.initializeDraggableMap === 'function') {
    await window.initializeDraggableMap(
      'newStructureMap',
      initialData.coordinate_lat,
      initialData.coordinate_lng,
      {
        onPositionChange: (newLat, newLng) => {
          updateLatLngInputs(newLat, newLng);
        }
      }
    );
  }

  const form = document.getElementById('newStructureForm');
  if (form) {
    const onFormChange = (e) => {
      isFormDirty = true;

      // Estrazione automatica coordinate dal link Google Maps
      if (e.target && e.target.id === 'field-google_maps_link') {
        const extracted = extractCoordinatesFromGoogleMapsLink(e.target.value);
        if (extracted) {
          updateLatLngInputs(extracted.lat, extracted.lng, 16);
          return;
        }
      }

      // Aggiorna marker se cambiano manualmente lat/lng
      if (e.target && (e.target.id === 'field-coordinate_lat' || e.target.id === 'field-coordinate_lng')) {
        const lat = parseFloat(document.getElementById('field-coordinate_lat')?.value || '');
        const lng = parseFloat(document.getElementById('field-coordinate_lng')?.value || '');
        if (!Number.isNaN(lat) && !Number.isNaN(lng) && typeof window.updateDraggableMarker === 'function') {
          window.updateDraggableMarker(lat, lng);
        }
      }

      const currentData = readFormData();
      updateCompletenessUI(currentData);
      saveDraft(currentData);
    };

    form.addEventListener('input', onFormChange);
    form.addEventListener('change', onFormChange);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveNewStructure();
    });
  }

  const btnGeocodeAddress = document.getElementById('btnGeocodeAddress');
  if (btnGeocodeAddress) {
    btnGeocodeAddress.addEventListener('click', async () => {
      const current = readFormData();
      if (!current.Indirizzo && !current.Luogo) {
        alert('Inserisci almeno un luogo o un indirizzo per la geocodifica.');
        return;
      }

      btnGeocodeAddress.disabled = true;
      const prev = btnGeocodeAddress.innerHTML;
      btnGeocodeAddress.innerHTML = '🔄 Ricerca...';

      try {
        const fullQuery = [current.Indirizzo, current.Luogo, current.Prov, 'Italia']
          .filter(Boolean)
          .join(', ');
        let coords = await queryGeocoder(fullQuery);
        if (!coords && current.Luogo) {
          coords = await queryGeocoder([current.Luogo, current.Prov, 'Italia'].filter(Boolean).join(', '));
        }

        if (coords) {
          updateLatLngInputs(coords.lat, coords.lng, 16);
        } else {
          alert('Impossibile individuare le coordinate da questo indirizzo.');
        }
      } finally {
        btnGeocodeAddress.disabled = false;
        btnGeocodeAddress.innerHTML = prev;
      }
    });
  }

  const btnCenterCity = document.getElementById('btnCenterCity');
  if (btnCenterCity) {
    btnCenterCity.addEventListener('click', async () => {
      const current = readFormData();
      if (!current.Luogo && !current.Prov) {
        alert('Inserisci almeno un luogo o una provincia.');
        return;
      }

      btnCenterCity.disabled = true;
      const prev = btnCenterCity.innerHTML;
      btnCenterCity.innerHTML = '🔄...';

      try {
        let coords = null;
        const cached = getCachedStructures();
        if (current.Luogo) {
          const sameCity = cached.filter(s =>
            s.Luogo &&
            s.Luogo.trim().toLowerCase() === current.Luogo.trim().toLowerCase() &&
            ((s.coordinate && s.coordinate.lat) || (s.coordinate_lat && s.coordinate_lng))
          );
          if (sameCity.length > 0) {
            let sumLat = 0;
            let sumLng = 0;
            sameCity.forEach(s => {
              sumLat += Number(s.coordinate_lat || s.coordinate.lat);
              sumLng += Number(s.coordinate_lng || s.coordinate.lng);
            });
            coords = { lat: sumLat / sameCity.length, lng: sumLng / sameCity.length };
          }
        }

        if (!coords && current.Luogo) {
          const cityDb = window.CITY_COORDINATES || (typeof CITY_COORDINATES !== 'undefined' ? CITY_COORDINATES : {});
          const localMatch = findCityCoordinates(current.Luogo, cityDb, cached);
          if (localMatch) {
            coords = { lat: localMatch.lat, lng: localMatch.lng };
          }
        }

        if (!coords) {
          const cityQuery = [current.Luogo, current.Prov, 'Italia'].filter(Boolean).join(', ');
          coords = await queryGeocoder(cityQuery);
        }

        if (coords) {
          updateLatLngInputs(coords.lat, coords.lng, 14);
        } else {
          alert('Impossibile trovare le coordinate per questa città.');
        }
      } finally {
        btnCenterCity.disabled = false;
        btnCenterCity.innerHTML = prev;
      }
    });
  }

  const clearDraftBtn = document.getElementById('clearDraftBtn');
  if (clearDraftBtn) {
    clearDraftBtn.addEventListener('click', () => {
      const current = readFormData();
      const hasContent = hasStructureChanges({}, current, true, isFormDirty);
      if (hasContent && !confirm('Vuoi svuotare tutti i campi e cancellare la bozza salvata?')) {
        return;
      }
      clearStoredDraft();
      form?.reset();
      const lastCheckInput = document.getElementById('field-Ultimo-controllo');
      if (lastCheckInput) lastCheckInput.value = formatTodayItalian();
      isFormDirty = false;
      const statusEl = document.getElementById('draftStatusText');
      if (statusEl) statusEl.textContent = '📝 Nuova bozza';
      updateCompletenessUI(readFormData());
    });
  }

  document.getElementById('saveNewStructureBtn')?.addEventListener('click', saveNewStructure);
  document.getElementById('cancelNewStructureBtn')?.addEventListener('click', handleExitRequest);
  document.getElementById('backToHomeBtn')?.addEventListener('click', handleExitRequest);

  window.addEventListener('beforeunload', (e) => {
    if (allowUnloadWithoutPrompt) return;
    const current = readFormData();
    if (hasStructureChanges({}, current, true, isFormDirty)) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
