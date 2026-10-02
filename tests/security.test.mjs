import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('vercel.json includes critical security headers and edge caching', () => {
  const vercelConfig = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf-8'));
  const allRoutes = vercelConfig.headers || [];

  const catchAll = allRoutes.find(r => r.source === '/(.*)');
  assert.ok(catchAll, 'vercel.json must have a catch-all header rule');

  const headers = catchAll.headers.reduce((acc, h) => {
    acc[h.key] = h.value;
    return acc;
  }, {});

  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.ok(headers['Strict-Transport-Security'].includes('max-age=31536000'));
  assert.ok(headers['Permissions-Policy'].includes('camera=()'));

  const geocodeRoute = allRoutes.find(r => r.source === '/api/geocode');
  assert.ok(geocodeRoute, 'vercel.json must have geocode route caching');
});

test('firestore.rules protects structure deletion and validates fields', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');
  assert.ok(rules.includes('function isAdmin()'), 'firestore.rules must define isAdmin helper');
  assert.ok(rules.includes('allow delete: if isAdmin()'), 'firestore.rules must restrict delete to admins');
  assert.ok(rules.includes('request.resource.data.Struttura is string'), 'firestore.rules must validate structure name string');
});

test('api/geocode.js validates query string and sets edge cache headers', () => {
  const code = fs.readFileSync(path.resolve('api/geocode.js'), 'utf-8');
  assert.ok(code.includes('cleanQ = q.trim().slice(0, 100)'), 'api/geocode.js must bound query length');
  assert.ok(code.includes('Cache-Control'), 'api/geocode.js must set Cache-Control header');
});

test('script.js and maps.js import and use escapeHtml for XSS defense', () => {
  const script = fs.readFileSync(path.resolve('script.js'), 'utf-8');
  assert.ok(script.includes('escapeHtml'), 'script.js must import/use escapeHtml');
  assert.ok(script.includes('safeStruttura'), 'script.js must use safeStruttura');

  const maps = fs.readFileSync(path.resolve('maps.js'), 'utf-8');
  assert.ok(maps.includes('function escapeHtml'), 'maps.js must define escapeHtml');
  assert.ok(maps.includes('safeStruttura'), 'maps.js must escape structure name in popup');
});
