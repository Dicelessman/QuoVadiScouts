export function extractCoordinatesFromGoogleMapsLink(googleMapsLink) {
  if (!googleMapsLink) return null;
  try {
    const patterns = [
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /@(-?\d+\.?\d*),(-?\d+\.?\d*),\d+z/,
      /@(-?\d+\.?\d*),(-?\d+\.?\d*),\d+\.?\d*z/
    ];
    for (const pattern of patterns) {
      const match = googleMapsLink.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Calcola la distanza in chilometri tra due coordinate geografiche (formula di Haversine).
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const p1Lat = parseFloat(lat1);
  const p1Lon = parseFloat(lon1);
  const p2Lat = parseFloat(lat2);
  const p2Lon = parseFloat(lon2);

  if (Number.isNaN(p1Lat) || Number.isNaN(p1Lon) || Number.isNaN(p2Lat) || Number.isNaN(p2Lon)) {
    return null;
  }

  const R = 6371; // Raggio medio terrestre in km
  const toRad = Math.PI / 180;
  const dLat = (p2Lat - p1Lat) * toRad;
  const dLon = (p2Lon - p1Lon) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1Lat * toRad) * Math.cos(p2Lat * toRad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;

  return Math.round(dist * 10) / 10;
}

/**
 * Trova le coordinate geografiche di una città/località cercata dall'utente.
 * Cerca prioritariamente nel database dei comuni, poi nelle strutture note o tramite coordinate dirette.
 */
export function findCityCoordinates(cityName, cityCoordinatesDb = {}, structuresList = []) {
  if (!cityName || typeof cityName !== 'string') return null;
  const raw = cityName.trim();
  if (!raw) return null;

  // 1. Verifica se l'utente ha inserito coordinate dirette es. "45.07, 7.68"
  const directCoordMatch = raw.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
  if (directCoordMatch) {
    const lat = parseFloat(directCoordMatch[1]);
    const lng = parseFloat(directCoordMatch[3]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, name: raw };
    }
  }

  // Normalizza nome città (maiuscolo, senza accenti, spazi singoli)
  const normalized = raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s'-]/g, "")
    .trim();

  // 2. Cerca corrispondenza esatta nel database delle città
  if (cityCoordinatesDb && typeof cityCoordinatesDb === 'object') {
    if (cityCoordinatesDb[normalized]) {
      const [lat, lng] = cityCoordinatesDb[normalized];
      return { lat, lng, name: raw };
    }

    // Cerca corrispondenza con prefisso o contenimento
    const keys = Object.keys(cityCoordinatesDb);
    const prefixMatch = keys.find(k => k === normalized || k.startsWith(normalized) || (normalized.length >= 4 && k.includes(normalized)));
    if (prefixMatch) {
      const [lat, lng] = cityCoordinatesDb[prefixMatch];
      return { lat, lng, name: prefixMatch };
    }
  }

  // 3. Fallback: cerca nelle strutture note per Luogo o Struttura
  if (Array.isArray(structuresList) && structuresList.length > 0) {
    const sMatch = structuresList.find(s => {
      const luogoNorm = (s.Luogo || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const provNorm = (s.Prov || s.Provincia || '').toUpperCase().trim();
      const hasCoords = (s.coordinate?.lat && s.coordinate?.lng) || (s.coordinate_lat && s.coordinate_lng);
      return hasCoords && (luogoNorm === normalized || provNorm === normalized || (normalized.length >= 3 && luogoNorm.includes(normalized)));
    });

    if (sMatch) {
      const lat = sMatch.coordinate?.lat || sMatch.coordinate_lat;
      const lng = sMatch.coordinate?.lng || sMatch.coordinate_lng;
      if (lat && lng) {
        return { lat, lng, name: sMatch.Luogo || raw };
      }
    }
  }

  return null;
}
