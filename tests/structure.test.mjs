import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStructureCoordinates } from '../utils/structure.js';

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

