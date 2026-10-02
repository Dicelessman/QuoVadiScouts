/**
 * Gestione autocomplete e preview di ricerca (in stile barra URL Chrome).
 * Ordine di visualizzazione:
 * 1. Città o località
 * 2. Nome struttura
 */

/**
 * Normalizza una stringa per il confronto (rimuove accenti e rende minuscolo).
 */
export function normalizeSearchTerm(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Formatta un nome città in Title Case (es. "SAN LAZZARO DI SAVENA" -> "San Lazzaro di Savena").
 */
export function formatCityDisplayName(name) {
  if (!name || typeof name !== 'string') return '';
  const lowercaseWords = new Set(['di', 'da', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'in', 'su', 'sul', 'sulla', 'e', 'ed', 'al', 'alla', 'ai', 'agli', 'alle']);
  return name
    .toLowerCase()
    .split(/([\s'-]+)/)
    .map((word, idx) => {
      if (word.match(/[\s'-]+/)) return word;
      if (idx > 0 && lowercaseWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

/**
 * Evidenzia le parti corrispondenti alla query nel testo per la visualizzazione.
 */
export function highlightMatch(text, query) {
  if (!text) return '';
  if (!query || typeof query !== 'string') return escapeHtml(text);

  const cleanQuery = query.trim();
  if (!cleanQuery) return escapeHtml(text);

  // Escaping sicuro per caratteri speciali regex
  const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  const parts = text.split(regex);
  return parts.map(part => {
    if (part.toLowerCase() === cleanQuery.toLowerCase()) {
      return `<strong class="autocomplete-match">${escapeHtml(part)}</strong>`;
    }
    return escapeHtml(part);
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Genera i suggerimenti per la preview a tendina nell'ordine:
 * 1. Città o località
 * 2. Nome struttura
 */
export function generateSearchSuggestions(query, structuresList = [], cityCoordinatesDb = {}, options = {}) {
  const { maxCities = 5, maxStructures = 6 } = options;

  if (!query || typeof query !== 'string') {
    return { query: '', cities: [], structures: [], totalMatches: 0 };
  }

  const rawQ = query.trim();
  const normQ = normalizeSearchTerm(rawQ);
  if (normQ.length === 0) {
    return { query: rawQ, cities: [], structures: [], totalMatches: 0 };
  }

  // === 1. CITTÀ O LOCALITÀ ===
  const cityMap = new Map();

  // 1a. Raccogli località direttamente dalle strutture
  if (Array.isArray(structuresList)) {
    structuresList.forEach(s => {
      const luogo = (s.Luogo || '').trim();
      const prov = (s.Prov || s.Provincia || '').trim().toUpperCase();
      if (!luogo) return;

      const normLuogo = normalizeSearchTerm(luogo);
      const normProv = normalizeSearchTerm(prov);

      const matchesLuogo = normLuogo.includes(normQ);
      const matchesProv = normProv === normQ || normProv.startsWith(normQ);

      if (matchesLuogo || matchesProv) {
        const key = `${normLuogo}_${normProv}`;
        if (!cityMap.has(key)) {
          const coords = s.coordinate || (s.coordinate_lat && s.coordinate_lng ? { lat: s.coordinate_lat, lng: s.coordinate_lng } : null);
          cityMap.set(key, {
            name: formatCityDisplayName(luogo),
            normalized: normLuogo,
            province: prov || null,
            structureCount: 1,
            coordinates: coords,
            fromStructures: true
          });
        } else {
          const entry = cityMap.get(key);
          entry.structureCount += 1;
          if (!entry.coordinates && (s.coordinate || s.coordinate_lat)) {
            entry.coordinates = s.coordinate || { lat: s.coordinate_lat, lng: s.coordinate_lng };
          }
        }
      }
    });
  }

  // 1b. Cerca anche nel database generale dei comuni italiani
  if (cityCoordinatesDb && typeof cityCoordinatesDb === 'object') {
    const dbKeys = Object.keys(cityCoordinatesDb);
    for (const key of dbKeys) {
      const normKey = normalizeSearchTerm(key);
      if (normKey.includes(normQ)) {
        const formatted = formatCityDisplayName(key);
        const mapKey = `${normKey}_`;
        if (!cityMap.has(mapKey) && ![...cityMap.values()].some(c => c.normalized === normKey)) {
          const coordsArr = cityCoordinatesDb[key];
          const coords = Array.isArray(coordsArr) ? { lat: coordsArr[0], lng: coordsArr[1] } : null;
          cityMap.set(mapKey, {
            name: formatted,
            normalized: normKey,
            province: null,
            structureCount: 0,
            coordinates: coords,
            fromStructures: false
          });
        }
      }
      if (cityMap.size >= maxCities * 3) break;
    }
  }

  // Ordina le città:
  // - Corrispondenza prefisso > sottostringa
  // - Città con strutture presenti > città senza strutture
  // - Numero di strutture decrescente
  const sortedCities = Array.from(cityMap.values()).sort((a, b) => {
    const aPrefix = a.normalized.startsWith(normQ) ? 0 : 1;
    const bPrefix = b.normalized.startsWith(normQ) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;

    if (a.structureCount !== b.structureCount) {
      return b.structureCount - a.structureCount;
    }
    return a.name.localeCompare(b.name);
  }).slice(0, maxCities);


  // === 2. NOME STRUTTURA ===
  const matchedStructures = [];
  if (Array.isArray(structuresList)) {
    structuresList.forEach(s => {
      const name = (s.Struttura || '').trim();
      const normName = normalizeSearchTerm(name);

      if (normName.includes(normQ)) {
        matchedStructures.push({
          id: s.id,
          name: name,
          normalized: normName,
          luogo: s.Luogo || '',
          prov: s.Prov || s.Provincia || '',
          casa: s.Casa === true || s.Casa === 'true',
          terreno: s.Terreno === true || s.Terreno === 'true',
          postiLetto: s.Letti || s.PostiLetto || null,
          distanzaKm: s.distanzaKm ?? null,
          isNameMatch: true,
          raw: s
        });
      }
    });

    // Ordina le strutture: prefisso nome prima, poi alfabetico
    matchedStructures.sort((a, b) => {
      const aPrefix = a.normalized.startsWith(normQ) ? 0 : 1;
      const bPrefix = b.normalized.startsWith(normQ) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.name.localeCompare(b.name);
    });
  }

  const finalStructures = matchedStructures.slice(0, maxStructures);

  return {
    query: rawQ,
    cities: sortedCities,
    structures: finalStructures,
    totalMatches: sortedCities.length + finalStructures.length
  };
}
