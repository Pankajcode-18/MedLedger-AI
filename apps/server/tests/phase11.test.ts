/**
 * Phase 11 – the study's scoring (SUS, agreement between doctors, confidence intervals, CSV reading).
 * Run with: npm test (inside apps/server).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { meanCI, parseCsv, susBand, susScore, weightedKappa, wilson } from '../../../docs/study/scoring.js';

describe('System Usability Scale', () => {
  test('scores follow Brooke (1996)', () => {
    assert.equal(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]), 50);
    assert.equal(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]), 100);
    assert.equal(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]), 0);
    assert.equal(susScore([4, 2, 4, 1, 4, 2, 5, 2, 4, 3]), 77.5);
    assert.equal(susBand(77.5), 'Good');
    assert.equal(susBand(68), 'OK');
  });
  test('refuses incomplete or out-of-range answers', () => {
    assert.throws(() => susScore([3, 3, 3]));
    assert.throws(() => susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 6]));
  });
});

describe('statistics', () => {
  test('mean with a t-based 95% interval', () => {
    const r = meanCI([70, 75, 80, 85, 90]);
    assert.equal(r.mean, 80);
    assert.ok(Math.abs(r.sd - 7.9057) < 1e-3);
    assert.ok(Math.abs(r.low - (80 - 2.776 * 7.9057 / Math.sqrt(5))) < 1e-2);
  });
  test('weighted kappa: 1 for identical ratings, below 0 for systematic disagreement', () => {
    assert.equal(weightedKappa([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 1);
    assert.ok(weightedKappa([1, 2, 4, 5, 3, 4], [1, 3, 4, 5, 3, 3]) > 0.8);
    assert.ok(weightedKappa([1, 2, 4, 5], [5, 4, 2, 1]) < 0);
  });
  test('Wilson interval', () => {
    const w = wilson(95, 100);
    assert.equal(w.rate, 0.95);
    assert.ok(w.low > 0.88 && w.low < 0.9 && w.high > 0.97 && w.high < 0.99);
  });
  test('CSV with comments, quotes and a byte-order mark', () => {
    const rows = parseCsv('﻿# comment\nid,note\n1,"a, b"\n2,"say ""hi"""\n');
    assert.deepEqual(rows, [{ id: '1', note: 'a, b' }, { id: '2', note: 'say "hi"' }]);
  });
});
