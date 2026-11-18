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
 * Sanitizza una stringa per prevenire vulnerabilità XSS (Cross-Site Scripting).
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function hasFilledValue(val) {
  if (typeof val === 'boolean') return val === true;
  if (typeof val === 'number') return !Number.isNaN(val);
  if (Array.isArray(val)) return val.length > 0;
  return val !== undefined && val !== null && String(val).trim() !== '';
}

function hasValidCoordinates(s) {
  if (!s || typeof s !== 'object') return false;
  const lat = s.coordinate?.lat ?? s.coordinate_lat;
  const lng = s.coordinate?.lng ?? s.coordinate_lng;
  return lat !== null && lat !== undefined && lat !== '' &&
    lng !== null && lng !== undefined && lng !== '' &&
    !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
}

/**
 * Normalizza un documento letto da Firestore assicurando che `id` corrisponda
 * sempre all'ID del documento Firestore (mai sovrascritto da eventuali campi `id` legacy).
 */
export function normalizeFirestoreStructureDoc(docId, docData) {
  const data = docData && typeof docData === 'object' ? { ...docData } : {};
  if (data.id !== undefined && data.id !== null && String(data.id) !== String(docId)) {
    data._legacyId = data.id;
  }
  data.id = docId;
  return data;
}

/**
 * Rimuove i campi interni/temporanei prima di scrivere un documento su Firestore.
 */
export function sanitizeStructureForFirestore(struttura) {
  if (!struttura || typeof struttura !== 'object') return {};
  const sanitized = { ...struttura };
  delete sanitized.id;
  delete sanitized._legacyId;
  delete sanitized._duplicateIds;
  delete sanitized.distanzaKm;
  return sanitized;
}

/**
 * Calcola la percentuale di completezza della scheda struttura (0-100) e i campi mancanti.
 */
export function calculateStructureCompleteness(s) {
  if (!s || typeof s !== 'object') {
    return {
      score: 0,
      missing: ['Nome', 'Luogo', 'Posizione', 'Contatto', 'Costi', 'Referente', 'Info']
    };
  }

  let score = 0;
  const missing = [];

  // 1. CRITICAL (40%)
  if (!hasFilledValue(s.Struttura)) {
    missing.push('Nome');
  }

  // Location (15%)
  if (hasFilledValue(s.Luogo) && hasFilledValue(s.Prov)) {
    score += 15;
  } else {
    missing.push('Luogo');
  }

  // Coordinates / Address (15%)
  if (hasValidCoordinates(s) || hasFilledValue(s.Indirizzo)) {
    score += 15;
  } else {
    missing.push('Posizione');
  }

  // Contact (10%)
  if (hasFilledValue(s.Contatto) || hasFilledValue(s.Email) || hasFilledValue(s.Sito)) {
    score += 10;
  } else {
    missing.push('Contatto');
  }

  // 2. IMPORTANT (40%)
  // Payment Info (15%)
  const hasPayment = hasFilledValue(s['A persona']) || hasFilledValue(s['A giornata']) ||
    hasFilledValue(s['A notte']) || hasFilledValue(s.Offerta) ||
    hasFilledValue(s.Forfait) || hasFilledValue(s['Altri costi']);
  if (hasPayment) {
    score += 15;
  } else {
    missing.push('Costi');
  }

  // Referente (10%)
  if (hasFilledValue(s.Referente)) {
    score += 10;
  } else {
    missing.push('Referente');
  }

  // Info / Notes (15%)
  if (hasFilledValue(s.Info) || hasFilledValue(s.Note) || hasFilledValue(s['Altre info'])) {
    score += 15;
  } else {
    missing.push('Info');
  }

  // 3. BONUS (20%)
  // Features (15%)
  const hasFeatures = hasFilledValue(s.Letti) || hasFilledValue(s.Spazi) ||
    hasFilledValue(s.Fuochi) || hasFilledValue(s.Hike) ||
    hasFilledValue(s.Cucina) || hasFilledValue(s.Riscaldamento);
  if (hasFeatures) {
    score += 15;
  }

  // Google Maps Link (5%)
  if (hasFilledValue(s.google_maps_link)) {
    score += 5;
  }

  return {
    score: Math.min(100, score),
    missing
  };
}

/**
 * Converte formati eterogenei di data (Date, Timestamp Firestore, numeri, stringhe italiane/ISO/anno) in Date.
 */
export function parseStructureDate(val) {
  if (val === undefined || val === null || val === '') return null;

  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      const d = val.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    const seconds = typeof val.seconds === 'number'
      ? val.seconds
      : (typeof val._seconds === 'number' ? val._seconds : null);
    if (seconds !== null) {
      const d = new Date(seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val <= 0) return null;
    if (val >= 1900 && val <= 2100) {
      return new Date(Math.trunc(val), 6, 1);
    }
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return null;

    // Anno a 4 cifre (es. "2023")
    if (/^\d{4}$/.test(str)) {
      const year = parseInt(str, 10);
      if (year >= 1900 && year <= 2100) {
        return new Date(year, 6, 1);
      }
    }

    // Formato italiano DD/MM/YYYY o DD-MM-YYYY o DD.MM.YY
    const itMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (itMatch) {
      const day = parseInt(itMatch[1], 10);
      const month = parseInt(itMatch[2], 10);
      let year = parseInt(itMatch[3], 10);
      if (year < 100) {
        year += year >= 70 ? 1900 : 2000;
      }
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
          return d;
        }
      }
    }

    // Formato MM/YYYY o MM-YYYY
    const monthYearMatch = str.match(/^(\d{1,2})[\/\-.](\d{4})$/);
    if (monthYearMatch) {
      const month = parseInt(monthYearMatch[1], 10);
      const year = parseInt(monthYearMatch[2], 10);
      if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        return new Date(year, month - 1, 15);
      }
    }

    // Formato standard ISO / Date string
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    // Fallback: estrazione anno contenuto nel testo (es. "Estate 2023")
    const yearMatch = str.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      return new Date(parseInt(yearMatch[1], 10), 6, 1);
    }
  }

  return null;
}

/**
 * Restituisce la data di aggiornamento più recente per la struttura.
 */
export function getStructureLastUpdateDate(s) {
  if (!s || typeof s !== 'object') return null;
  const candidates = [
    s.lastModified,
    s.reviewStatus?.lastReviewedDate,
    s['Ultimo controllo'],
    s.updatedAt,
    s.createdAt
  ];

  let latestDate = null;
  for (const candidate of candidates) {
    const parsed = parseStructureDate(candidate);
    if (parsed && (!latestDate || parsed.getTime() > latestDate.getTime())) {
      latestDate = parsed;
    }
  }
  return latestDate;
}

/**
 * Valuta la visibilità del marker sulla mappa in base a completezza (<50%)
 * e anzianità dell'ultimo aggiornamento (>= 1 anno o assente).
 */
export function evaluateStructureMapVisibility(s, now = new Date()) {
  const { score, missing } = calculateStructureCompleteness(s);
  const lastUpdateDate = getStructureLastUpdateDate(s);
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = Number.isNaN(nowDate.getTime()) ? Date.now() : nowDate.getTime();

  const ageMs = lastUpdateDate ? Math.max(0, nowMs - lastUpdateDate.getTime()) : Infinity;
  const daysSinceUpdate = lastUpdateDate ? Math.floor(ageMs / (24 * 60 * 60 * 1000)) : Infinity;

  const isOutdated = !lastUpdateDate || ageMs >= ONE_YEAR_MS;
  const isIncomplete = score < 50;
  const isLowVisibility = isIncomplete || isOutdated;

  const reasons = [];
  if (isIncomplete) {
    reasons.push(`Scheda completa al ${score}% (< 50%)`);
  }
  if (isOutdated) {
    reasons.push(lastUpdateDate
      ? 'Non aggiornata da oltre 1 anno'
      : 'Data ultimo aggiornamento non presente');
  }

  return {
    completenessScore: score,
    missingFields: missing,
    lastUpdateDate,
    daysSinceUpdate,
    isOutdated,
    isIncomplete,
    isLowVisibility,
    reasons
  };
}

function normalizeMatchText(str) {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getRecordQuality(s) {
  const hasCoords = hasValidCoordinates(s) ? 1000 : 0;
  const hasRealId = s.id && !String(s.id).startsWith('new_') ? 500 : 0;
  const { score } = calculateStructureCompleteness(s);
  const updateDate = getStructureLastUpdateDate(s);
  return {
    primary: hasCoords + hasRealId + score,
    ts: updateDate ? updateDate.getTime() : 0
  };
}

function isBetterRecord(candidate, current) {
  const qA = getRecordQuality(candidate);
  const qB = getRecordQuality(current);
  if (qA.primary !== qB.primary) return qA.primary > qB.primary;
  return qA.ts > qB.ts;
}

function areDuplicateStructures(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && String(a.id) === String(b.id)) return true;
  if (a._legacyId && b._legacyId && String(a._legacyId) === String(b._legacyId)) return true;
  if (a._legacyId && b.id && String(a._legacyId) === String(b.id)) return true;
  if (b._legacyId && a.id && String(b._legacyId) === String(a.id)) return true;

  const nameA = normalizeMatchText(a.Struttura);
  const nameB = normalizeMatchText(b.Struttura);
  if (!nameA || !nameB || nameA !== nameB) return false;

  const luogoA = normalizeMatchText(a.Luogo);
  const luogoB = normalizeMatchText(b.Luogo);
  const provA = normalizeMatchText(a.Prov);
  const provB = normalizeMatchText(b.Prov);

  if (luogoA === luogoB) return true;
  if ((!luogoA || !luogoB) && provA === provB) return true;
  return false;
}

function mergeDuplicatePair(first, second) {
  const winner = isBetterRecord(second, first) ? second : first;
  const loser = winner === first ? second : first;

  const merged = { ...winner };
  const skipKeys = new Set(['id', '_legacyId', '_duplicateIds', 'distanzaKm']);

  for (const key of Object.keys(loser)) {
    if (skipKeys.has(key)) continue;
    const loserVal = loser[key];
    const winnerVal = merged[key];

    if (key === 'coordinate') {
      if (!(merged.coordinate?.lat && merged.coordinate?.lng) && loserVal?.lat && loserVal?.lng) {
        merged.coordinate = { ...loserVal };
      }
      continue;
    }

    if (key === 'rating') {
      if (!(merged.rating?.count > 0) && loserVal?.count > 0) {
        merged.rating = { ...loserVal };
      }
      continue;
    }

    const winnerEmpty = winnerVal === undefined || winnerVal === null || winnerVal === '' ||
      (Array.isArray(winnerVal) && winnerVal.length === 0);
    const loserFilled = loserVal !== undefined && loserVal !== null && loserVal !== '' &&
      !(Array.isArray(loserVal) && loserVal.length === 0);

    if (winnerEmpty && loserFilled) {
      merged[key] = loserVal;
    }
  }

  if ((!merged.id || String(merged.id).startsWith('new_')) && loser.id && !String(loser.id).startsWith('new_')) {
    if (merged.id && !merged._legacyId) {
      merged._legacyId = merged.id;
    }
    merged.id = loser.id;
  } else if (!merged._legacyId && loser._legacyId) {
    merged._legacyId = loser._legacyId;
  }

  const dupSet = new Set([...(winner._duplicateIds || []), ...(loser._duplicateIds || [])]);
  if (loser.id && !String(loser.id).startsWith('new_') && loser.id !== merged.id) {
    dupSet.add(loser.id);
  }
  if (winner.id && !String(winner.id).startsWith('new_') && winner.id !== merged.id) {
    dupSet.add(winner.id);
  }
  dupSet.delete(merged.id);

  if (dupSet.size > 0) {
    merged._duplicateIds = Array.from(dupSet);
  }

  return normalizeStructureCoordinates(merged);
}

/**
 * Deduplica un elenco di strutture unendo eventuali record duplicati in un unico elemento
 * e tenendo traccia degli ID Firestore duplicati in `_duplicateIds`.
 */
export function deduplicateStructures(lista) {
  if (!Array.isArray(lista)) return [];
  const result = [];

  for (const item of lista) {
    if (!item || typeof item !== 'object') continue;
    const matchIndex = result.findIndex(existing => areDuplicateStructures(existing, item));
    if (matchIndex === -1) {
      result.push(normalizeStructureCoordinates(item));
    } else {
      result[matchIndex] = mergeDuplicatePair(result[matchIndex], item);
    }
  }

  return result;
}
