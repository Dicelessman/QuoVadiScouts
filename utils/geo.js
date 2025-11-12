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

