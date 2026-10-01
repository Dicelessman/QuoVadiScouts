import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStructureCoordinates, matchesQuickFilter } from '../utils/structure.js';

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

test('matchesQuickFilter checks beds and favorites', () => {
  const bigHouse = { id: 'bh', Casa: true, Letti: '45' };
  const smallHouse = { id: 'sh', Casa: true, Letti: '15' };

  assert.equal(matchesQuickFilter(bigHouse, 'letti-30'), true);
  assert.equal(matchesQuickFilter(smallHouse, 'letti-30'), false);
  assert.equal(matchesQuickFilter(bigHouse, 'preferiti', ['bh']), true);
  assert.equal(matchesQuickFilter(smallHouse, 'preferiti', ['bh']), false);
});

