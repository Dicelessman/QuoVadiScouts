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

export function cleanPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[^0-9+]/g, '');
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

export function calculatePagination(totalItems, currentPage = 1, pageSize = 20) {
  const validTotal = Math.max(0, parseInt(totalItems, 10) || 0);
  const validSize = Math.max(1, parseInt(pageSize, 10) || 20);
  const totalPages = Math.max(1, Math.ceil(validTotal / validSize));
  const page = Math.max(1, Math.min(parseInt(currentPage, 10) || 1, totalPages));
  const startIndex = (page - 1) * validSize;
  const endIndex = Math.min(startIndex + validSize, validTotal);

  return {
    totalItems: validTotal,
    pageSize: validSize,
    totalPages,
    currentPage: page,
    startIndex,
    endIndex,
    hasPrev: page > 1,
    hasNext: page < totalPages
  };
}

export function searchStrutture(lista, query) {
  if (!Array.isArray(lista)) return [];
  if (!query || typeof query !== 'string' || !query.trim()) return lista;

  const q = query.trim().toLowerCase();
  return lista.filter(s => {
    if (!s) return false;
    const nome = (s.Struttura || '').toLowerCase();
    const luogo = (s.Luogo || '').toLowerCase();
    const prov = (s.Prov || s.Provincia || '').toLowerCase();
    const info = (s.Info || '').toLowerCase();
    const referente = (s.Referente || '').toLowerCase();
    return nome.includes(q) || luogo.includes(q) || prov.includes(q) || info.includes(q) || referente.includes(q);
  });
}
