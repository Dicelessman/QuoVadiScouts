import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSearchTerm,
  formatCityDisplayName,
  highlightMatch,
  generateSearchSuggestions
} from '../utils/autocomplete.js';

test('normalizeSearchTerm removes accents and converts to lowercase', () => {
  assert.equal(normalizeSearchTerm('Bologna'), 'bologna');
  assert.equal(normalizeSearchTerm('Forlì-Cesena'), 'forli-cesena');
  assert.equal(normalizeSearchTerm('   TORINO   '), 'torino');
  assert.equal(normalizeSearchTerm(''), '');
});

test('formatCityDisplayName formats names into Title Case', () => {
  assert.equal(formatCityDisplayName('SAN LAZZARO DI SAVENA'), 'San Lazzaro di Savena');
  assert.equal(formatCityDisplayName('BOLOGNA'), 'Bologna');
  assert.equal(formatCityDisplayName('REGGIO NELL\'EMILIA'), 'Reggio Nell\'Emilia');
});

test('highlightMatch wraps matching query in strong tag', () => {
  const res = highlightMatch('Casa Scout San Giorgio', 'scout');
  assert.equal(res, 'Casa <strong class="autocomplete-match">Scout</strong> San Giorgio');

  const res2 = highlightMatch('Bologna', 'bolo');
  assert.equal(res2, '<strong class="autocomplete-match">Bolo</strong>gna');
});

test('generateSearchSuggestions returns results in exact order: 1. Cities, 2. Structures', () => {
  const mockDb = {
    'BOLOGNA': [44.4949, 11.3426],
    'CASALECCHIO DI RENO': [44.4789, 11.2778],
    'SAN LAZZARO DI SAVENA': [44.4719, 11.4089]
  };

  const mockStructures = [
    {
      id: '1',
      Struttura: 'Base Scout Parco dei Gessi',
      Luogo: 'San Lazzaro di Savena',
      Prov: 'BO',
      Casa: true,
      Terreno: true
    },
    {
      id: '2',
      Struttura: 'Chalet Scout Reno',
      Luogo: 'Casalecchio di Reno',
      Prov: 'BO',
      Casa: true,
      Terreno: false
    },
    {
      id: '3',
      Struttura: 'Base Scout Bologna Centro',
      Luogo: 'Bologna',
      Prov: 'BO',
      Casa: true
    }
  ];

  // Test con query "bolog"
  const suggestions = generateSearchSuggestions('bolog', mockStructures, mockDb);

  assert.equal(suggestions.query, 'bolog');
  assert.ok(suggestions.cities.length > 0, 'Should have matching cities');
  assert.ok(suggestions.structures.length > 0, 'Should have matching structures');

  // Verify city section contains Bologna
  assert.equal(suggestions.cities[0].name, 'Bologna');
  assert.equal(suggestions.cities[0].structureCount, 1);

  // Verify structure section contains "Base Scout Bologna Centro"
  assert.equal(suggestions.structures[0].name, 'Base Scout Bologna Centro');
});

test('generateSearchSuggestions prioritizes cities with scout structures', () => {
  const mockDb = {
    'BOLOGNA': [44.4949, 11.3426],
    'BOLOGNANO': [42.2134, 13.9542], // Comuna senza strutture
    'BOLOGNETTA': [37.9621, 13.4561] // Comune senza strutture
  };

  const mockStructures = [
    {
      id: '1',
      Struttura: 'Base Scout 1',
      Luogo: 'Bologna',
      Prov: 'BO'
    },
    {
      id: '2',
      Struttura: 'Base Scout 2',
      Luogo: 'Bologna',
      Prov: 'BO'
    }
  ];

  const suggestions = generateSearchSuggestions('bolog', mockStructures, mockDb);

  // Bologna has 2 structures, should be ranked first
  assert.equal(suggestions.cities[0].name, 'Bologna');
  assert.equal(suggestions.cities[0].structureCount, 2);
});

test('generateSearchSuggestions returns empty lists for empty or invalid input', () => {
  const empty = generateSearchSuggestions('', [], {});
  assert.equal(empty.cities.length, 0);
  assert.equal(empty.structures.length, 0);
  assert.equal(empty.totalMatches, 0);
});
