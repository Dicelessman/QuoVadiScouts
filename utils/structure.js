import { calculateDistanceKm } from './geo.js';

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

/**
 * Genera il testo formattato da condividere con i capi scout (via WhatsApp o Web Share).
 */
export function formatStructureShareText(s) {
  if (!s) return '';
  const nome = s.Struttura || 'Struttura scout';
  const luogo = [s.Luogo, s.Prov].filter(Boolean).join(' (');
  const luogoStr = luogo ? `${luogo})` : '';
  const tipologia = [s.Casa ? '🏠 Casa' : '', s.Terreno ? '🌲 Terreno' : ''].filter(Boolean).join(' + ');
  const letti = s.Letti ? `🛌 ${s.Letti} posti letto` : '';
  const contatto = s.Contatto ? `📞 ${s.Contatto}` : '';
  const referente = s.Referente ? `👤 ${s.Referente}` : '';
  
  const lat = s.coordinate?.lat || s.coordinate_lat;
  const lng = s.coordinate?.lng || s.coordinate_lng;
  const mapsUrl = (lat && lng)
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : (s.google_maps_link || '');

  const righe = [
    `⚜️ *${nome}*`,
    luogoStr ? `📍 ${luogoStr}` : '',
    tipologia ? `🏷️ ${tipologia}` : '',
    letti,
    referente,
    contatto,
    mapsUrl ? `🗺️ Mappa: ${mapsUrl}` : '',
    '',
    `Condiviso tramite QuoVadiScout`
  ].filter(Boolean);

  return righe.join('\n');
}

/**
 * Genera il link per aprire direttamente WhatsApp con il testo precompilato.
 */
export function getWhatsAppShareUrl(s) {
  const text = formatStructureShareText(s);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function matchesQuickFilter(s, filterType, elencoPersonale = [], userLocation = null, maxRadiusKm = null) {
  if (!s || !filterType || filterType === 'all') return true;

  if (filterType === 'casa') return s.Casa === true;
  if (filterType === 'terreno') return s.Terreno === true;

  // Branche scout
  if (filterType === 'branco') {
    return Boolean(
      s.Branco === true || s.Branco === 'true' || s.Branco === 'S' || s.Branco === 'Si' || s.Branco === 'Sì' ||
      s.Casa === true
    );
  }
  if (filterType === 'reparto') {
    return Boolean(
      s.Reparto === true || s.Reparto === 'true' || s.Reparto === 'S' || s.Reparto === 'Si' || s.Reparto === 'Sì' ||
      s.Terreno === true
    );
  }
  if (filterType === 'clan') {
    return Boolean(
      s.Compagnia === true || s.Compagnia === 'true' || s.Clan === true || s.Compagnia === 'S' || s.Compagnia === 'Si' ||
      (s.Info && /clan|rover|route|bivacco/i.test(s.Info))
    );
  }

  if (filterType === 'letti-30') {
    const letti = parseInt(s.Letti || s.PostiLetto || 0, 10);
    return !isNaN(letti) && letti >= 30;
  }
  if (filterType === 'preferiti') {
    return Array.isArray(elencoPersonale) && elencoPersonale.includes(s.id);
  }
  if (filterType === 'vicine') {
    const lat = s.coordinate?.lat || s.coordinate_lat;
    const lng = s.coordinate?.lng || s.coordinate_lng;
    if (!lat || !lng) return false;

    // Se abbiamo posizione utente e raggio specificato, filtriamo per distanza
    if (userLocation && userLocation.lat && userLocation.lng && maxRadiusKm) {
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
      return dist !== null && dist <= maxRadiusKm;
    }
    return true;
  }

  // Filtri per raggio diretto (es. 'raggio-50', 'raggio-100')
  if (filterType.startsWith('raggio-')) {
    const radius = parseInt(filterType.replace('raggio-', ''), 10);
    if (!isNaN(radius) && userLocation && userLocation.lat && userLocation.lng) {
      const lat = s.coordinate?.lat || s.coordinate_lat;
      const lng = s.coordinate?.lng || s.coordinate_lng;
      if (!lat || !lng) return false;
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
      return dist !== null && dist <= radius;
    }
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
