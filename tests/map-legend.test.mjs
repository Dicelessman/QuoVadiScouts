import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAYER_METADATA,
  MAP_OVERLAY_LEGENDS,
  isLayerOverlayDynamic,
  getActiveLegendData,
  renderLegendHtml
} from '../utils/map-legend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

test('isLayerOverlayDynamic confirms all 4 overlays are dynamic tile streams', () => {
  assert.equal(isLayerOverlayDynamic('railway'), true);
  assert.equal(isLayerOverlayDynamic('hiking'), true);
  assert.equal(isLayerOverlayDynamic('cycling'), true);
  assert.equal(isLayerOverlayDynamic('mtb'), true);
  assert.equal(isLayerOverlayDynamic('nonexistent'), false);
});

test('LAYER_METADATA documents OSM dynamic sources and providers', () => {
  const ids = ['railway', 'hiking', 'cycling', 'mtb'];
  for (const id of ids) {
    const meta = LAYER_METADATA[id];
    assert.ok(meta, `Metadata for ${id} should exist`);
    assert.equal(meta.isDynamic, true);
    assert.ok(meta.provider, 'Provider should be defined');
    assert.ok(meta.sourceDatabase.includes('OpenStreetMap'), 'Upstream database should be OpenStreetMap');
    assert.ok(meta.tileUrlPattern.startsWith('https://'), 'Tile pattern should be HTTPS');
  }
});

test('getActiveLegendData returns empty array for empty or invalid inputs', () => {
  assert.deepEqual(getActiveLegendData([]), []);
  assert.deepEqual(getActiveLegendData(null), []);
  assert.deepEqual(getActiveLegendData(undefined), []);
  assert.deepEqual(getActiveLegendData(['unknown-layer']), []);
});

test('getActiveLegendData returns matched sections in order', () => {
  const dataSingle = getActiveLegendData(['hiking']);
  assert.equal(dataSingle.length, 1);
  assert.equal(dataSingle[0].id, 'hiking');
  assert.ok(dataSingle[0].items.length >= 3);

  const dataMulti = getActiveLegendData(['railway', 'mtb']);
  assert.equal(dataMulti.length, 2);
  assert.equal(dataMulti[0].id, 'railway');
  assert.equal(dataMulti[1].id, 'mtb');
});

test('renderLegendHtml returns empty string when no layers active', () => {
  assert.equal(renderLegendHtml([]), '');
  assert.equal(renderLegendHtml(['invalid']), '');
});

test('renderLegendHtml generates HTML markup with swatches and labels for active layers', () => {
  const html = renderLegendHtml(['railway', 'cycling']);
  assert.ok(html.includes('data-layer-id="railway"'));
  assert.ok(html.includes('data-layer-id="cycling"'));
  assert.ok(html.includes('Rete Ferroviaria'));
  assert.ok(html.includes('Piste Ciclabili'));
  assert.ok(html.includes('legend-line-rail-main'));
  assert.ok(html.includes('legend-line-cycle-national'));
  // Should NOT contain unselected layers
  assert.ok(!html.includes('data-layer-id="hiking"'));
  assert.ok(!html.includes('data-layer-id="mtb"'));
});

test('renderLegendHtml renders all 4 layers when all are selected', () => {
  const allIds = ['railway', 'hiking', 'cycling', 'mtb'];
  const html = renderLegendHtml(allIds);
  for (const id of allIds) {
    assert.ok(html.includes(`data-layer-id="${id}"`), `Should include section for ${id}`);
  }
  assert.ok(html.includes('OpenRailwayMap') || html.includes('Rete Ferroviaria'));
  assert.ok(html.includes('Sentieri Escursionistici'));
  assert.ok(html.includes('Piste Ciclabili'));
  assert.ok(html.includes('Percorsi MTB'));
});

test('index.html contains mapOverlayLegend and all necessary child elements', () => {
  const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('id="mapOverlayLegend"'));
  assert.ok(indexHtml.includes('id="legendHeader"'));
  assert.ok(indexHtml.includes('id="legendActiveBadge"'));
  assert.ok(indexHtml.includes('id="legendToggleBtn"'));
  assert.ok(indexHtml.includes('id="legendContent"'));
  assert.ok(indexHtml.includes('id="layersMenu"'));
  assert.ok(indexHtml.includes('id="layer-railway"'));
  assert.ok(indexHtml.includes('id="layer-hiking"'));
  assert.ok(indexHtml.includes('id="layer-cycling"'));
  assert.ok(indexHtml.includes('id="layer-mtb"'));
});

test('index.local.html has parity with mapOverlayLegend and layer controls', () => {
  const localHtml = fs.readFileSync(path.join(projectRoot, 'index.local.html'), 'utf8');
  assert.ok(localHtml.includes('id="mapOverlayLegend"'));
  assert.ok(localHtml.includes('id="layersMenu"'));
  assert.ok(localHtml.includes('id="layer-railway"'));
});

test('styles.css contains rules for map-overlay-legend, swatches, and dark mode', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'styles.css'), 'utf8');
  assert.ok(css.includes('.map-overlay-legend'));
  assert.ok(css.includes('.map-overlay-legend.hidden'));
  assert.ok(css.includes('.map-overlay-legend.minimized'));
  assert.ok(css.includes('[data-theme="dark"] .map-overlay-legend'));
  assert.ok(css.includes('.legend-line-rail-main'));
  assert.ok(css.includes('.legend-line-hike-major'));
  assert.ok(css.includes('.legend-line-cycle-national'));
  assert.ok(css.includes('.legend-line-mtb-main'));
  assert.ok(css.includes('.main-map-container.collapsed #mapOverlayLegend'));
});
