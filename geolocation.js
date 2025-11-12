/**
 * Sistema di Geolocalizzazione per QuoVadiScout
 * Integra Google Maps API e concatenazione indirizzo per geolocalizzazione strutture
 */

class GeolocationManager {
  constructor() {
    this.config = window.GeolocationConfig;
    this.configUtils = window.GeolocationConfigUtils;
    this.googleMapsApiKey = this.config.googleMaps.apiKey;
    this.geocodingService = null;
    this.placesService = null;
    this.map = null;
    this.markers = [];
    this.cache = new Map();
    
    // OSM-only: inizializza Google solo se presente API key valida
    if (this.configUtils && this.configUtils.isGoogleMapsConfigured && this.configUtils.isGoogleMapsConfigured()) {
      this.initGoogleMaps();
    } else {
      console.log('ℹ️ Modalità OSM-only attiva (Google Maps disabilitato)');
    }
  }

  /**
   * Inizializza Google Maps API
   */
  async initGoogleMaps() {
    try {
      // Verifica se Google Maps è configurato
      if (!this.configUtils.isGoogleMapsConfigured()) {
        console.warn('⚠️ Google Maps API key non configurata');
        return;
      }

      // Carica Google Maps API se non già caricata
      if (typeof google === 'undefined') {
        await this.loadGoogleMapsAPI();
      }
      
      this.geocodingService = new google.maps.Geocoder();
      console.log('✅ Google Maps API inizializzata');
    } catch (error) {
      console.error('❌ Errore inizializzazione Google Maps:', error);
    }
  }

  /**
   * Carica Google Maps API dinamicamente
   */
  loadGoogleMapsAPI() {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      const libraries = this.config.googleMaps.libraries.join(',');
      const region = this.config.googleMaps.region;
      const language = this.config.googleMaps.language;
      
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.googleMapsApiKey}&libraries=${libraries}&region=${region}&language=${language}&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;
      
      window.initGoogleMaps = () => {
        resolve();
        delete window.initGoogleMaps;
      };
      
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Metodo 1: Geocoding tramite Google Maps API
   * @param {string} address - Indirizzo completo
   * @returns {Promise<Object>} Coordinate e informazioni dettagliate
   */
  async geocodeWithGoogleMaps(address) {
    try {
      const request = {
        address: address,
        region: 'IT', // Focalizza sui risultati italiani
        language: 'it'
      };

      const results = await new Promise((resolve, reject) => {
        this.geocodingService.geocode(request, (results, status) => {
          if (status === 'OK' && results.length > 0) {
            resolve(results);
          } else {
            reject(new Error(`Geocoding fallito: ${status}`));
          }
        });
      });

      const result = results[0];
      const location = result.geometry.location;
      
      return {
        success: true,
        coordinates: {
          lat: location.lat(),
          lng: location.lng()
        },
        formattedAddress: result.formatted_address,
        addressComponents: this.parseAddressComponents(result.address_components),
        googleMapsUrl: this.generateGoogleMapsUrl(location.lat(), location.lng()),
        placeId: result.place_id,
        accuracy: this.getAccuracyLevel(result.geometry.location_type)
      };
    } catch (error) {
      console.error('❌ Errore geocoding Google Maps:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Metodo 2: Concatenazione indirizzo + luogo + provincia
   * @param {Object} addressData - Dati indirizzo strutturati
   * @returns {Promise<Object>} Coordinate e informazioni
   */
  async geocodeWithConcatenation(addressData) {
    const { via, numero, luogo, provincia } = addressData;
    
    // Costruisce l'indirizzo completo
    const fullAddress = this.buildFullAddress(via, numero, luogo, provincia);
    
    // Prova prima con Google Maps
    const googleResult = await this.geocodeWithGoogleMaps(fullAddress);
    if (googleResult.success) {
      return googleResult;
    }

    // Fallback: prova con altri servizi di geocoding
    return await this.tryAlternativeGeocoding(fullAddress);
  }

  /**
   * Costruisce indirizzo completo da componenti
   */
  buildFullAddress(via, numero, luogo, provincia) {
    const parts = [];
    
    if (via) parts.push(via);
    if (numero) parts.push(numero);
    if (luogo) parts.push(luogo);
    if (provincia) parts.push(provincia);
    
    return parts.join(', ');
  }

  /**
   * Prova servizi alternativi di geocoding
   */
  async tryAlternativeGeocoding(address) {
    try {
      // Usa OpenStreetMap Nominatim come fallback
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=it&limit=1`
      );
      
      const results = await response.json();
      
      if (results.length > 0) {
        const result = results[0];
        return {
          success: true,
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon)
          },
          formattedAddress: result.display_name,
          source: 'OpenStreetMap',
          googleMapsUrl: this.generateGoogleMapsUrl(result.lat, result.lon)
        };
      }
      
      return {
        success: false,
        error: 'Nessun risultato trovato'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Genera link Google Maps
   */
  generateGoogleMapsUrl(lat, lng, address = '') {
    const baseUrl = 'https://maps.google.com/maps';
    const params = new URLSearchParams({
      q: address || `${lat},${lng}`,
      ll: `${lat},${lng}`,
      z: '15'
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Genera link per navigazione
   */
  generateNavigationUrl(lat, lng, address = '') {
    const baseUrl = 'https://www.google.com/maps/dir/';
    const destination = address ? encodeURIComponent(address) : `${lat},${lng}`;
    return `${baseUrl}${destination}`;
  }

  /**
   * Analizza componenti dell'indirizzo
   */
  parseAddressComponents(components) {
    const parsed = {
      streetNumber: '',
      route: '',
      locality: '',
      administrativeAreaLevel2: '', // Provincia
      administrativeAreaLevel1: '', // Regione
      country: '',
      postalCode: ''
    };

    components.forEach(component => {
      const types = component.types;
      const longName = component.long_name;
      const shortName = component.short_name;

      if (types.includes('street_number')) {
        parsed.streetNumber = longName;
      } else if (types.includes('route')) {
        parsed.route = longName;
      } else if (types.includes('locality')) {
        parsed.locality = longName;
      } else if (types.includes('administrative_area_level_2')) {
        parsed.administrativeAreaLevel2 = longName;
      } else if (types.includes('administrative_area_level_1')) {
        parsed.administrativeAreaLevel1 = longName;
      } else if (types.includes('country')) {
        parsed.country = longName;
      } else if (types.includes('postal_code')) {
        parsed.postalCode = longName;
      }
    });

    return parsed;
  }

  /**
   * Determina livello di accuratezza
   */
  getAccuracyLevel(locationType) {
    const accuracyMap = {
      'ROOFTOP': 'Massima (edificio specifico)',
      'RANGE_INTERPOLATED': 'Alta (interpolata)',
      'GEOMETRIC_CENTER': 'Media (centro geometrico)',
      'APPROXIMATE': 'Bassa (approssimativa)'
    };
    
    return accuracyMap[locationType] || 'Sconosciuta';
  }

  /**
   * Geocoding inverso: da coordinate a indirizzo
   */
  async reverseGeocode(lat, lng) {
    try {
      const latlng = new google.maps.LatLng(lat, lng);
      
      const results = await new Promise((resolve, reject) => {
        this.geocodingService.geocode({ location: latlng }, (results, status) => {
          if (status === 'OK' && results.length > 0) {
            resolve(results);
          } else {
            reject(new Error(`Reverse geocoding fallito: ${status}`));
          }
        });
      });

      const result = results[0];
      return {
        success: true,
        formattedAddress: result.formatted_address,
        addressComponents: this.parseAddressComponents(result.address_components),
        placeId: result.place_id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Valida coordinate
   */
  validateCoordinates(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    return {
      valid: !isNaN(latNum) && !isNaN(lngNum) && 
             latNum >= -90 && latNum <= 90 && 
             lngNum >= -180 && lngNum <= 180,
      coordinates: { lat: latNum, lng: lngNum }
    };
  }

  /**
   * Calcola distanza tra due punti
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raggio della Terra in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI/180);
  }

  /**
   * Trova strutture vicine
   */
  findNearbyStructures(userLat, userLng, structures, maxDistance = 50) {
    return structures.filter(structure => {
      if (!structure.coordinate || !structure.coordinate.lat || !structure.coordinate.lng) {
        return false;
      }
      
      const distance = this.calculateDistance(
        userLat, userLng,
        structure.coordinate.lat, structure.coordinate.lng
      );
      
      return distance <= maxDistance;
    }).map(structure => {
      const distance = this.calculateDistance(
        userLat, userLng,
        structure.coordinate.lat, structure.coordinate.lng
      );
      
      return {
        ...structure,
        distance: Math.round(distance * 100) / 100 // Arrotonda a 2 decimali
      };
    }).sort((a, b) => a.distance - b.distance);
  }
}

// Esporta per uso globale
window.GeolocationManager = GeolocationManager;

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  window.geolocationManager = new GeolocationManager();
});
