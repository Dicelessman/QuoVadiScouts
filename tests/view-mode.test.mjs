import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('index.html contains viewToggleItem and segmented switch control', () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
  assert.ok(html.includes('id="viewToggleItem"'), 'index.html must have #viewToggleItem');
  assert.ok(html.includes('class="view-switch-segmented"'), 'index.html must have segmented switch container');
  assert.ok(html.includes('data-view-seg="cards"'), 'index.html must have cards seg button');
  assert.ok(html.includes('data-view-seg="list"'), 'index.html must have list seg button');
});

test('index.local.html has parity with viewToggleItem and segmented switch', () => {
  const localHtml = fs.readFileSync(path.resolve('index.local.html'), 'utf-8');
  assert.ok(localHtml.includes('id="viewToggleItem"'), 'index.local.html must have #viewToggleItem');
  assert.ok(localHtml.includes('class="view-switch-segmented"'), 'index.local.html must have segmented switch container');
  assert.ok(localHtml.includes('data-view-seg="cards"'), 'index.local.html must have cards seg button');
  assert.ok(localHtml.includes('data-view-seg="list"'), 'index.local.html must have list seg button');
});

test('styles.css contains rules for list-mode, list-row, and segmented buttons', () => {
  const css = fs.readFileSync(path.resolve('styles.css'), 'utf-8');
  assert.ok(css.includes('body.list-view .results-container'), 'styles.css must style list-view container');
  assert.ok(css.includes('.results-container.list-mode'), 'styles.css must have list-mode container style');
  assert.ok(css.includes('.structure-card.list-row'), 'styles.css must have list-row card style');
  assert.ok(css.includes('.view-switch-segmented'), 'styles.css must style view-switch-segmented');
  assert.ok(css.includes('.view-seg-btn.active'), 'styles.css must style active segmented button');
  assert.ok(css.includes('.list-item-container'), 'styles.css must style list item container');
  assert.ok(css.includes('.list-type-badge'), 'styles.css must style list type badge');
});

test('virtual-scroll.js respects list view mode for items per row', () => {
  const js = fs.readFileSync(path.resolve('virtual-scroll.js'), 'utf-8');
  assert.ok(
    js.includes('list-mode') || js.includes('list-view'),
    'virtual-scroll.js must check for list mode in getEstimatedItemsPerRow'
  );
});

test('script.js implements buildStructureCardElement, updateViewModeUI, and toggleViewMode', () => {
  const script = fs.readFileSync(path.resolve('script.js'), 'utf-8');
  assert.ok(script.includes('function buildStructureCardElement'), 'script.js must define buildStructureCardElement');
  assert.ok(script.includes('function updateViewModeUI'), 'script.js must define updateViewModeUI');
  assert.ok(script.includes('function toggleViewMode'), 'script.js must define toggleViewMode');
  assert.ok(script.includes('window.toggleViewMode = toggleViewMode'), 'script.js must export toggleViewMode');
  assert.ok(script.includes('placeholderHeight: isListViewMode ? 58 : 220'), 'script.js must adjust placeholderHeight for list view');
});
