import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCoordinatesFromGoogleMapsLink, calculateDistanceKm, findCityCoordinates } from '../utils/geo.js';

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

test('findCityCoordinates finds coordinates from city database', () => {
  const mockDb = {
    'TORINO': [45.0703, 7.6869],
    'MILANO': [45.4642, 9.1900],
    'BOLOGNA': [44.4949, 11.3426]
  };

  const torino = findCityCoordinates('torino', mockDb);
  assert.ok(torino);
  assert.equal(torino.lat, 45.0703);
  assert.equal(torino.lng, 7.6869);

  const milano = findCityCoordinates('Milano ', mockDb);
  assert.ok(milano);
  assert.equal(milano.lat, 45.4642);

  // Prefisso
  const bolo = findCityCoordinates('Bolog', mockDb);
  assert.ok(bolo);
  assert.equal(bolo.lat, 44.4949);
});

test('findCityCoordinates parses direct coordinates', () => {
  const direct = findCityCoordinates('45.123, 7.456');
  assert.deepEqual(direct, { lat: 45.123, lng: 7.456, name: '45.123, 7.456' });
});

test('findCityCoordinates fallbacks to structures list if not in db', () => {
  const mockDb = {};
  const mockStructures = [
    { id: '1', Luogo: 'Gressoney', coordinate: { lat: 45.8, lng: 7.8 } }
  ];

  const res = findCityCoordinates('gressoney', mockDb, mockStructures);
  assert.ok(res);
  assert.equal(res.lat, 45.8);
  assert.equal(res.lng, 7.8);
});

test('findCityCoordinates returns null for unknown location', () => {
  assert.equal(findCityCoordinates('cittainesistente999', {}, []), null);
  assert.equal(findCityCoordinates('', {}, []), null);
});
