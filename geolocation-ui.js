/**
 * Interfaccia Utente per Geolocalizzazione
 * Componenti UI per gestione coordinate e indirizzi
 */

class GeolocationUI {
  constructor() {
    this.geolocationManager = window.geolocationManager;
    this.currentStructure = null;
    this.isEditing = false;
    this.draggableMap = null;

    this.init();
  }

  init() {
    this.createGeolocationModal();
    this.setupEventListeners();
  }

  /**
   * Crea modale per gestione geolocalizzazione
   */
  createGeolocationModal() {
    const modalHTML = `
      <div id="geolocationModal" class="modal hidden">
        <div class="modal-content geolocation-modal">
          <div class="modal-header">
            <h2>📍 Gestione Posizione</h2>
            <button id="closeGeolocationModal" class="close">✕</button>
          </div>
          
          <div class="modal-body">
            <!-- Metodo 1: Google Maps -->
            <section class="geolocation-method">
              <h3>🗺️ Ricerca con Google Maps</h3>
              <div class="input-group">
                <input type="text" id="googleMapsSearch" placeholder="Cerca indirizzo completo..." />
                <button id="searchGoogleMaps" class="btn-primary">🔍 Cerca</button>
              </div>
              <div id="googleMapsResults" class="search-results"></div>
            </section>

            <!-- Metodo 2: Concatenazione -->
            <section class="geolocation-method">
              <h3>📝 Indirizzo Strutturato</h3>
              <div class="address-form">
                <div class="form-row">
                  <div class="form-group">
                    <label for="addressVia">Via/Strada</label>
                    <input type="text" id="addressVia" placeholder="Via Roma" />
                  </div>
                  <div class="form-group">
                    <label for="addressNumero">Numero</label>
                    <input type="text" id="addressNumero" placeholder="123" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="addressLuogo">Luogo</label>
                    <input type="text" id="addressLuogo" placeholder="Milano" />
                  </div>
                  <div class="form-group">
                    <label for="addressProvincia">Provincia</label>
                    <input type="text" id="addressProvincia" placeholder="MI" maxlength="2" />
                  </div>
                </div>
                <button id="geocodeAddress" class="btn-primary">🌍 Trova Coordinate</button>
              </div>
            </section>

            <!-- Metodo 3: Coordinate Manuali -->
            <section class="geolocation-method">
              <h3>📍 Coordinate Manuali</h3>
              <div class="coordinates-form">
                <div class="form-row">
                  <div class="form-group">
                    <label for="manualLat">Latitudine</label>
                    <input type="number" id="manualLat" step="any" placeholder="45.4642" />
                  </div>
                  <div class="form-group">
                    <label for="manualLng">Longitudine</label>
                    <input type="number" id="manualLng" step="any" placeholder="9.1900" />
                  </div>
                </div>
                <button id="validateCoordinates" class="btn-secondary">✅ Valida</button>
                <button id="getCurrentLocation" class="btn-accent">📍 Posizione Attuale</button>
              </div>
            </section>

            <!-- Metodo 4: Mappa Interattiva -->
            <section class="geolocation-method">
              <h3>📍 Riposiziona sulla Mappa</h3>
              <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Trascina il segnaposto blu sulla posizione corretta.</p>
              <div id="geolocationMap" style="height: 300px; width: 100%; border-radius: 8px; border: 1px solid #e0e0e0;"></div>
            </section>

            <!-- Risultati e Anteprima -->
            <section class="geolocation-results">
              <h3>📊 Risultato</h3>
              <div id="geolocationPreview" class="preview-container">
                <div class="preview-info">
                  <div class="info-item">
                    <span class="label">Indirizzo:</span>
                    <span id="previewAddress" class="value">-</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Coordinate:</span>
                    <span id="previewCoordinates" class="value">-</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Accuratezza:</span>
                    <span id="previewAccuracy" class="value">-</span>
                  </div>
                </div>
                <div class="preview-actions">
                  <button id="openInGoogleMaps" class="btn-outline" disabled>🗺️ Apri in Google Maps</button>
                  <button id="getDirections" class="btn-outline" disabled>🧭 Indicazioni</button>
                </div>
              </div>
            </section>
          </div>

          <div class="modal-footer">
            <button id="saveGeolocation" class="btn-primary" disabled>💾 Salva Posizione</button>
            <button id="cancelGeolocation" class="btn-secondary">❌ Annulla</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  /**
   * Configura event listeners
   */
  setupEventListeners() {
    // Chiusura modale
    document.getElementById('closeGeolocationModal').addEventListener('click', () => {
      this.hideModal();
    });

    document.getElementById('cancelGeolocation').addEventListener('click', () => {
      this.hideModal();
    });

    // Ricerca Google Maps
    document.getElementById('searchGoogleMaps').addEventListener('click', () => {
      this.searchWithGoogleMaps();
    });

    document.getElementById('googleMapsSearch').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchWithGoogleMaps();
      }
    });

    // Geocoding indirizzo strutturato
    document.getElementById('geocodeAddress').addEventListener('click', () => {
      this.geocodeStructuredAddress();
    });

    // Validazione coordinate manuali
    document.getElementById('validateCoordinates').addEventListener('click', () => {
      this.validateManualCoordinates();
    });

    // Posizione attuale
    document.getElementById('getCurrentLocation').addEventListener('click', () => {
      this.getCurrentLocation();
    });

    // Salvataggio
    document.getElementById('saveGeolocation').addEventListener('click', () => {
      this.saveGeolocation();
    });

    // Apertura in Google Maps
    document.getElementById('openInGoogleMaps').addEventListener('click', () => {
      this.openInGoogleMaps();
    });

    // Indicazioni stradali
    document.getElementById('getDirections').addEventListener('click', () => {
      this.getDirections();
    });
  }

  /**
   * Mostra modale per struttura specifica
   */
  showModal(structure = null) {
    this.currentStructure = structure;
    this.isEditing = !!structure;

    const modal = document.getElementById('geolocationModal');
    modal.classList.remove('hidden');

    // Popola campi se in modalità editing
    if (structure && structure.coordinate) {
      this.populateFields(structure);
    } else {
      this.clearFields();
    }

    // Focus sul primo campo
    document.getElementById('googleMapsSearch').focus();

    // Inizializza mappa interattiva
    this.initInteractiveMap();
  }

  /**
   * Inizializza o aggiorna la mappa interattiva nel modale
   */
  async initInteractiveMap() {
    const lat = this.currentStructure?.coordinate?.lat || 45.4642; // Default Milano
    const lng = this.currentStructure?.coordinate?.lng || 9.1900;

    if (!this.draggableMap) {
      if (window.DraggableMarkerMapManager) {
        this.draggableMap = new window.DraggableMarkerMapManager();
        await this.draggableMap.initialize('geolocationMap', lat, lng, {
          onPositionChange: (newLat, newLng) => {
            document.getElementById('manualLat').value = newLat.toFixed(6);
            document.getElementById('manualLng').value = newLng.toFixed(6);

            // Simula click su valida per aggiornare l'anteprima
            this.validateManualCoordinates();
          }
        });
      } else {
        console.error('❌ DraggableMarkerMapManager non trovato');
      }
    } else {
      // Aggiorna marker esistente
      this.draggableMap.updateMarkerPosition(lat, lng, 15);
    }
  }

  /**
   * Nasconde modale
   */
  hideModal() {
    const modal = document.getElementById('geolocationModal');
    modal.classList.add('hidden');
    this.currentStructure = null;
    this.isEditing = false;
  }

  /**
   * Popola campi con dati struttura
   */
  populateFields(structure) {
    if (structure.coordinate) {
      document.getElementById('manualLat').value = structure.coordinate.lat;
      document.getElementById('manualLng').value = structure.coordinate.lng;
    }

    if (structure.indirizzo) {
      const parts = structure.indirizzo.split(',');
      if (parts.length >= 2) {
        document.getElementById('addressVia').value = parts[0].trim();
        if (parts.length >= 3) {
          document.getElementById('addressLuogo').value = parts[1].trim();
          document.getElementById('addressProvincia').value = parts[2].trim();
        }
      }
    }
  }

  /**
   * Pulisce tutti i campi
   */
  clearFields() {
    document.getElementById('googleMapsSearch').value = '';
    document.getElementById('addressVia').value = '';
    document.getElementById('addressNumero').value = '';
    document.getElementById('addressLuogo').value = '';
    document.getElementById('addressProvincia').value = '';
    document.getElementById('manualLat').value = '';
    document.getElementById('manualLng').value = '';
    document.getElementById('googleMapsResults').innerHTML = '';
    this.clearPreview();
  }

  /**
   * Ricerca con Google Maps
   */
  async searchWithGoogleMaps() {
    const query = document.getElementById('googleMapsSearch').value.trim();
    if (!query) return;

    const resultsContainer = document.getElementById('googleMapsResults');
    resultsContainer.innerHTML = '<div class="loading">🔍 Ricerca in corso...</div>';

    try {
      const result = await this.geolocationManager.geocodeWithGoogleMaps(query);

      if (result.success) {
        this.displayGoogleMapsResults([result]);
      } else {
        resultsContainer.innerHTML = `<div class="error">❌ ${result.error}</div>`;
      }
    } catch (error) {
      resultsContainer.innerHTML = `<div class="error">❌ Errore: ${error.message}</div>`;
    }
  }

  /**
   * Mostra risultati Google Maps
   */
  displayGoogleMapsResults(results) {
    const container = document.getElementById('googleMapsResults');

    const resultsHTML = results.map((result, index) => `
      <div class="search-result-item" data-result='${JSON.stringify(result)}'>
        <div class="result-address">${result.formattedAddress}</div>
        <div class="result-coordinates">${result.coordinates.lat}, ${result.coordinates.lng}</div>
        <div class="result-accuracy">${result.accuracy}</div>
        <button class="btn-small" onclick="geolocationUI.selectGoogleMapsResult(${index})">Seleziona</button>
      </div>
    `).join('');

    container.innerHTML = resultsHTML;
  }

  /**
   * Seleziona risultato Google Maps
   */
  selectGoogleMapsResult(index) {
    const resultItem = document.querySelectorAll('.search-result-item')[index];
    const result = JSON.parse(resultItem.dataset.result);

    this.updatePreview(result);
    this.enableSaveButton();
  }

  /**
   * Geocoding indirizzo strutturato
   */
  async geocodeStructuredAddress() {
    const via = document.getElementById('addressVia').value.trim();
    const numero = document.getElementById('addressNumero').value.trim();
    const luogo = document.getElementById('addressLuogo').value.trim();
    const provincia = document.getElementById('addressProvincia').value.trim();

    if (!via || !luogo || !provincia) {
      alert('⚠️ Compila almeno Via, Luogo e Provincia');
      return;
    }

    const addressData = { via, numero, luogo, provincia };

    try {
      const result = await this.geolocationManager.geocodeWithConcatenation(addressData);

      if (result.success) {
        this.updatePreview(result);
        this.enableSaveButton();
      } else {
        alert(`❌ Errore: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Errore: ${error.message}`);
    }
  }

  /**
   * Valida coordinate manuali
   */
  validateManualCoordinates() {
    const lat = document.getElementById('manualLat').value;
    const lng = document.getElementById('manualLng').value;

    if (!lat || !lng) {
      alert('⚠️ Inserisci entrambe le coordinate');
      return;
    }

    const validation = this.geolocationManager.validateCoordinates(lat, lng);

    if (validation.valid) {
      const result = {
        success: true,
        coordinates: validation.coordinates,
        formattedAddress: 'Coordinate manuali',
        accuracy: 'Manuale'
      };

      this.updatePreview(result);
      this.enableSaveButton();
    } else {
      alert('❌ Coordinate non valide');
    }
  }

  /**
   * Ottiene posizione attuale
   */
  async getCurrentLocation() {
    if (!navigator.geolocation) {
      alert('❌ Geolocalizzazione non supportata');
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      document.getElementById('manualLat').value = lat;
      document.getElementById('manualLng').value = lng;

      // Prova reverse geocoding
      const reverseResult = await this.geolocationManager.reverseGeocode(lat, lng);

      const result = {
        success: true,
        coordinates: { lat, lng },
        formattedAddress: reverseResult.success ? reverseResult.formattedAddress : 'Posizione attuale',
        accuracy: 'GPS'
      };

      this.updatePreview(result);
      this.enableSaveButton();

    } catch (error) {
      alert(`❌ Errore geolocalizzazione: ${error.message}`);
    }
  }

  /**
   * Aggiorna anteprima risultati
   */
  updatePreview(result) {
    document.getElementById('previewAddress').textContent = result.formattedAddress;
    document.getElementById('previewCoordinates').textContent =
      `${result.coordinates.lat}, ${result.coordinates.lng}`;
    document.getElementById('previewAccuracy').textContent = result.accuracy;

    // Abilita pulsanti azione
    document.getElementById('openInGoogleMaps').disabled = false;
    document.getElementById('getDirections').disabled = false;

    // Salva risultato per uso successivo
    this.currentResult = result;
  }

  /**
   * Pulisce anteprima
   */
  clearPreview() {
    document.getElementById('previewAddress').textContent = '-';
    document.getElementById('previewCoordinates').textContent = '-';
    document.getElementById('previewAccuracy').textContent = '-';

    document.getElementById('openInGoogleMaps').disabled = true;
    document.getElementById('getDirections').disabled = true;

    this.currentResult = null;
  }

  /**
   * Abilita pulsante salvataggio
   */
  enableSaveButton() {
    document.getElementById('saveGeolocation').disabled = false;
  }

  /**
   * Salva geolocalizzazione
   */
  saveGeolocation() {
    if (!this.currentResult) {
      alert('⚠️ Nessun risultato da salvare');
      return;
    }

    // Emette evento personalizzato per salvataggio
    const event = new CustomEvent('geolocationSaved', {
      detail: {
        structure: this.currentStructure,
        result: this.currentResult,
        isEditing: this.isEditing
      }
    });

    document.dispatchEvent(event);
    this.hideModal();
  }

  /**
   * Apre in Google Maps
   */
  openInGoogleMaps() {
    if (!this.currentResult) return;

    const url = this.geolocationManager.generateGoogleMapsUrl(
      this.currentResult.coordinates.lat,
      this.currentResult.coordinates.lng,
      this.currentResult.formattedAddress
    );

    window.open(url, '_blank');
  }

  /**
   * Ottiene indicazioni stradali
   */
  getDirections() {
    if (!this.currentResult) return;

    const url = this.geolocationManager.generateNavigationUrl(
      this.currentResult.coordinates.lat,
      this.currentResult.coordinates.lng,
      this.currentResult.formattedAddress
    );

    window.open(url, '_blank');
  }
}

// Esporta per uso globale
window.GeolocationUI = GeolocationUI;

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  window.geolocationUI = new GeolocationUI();
});
