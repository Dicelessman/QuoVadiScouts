/**
 * Integrazione Sistema di Geolocalizzazione
 * Collega il sistema di geolocalizzazione con il form di aggiunta strutture
 */

class GeolocationIntegration {
  constructor() {
    this.geolocationManager = window.geolocationManager;
    this.geolocationUI = window.geolocationUI;
    this.currentStructure = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.addGeolocationButtons();
  }

  /**
   * Configura event listeners
   */
  setupEventListeners() {
    // Ascolta eventi di salvataggio geolocalizzazione
    document.addEventListener('geolocationSaved', (event) => {
      this.handleGeolocationSaved(event.detail);
    });

    // Ascolta eventi di aggiunta struttura
    document.addEventListener('structureAdded', (event) => {
      this.handleStructureAdded(event.detail);
    });
  }

  /**
   * Aggiunge pulsanti geolocalizzazione alle card strutture
   */
  addGeolocationButtons() {
    // Observer per nuove card strutture
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('structure-card')) {
            this.addGeolocationButtonToCard(node);
          }
        });
      });
    });

    observer.observe(document.getElementById('results'), {
      childList: true,
      subtree: true
    });
  }

  /**
   * Aggiunge pulsante geolocalizzazione a una card struttura
   */
  addGeolocationButtonToCard(card) {
    const actionsContainer = card.querySelector('.card-actions');
    if (!actionsContainer) return;

    // Controlla se il pulsante esiste già
    if (actionsContainer.querySelector('.geolocation-btn')) return;

    const geolocationBtn = document.createElement('button');
    geolocationBtn.className = 'geolocation-btn btn-small';
    geolocationBtn.innerHTML = '📍 Riposiziona';
    geolocationBtn.title = 'Gestisci posizione';

    geolocationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openGeolocationForStructure(card);
    });

    actionsContainer.appendChild(geolocationBtn);
  }

  /**
   * Apre modale geolocalizzazione per struttura specifica
   */
  openGeolocationForStructure(card) {
    const structureId = card.dataset.id;
    const structure = this.getStructureById(structureId);

    if (structure) {
      this.currentStructure = structure;
      this.geolocationUI.showModal(structure);
    }
  }

  /**
   * Gestisce salvataggio geolocalizzazione
   */
  handleGeolocationSaved(detail) {
    const { structure, result, isEditing } = detail;

    if (isEditing && structure) {
      // Aggiorna struttura esistente
      this.updateStructureGeolocation(structure, result);
    } else {
      // Crea nuova struttura con geolocalizzazione
      this.createStructureWithGeolocation(result);
    }

    this.showSuccessMessage('✅ Posizione salvata con successo!');
  }

  /**
   * Aggiorna geolocalizzazione struttura esistente
   */
  updateStructureGeolocation(structure, result) {
    // Aggiorna coordinate
    if (!structure.coordinate) {
      structure.coordinate = {};
    }
    structure.coordinate.lat = result.coordinates.lat;
    structure.coordinate.lng = result.coordinates.lng;

    // Aggiorna indirizzo se disponibile
    if (result.formattedAddress) {
      structure.indirizzo = result.formattedAddress;
    }

    // Salva nel localStorage
    this.saveStructureToStorage(structure);

    // Aggiorna UI
    this.updateStructureCard(structure);

    // Aggiorna mappa se visibile
    if (window.map && window.map.updateMarker) {
      window.map.updateMarker(structure);
    }
  }

  /**
   * Crea nuova struttura con geolocalizzazione
   */
  createStructureWithGeolocation(result) {
    const newStructure = {
      id: Date.now().toString(),
      struttura: 'Nuova Struttura',
      luogo: this.extractLocationFromAddress(result.formattedAddress),
      provincia: this.extractProvinceFromAddress(result.formattedAddress),
      coordinate: {
        lat: result.coordinates.lat,
        lng: result.coordinates.lng
      },
      indirizzo: result.formattedAddress,
      dataCreazione: new Date().toISOString()
    };

    // Salva struttura
    this.saveStructureToStorage(newStructure);

    // Aggiorna UI
    this.refreshStructuresList();

    // Mostra messaggio di successo
    this.showSuccessMessage('✅ Struttura creata con posizione!');
  }

  /**
   * Estrae luogo dall'indirizzo
   */
  extractLocationFromAddress(address) {
    if (!address) return '';

    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim();
    }
    return '';
  }

  /**
   * Estrae provincia dall'indirizzo
   */
  extractProvinceFromAddress(address) {
    if (!address) return '';

    const parts = address.split(',');
    if (parts.length >= 1) {
      const lastPart = parts[parts.length - 1].trim();
      // Cerca codice provincia (2 lettere)
      const provinceMatch = lastPart.match(/\b([A-Z]{2})\b/);
      if (provinceMatch) {
        return provinceMatch[1];
      }
    }
    return '';
  }

  /**
   * Ottiene struttura per ID
   */
  getStructureById(id) {
    const structures = this.getStructuresFromStorage();
    return structures.find(s => s.id === id);
  }

  /**
   * Ottiene strutture dal localStorage
   */
  getStructuresFromStorage() {
    try {
      const stored = localStorage.getItem('strutture');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Errore lettura strutture:', error);
      return [];
    }
  }

  /**
   * Salva struttura nel localStorage
   */
  saveStructureToStorage(structure) {
    try {
      const structures = this.getStructuresFromStorage();
      const existingIndex = structures.findIndex(s => s.id === structure.id);

      if (existingIndex >= 0) {
        structures[existingIndex] = structure;
      } else {
        structures.push(structure);
      }

      localStorage.setItem('strutture', JSON.stringify(structures));
    } catch (error) {
      console.error('Errore salvataggio struttura:', error);
    }
  }

  /**
   * Aggiorna card struttura
   */
  updateStructureCard(structure) {
    const card = document.querySelector(`[data-id="${structure.id}"]`);
    if (!card) return;

    // Aggiorna coordinate se mostrate
    const coordinateElement = card.querySelector('.coordinate-info');
    if (coordinateElement) {
      coordinateElement.textContent = `${structure.coordinate.lat}, ${structure.coordinate.lng}`;
    }

    // Aggiorna indirizzo se mostrato
    const addressElement = card.querySelector('.address-info');
    if (addressElement && structure.indirizzo) {
      addressElement.textContent = structure.indirizzo;
    }
  }

  /**
   * Aggiorna lista strutture
   */
  refreshStructuresList() {
    // Emette evento per aggiornare la lista
    const event = new CustomEvent('structuresUpdated');
    document.dispatchEvent(event);
  }

  /**
   * Mostra messaggio di successo
   */
  showSuccessMessage(message) {
    // Crea notifica temporanea
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10000;
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Rimuovi dopo 3 secondi
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  /**
   * Geocoding automatico per strutture senza coordinate
   */
  async processStructuresWithoutCoordinates() {
    const structures = this.getStructuresFromStorage();
    const structuresWithoutCoords = structures.filter(s =>
      !s.coordinate || !s.coordinate.lat || !s.coordinate.lng
    );

    if (structuresWithoutCoords.length === 0) {
      this.showSuccessMessage('✅ Tutte le strutture hanno già le coordinate!');
      return;
    }

    let processed = 0;
    let errors = 0;

    for (const structure of structuresWithoutCoords) {
      try {
        // Costruisce indirizzo da struttura
        const address = this.buildAddressFromStructure(structure);

        if (address) {
          const result = await this.geolocationManager.geocodeWithGoogleMaps(address);

          if (result.success) {
            structure.coordinate = result.coordinates;
            structure.indirizzo = result.formattedAddress;
            this.saveStructureToStorage(structure);
            processed++;
          } else {
            errors++;
          }
        } else {
          errors++;
        }
      } catch (error) {
        console.error('Errore geocoding struttura:', structure, error);
        errors++;
      }
    }

    // Aggiorna UI
    this.refreshStructuresList();

    // Mostra risultati
    this.showSuccessMessage(
      `✅ Geocoding completato: ${processed} successi, ${errors} errori`
    );
  }

  /**
   * Costruisce indirizzo da struttura
   */
  buildAddressFromStructure(structure) {
    const parts = [];

    if (structure.indirizzo) {
      parts.push(structure.indirizzo);
    } else {
      if (structure.via) parts.push(structure.via);
      if (structure.numero) parts.push(structure.numero);
    }

    if (structure.luogo) parts.push(structure.luogo);
    if (structure.provincia) parts.push(structure.provincia);

    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * Trova strutture vicine alla posizione utente
   */
  async findNearbyStructures() {
    if (!navigator.geolocation) {
      alert('❌ Geolocalizzazione non supportata');
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      const structures = this.getStructuresFromStorage();
      const nearbyStructures = this.geolocationManager.findNearbyStructures(
        userLat, userLng, structures, 50 // 50km raggio
      );

      if (nearbyStructures.length > 0) {
        this.showNearbyStructures(nearbyStructures);
      } else {
        this.showSuccessMessage('📍 Nessuna struttura trovata nelle vicinanze');
      }

    } catch (error) {
      alert(`❌ Errore geolocalizzazione: ${error.message}`);
    }
  }

  /**
   * Mostra strutture vicine
   */
  showNearbyStructures(structures) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>📍 Strutture Vicine</h2>
          <button class="close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="nearby-structures">
            ${structures.map(s => `
              <div class="nearby-structure">
                <h4>${s.struttura}</h4>
                <p>${s.luogo}, ${s.provincia}</p>
                <p class="distance">📍 ${s.distance} km</p>
                <button onclick="geolocationIntegration.openInMaps(${s.coordinate.lat}, ${s.coordinate.lng})">
                  🗺️ Apri in Mappe
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /**
   * Apre posizione in mappe
   */
  openInMaps(lat, lng) {
    const url = this.geolocationManager.generateGoogleMapsUrl(lat, lng);
    window.open(url, '_blank');
  }
}

// Esporta per uso globale
window.GeolocationIntegration = GeolocationIntegration;

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  window.geolocationIntegration = new GeolocationIntegration();
});
