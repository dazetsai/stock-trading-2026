/**
 * @fileoverview 法人爬蟲單元測試 (純邏輯，不含 HTTP 呼叫)
 * @module test/institutional-crawler
 */

const { formatDateTWSE, parseIntSafe } = require('../src/crawler/institutional-crawler');
const assert = require('assert');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (err) { failed++; console.log(`  ❌ ${name}: ${err.message}`); }
}

console.log('\n📊 法人爬蟲測試\n');

test('formatDateTWSE 字串格式', () => {
  assert.strictEqual(formatDateTWSE('2026-02-09'), '20260209');
  assert.strictEqual(formatDateTWSE('2026-01-01'), '20260101');
});

test('formatDateTWSE Date 物件', () => {
  const d = new Date(2026, 1, 9); // Feb 9
  assert.strictEqual(formatDateTWSE(d), '20260209');
});

test('parseIntSafe 各種輸入', () => {
  assert.strictEqual(parseIntSafe('1,234'), 1234);
  assert.strictEqual(parseIntSafe('-5,678'), -5678);
  assert.strictEqual(parseIntSafe('0'), 0);
  assert.strictEqual(parseIntSafe(null), 0);
  assert.strictEqual(parseIntSafe(undefined), 0);
  assert.strictEqual(parseIntSafe('abc'), 0);
  assert.strictEqual(parseIntSafe('12345'), 12345);
});

test('模組匯出完整', () => {
  const mod = require('../src/crawler/institutional-crawler');
  assert.strictEqual(typeof mod.fetchInstitutionalData, 'function');
  assert.strictEqual(typeof mod.fetchAndSave, 'function');
  assert.ok(mod.CONFIG.twseUrl.includes('twse'));
});

console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
