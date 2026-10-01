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
