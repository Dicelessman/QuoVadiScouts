import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStructureCoordinates,
  matchesQuickFilter,
  cleanPhoneNumber,
  calculatePagination,
  searchStrutture,
  formatStructureShareText,
  getWhatsAppShareUrl
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
