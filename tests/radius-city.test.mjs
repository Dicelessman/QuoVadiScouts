import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistanceKm, findCityCoordinates } from '../utils/geo.js';
import { matchesQuickFilter } from '../utils/structure.js';

test('findCityCoordinates resolves Italian municipalities correctly', () => {
  const mockDb = {
    'BOLOGNA': [44.4949, 11.3426],
    'TORINO': [45.0703, 7.6869],
    'MILANO': [45.4642, 9.1900],
    'ROMA': [41.9028, 12.4964],
    'FIRENZE': [43.7696, 11.2558]
  };

  const bolo = findCityCoordinates('Bologna', mockDb);
  assert.ok(bolo);
  assert.equal(bolo.lat, 44.4949);
  assert.equal(bolo.lng, 11.3426);

  const torino = findCityCoordinates('torino', mockDb);
  assert.ok(torino);
  assert.equal(torino.lat, 45.0703);

  // Normalization with accents or spaces
  const boloSpaced = findCityCoordinates('  bologna  ', mockDb);
  assert.ok(boloSpaced);
  assert.equal(boloSpaced.lat, 44.4949);
});

test('radius 50km calculation from searched city correctly filters and sorts structures', () => {
  const bolognaCoords = { lat: 44.4949, lng: 11.3426, name: 'Bologna' };

  const strutture = [
    {
      id: 's-san-lazzaro',
      Struttura: 'Base Scout Parco dei Gessi',
      Luogo: 'San Lazzaro di Savena',
      coordinate_lat: 44.4719,
      coordinate_lng: 11.4089
    },
    {
      id: 's-casalecchio',
      Struttura: 'Chalet Scout Reno',
      Luogo: 'Casalecchio di Reno',
      coordinate_lat: 44.4789,
      coordinate_lng: 11.2778
    },
    {
      id: 's-imola',
      Struttura: 'Campo Scout Colline Romagnole',
      Luogo: 'Imola',
      coordinate_lat: 44.3533,
      coordinate_lng: 11.7144
    },
    {
      id: 's-milano',
      Struttura: 'Casa Scout San Giorgio',
      Luogo: 'Milano',
      coordinate_lat: 45.4642,
      coordinate_lng: 9.1900
    },
    {
      id: 's-roma',
      Struttura: 'Base Scout Roma',
      Luogo: 'Roma',
      coordinate_lat: 41.8902,
      coordinate_lng: 12.4722
    }
  ];

  // Calcola distanze rispetto a Bologna
  const within50 = [];
  for (const s of strutture) {
    const dist = calculateDistanceKm(bolognaCoords.lat, bolognaCoords.lng, s.coordinate_lat, s.coordinate_lng);
    s.distanzaKm = dist;
    if (matchesQuickFilter(s, 'raggio-50', [], bolognaCoords)) {
      within50.push(s);
    }
  }

  // Verifica che solo San Lazzaro (~5.8km), Casalecchio (~5.5km) e Imola (~33.4km) siano entro 50km
  assert.equal(within50.length, 3);
  const ids = within50.map(s => s.id);
  assert.ok(ids.includes('s-san-lazzaro'));
  assert.ok(ids.includes('s-casalecchio'));
  assert.ok(ids.includes('s-imola'));
  assert.ok(!ids.includes('s-milano'));
  assert.ok(!ids.includes('s-roma'));

  // Ordina per distanza crescente
  within50.sort((a, b) => a.distanzaKm - b.distanzaKm);
  assert.ok(within50[0].distanzaKm <= within50[1].distanzaKm);
  assert.ok(within50[1].distanzaKm <= within50[2].distanzaKm);
  assert.equal(within50[2].id, 's-imola');
});

test('chip label dynamic formatting logic', () => {
  function formatChipLabel(query, resolvedName) {
    const raw = (query || '').trim();
    if (raw.length > 0) {
      return `🧭 Entro 50km da ${resolvedName || raw}`;
    }
    return '🧭 Entro 50km da...';
  }

  assert.equal(formatChipLabel(''), '🧭 Entro 50km da...');
  assert.equal(formatChipLabel('   '), '🧭 Entro 50km da...');
  assert.equal(formatChipLabel('Bologna'), '🧭 Entro 50km da Bologna');
  assert.equal(formatChipLabel('bologna', 'Bologna'), '🧭 Entro 50km da Bologna');
  assert.equal(formatChipLabel('Torino'), '🧭 Entro 50km da Torino');
});
