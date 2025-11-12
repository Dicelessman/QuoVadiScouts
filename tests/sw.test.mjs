import test from 'node:test';
import assert from 'node:assert/strict';
import { isCacheableRequestLike } from '../utils/sw.js';

test('isCacheableRequestLike allows GET https', () => {
  assert.equal(isCacheableRequestLike({ url: 'https://example.com/app.js' }), true);
});

test('isCacheableRequestLike rejects POST', () => {
  assert.equal(isCacheableRequestLike({ url: 'https://api', method: 'POST' }), false);
});

test('isCacheableRequestLike rejects credentials include', () => {
  assert.equal(isCacheableRequestLike({ url: 'https://example.com', credentials: 'include' }), false);
});

test('isCacheableRequestLike rejects invalid URL', () => {
  assert.equal(isCacheableRequestLike({ url: 'not a url' }), false);
});

