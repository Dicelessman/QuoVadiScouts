import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCoordinatesFromGoogleMapsLink } from '../utils/geo.js';

test('extractCoordinatesFromGoogleMapsLink parses @lat,lng', () => {
  const res = extractCoordinatesFromGoogleMapsLink('https://maps.google.com/@45.123,7.456,12z');
  assert.deepEqual(res, { lat: 45.123, lng: 7.456 });
});

test('extractCoordinatesFromGoogleMapsLink parses ?q=lat,lng', () => {
  const res = extractCoordinatesFromGoogleMapsLink('https://maps.google.com/?q=-12.5,99.75');
  assert.deepEqual(res, { lat: -12.5, lng: 99.75 });
});

test('extractCoordinatesFromGoogleMapsLink returns null for invalid', () => {
  const res = extractCoordinatesFromGoogleMapsLink('https://maps.google.com/?q=abc,def');
  assert.equal(res, null);
});

