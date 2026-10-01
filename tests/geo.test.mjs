import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCoordinatesFromGoogleMapsLink, calculateDistanceKm } from '../utils/geo.js';

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

test('calculateDistanceKm computes distance between Rome and Milan (~477km)', () => {
  // Roma: 41.9028, 12.4964, Milano: 45.4642, 9.1900
  const dist = calculateDistanceKm(41.9028, 12.4964, 45.4642, 9.1900);
  assert.ok(dist >= 470 && dist <= 485, `Expected ~477km, got ${dist}`);
});

test('calculateDistanceKm returns 0 for identical points', () => {
  const dist = calculateDistanceKm(45.0, 9.0, 45.0, 9.0);
  assert.equal(dist, 0);
});

test('calculateDistanceKm returns null for invalid input', () => {
  assert.equal(calculateDistanceKm(null, 9.0, 45.0, 9.0), null);
  assert.equal(calculateDistanceKm('invalid', 9.0, 45.0, 9.0), null);
});
