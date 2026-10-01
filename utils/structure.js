export function normalizeStructureCoordinates(struttura) {
  const s = { ...struttura };
  if (s.coordinate && s.coordinate.lat && s.coordinate.lng) {
    s.coordinate_lat = s.coordinate_lat ?? s.coordinate.lat;
    s.coordinate_lng = s.coordinate_lng ?? s.coordinate.lng;
  } else if (s.coordinate_lat != null && s.coordinate_lng != null) {
    s.coordinate = s.coordinate ?? { lat: s.coordinate_lat, lng: s.coordinate_lng };
  }
  return s;
}

export function matchesQuickFilter(s, filterType, elencoPersonale = []) {
  if (!s || !filterType || filterType === 'all') return true;
  if (filterType === 'casa') return s.Casa === true;
  if (filterType === 'terreno') return s.Terreno === true;
  if (filterType === 'letti-30') {
    const letti = parseInt(s.Letti || s.PostiLetto || 0, 10);
    return !isNaN(letti) && letti >= 30;
  }
  if (filterType === 'preferiti') {
    return Array.isArray(elencoPersonale) && elencoPersonale.includes(s.id);
  }
  if (filterType === 'vicine') {
    return Boolean(s.coordinate?.lat || s.coordinate_lat);
  }
  return true;
}

