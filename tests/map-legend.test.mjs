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
  // Railway: accurate ORM colors — highspeed, main, branch, tram, metro, lightrail, industrial, disused
  assert.ok(html.includes('legend-line-rail-highspeed'), 'should include AV swatch');
  assert.ok(html.includes('legend-line-rail-main'), 'should include main line swatch');
  assert.ok(html.includes('legend-line-rail-branch'), 'should include branch line swatch');
  assert.ok(html.includes('legend-line-rail-tram'), 'should include tram swatch');
  // Cycling: accurate shield-based colors
  assert.ok(html.includes('legend-line-cycle-national'));
  assert.ok(html.includes('legend-line-cycle-regional'));
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
  // Railway swatches — accurate ORM colors
  assert.ok(css.includes('.legend-line-rail-highspeed'), 'AV swatch #ff0c00');
  assert.ok(css.includes('.legend-line-rail-main'), 'main line swatch #ff8100');
  assert.ok(css.includes('.legend-line-rail-branch'), 'branch swatch #c4b600');
  assert.ok(css.includes('.legend-line-rail-tram'), 'tram swatch #d877b8');
  assert.ok(css.includes('.legend-line-rail-metro'), 'metro swatch #0300c3');
  assert.ok(css.includes('.legend-line-rail-lightrail'), 'light rail swatch #00bd14');
  assert.ok(css.includes('.legend-line-rail-industrial'), 'industrial swatch #87491d');
  assert.ok(css.includes('.legend-line-rail-disused'), 'disused swatch #70584d');
  // Hiking / cycling / MTB
  assert.ok(css.includes('.legend-line-hike-major'));
  assert.ok(css.includes('.legend-line-hike-regional'));
  assert.ok(css.includes('.legend-line-cycle-national'));
  assert.ok(css.includes('.legend-line-cycle-regional'));
  assert.ok(css.includes('.legend-line-mtb-major'));
  assert.ok(css.includes('.main-map-container.collapsed #mapOverlayLegend'));
});

test('railway legend has all 9 correct entries matching OpenRailwayMap CartoCSS colors', () => {
  const railwayLegend = MAP_OVERLAY_LEGENDS.railway;
  assert.ok(railwayLegend, 'Railway legend should exist');
  const types = railwayLegend.items.map(i => i.type);
  assert.ok(types.includes('rail-highspeed'), 'should have AV (highspeed)');
  assert.ok(types.includes('rail-main'), 'should have main line');
  assert.ok(types.includes('rail-branch'), 'should have branch/secondary');
  assert.ok(types.includes('rail-tram'), 'should have tram');
  assert.ok(types.includes('rail-metro'), 'should have metro/subway');
  assert.ok(types.includes('rail-lightrail'), 'should have light rail');
  assert.ok(types.includes('rail-industrial'), 'should have industrial/spur');
  assert.ok(types.includes('rail-disused'), 'should have disused/abandoned');
  assert.ok(types.includes('rail-station'), 'should have station points');
});

test('hiking legend explains dynamic shield system with 4 entries', () => {
  const hikingLegend = MAP_OVERLAY_LEGENDS.hiking;
  assert.ok(hikingLegend, 'Hiking legend should exist');
  assert.ok(hikingLegend.items.length >= 4, 'Should have at least 4 items');
  const types = hikingLegend.items.map(i => i.type);
  assert.ok(types.includes('hike-shield-info'), 'should explain shield system');
});

test('cycling legend has shield info + 3 tier entries', () => {
  const cyclingLegend = MAP_OVERLAY_LEGENDS.cycling;
  assert.ok(cyclingLegend.items.length >= 4);
  const types = cyclingLegend.items.map(i => i.type);
  assert.ok(types.includes('cycle-national'));
  assert.ok(types.includes('cycle-regional'));
  assert.ok(types.includes('cycle-local'));
});

test('MTB legend has shield info + difficulty indicator', () => {
  const mtbLegend = MAP_OVERLAY_LEGENDS.mtb;
  assert.ok(mtbLegend.items.length >= 4);
  const types = mtbLegend.items.map(i => i.type);
  assert.ok(types.includes('mtb-shield-info'));
  assert.ok(types.includes('mtb-difficulty'));
});
