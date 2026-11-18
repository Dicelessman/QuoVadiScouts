import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStructureCoordinates,
  matchesQuickFilter,
  cleanPhoneNumber,
  escapeHtml,
  calculatePagination,
  searchStrutture,
  formatStructureShareText,
  getWhatsAppShareUrl,
  normalizeFirestoreStructureDoc,
  sanitizeStructureForFirestore,
  calculateStructureCompleteness,
  parseStructureDate,
  getStructureLastUpdateDate,
  evaluateStructureMapVisibility,
  isGhostOrDeletedStructure,
  deduplicateStructures
} from '../utils/structure.js';

test('normalizeStructureCoordinates adds coordinate_lat/lng from coordinate', () => {
  const inObj = { coordinate: { lat: 10, lng: 20 } };
  const out = normalizeStructureCoordinates(inObj);
  assert.equal(out.coordinate_lat, 10);
  assert.equal(out.coordinate_lng, 20);
});

test('normalizeStructureCoordinates adds coordinate object from lat/lng', () => {
  const inObj = { coordinate_lat: 45.1, coordinate_lng: 7.7 };
  const out = normalizeStructureCoordinates(inObj);
  assert.deepEqual(out.coordinate, { lat: 45.1, lng: 7.7 });
});

test('matchesQuickFilter checks casa and terreno correctly', () => {
  const casa = { id: 'c1', Casa: true, Terreno: false };
  const terreno = { id: 't1', Casa: false, Terreno: true };

  assert.equal(matchesQuickFilter(casa, 'all'), true);
  assert.equal(matchesQuickFilter(casa, 'casa'), true);
  assert.equal(matchesQuickFilter(casa, 'terreno'), false);
  assert.equal(matchesQuickFilter(terreno, 'terreno'), true);
  assert.equal(matchesQuickFilter(terreno, 'casa'), false);
});

test('matchesQuickFilter checks scout branches branco, reparto, clan', () => {
  const perBranco = { id: 'b1', Branco: true, Casa: true };
  const perReparto = { id: 'r1', Reparto: true, Terreno: true };
  const perClan = { id: 'cl1', Compagnia: true, Info: 'Ideale per route e bivacchi' };

  assert.equal(matchesQuickFilter(perBranco, 'branco'), true);
  assert.equal(matchesQuickFilter(perReparto, 'reparto'), true);
  assert.equal(matchesQuickFilter(perClan, 'clan'), true);

  assert.equal(matchesQuickFilter(perReparto, 'branco'), false);
  assert.equal(matchesQuickFilter(perBranco, 'clan'), false);
});

test('matchesQuickFilter checks radius filters with user location', () => {
  // Centro di Milano (45.4642, 9.1900)
  const userLoc = { lat: 45.4642, lng: 9.1900 };
  const nearMilano = { id: 'nm', coordinate_lat: 45.5000, coordinate_lng: 9.2000 }; // ~4km
  const farRome = { id: 'fr', coordinate_lat: 41.9028, coordinate_lng: 12.4964 }; // ~477km

  assert.equal(matchesQuickFilter(nearMilano, 'raggio-25', [], userLoc), true);
  assert.equal(matchesQuickFilter(farRome, 'raggio-25', [], userLoc), false);
  assert.equal(matchesQuickFilter(farRome, 'raggio-500', [], userLoc), true);
});

test('matchesQuickFilter checks radius filters with searched city location (Entro 50km da)', () => {
  // Centro di Torino (45.0703, 7.6869)
  const torinoCenter = { lat: 45.0703, lng: 7.6869, name: 'Torino' };
  const avigliana = { id: 'av', Luogo: 'Avigliana', coordinate_lat: 45.0789, coordinate_lng: 7.3975 }; // ~23km da Torino
  const asti = { id: 'at', Luogo: 'Asti', coordinate_lat: 44.9008, coordinate_lng: 8.2065 }; // ~45km da Torino
  const cuneo = { id: 'cn', Luogo: 'Cuneo', coordinate_lat: 44.3845, coordinate_lng: 7.5427 }; // ~78km da Torino

  assert.equal(matchesQuickFilter(avigliana, 'raggio-50', [], torinoCenter), true);
  assert.equal(matchesQuickFilter(asti, 'raggio-50', [], torinoCenter), true);
  assert.equal(matchesQuickFilter(cuneo, 'raggio-50', [], torinoCenter), false);
});

test('matchesQuickFilter checks beds and favorites', () => {
  const bigHouse = { id: 'bh', Casa: true, Letti: '45' };
  const smallHouse = { id: 'sh', Casa: true, Letti: '15' };

  assert.equal(matchesQuickFilter(bigHouse, 'letti-30'), true);
  assert.equal(matchesQuickFilter(smallHouse, 'letti-30'), false);
  assert.equal(matchesQuickFilter(bigHouse, 'preferiti', ['bh']), true);
  assert.equal(matchesQuickFilter(smallHouse, 'preferiti', ['bh']), false);
});

test('cleanPhoneNumber formats phone correctly for tel: protocol', () => {
  assert.equal(cleanPhoneNumber('+39 011 / 123.456-78'), '+3901112345678');
  assert.equal(cleanPhoneNumber('347 12 34 567'), '3471234567');
  assert.equal(cleanPhoneNumber(null), '');
  assert.equal(cleanPhoneNumber(''), '');
});

test('formatStructureShareText and getWhatsAppShareUrl generate rich text', () => {
  const s = {
    Struttura: 'Base Scout Brownsea',
    Luogo: 'Colle Brianza',
    Prov: 'LC',
    Casa: true,
    Terreno: true,
    Letti: 40,
    Referente: 'Akela',
    Contatto: '333-1122334',
    coordinate: { lat: 45.75, lng: 9.35 }
  };
  const text = formatStructureShareText(s);
  assert.ok(text.includes('Base Scout Brownsea'));
  assert.ok(text.includes('Colle Brianza (LC)'));
  assert.ok(text.includes('40 posti letto'));
  assert.ok(text.includes('333-1122334'));
  assert.ok(text.includes('google.com/maps?q=45.75,9.35'));

  const waUrl = getWhatsAppShareUrl(s);
  assert.ok(waUrl.startsWith('https://api.whatsapp.com/send?text='));
  assert.ok(waUrl.includes('Base%20Scout%20Brownsea'));
});

test('calculatePagination computes correct boundaries and navigation flags', () => {
  const p1 = calculatePagination(55, 1, 20);
  assert.equal(p1.totalPages, 3);
  assert.equal(p1.currentPage, 1);
  assert.equal(p1.startIndex, 0);
  assert.equal(p1.endIndex, 20);
  assert.equal(p1.hasPrev, false);
  assert.equal(p1.hasNext, true);

  const pLast = calculatePagination(55, 3, 20);
  assert.equal(pLast.currentPage, 3);
  assert.equal(pLast.startIndex, 40);
  assert.equal(pLast.endIndex, 55);
  assert.equal(pLast.hasPrev, true);
  assert.equal(pLast.hasNext, false);

  const pOutOfBounds = calculatePagination(55, 999, 20);
  assert.equal(pOutOfBounds.currentPage, 3);

  const pEmpty = calculatePagination(0, 1, 20);
  assert.equal(pEmpty.totalPages, 1);
  assert.equal(pEmpty.currentPage, 1);
  assert.equal(pEmpty.startIndex, 0);
  assert.equal(pEmpty.endIndex, 0);
});

test('searchStrutture filters by name, location, and info accurately', () => {
  const sample = [
    { id: '1', Struttura: 'Base Scout Brownsea', Luogo: 'Colle Brianza', Prov: 'LC', Info: 'Ottima per lupetti' },
    { id: '2', Struttura: 'Chalet delle Aquile', Luogo: 'Gressoney', Prov: 'AO', Info: 'Alta quota' },
    { id: '3', Struttura: 'Cascina San Giorgio', Luogo: 'Asti', Prov: 'AT', Referente: 'Mario Rossi' }
  ];

  assert.equal(searchStrutture(sample, '').length, 3);
  assert.equal(searchStrutture(sample, 'brownsea').length, 1);
  assert.equal(searchStrutture(sample, 'brownsea')[0].id, '1');
  assert.equal(searchStrutture(sample, 'AO').length, 1);
  assert.equal(searchStrutture(sample, 'mario').length, 1);
  assert.equal(searchStrutture(sample, 'inesistente').length, 0);
});

test('escapeHtml neutralizes XSS characters and handles null/undefined', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("Hello 'world' & <friends>"), 'Hello &#39;world&#39; &amp; &lt;friends&gt;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(123), '123');
});

test('normalizeFirestoreStructureDoc preserves real Firestore docId over legacy new_ id', () => {
  const normalized = normalizeFirestoreStructureDoc('firestore-abc-123', {
    id: 'new_1700000000000',
    Struttura: 'Forte di Vinadio',
    Luogo: 'Vinadio',
    Prov: 'CN'
  });

  assert.equal(normalized.id, 'firestore-abc-123');
  assert.equal(normalized._legacyId, 'new_1700000000000');
  assert.equal(normalized.Struttura, 'Forte di Vinadio');
});

test('sanitizeStructureForFirestore strips internal fields before Firestore writes', () => {
  const payload = sanitizeStructureForFirestore({
    id: 'new_999',
    _legacyId: 'new_888',
    _duplicateIds: ['dup-1'],
    distanzaKm: 12.4,
    Struttura: 'Forte di Vinadio',
    Luogo: 'Vinadio',
    Prov: 'CN'
  });

  assert.equal('id' in payload, false);
  assert.equal('_legacyId' in payload, false);
  assert.equal('_duplicateIds' in payload, false);
  assert.equal('distanzaKm' in payload, false);
  assert.equal(payload.Struttura, 'Forte di Vinadio');
});

test('deduplicateStructures merges Forte di Vinadio duplicates keeping coordinates and tracking _duplicateIds', () => {
  const docs = [
    {
      id: 'doc-vinadio-1',
      _legacyId: 'new_1700000001',
      Struttura: 'Forte di Vinadio',
      Luogo: 'Vinadio',
      Prov: 'CN',
      Referente: 'Comune di Vinadio',
      Info: 'Base per campi estivi'
    },
    {
      id: 'doc-vinadio-2',
      _legacyId: 'new_1700000001',
      Struttura: 'Forte di Vinadio',
      Luogo: 'Vinadio',
      Prov: 'CN',
      coordinate_lat: 44.3072,
      coordinate_lng: 7.1753,
      Contatto: '0171-959151'
    }
  ];

  const deduplicated = deduplicateStructures(docs);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].id, 'doc-vinadio-2');
  assert.equal(deduplicated[0].coordinate_lat, 44.3072);
  assert.equal(deduplicated[0].coordinate_lng, 7.1753);
  assert.deepEqual(deduplicated[0].coordinate, { lat: 44.3072, lng: 7.1753 });
  assert.equal(deduplicated[0].Referente, 'Comune di Vinadio');
  assert.equal(deduplicated[0].Contatto, '0171-959151');
  assert.deepEqual(deduplicated[0]._duplicateIds, ['doc-vinadio-1']);

  // Caso con nomi/luoghi uguali senza _legacyId condiviso e uno senza coordinate
  const byNameAndCity = deduplicateStructures([
    { id: 'new_123', Struttura: '  Forte   di Vinadio ', Luogo: 'vinadio', Prov: 'CN', Info: 'Scheda parziale' },
    { id: 'fs-real-99', Struttura: 'Forte di Vinadio', Luogo: 'Vinadio', Prov: 'CN', coordinate_lat: 44.3072, coordinate_lng: 7.1753 }
  ]);
  assert.equal(byNameAndCity.length, 1);
  assert.equal(byNameAndCity[0].id, 'fs-real-99');
  assert.equal(byNameAndCity[0].Info, 'Scheda parziale');
});

test('parseStructureDate supports Firestore timestamps, Italian strings, years, and ISO dates', () => {
  const fromSeconds = parseStructureDate({ seconds: 1700000000 });
  assert.ok(fromSeconds instanceof Date);
  assert.equal(fromSeconds.getTime(), 1700000000 * 1000);

  const fromItalian = parseStructureDate('15/03/2023');
  assert.ok(fromItalian instanceof Date);
  assert.equal(fromItalian.getFullYear(), 2023);
  assert.equal(fromItalian.getMonth(), 2);
  assert.equal(fromItalian.getDate(), 15);

  const fromYear = parseStructureDate('2022');
  assert.ok(fromYear instanceof Date);
  assert.equal(fromYear.getFullYear(), 2022);

  const fromIso = parseStructureDate('2026-06-10T12:00:00.000Z');
  assert.ok(fromIso instanceof Date);
  assert.equal(fromIso.getUTCFullYear(), 2026);
  assert.equal(parseStructureDate(''), null);
});

test('calculateStructureCompleteness and evaluateStructureMapVisibility flag <50% or >=1 year structures', () => {
  const refNow = new Date('2026-11-18T12:00:00.000Z');

  // 1. Completa (>=50%) e aggiornata di recente (<1 anno) -> visibilità piena
  const completeRecent = {
    Struttura: 'Casa Alpina San Giorgio',
    Luogo: 'Vinadio',
    Prov: 'CN',
    coordinate_lat: 44.3,
    coordinate_lng: 7.1,
    Contatto: '3331234567',
    Offerta: '10 euro',
    Referente: 'Mario Rossi',
    Info: 'Ottima struttura',
    lastModified: '2026-08-01T10:00:00.000Z'
  };
  assert.equal(calculateStructureCompleteness(completeRecent).score, 80);
  const visCompleteRecent = evaluateStructureMapVisibility(completeRecent, refNow);
  assert.equal(visCompleteRecent.isLowVisibility, false);
  assert.equal(visCompleteRecent.isIncomplete, false);
  assert.equal(visCompleteRecent.isOutdated, false);

  // 2. Completa (>=50%) ma non aggiornata da oltre 1 anno -> bassa visibilità
  const completeOutdated = {
    ...completeRecent,
    lastModified: '2024-10-01T10:00:00.000Z'
  };
  const visOutdated = evaluateStructureMapVisibility(completeOutdated, refNow);
  assert.equal(visOutdated.isOutdated, true);
  assert.equal(visOutdated.isIncomplete, false);
  assert.equal(visOutdated.isLowVisibility, true);

  // 3. Aggiornata oggi ma scheda incompleta (<50%) -> bassa visibilità
  const incompleteRecent = {
    Struttura: 'Baita Nuova',
    Luogo: 'Vinadio',
    Prov: 'CN',
    coordinate_lat: 44.3,
    coordinate_lng: 7.1,
    lastModified: '2026-11-18T10:00:00.000Z'
  };
  assert.equal(calculateStructureCompleteness(incompleteRecent).score, 30);
  const visIncomplete = evaluateStructureMapVisibility(incompleteRecent, refNow);
  assert.equal(visIncomplete.isIncomplete, true);
  assert.equal(visIncomplete.isOutdated, false);
  assert.equal(visIncomplete.isLowVisibility, true);

  // 4. Senza alcuna data di aggiornamento -> outdated -> bassa visibilità
  const noDate = {
    ...completeRecent,
    lastModified: undefined
  };
  assert.equal(getStructureLastUpdateDate(noDate), null);
  const visNoDate = evaluateStructureMapVisibility(noDate, refNow);
  assert.equal(visNoDate.isOutdated, true);
  assert.equal(visNoDate.isLowVisibility, true);
});

test('normalizeStructureCoordinates replaces null coordinate object when lat/lng scalars exist', () => {
  const doc = {
    id: 'UzMLQjbH4tUAqu32rLGz',
    Struttura: 'Forte di Vinadio',
    coordinate: { lat: null, lng: null },
    coordinate_lat: 44.307457,
    coordinate_lng: 7.172739
  };
  const out = normalizeStructureCoordinates(doc);
  assert.deepEqual(out.coordinate, { lat: 44.307457, lng: 7.172739 });
  assert.equal(out.coordinate_lat, 44.307457);
  assert.equal(out.coordinate_lng, 7.172739);
});

test('deduplicateStructures handles real duplicate pairs, typo coords, descriptive strings vs booleans, and ghost docs', () => {
  const realWorldDocs = [
    // Forte di Vinadio: vincitore + duplicato con _legacyId e coordinate {lat: null, lng: null}
    normalizeFirestoreStructureDoc('4zez6T2vh4bdbKfuPFw3', {
      Struttura: 'Forte di Vinadio',
      Luogo: 'Vinadio',
      Prov: 'CN',
      Trasporti: 'Bus locale',
      Cucina: 'Presente',
      Spazi: 'Ampi',
      'A persona': '10 euro',
      coordinate: { lat: 44.307457, lng: 7.172739 },
      coordinate_lat: 44.307457,
      coordinate_lng: 7.172739,
      version: 2,
      lastModified: '2026-11-17T21:03:22Z'
    }),
    normalizeFirestoreStructureDoc('UzMLQjbH4tUAqu32rLGz', {
      id: 'new_1794907928372',
      Struttura: 'Forte di Vinadio',
      Luogo: 'Vinadio',
      Prov: 'CN',
      Referente: 'Fondazione Artea',
      coordinate: { lat: null, lng: null },
      coordinate_lat: 44.307457,
      coordinate_lng: 7.172739,
      version: 1,
      lastModified: '2026-11-17T09:38:27Z'
    }),
    // Parrocchia di San Rocco: 44.3667 (valido in Piemonte) deve battere 42.3669 (refuso)
    normalizeFirestoreStructureDoc('6iOHu5eMa2ECM9kOyvWW', {
      id: 'new_1768653018999',
      Struttura: 'Parrocchia di San Rocco',
      Luogo: 'Cuneo',
      Prov: 'CN',
      Contatto: '0171-491000',
      Referente: 'Don Mario',
      Info: 'Oratorio',
      coordinate_lat: 42.36694,
      coordinate_lng: 7.52248,
      lastModified: '2026-01-19T10:00:00Z'
    }),
    normalizeFirestoreStructureDoc('MfsqspjPUHpCtVGfotAx', {
      id: 'new_1768653018999',
      Struttura: 'Parrocchia di San Rocco',
      Luogo: 'Cuneo',
      Prov: 'CN',
      coordinate: { lat: 44.3667633, lng: 7.5224803 },
      coordinate_lat: 44.3667633,
      coordinate_lng: 7.5224803,
      lastModified: '2026-01-17T10:00:00Z'
    }),
    // Casa CNGEI Ca du Pin + Rifugio Santa Libera: stringhe descrittive prevalgono su boolean
    normalizeFirestoreStructureDoc('v8CDZMll8wVQ0VkGqHpk', {
      Struttura: 'Rifugio Santa Libera',
      Luogo: 'Monastero Bormida',
      Prov: 'AT',
      Referente: 'Luigi Rosso',
      Contatto: '3381479177',
      Email: 'info@rifugio.it',
      Info: 'Ottimo rifugio',
      Letti: true,
      Spazi: false,
      coordinate_lat: 44.64,
      coordinate_lng: 8.32,
      version: 4
    }),
    normalizeFirestoreStructureDoc('vasUUhI2IT1aVPLLgvyl', {
      id: 'new_1762771993738',
      Struttura: 'Rifugio Santa Libera',
      Luogo: 'Monastero Bormida',
      Prov: 'AT',
      Letti: '30',
      Spazi: true,
      coordinate: { lat: null, lng: null },
      version: 1
    }),
    // Monastero di San Biagio: sottostringa luogo + stessa provincia
    normalizeFirestoreStructureDoc('mQscEXk8bTewyd1k9nxX', {
      Struttura: 'Monastero di San Biagio',
      Luogo: 'San Biagio di Mondovì',
      Prov: 'CN',
      Sito: 'https://www.monasterodisanbiagio.it/',
      coordinate_lat: 44.4091959,
      coordinate_lng: 7.7129077
    }),
    normalizeFirestoreStructureDoc('EwQvRP9ZOmzWmcP2RJoy', {
      Struttura: 'Monastero di San Biagio',
      Luogo: 'Mondovì',
      Prov: 'CN',
      Indirizzo: 'San Biagio',
      Sito: 'https://www.monasterodisanbiagio.it/',
      Info: 'Ospitalità scout'
    }),
    // Casa Alpina Don Macario: comuni limitrofi + stesso IIcontatto in stessa provincia
    normalizeFirestoreStructureDoc('R53i8NC4ckfpzn2CKeNK', {
      Struttura: 'Casa Alpina Don Macario',
      Luogo: 'Savoulx',
      Prov: 'TO',
      IIcontatto: '0112201022',
      Letti: '140',
      Info: 'Base alpina',
      coordinate_lat: 45.03,
      coordinate_lng: 6.78
    }),
    normalizeFirestoreStructureDoc('RKUZNnwvZLf1DuzV4ZFd', {
      Struttura: 'Casa Alpina Don Macario',
      Luogo: 'Oulx',
      Prov: 'TO',
      IIcontatto: '0112201022',
      Letti: '140'
    }),
    // Nomi generici in luoghi diversi della stessa provincia NON devono essere uniti
    normalizeFirestoreStructureDoc('generic-1', {
      Struttura: 'Casa',
      Luogo: 'Pinerolo',
      Prov: 'TO'
    }),
    normalizeFirestoreStructureDoc('generic-2', {
      Struttura: 'Casa',
      Luogo: 'Susa',
      Prov: 'TO'
    }),
    // Record già marcati eliminati e record fantasma vuoti devono essere esclusi
    normalizeFirestoreStructureDoc('marked-dup', {
      Struttura: 'Forte di Vinadio',
      Luogo: 'Vinadio',
      Prov: 'CN',
      isDeletedDuplicate: true
    }),
    normalizeFirestoreStructureDoc('1sCKmLZClmYhLRN7Z8fM', {
      id: 'new_1767787145498',
      Struttura: '',
      Luogo: ''
    })
  ];

  const clean = deduplicateStructures(realWorldDocs);
  assert.equal(clean.length, 7);

  const vinadio = clean.find(s => s.Struttura === 'Forte di Vinadio');
  assert.equal(vinadio.id, '4zez6T2vh4bdbKfuPFw3');
  assert.equal(vinadio.Referente, 'Fondazione Artea');
  assert.deepEqual(vinadio._duplicateIds, ['UzMLQjbH4tUAqu32rLGz']);

  const sanRocco = clean.find(s => s.Struttura === 'Parrocchia di San Rocco');
  assert.equal(sanRocco.id, 'MfsqspjPUHpCtVGfotAx');
  assert.equal(sanRocco.coordinate_lat, 44.3667633);
  assert.equal(sanRocco.Referente, 'Don Mario');
  assert.deepEqual(sanRocco._duplicateIds, ['6iOHu5eMa2ECM9kOyvWW']);

  const santaLibera = clean.find(s => s.Struttura === 'Rifugio Santa Libera');
  assert.equal(santaLibera.id, 'v8CDZMll8wVQ0VkGqHpk');
  assert.equal(santaLibera.Letti, '30');
  assert.deepEqual(santaLibera._duplicateIds, ['vasUUhI2IT1aVPLLgvyl']);

  const sanBiagio = clean.find(s => s.Struttura === 'Monastero di San Biagio');
  assert.equal(sanBiagio.id, 'mQscEXk8bTewyd1k9nxX');
  assert.equal(sanBiagio.Info, 'Ospitalità scout');
  assert.deepEqual(sanBiagio._duplicateIds, ['EwQvRP9ZOmzWmcP2RJoy']);

  const donMacario = clean.find(s => s.Struttura === 'Casa Alpina Don Macario');
  assert.equal(donMacario.id, 'R53i8NC4ckfpzn2CKeNK');
  assert.deepEqual(donMacario._duplicateIds, ['RKUZNnwvZLf1DuzV4ZFd']);

  assert.equal(clean.filter(s => s.Struttura === 'Casa').length, 2);
  assert.equal(isGhostOrDeletedStructure({ Struttura: '', Luogo: '' }), true);
  assert.equal(isGhostOrDeletedStructure({ Struttura: 'X', isDeletedDuplicate: true }), true);
  assert.equal(clean.some(s => s.id === '1sCKmLZClmYhLRN7Z8fM'), false);
});


