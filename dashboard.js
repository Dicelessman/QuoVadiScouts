// === Firebase SDK Imports ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// === Configurazione Firebase ===
// Caricata runtime da /api/firebase-config.js
const firebaseConfig = (typeof window !== 'undefined' && window.FirebaseConfig)
  ? window.FirebaseConfig
  : {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: ''
    };

// === Inizializzazione Firebase ===
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const colRef = collection(db, "strutture");

// === Variabili Globali ===
let map;
let markers = [];
let currentFilter = 'all';
let markerCluster;

// === Funzioni Utility ===
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

// === Caricamento Dati ===
async function caricaStrutture() {
  try {
    console.log('📊 Caricamento dati per dashboard...');
    const snapshot = await getDocs(colRef);
    const struttureLocali = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Aggiorna le strutture globali
    window.strutture = struttureLocali;
    
    console.log(`✅ Caricate ${struttureLocali.length} strutture`);
    return struttureLocali;
  } catch (error) {
    console.error('❌ Errore nel caricamento:', error);
    throw error;
  }
}

// === Calcolo Statistiche ===
function calcolaStatistiche() {
  const strutture = window.strutture || [];
  const stats = {
    totali: strutture.length,
    case: strutture.filter(s => s.Casa && !s.Terreno).length,
    terreni: strutture.filter(s => s.Terreno && !s.Casa).length,
    entrambe: strutture.filter(s => s.Casa && s.Terreno).length,
    senza: strutture.filter(s => !s.Casa && !s.Terreno).length
  };
  
  return stats;
}

function calcolaStatisticheProvince() {
  const provinceStats = {};
  const strutture = window.strutture || [];
  
  strutture.forEach(struttura => {
    const prov = struttura.Prov || 'Non specificata';
    if (!provinceStats[prov]) {
      provinceStats[prov] = {
        totali: 0,
        case: 0,
        terreni: 0,
        entrambe: 0,
        senza: 0
      };
    }
    
    provinceStats[prov].totali++;
    
    if (struttura.Casa && struttura.Terreno) {
      provinceStats[prov].entrambe++;
    } else if (struttura.Casa) {
      provinceStats[prov].case++;
    } else if (struttura.Terreno) {
      provinceStats[prov].terreni++;
    } else {
      provinceStats[prov].senza++;
    }
  });
  
  return provinceStats;
}

// === Aggiorna Statistiche ===
function aggiornaStatistiche() {
  const stats = calcolaStatistiche();
  
  // Controlli di sicurezza per gli elementi DOM
  const elements = {
    totalStructures: document.getElementById('totalStructures'),
    totalCase: document.getElementById('totalCase'),
    totalTerreni: document.getElementById('totalTerreni'),
    totalEntrambe: document.getElementById('totalEntrambe'),
    totalSenza: document.getElementById('totalSenza')
  };
  
  // Aggiorna solo gli elementi che esistono
  if (elements.totalStructures) elements.totalStructures.textContent = stats.totali;
  if (elements.totalCase) elements.totalCase.textContent = stats.case;
  if (elements.totalTerreni) elements.totalTerreni.textContent = stats.terreni;
  if (elements.totalEntrambe) elements.totalEntrambe.textContent = stats.entrambe;
  if (elements.totalSenza) elements.totalSenza.textContent = stats.senza;
  
  // Nuove metriche avanzate
  aggiornaMetricheAvanzate();
}

function aggiornaMetricheAvanzate() {
  const strutture = window.strutture || [];
  
  // Controlli di sicurezza per gli elementi DOM
  const elements = {
    lastUpdate: document.getElementById('lastUpdate'),
    structuresWithCoords: document.getElementById('structuresWithCoords'),
    structuresWithNotes: document.getElementById('structuresWithNotes'),
    avgRating: document.getElementById('avgRating'),
    structuresVerified: document.getElementById('structuresVerified'),
    provincesCovered: document.getElementById('provincesCovered')
  };
  
  // Ultimo aggiornamento
  const lastModified = strutture
    .map(s => s.lastModified ? new Date(s.lastModified.seconds * 1000) : null)
    .filter(d => d)
    .sort((a, b) => b - a)[0];
  
  if (elements.lastUpdate) {
    elements.lastUpdate.textContent = lastModified 
      ? lastModified.toLocaleDateString('it-IT')
      : 'N/A';
  }
  
  // Strutture con coordinate
  const withCoords = strutture.filter(s => 
    (s.coordinate && s.coordinate.lat && s.coordinate.lng) ||
    (s.coordinate_lat && s.coordinate_lng)
  ).length;
  if (elements.structuresWithCoords) {
    elements.structuresWithCoords.textContent = `${withCoords} (${Math.round(withCoords/strutture.length*100)}%)`;
  }
  
  // Strutture con note personali
  const withNotes = strutture.filter(s => s.notePersonali && s.notePersonali.length > 0).length;
  if (elements.structuresWithNotes) {
    elements.structuresWithNotes.textContent = `${withNotes} (${Math.round(withNotes/strutture.length*100)}%)`;
  }
  
  // Rating medio
  const ratings = strutture
    .map(s => s.rating?.average)
    .filter(r => r !== undefined && r !== null);
  const avgRating = ratings.length > 0 
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : 'N/A';
  if (elements.avgRating) {
    elements.avgRating.textContent = avgRating;
  }
  
  // Strutture verificate (assumendo campo 'verificata' o simile)
  const verified = strutture.filter(s => s.verificata === true || s.verified === true).length;
  if (elements.structuresVerified) {
    elements.structuresVerified.textContent = `${verified} (${Math.round(verified/strutture.length*100)}%)`;
  }
  
  // Province coperte
  const uniqueProvinces = new Set(strutture.map(s => s.Prov).filter(p => p && p.trim() !== ''));
  if (elements.provincesCovered) {
    elements.provincesCovered.textContent = uniqueProvinces.size;
  }
}

function aggiornaStatisticheProvince() {
  const provinceStats = calcolaStatisticheProvince();
  const tableBody = document.getElementById('provinceTableBody');
  const filterSelect = document.getElementById('provinceFilter');
  
  // Controllo di sicurezza per gli elementi DOM
  if (!tableBody) {
    console.error('❌ Elemento provinceTableBody non trovato - DOM non ancora pronto');
    return;
  }
  
  if (!filterSelect) {
    console.error('❌ Elemento provinceFilter non trovato - DOM non ancora pronto');
    return;
  }
  
  // Popola il dropdown se non è già popolato
  if (filterSelect.options.length === 1) {
    const provinces = Object.keys(provinceStats).sort();
    provinces.forEach(prov => {
      const option = document.createElement('option');
      option.value = prov;
      option.textContent = prov;
      filterSelect.appendChild(option);
    });
  }
  
  // Ottieni filtro selezionato
  const selectedProvince = filterSelect.value;
  
  // Pulisci la tabella
  tableBody.innerHTML = '';
  
  // Ordina per numero totale di strutture
  const sortedProvinces = Object.entries(provinceStats)
    .sort(([,a], [,b]) => b.totali - a.totali);
  
  // Filtra per provincia selezionata
  const provincesToShow = selectedProvince === 'all' 
    ? sortedProvinces 
    : sortedProvinces.filter(([prov]) => prov === selectedProvince);
  
  provincesToShow.forEach(([provincia, stats]) => {
    const row = document.createElement('tr');
    row.style.cssText = `
      border-bottom: 1px solid var(--border-light);
      transition: background-color 0.2s ease;
    `;
    
    // Hover effect
    row.addEventListener('mouseenter', () => {
      row.style.backgroundColor = 'var(--bg-tertiary)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.backgroundColor = 'transparent';
    });
    
    row.innerHTML = `
      <td style="padding: 12px; font-weight: 500; color: var(--text-primary);">
        <strong>${provincia}</strong>
      </td>
      <td style="padding: 12px; text-align: center; color: var(--text-primary);">
        <strong>${stats.totali}</strong>
      </td>
      <td style="padding: 12px; text-align: center;">
        <a href="index.html?filtro=casa&provincia=${encodeURIComponent(provincia)}" 
           style="color: #1976d2; text-decoration: none; font-weight: 500;" 
           title="Cerca case in ${provincia}">
          🏠 ${stats.case}
        </a>
      </td>
      <td style="padding: 12px; text-align: center;">
        <a href="index.html?filtro=terreno&provincia=${encodeURIComponent(provincia)}" 
           style="color: #4caf50; text-decoration: none; font-weight: 500;" 
           title="Cerca terreni in ${provincia}">
          🌱 ${stats.terreni}
        </a>
      </td>
      <td style="padding: 12px; text-align: center; color: var(--text-secondary);">
        ❓ ${stats.senza}
      </td>
    `;
    
    if (tableBody) {
      tableBody.appendChild(row);
    }
  });
}

// === Inizializzazione Mappa ===
function initMap() {
  console.log('🗺️ Inizializzazione Leaflet Map...');
  
  try {
    // Inizializza la mappa Leaflet
    map = L.map('map').setView([41.9028, 12.4964], 6); // Centro Italia
    
    // Aggiungi layer OpenStreetMap base
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);
    
    // Aggiungi layer overlay per rete ferroviaria (OpenRailwayMap)
    // Aumentato contrasto: opacità più alta e filtri CSS
    const railwayLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>',
      maxZoom: 19,
      opacity: 0.9,
      className: 'railway-layer-high-contrast'
    });
    
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
    
    // Crea layer control per base maps e overlay
    const baseMaps = {
      'OpenStreetMap': osmLayer
    };
    
    const overlayMaps = {
      'Rete Ferroviaria': railwayLayer
    };
    
    // Salva il layer ferroviario in una variabile globale per accesso da pulsanti
    window.dashboardRailwayLayer = railwayLayer;
    
    console.log('✅ Mappa Leaflet creata');
    
    // Aggiungi marker per ogni struttura
    aggiungiMarkers();
    
    // Event listeners per i controlli
    document.getElementById('showAllBtn').addEventListener('click', () => filtraMarkers('all'));
    document.getElementById('showCaseBtn').addEventListener('click', () => filtraMarkers('casa'));
    document.getElementById('showTerrenoBtn').addEventListener('click', () => filtraMarkers('terreno'));
    document.getElementById('showEntrambeBtn').addEventListener('click', () => filtraMarkers('entrambe'));
    
    console.log('✅ Controlli mappa configurati');
    
  } catch (error) {
    console.error('❌ Errore nell\'inizializzazione della mappa:', error);
    document.getElementById('map').innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f0f0f0; color: #666;">
        <div style="text-align: center;">
          <h3>⚠️ Errore nel caricamento della mappa</h3>
          <p>Impossibile caricare Leaflet Map</p>
        </div>
      </div>
    `;
  }
}

// Rendi la funzione disponibile globalmente per il callback
window.dashboardInitMap = initMap;

function aggiungiMarkers() {
  if (!map) {
    console.warn('⚠️ Mappa non inizializzata, impossibile aggiungere marker');
    return;
  }
  
  console.log('📍 Aggiunta marker per le strutture...');
  // Rimuovi marker esistenti
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  
  let markerCount = 0;
  let coordinateCount = 0;
  let provinciaCount = 0;
  const strutture = window.strutture || [];
  
  strutture.forEach((struttura, index) => {
    // Prova a estrarre coordinate se disponibili
    let lat, lng;
    
    if (struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng) {
      lat = struttura.coordinate.lat;
      lng = struttura.coordinate.lng;
      if (!isNaN(lat) && !isNaN(lng)) {
        coordinateCount++;
      }
    } else if (struttura.coordinate_lat && struttura.coordinate_lng) {
      lat = struttura.coordinate_lat;
      lng = struttura.coordinate_lng;
      if (!isNaN(lat) && !isNaN(lng)) {
        coordinateCount++;
      }
    }
    
    // Se non ci sono coordinate, prova geocoding automatico
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      // Prova prima a estrarre da Google Maps
      if (struttura.google_maps_link) {
        const coordinate = estraiCoordinateDaGoogleMaps(struttura.google_maps_link);
        if (coordinate) {
          lat = coordinate.lat;
          lng = coordinate.lng;
          coordinateCount++;
        }
      }
      
      // Se ancora non ci sono coordinate, usa fallback provincia
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        const coord = getCoordinateProvincia(struttura.Prov);
        if (coord) {
          lat = coord.lat + (Math.random() - 0.5) * 0.1; // Aggiungi variazione per evitare sovrapposizione
          lng = coord.lng + (Math.random() - 0.5) * 0.1;
          provinciaCount++;
        }
      }
    }
    
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      const marker = L.marker([lat, lng], {
        title: struttura.Struttura || 'Struttura senza nome',
        icon: getMarkerIcon(struttura)
      });
      
      const popupContent = `
        <div style="padding: 10px; max-width: 300px;">
          <h4 style="margin: 0 0 8px 0; color: #2f6b2f;">${struttura.Struttura || 'Senza nome'}</h4>
          <p style="margin: 4px 0;"><strong>📍 Luogo:</strong> ${struttura.Luogo || 'N/A'}, ${struttura.Prov || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>👤 Referente:</strong> ${struttura.Referente || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>📞 Contatto:</strong> ${struttura.Contatto || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>📧 Email:</strong> ${struttura.Email || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>🌐 Sito:</strong> ${struttura.Sito || 'N/A'}</p>
          ${struttura.Letti ? `<p style="margin: 4px 0;"><strong>🛏️ Letti:</strong> ${struttura.Letti}</p>` : ''}
          ${struttura.Branco ? `<p style="margin: 4px 0;"><strong>🐺 Branco:</strong> ${struttura.Branco}</p>` : ''}
          ${struttura.Reparto ? `<p style="margin: 4px 0;"><strong>🏕️ Reparto:</strong> ${struttura.Reparto}</p>` : ''}
          ${struttura.Compagnia ? `<p style="margin: 4px 0;"><strong>🎯 Compagnia:</strong> ${struttura.Compagnia}</p>` : ''}
          ${struttura.Info ? `<p style="margin: 4px 0; font-size: 0.9rem; color: #666;">${struttura.Info}</p>` : ''}
          <div style="margin-top: 8px;">
            ${struttura.Casa ? '<span style="background: #1976d2; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin-right: 4px;">🏠 Casa</span>' : ''}
            ${struttura.Terreno ? '<span style="background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px;">🌱 Terreno</span>' : ''}
            ${!struttura.Casa && !struttura.Terreno ? '<span style="background: #9e9e9e; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px;">❓ Senza categoria</span>' : ''}
          </div>
          <div style="margin-top: 10px; text-align: center;">
            <button onclick="mostraSchedaCompleta('${struttura.id || index}')" style="background: #2f6b2f; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
              📋 Visualizza/Modifica
            </button>
          </div>
        </div>
      `;
      
      marker.bindPopup(popupContent);
      marker.addTo(map);
      
      // Aggiungi dati della struttura al marker per i filtri
      marker.struttura = struttura;
      
      markers.push(marker);
      markerCount++;
    }
  });
  
  console.log(`✅ Aggiunti ${markerCount} marker alla mappa`);
  console.log(`📊 Dettagli: ${coordinateCount} con coordinate GPS, ${provinciaCount} con coordinate provincia`);
}

function getMarkerIcon(struttura) {
  let color = '#9e9e9e'; // Default grigio
  
  if (struttura.Casa && struttura.Terreno) {
    color = '#ff9800'; // Arancione per entrambe
  } else if (struttura.Casa) {
    color = '#1976d2'; // Blu per case
  } else if (struttura.Terreno) {
    color = '#4caf50'; // Verde per terreni
  }
  
  // Crea icona personalizzata per Leaflet
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function filtraMarkers(tipo) {
  currentFilter = tipo;
  
  console.log(`🔍 Filtro mappa: ${tipo}`);
  
  // Aggiorna pulsanti
  document.querySelectorAll('.map-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`[onclick*="${tipo}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  
  let visibleCount = 0;
  const strutture = window.strutture || [];
  
  markers.forEach(marker => {
    // Usa i dati della struttura salvati nel marker
    const struttura = marker.struttura;
    
    if (!struttura) {
      map.removeLayer(marker);
      return;
    }
    
    let show = false;
    switch (tipo) {
      case 'all':
        show = true;
        break;
      case 'casa':
        show = struttura.Casa && !struttura.Terreno;
        break;
      case 'terreno':
        show = struttura.Terreno && !struttura.Casa;
        break;
      case 'entrambe':
        show = struttura.Casa && struttura.Terreno;
        break;
    }
    
    if (show) {
      if (!map.hasLayer(marker)) {
        marker.addTo(map);
      }
      visibleCount++;
    } else {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    }
  });
  
  console.log(`✅ Filtro applicato: ${visibleCount} marker visibili su ${markers.length} totali`);
}

// === Coordinate Province ===
function getCoordinateProvincia(provincia) {
  const coordinate = {
    // Lombardia
    'MI': { lat: 45.4642, lng: 9.1900 },
    'BG': { lat: 45.6944, lng: 9.6773 },
    'BS': { lat: 45.5416, lng: 10.2118 },
    'CO': { lat: 45.8081, lng: 9.0852 },
    'CR': { lat: 45.1426, lng: 10.0237 },
    'LC': { lat: 45.8566, lng: 9.3906 },
    'LO': { lat: 45.2958, lng: 9.5333 },
    'MN': { lat: 45.1473, lng: 10.7942 },
    'PV': { lat: 45.1847, lng: 9.1582 },
    'SO': { lat: 46.1708, lng: 9.8742 },
    'VA': { lat: 45.8206, lng: 8.8251 },
    'VI': { lat: 45.6089, lng: 8.8581 },
    
    // Lazio
    'RM': { lat: 41.9028, lng: 12.4964 },
    'FR': { lat: 41.6401, lng: 13.3507 },
    'LT': { lat: 41.4679, lng: 12.9036 },
    'RI': { lat: 42.4014, lng: 12.8628 },
    'VT': { lat: 42.4174, lng: 12.1082 },
    
    // Campania
    'NA': { lat: 40.8518, lng: 14.2681 },
    'AV': { lat: 40.9142, lng: 14.7828 },
    'BN': { lat: 41.1315, lng: 14.7801 },
    'CE': { lat: 41.0731, lng: 14.3328 },
    'SA': { lat: 40.6824, lng: 14.7681 },
    
    // Piemonte
    'TO': { lat: 45.0703, lng: 7.6869 },
    'AL': { lat: 44.8990, lng: 8.2060 },
    'AT': { lat: 44.8990, lng: 8.2060 },
    'BI': { lat: 45.5664, lng: 8.0536 },
    'CN': { lat: 44.3849, lng: 7.5427 },
    'NO': { lat: 45.4469, lng: 8.6219 },
    'VB': { lat: 45.8206, lng: 8.8251 },
    'VC': { lat: 45.8206, lng: 8.8251 },
    
    // Toscana
    'FI': { lat: 43.7696, lng: 11.2558 },
    'AR': { lat: 43.4647, lng: 11.8826 },
    'GR': { lat: 42.7606, lng: 11.1139 },
    'LI': { lat: 43.5489, lng: 10.3106 },
    'LU': { lat: 43.8430, lng: 10.5079 },
    'MS': { lat: 44.1466, lng: 9.8281 },
    'PI': { lat: 43.7228, lng: 10.4017 },
    'PT': { lat: 43.8735, lng: 11.0462 },
    'PO': { lat: 43.8735, lng: 11.0462 },
    'SI': { lat: 43.3188, lng: 11.3307 },
    
    // Emilia-Romagna
    'BO': { lat: 44.4949, lng: 11.3426 },
    'FE': { lat: 44.8381, lng: 11.6196 },
    'FC': { lat: 44.2207, lng: 12.0407 },
    'MO': { lat: 44.6471, lng: 10.9252 },
    'PR': { lat: 44.8015, lng: 10.3279 },
    'RE': { lat: 44.6989, lng: 10.6297 },
    'RN': { lat: 44.0594, lng: 12.5684 },
    
    // Liguria
    'GE': { lat: 44.4056, lng: 8.9463 },
    'IM': { lat: 43.9208, lng: 7.7772 },
    'SP': { lat: 44.1025, lng: 9.8238 },
    'SV': { lat: 44.3076, lng: 8.4607 },
    
    // Puglia
    'BA': { lat: 41.1177, lng: 16.8719 },
    'BT': { lat: 41.1386, lng: 16.3106 },
    'FG': { lat: 41.4622, lng: 15.5450 },
    'LE': { lat: 40.3512, lng: 18.1680 },
    'TA': { lat: 40.4749, lng: 17.2302 },
    'BR': { lat: 40.5891, lng: 17.9361 },
    
    // Sardegna
    'CA': { lat: 39.2238, lng: 9.1217 },
    'CI': { lat: 39.1653, lng: 8.7963 },
    'NU': { lat: 40.3209, lng: 9.3301 },
    'OR': { lat: 39.9056, lng: 8.5923 },
    'SS': { lat: 40.7259, lng: 8.5557 },
    'SU': { lat: 39.1706, lng: 8.4392 },
    
    // Veneto
    'VE': { lat: 45.4408, lng: 12.3155 },
    'BL': { lat: 46.1396, lng: 12.2170 },
    'PD': { lat: 45.4064, lng: 11.8768 },
    'RO': { lat: 45.0703, lng: 11.7902 },
    'TV': { lat: 45.6669, lng: 12.2431 },
    'VR': { lat: 45.4384, lng: 10.9916 },
    'VI': { lat: 45.5455, lng: 11.5353 }
  };
  
  return coordinate[provincia] || null;
}

// === Grafici ===
function creaGrafici() {
  const stats = calcolaStatistiche();
  const provinceStats = calcolaStatisticheProvince();
  const strutture = window.strutture || [];
  
  // Grafico a torta per tipo
  const typeCtx = document.getElementById('typeChart').getContext('2d');
  new Chart(typeCtx, {
    type: 'doughnut',
    data: {
      labels: ['Case', 'Terreni', 'Casa + Terreno', 'Senza Categoria'],
      datasets: [{
        data: [stats.case, stats.terreni, stats.entrambe, stats.senza],
        backgroundColor: ['#1976d2', '#4caf50', '#ff9800', '#9e9e9e'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
  
  // Grafico a barre per province
  const topProvinces = Object.entries(provinceStats)
    .sort(([,a], [,b]) => b.totali - a.totali)
    .slice(0, 10);
  
  const provinceCtx = document.getElementById('provinceChart').getContext('2d');
  new Chart(provinceCtx, {
    type: 'bar',
    data: {
      labels: topProvinces.map(([prov]) => prov),
      datasets: [{
        label: 'Strutture',
        data: topProvinces.map(([,stats]) => stats.totali),
        backgroundColor: '#2f6b2f',
        borderColor: '#1e5a1e',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

// === Inizializzazione Dashboard ===
async function inizializzaDashboard() {
  try {
    // Verifica che gli elementi DOM essenziali siano presenti
    const loadingElement = document.getElementById('loading');
    if (!loadingElement) {
      console.error('❌ Elemento loading non trovato');
      return;
    }
    
    loadingElement.classList.remove('hidden');
    
    // Attendi un momento per assicurarsi che il DOM sia completamente pronto
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const struttureCaricate = await caricaStrutture();
    aggiornaStatistiche();
    aggiornaStatisticheProvince();
    creaGrafici();
    aggiornaStatisticheApp();
    
    // Mappa rimossa - non più utilizzata nella dashboard
    // console.log('🗺️ Inizializzazione mappa Leaflet...');
    // initMap();
    
    loadingElement.classList.add('hidden');
    
  } catch (error) {
    console.error('❌ Errore nell\'inizializzazione:', error);
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.innerHTML = `
        <div class="error">
          <h3>⚠️ Errore nel caricamento</h3>
          <p>Impossibile caricare i dati della dashboard.</p>
          <button onclick="location.reload()">🔄 Ricarica</button>
        </div>
      `;
    }
  }
}

// === Event Listeners ===
// Aggiungi event listener per il pulsante refresh solo se esiste
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', inizializzaDashboard);
} else {
  console.warn('⚠️ Pulsante refresh non trovato');
}

// Listener per filtro provincia
const provinceFilter = document.getElementById('provinceFilter');
if (provinceFilter) {
  provinceFilter.addEventListener('change', () => {
    aggiornaStatisticheProvince();
  });
} else {
  console.warn('⚠️ Filtro provincia non trovato');
}

// La funzione mostraSchedaCompleta è ora gestita dal file script.js principale

// === Avvio Dashboard ===
window.addEventListener('DOMContentLoaded', inizializzaDashboard);

// Fallback Leaflet rimosso - mappa non più utilizzata

// Funzioni mappa rimosse dalla dashboard
// window.initMap = initMap;
// window.aggiungiMarkers = aggiungiMarkers;
// window.filtraMarkers = filtraMarkers;
