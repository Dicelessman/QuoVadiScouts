// === QuoVadiScout Maps v1.2.1 - Cache Bust: 2024-12-19-11-25 ===
console.log('🔄 Maps.js caricato con versione v1.2.1 - Cache bust applicato');
console.log('🗺️ Debug: Leaflet disponibile al caricamento:', typeof L !== 'undefined');

// Aggiungi script per Leaflet Routing Machine
const routingScript = document.createElement('script');
routingScript.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
routingScript.onload = () => {
  console.log('✅ Leaflet Routing Machine caricato');
};
document.head.appendChild(routingScript);

const routingCSS = document.createElement('link');
routingCSS.rel = 'stylesheet';
routingCSS.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
document.head.appendChild(routingCSS);
// Maps integration for QuoVadiScout
// Leaflet + OpenStreetMap implementation

console.log('🗺️ Maps.js caricato correttamente');

class MapsManager {
  constructor() {
    this.map = null;
    this.markers = [];
    this.markerCluster = null;
    this.userLocation = null;
    this.isInitialized = false;
    this.routingControl = null;
    this.railwayLayer = null;
    this.overlayLayers = {};
  }

  async initialize(containerId = 'map') {
    try {
      // Verifica che Leaflet sia disponibile
      if (typeof L === 'undefined') {
        console.error('❌ Leaflet non disponibile');
        console.log('🔍 Debug: typeof L =', typeof L);
        console.log('🔍 Debug: window.L =', typeof window.L);
        console.log('🔍 Debug: Leaflet disponibile dopo 1s:', typeof L);
        
        // Aspetta un po' e riprova
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (typeof L === 'undefined') {
          console.error('❌ Leaflet ancora non disponibile dopo 1 secondo');
          return false;
        }
        console.log('✅ Leaflet disponibile dopo attesa');
      }

      // Inizializza la mappa
      this.map = L.map(containerId).setView([41.9028, 12.4964], 6); // Centra sull'Italia

      // Aggiungi layer OpenStreetMap base
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(this.map);

      // Aggiungi layer overlay per rete ferroviaria (OpenRailwayMap)
      // Aumentato contrasto: opacità più alta e filtri CSS
      this.railwayLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
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
        'Rete Ferroviaria': this.railwayLayer
      };

      // Inizializza cluster di markers
      this.markerCluster = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50
      });
      this.map.addLayer(this.markerCluster);

      this.isInitialized = true;
      console.log('✅ Mappa inizializzata');
      if (this.railwayLayer) {
        console.log('✅ Layer ferroviario creato e pronto');
      }
      return true;
    } catch (error) {
      console.error('❌ Errore inizializzazione mappa:', error);
      return false;
    }
  }

  addStructureMarker(struttura) {
    if (!this.isInitialized || !this.map) return;

    try {
      let lat = null, lng = null;

      // Usa coordinate se disponibili - gestisce entrambi i formati
      if (struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng) {
        lat = struttura.coordinate.lat;
        lng = struttura.coordinate.lng;
      } else if (struttura.coordinate_lat && struttura.coordinate_lng) {
        lat = struttura.coordinate_lat;
        lng = struttura.coordinate_lng;
        // Sincronizza anche il formato coordinate per compatibilità futura
        struttura.coordinate = { lat, lng };
      } else {
        // Non fare geocoding automatico, usa fallback
        console.warn('⚠️ Nessuna posizione disponibile per:', struttura.Struttura);
        return;
      }

      // Crea icona personalizzata basata sul tipo
      const icon = this.createStructureIcon(struttura);

      // Crea marker
      const marker = L.marker([lat, lng], { icon })
        .bindPopup(this.createStructurePopup(struttura));

      this.markers.push({
        marker,
        struttura
      });

      this.markerCluster.addLayer(marker);
      console.log(`📍 Marker aggiunto per: ${struttura.Struttura}`);
    } catch (error) {
      console.error('❌ Errore aggiunta marker:', error);
    }
  }

  addStructureMarkerWithFallback(struttura) {
    if (!this.isInitialized || !this.map) return;

    // Coordinate di fallback per provincia
    const provinceCoordinates = {
      'TO': [45.0703, 7.6869], // Torino
      'CN': [44.3849, 7.5427], // Cuneo
      'AT': [44.8990, 8.2061], // Asti
      'AL': [44.9133, 8.6150], // Alessandria
      'BI': [45.5663, 8.0523], // Biella
      'NO': [45.4469, 8.6226], // Novara
      'VB': [45.8206, 8.8256], // Verbano-Cusio-Ossola
      'VC': [45.6155, 8.2956], // Vercelli
      'SV': [44.3079, 8.4683], // Savona
      'GE': [44.4056, 8.9463], // Genova
      'IM': [43.9219, 7.8519], // Imperia
      'SP': [44.1028, 9.8248], // La Spezia
      'MS': [44.1494, 9.9637], // Massa-Carrara
      'LU': [43.8428, 10.5027], // Lucca
      'PT': [43.8847, 10.8121], // Pistoia
      'PO': [43.8789, 11.0966], // Prato
      'FI': [43.7696, 11.2558], // Firenze
      'AR': [43.4627, 11.8798], // Arezzo
      'SI': [43.3188, 11.3307], // Siena
      'GR': [42.7607, 11.1134], // Grosseto
      'LI': [43.5424, 10.3105], // Livorno
      'PI': [43.7155, 10.4017], // Pisa
      'BS': [45.5416, 10.2118], // Brescia
      'BG': [45.6949, 9.6773], // Bergamo
      'CO': [45.8081, 9.0852], // Como
      'CR': [45.1327, 10.0226], // Cremona
      'LC': [45.8566, 9.3933], // Lecco
      'LO': [45.3232, 9.6592], // Lodi
      'MN': [45.1564, 10.7914], // Mantova
      'MI': [45.4642, 9.1900], // Milano
      'PV': [45.1847, 9.1582], // Pavia
      'SO': [46.1718, 9.8729], // Sondrio
      'VA': [45.8206, 8.8256], // Varese
      'PD': [45.4064, 11.8768], // Padova
      'RO': [45.0703, 11.7899], // Rovigo
      'TV': [45.6669, 12.2431], // Treviso
      'VE': [45.4408, 12.3155], // Venezia
      'VR': [45.4384, 10.9916], // Verona
      'VI': [45.5455, 11.5353], // Vicenza
      'BL': [46.1379, 12.2151], // Belluno
      'TN': [46.0679, 11.1211], // Trento
      'BZ': [46.4983, 11.3548], // Bolzano
      'UD': [46.0640, 13.2363], // Udine
      'GO': [45.9411, 13.6281], // Gorizia
      'TS': [45.6495, 13.7768], // Trieste
      'PN': [45.9564, 12.6615], // Pordenone
      'RE': [44.6989, 10.6297], // Reggio Emilia
      'MO': [44.6471, 10.9252], // Modena
      'PR': [44.8015, 10.3279], // Parma
      'PC': [45.0526, 9.6934], // Piacenza
      'BO': [44.4949, 11.3426], // Bologna
      'FE': [44.8381, 11.6191], // Ferrara
      'RA': [44.4175, 12.2035], // Ravenna
      'FC': [44.2226, 12.0407], // Forlì-Cesena
      'RN': [44.0678, 12.5695], // Rimini
      'AN': [43.5490, 13.5159], // Ancona
      'AP': [42.8540, 13.5753], // Ascoli Piceno
      'FM': [43.1609, 13.7189], // Fermo
      'MC': [43.3003, 13.4534], // Macerata
      'PU': [43.9107, 12.9136], // Pesaro e Urbino
      'PG': [43.1122, 12.3888], // Perugia
      'TR': [42.6588, 12.6440], // Terni
      'RI': [42.4018, 12.8627], // Rieti
      'VT': [42.4170, 12.1082], // Viterbo
      'RM': [41.9028, 12.4964], // Roma
      'FR': [41.6433, 13.3534], // Frosinone
      'LT': [41.4679, 13.0049], // Latina
      'CE': [41.0731, 14.3328], // Caserta
      'NA': [40.8518, 14.2681], // Napoli
      'BN': [41.1293, 14.7821], // Benevento
      'AV': [40.9223, 14.7811], // Avellino
      'SA': [40.6824, 14.7681], // Salerno
      'PZ': [40.6395, 15.8053], // Potenza
      'MT': [40.6672, 16.6046], // Matera
      'BA': [41.1177, 16.8719], // Bari
      'BT': [41.1386, 16.2766], // Barletta-Andria-Trani
      'BR': [40.6377, 17.9458], // Brindisi
      'FG': [41.4622, 15.5438], // Foggia
      'LE': [40.3573, 18.1720], // Lecce
      'TA': [40.4640, 17.2470], // Taranto
      'AQ': [42.3485, 13.3995], // L'Aquila
      'CH': [42.3512, 14.1675], // Chieti
      'PE': [42.4586, 14.2136], // Pescara
      'TE': [42.6588, 13.7034], // Teramo
      'CB': [41.5609, 14.6673], // Campobasso
      'IS': [41.5899, 14.2259], // Isernia
      'CS': [39.3088, 16.3462], // Cosenza
      'CZ': [38.9108, 16.5873], // Catanzaro
      'KR': [39.3088, 17.0377], // Crotone
      'RC': [38.1112, 15.6613], // Reggio Calabria
      'VV': [38.6762, 16.1000], // Vibo Valentia
      'PA': [38.1157, 13.3613], // Palermo
      'AG': [37.3080, 13.5853], // Agrigento
      'CL': [37.4906, 14.0625], // Caltanissetta
      'CT': [37.5079, 15.0830], // Catania
      'EN': [37.5679, 14.2790], // Enna
      'ME': [38.1938, 15.5540], // Messina
      'RG': [36.9252, 14.7309], // Ragusa
      'SR': [37.0755, 15.2866], // Siracusa
      'TP': [37.7980, 12.4340], // Trapani
      'CA': [39.2238, 9.1217], // Cagliari
      'CI': [39.1647, 8.6073], // Carbonia-Iglesias
      'VS': [39.8711, 8.5953], // Medio Campidano
      'NU': [40.3209, 9.3297], // Nuoro
      'OR': [39.9052, 8.5913], // Oristano
      'SS': [40.7259, 8.5557], // Sassari
      'OT': [40.8389, 9.4407], // Olbia-Tempio
      'OG': [39.8711, 9.6272], // Ogliastra
      'AO': [45.7376, 7.3172], // Aosta
    };

    const provincia = struttura.Prov || 'TO'; // Default Torino
    const fallbackCoords = provinceCoordinates[provincia] || [45.0703, 7.6869]; // Default Torino
    
    // Aggiungi un piccolo offset casuale per evitare sovrapposizioni
    const lat = fallbackCoords[0] + (Math.random() - 0.5) * 0.1;
    const lng = fallbackCoords[1] + (Math.random() - 0.5) * 0.1;

    // Crea icona personalizzata per marker di fallback
    const icon = L.divIcon({
      className: 'custom-div-icon',
      html: '<div style="background-color: #ffc107; color: #000; border: 2px solid #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">?</div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    // Crea marker con popup personalizzato
    const marker = L.marker([lat, lng], { icon })
      .bindPopup(`
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #2c5530;">${struttura.Struttura || 'Struttura senza nome'}</h4>
          <p style="margin: 4px 0;"><strong>📍 Luogo:</strong> ${struttura.Luogo || 'Non specificato'}, ${struttura.Prov || 'Non specificata'}</p>
          <p style="margin: 4px 0; color: #856404; background: #fff3cd; padding: 4px; border-radius: 4px; font-size: 12px;">
            <strong>⚠️ Posizione approssimativa</strong><br>
            Coordinate basate sulla provincia
          </p>
          ${struttura.Referente ? `<p style="margin: 4px 0;"><strong>👤 Referente:</strong> ${struttura.Referente}</p>` : ''}
          ${struttura.Contatto ? `<p style="margin: 4px 0;"><strong>📞 Contatto:</strong> ${struttura.Contatto}</p>` : ''}
          ${struttura.Email ? `<p style="margin: 4px 0;"><strong>📧 Email:</strong> ${struttura.Email}</p>` : ''}
          ${struttura.Info ? `<p style="margin: 4px 0;"><strong>ℹ️ Info:</strong> ${struttura.Info}</p>` : ''}
          <div style="margin-top: 8px;">
            <button onclick="window.mostraSchedaCompleta('${struttura.id}')" style="
              background: #28a745;
              color: white;
              border: none;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            ">Vedi Dettagli</button>
          </div>
        </div>
      `);

    this.markers.push({
      marker,
      struttura
    });

    this.markerCluster.addLayer(marker);
    console.log(`📍 Marker di fallback aggiunto per: ${struttura.Struttura} (${provincia})`);
  }

  createStructureIcon(struttura) {
    let iconHtml = '<i class="fas fa-campground"></i>';
    let iconColor = '#2f6b2f';

    // Colore basato sullo stato
    if (struttura.stato === 'attiva') {
      iconColor = '#28a745';
    } else if (struttura.stato === 'temporaneamente_non_attiva') {
      iconColor = '#ffc107';
    } else if (struttura.stato === 'non_piu_attiva') {
      iconColor = '#dc3545';
    }

    // Icona basata sul tipo
    if (struttura.Casa && struttura.Terreno) {
      iconHtml = '<i class="fas fa-building"></i>';
    } else if (struttura.Casa) {
      iconHtml = '<i class="fas fa-home"></i>';
    } else if (struttura.Terreno) {
      iconHtml = '<i class="fas fa-seedling"></i>';
    }

    return L.divIcon({
      html: `<div style="
        background: ${iconColor};
        color: white;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${iconHtml}</div>`,
      className: 'custom-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }

  createStructurePopup(struttura) {
    const popupContent = `
      <div style="min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #2f6b2f;">${struttura.Struttura || 'Struttura senza nome'}</h4>
        <p style="margin: 0 0 8px 0; color: #666;">
          📍 ${struttura.Luogo || 'N/A'}, ${struttura.Prov || 'N/A'}
        </p>
        <div style="margin: 8px 0;">
          ${struttura.Casa ? '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin-right: 4px;">🏠 Casa</span>' : ''}
          ${struttura.Terreno ? '<span style="background: #17a2b8; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin-right: 4px;">🌱 Terreno</span>' : ''}
          ${struttura.stato ? `<span style="background: ${this.getStateColor(struttura.stato)}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px;">${this.getStateIcon(struttura.stato)} ${this.getStateLabel(struttura.stato)}</span>` : ''}
        </div>
        ${struttura.Referente ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Referente:</strong> ${struttura.Referente}</p>` : ''}
        ${struttura.Contatto ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Contatto:</strong> ${struttura.Contatto}</p>` : ''}
        ${struttura.Email ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${struttura.Email}</p>` : ''}
        ${struttura.rating?.average ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Rating:</strong> ⭐ ${struttura.rating.average.toFixed(1)}/5</p>` : ''}
        <div style="margin-top: 8px;">
          <button onclick="window.mostraSchedaCompleta('${struttura.id}')" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          ">Visualizza Dettagli</button>
        </div>
      </div>
    `;
    return popupContent;
  }

  getStateColor(stato) {
    switch (stato) {
      case 'attiva': return '#28a745';
      case 'temporaneamente_non_attiva': return '#ffc107';
      case 'non_piu_attiva': return '#dc3545';
      default: return '#6c757d';
    }
  }

  getStateIcon(stato) {
    switch (stato) {
      case 'attiva': return '🟢';
      case 'temporaneamente_non_attiva': return '🟡';
      case 'non_piu_attiva': return '🔴';
      default: return '⚪';
    }
  }

  getStateLabel(stato) {
    switch (stato) {
      case 'attiva': return 'Attiva';
      case 'temporaneamente_non_attiva': return 'Temporaneamente non attiva';
      case 'non_piu_attiva': return 'Non più attiva';
      default: return 'Stato sconosciuto';
    }
  }

  clearMarkers() {
    if (this.markerCluster) {
      this.markerCluster.clearLayers();
    }
    this.markers = [];
    console.log('🗑️ Marker rimossi dalla mappa');
  }

  async updateMarkers(strutture) {
    if (!this.map) {
      console.warn('⚠️ MapsManager: Mappa non inizializzata, salto aggiornamento marker');
      return;
    }
    
    this.clearMarkers();
    
    // Processa ogni struttura per ottenere coordinate
    for (const struttura of strutture) {
      // Se ha coordinate precise, mostra direttamente
      if ((struttura.coordinate && struttura.coordinate.lat && struttura.coordinate.lng) ||
          (struttura.coordinate_lat && struttura.coordinate_lng)) {
        this.addStructureMarker(struttura);
      } else {
        // Fallback: usa coordinate di provincia (senza geocoding automatico)
        this.addStructureMarkerWithFallback(struttura);
      }
    }
    console.log(`📍 ${strutture.length} marker aggiornati sulla mappa`);
  }
  
  // Funzione rimossa: tentaGeocodingAutomatico
  // Il geocoding automatico è stato disabilitato per evitare loop infiniti
  // Usa solo coordinate manuali o fallback di provincia
  
  estraiCoordinateDaGoogleMaps(googleMapsLink) {
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

  // Funzione rimossa: geocodeStructure
  // Il geocoding automatico è stato disabilitato

  // Funzione rimossa: processGeocodingQueue
  // Il geocoding automatico è stato disabilitato

  // Funzioni rimosse: performGeocoding, fallbackGeocoding
  // Il geocoding automatico è stato disabilitato per evitare loop infiniti

  async saveCoordinatesToFirestore(strutturaId, lat, lng) {
    try {
      if (typeof window.updateDoc === 'function' && window.doc && window.db) {
        const docRef = window.doc(window.db, "strutture", strutturaId);
        await window.updateDoc(docRef, {
          coordinate: { lat, lng },
          lastModified: new Date()
        });
        console.log('✅ Coordinate salvate su Firestore');
      }
    } catch (error) {
      console.error('❌ Errore salvataggio coordinate:', error);
    }
  }

  async getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalizzazione non supportata'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          resolve(this.userLocation);
        },
        (error) => {
          console.error('❌ Errore geolocalizzazione:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minuti
        }
      );
    });
  }

  centerOnUserLocation() {
    if (this.userLocation) {
      this.map.setView([this.userLocation.lat, this.userLocation.lng], 13);
      
      // Aggiungi marker per la posizione utente
      L.marker([this.userLocation.lat, this.userLocation.lng], {
        icon: L.divIcon({
          html: '<div style="background: #007bff; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">📍</div>',
          className: 'user-location-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(this.map).bindPopup('La tua posizione').openPopup();
      
      console.log('📍 Mappa centrata sulla tua posizione');
    }
  }

  async findNearbyStructures(radiusKm = 50) {
    if (!this.userLocation) {
      await this.getUserLocation();
    }

    if (!this.userLocation) {
      console.error('❌ Posizione utente non disponibile');
      return [];
    }

    const nearbyStructures = window.strutture.filter(struttura => {
      if (!struttura.coordinate || !struttura.coordinate.lat || !struttura.coordinate.lng) {
        return false;
      }

      const distance = this.calculateDistance(
        this.userLocation.lat,
        this.userLocation.lng,
        struttura.coordinate.lat,
        struttura.coordinate.lng
      );

      return distance <= radiusKm;
    });

    // Ordina per distanza
    nearbyStructures.sort((a, b) => {
      const distA = this.calculateDistance(
        this.userLocation.lat,
        this.userLocation.lng,
        a.coordinate.lat,
        a.coordinate.lng
      );
      const distB = this.calculateDistance(
        this.userLocation.lat,
        this.userLocation.lng,
        b.coordinate.lat,
        b.coordinate.lng
      );
      return distA - distB;
    });

    return nearbyStructures;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raggio della Terra in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d;
  }

  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  // Calcola percorso tra due punti
  async calculateRoute(fromLat, fromLng, toLat, toLng, options = {}) {
    if (!this.map || typeof L.Routing === 'undefined') {
      console.warn('Routing non disponibile');
      return null;
    }

    try {
      // Rimuovi routing precedente se presente
      if (this.routingControl) {
        this.map.removeControl(this.routingControl);
      }

      // Crea routing control
      this.routingControl = L.Routing.control({
        waypoints: [
          L.latLng(fromLat, fromLng),
          L.latLng(toLat, toLng)
        ],
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        lineOptions: {
          styles: [{ 
            color: '#2f6b2f', 
            weight: 4,
            opacity: 0.8
          }]
        },
        show: false, // Nascondi pannello di controllo
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: true,
        createMarker: function() { return null; }, // Nessun marker sui waypoints
        ...options
      });

      // Aggiungi alla mappa
      this.routingControl.addTo(this.map);

      // Eventi routing
      this.routingControl.on('routesfound', (e) => {
        const routes = e.routes;
        const summary = routes[0].summary;
        
        console.log(`Percorso trovato: ${(summary.totalDistance / 1000).toFixed(1)}km, ${Math.round(summary.totalTime / 60)}min`);
        
        // Dispatches evento custom
        document.dispatchEvent(new CustomEvent('routeFound', {
          detail: {
            distance: summary.totalDistance,
            duration: summary.totalTime,
            routes: routes
          }
        }));
      });

      this.routingControl.on('routingerror', (e) => {
        console.error('Errore routing:', e.error);
      });

      return this.routingControl;

    } catch (error) {
      console.error('Errore calcolo percorso:', error);
      return null;
    }
  }

  // Calcola percorso dalla posizione utente a una struttura
  async calculateRouteToStructure(structureId) {
    if (!this.userLocation) {
      console.warn('Posizione utente non disponibile');
      return null;
    }

    const structure = this.structures.find(s => s.id === structureId);
    if (!structure || !structure.coordinate_lat || !structure.coordinate_lng) {
      console.warn('Struttura non trovata o senza coordinate');
      return null;
    }

    return await this.calculateRoute(
      this.userLocation.lat,
      this.userLocation.lng,
      parseFloat(structure.coordinate_lat),
      parseFloat(structure.coordinate_lng)
    );
  }

  // Rimuove il percorso corrente
  clearRoute() {
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
      this.routingControl = null;
      console.log('Percorso rimosso');
    }
  }

  destroy() {
    if (this.map) {
      this.clearRoute();
      
      // Rimuovi layer control se presente
      if (this.railwayLayerControl) {
        this.map.removeControl(this.railwayLayerControl);
        this.railwayLayerControl = null;
      }
      
      // Rimuovi layer ferroviario se presente
      if (this.railwayLayer) {
        this.map.removeLayer(this.railwayLayer);
        this.railwayLayer = null;
      }
      
      this.map.remove();
      this.map = null;
      this.markers = [];
      this.markerCluster = null;
      this.isInitialized = false;
      console.log('🗑️ Mappa distrutta');
    }
  }
}

// Variabili statiche di geocoding rimosse
// Il geocoding automatico è stato disabilitato

// Inizializza il manager delle mappe
const mapsManager = new MapsManager();

// Esporta per uso globale
window.mapsManager = mapsManager;

// Funzioni helper per l'integrazione
window.initializeMap = async (containerId) => {
  return await mapsManager.initialize(containerId);
};

window.showStructuresOnMap = (strutture) => {
  try {
    mapsManager.updateMarkers(strutture);
  } catch (error) {
    console.error('❌ Errore aggiornamento marker mappa:', error);
    
    // Utilizza il gestore errori centralizzato
    if (window.errorHandler) {
      window.errorHandler.handleMapError(error, 'showStructuresOnMap');
    }
  }
};

window.centerMapOnUser = async () => {
  try {
    await mapsManager.getUserLocation();
    mapsManager.centerOnUserLocation();
  } catch (error) {
    alert('Impossibile ottenere la tua posizione. Assicurati di aver concesso i permessi di geolocalizzazione.');
  }
};

window.findNearbyStructures = async (radiusKm) => {
  return await mapsManager.findNearbyStructures(radiusKm);
};

window.calculateRoute = async (fromLat, fromLng, toLat, toLng, options = {}) => {
  return await mapsManager.calculateRoute(fromLat, fromLng, toLat, toLng, options);
};

window.calculateRouteToStructure = async (structureId) => {
  return await mapsManager.calculateRouteToStructure(structureId);
};

window.clearRoute = () => {
  mapsManager.clearRoute();
};

// Log delle funzioni esportate (dopo averle tutte definite)
console.log('🗺️ Funzioni mappa esportate su window:', {
  initializeMap: typeof window.initializeMap,
  showStructuresOnMap: typeof window.showStructuresOnMap,
  centerMapOnUser: typeof window.centerMapOnUser,
  findNearbyStructures: typeof window.findNearbyStructures,
  calculateRoute: typeof window.calculateRoute,
  calculateRouteToStructure: typeof window.calculateRouteToStructure,
  clearRoute: typeof window.clearRoute
});

console.log('🗺️ Maps Manager caricato');
