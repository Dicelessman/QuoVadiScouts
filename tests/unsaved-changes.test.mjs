import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloneStructureSnapshot,
  hasStructureChanges,
  restoreStructureSnapshot,
  STRUCTURE_COMPARE_FIELDS
} from '../utils/unsaved-changes.js';

test('cloneStructureSnapshot creates a deep independent clone', () => {
  const original = {
    id: 'st-1',
    Struttura: 'Base Scout Ritorno Alle Sorgenti',
    Luogo: 'Costacciaro',
    Casa: true,
    coordinate: { lat: 43.35, lng: 12.71 }
  };

  const cloned = cloneStructureSnapshot(original);
  assert.deepEqual(cloned, original);

  // Modifica original e verifica che cloned non cambi
  original.Struttura = 'Altro Nome';
  original.coordinate.lat = 44.0;
  assert.equal(cloned.Struttura, 'Base Scout Ritorno Alle Sorgenti');
  assert.equal(cloned.coordinate.lat, 43.35);
});

test('hasStructureChanges returns false when structure is identical to snapshot', () => {
  const snapshot = {
    Struttura: 'Chalet Scout Stella Alpina',
    Luogo: 'Asiago',
    Prov: 'VI',
    Casa: true,
    Terreno: false,
    coordinate_lat: 45.876543,
    coordinate_lng: 11.512345
  };

  const current = { ...snapshot };
  assert.equal(hasStructureChanges(snapshot, current, false, false), false);
});

test('hasStructureChanges returns true when a text field is changed', () => {
  const snapshot = {
    Struttura: 'Chalet Scout Stella Alpina',
    Luogo: 'Asiago',
    Prov: 'VI'
  };

  const current = {
    ...snapshot,
    Struttura: 'Chalet Scout Stella Alpina Nuova Gestione'
  };

  assert.equal(hasStructureChanges(snapshot, current, false, false), true);
});

test('hasStructureChanges returns true when a boolean checkbox is toggled', () => {
  const snapshot = {
    Struttura: 'Campo San Giorgio',
    Casa: false,
    Terreno: true
  };

  const current = {
    ...snapshot,
    Casa: true // Toggled!
  };

  assert.equal(hasStructureChanges(snapshot, current, false, false), true);
});

test('hasStructureChanges returns true when coordinates change', () => {
  const snapshot = {
    Struttura: 'Campo San Giorgio',
    coordinate_lat: 42.123456,
    coordinate_lng: 12.654321
  };

  const current = {
    ...snapshot,
    coordinate_lat: 42.200000
  };

  assert.equal(hasStructureChanges(snapshot, current, false, false), true);
});

test('hasStructureChanges returns true if isFormDirty is set to true', () => {
  const snapshot = { Struttura: 'Test' };
  const current = { Struttura: 'Test' };

  assert.equal(hasStructureChanges(snapshot, current, false, true), true);
});

test('hasStructureChanges for new structure returns true if any text is typed', () => {
  const emptyNew = { Struttura: '', Luogo: '', Prov: '' };
  assert.equal(hasStructureChanges({}, emptyNew, true, false), false);

  const partiallyFilled = { Struttura: 'Nuova Baita', Luogo: '', Prov: '' };
  assert.equal(hasStructureChanges({}, partiallyFilled, true, false), true);
});

test('restoreStructureSnapshot restores target to original snapshot state', () => {
  const original = {
    id: 'st-99',
    Struttura: 'Rifugio Antico',
    Luogo: 'Subiaco',
    Casa: true,
    Terreno: false
  };

  const snapshot = cloneStructureSnapshot(original);

  const mutated = {
    ...original,
    Struttura: 'Rifugio Modificato',
    Casa: false,
    campoNuovo: 'valore non salvato'
  };

  restoreStructureSnapshot(mutated, snapshot);

  assert.equal(mutated.Struttura, 'Rifugio Antico');
  assert.equal(mutated.Casa, true);
  assert.equal('campoNuovo' in mutated, false);
});
