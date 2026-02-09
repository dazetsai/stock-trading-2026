/**
 * @fileoverview MTM + MA 指標單元測試
 * @module test/momentum
 */

const { calculateMTM, calculateMA, calculateMASystem } = require('../src/indicators/momentum');
const assert = require('assert');

function generatePriceData(count, baseClose = 100) {
  return Array.from({ length: count }, (_, i) => ({
    close: baseClose - i * 0.5,
    volume: 10000
  }));
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (err) { failed++; console.log(`  ❌ ${name}: ${err.message}`); }
}

console.log('\n📊 MTM + MA 指標測試\n');

// ─── MTM Tests ─────────────────────────────────────
test('calculateMTM 資料不足拋出錯誤', () => {
  assert.throws(() => calculateMTM([]), /至少/);
  assert.throws(() => calculateMTM(generatePriceData(10)), /至少/);
});

test('calculateMTM 正常計算 - 上漲趨勢', () => {
  const data = generatePriceData(20, 100);
  // 最新收盤 100, 10天前收盤 95 => MTM = 5
  const result = calculateMTM(data);
  assert.ok(typeof result.mtm === 'number');
  assert.ok(typeof result.mtmma === 'number');
  assert.ok(['ACCELERATING', 'DECELERATING'].includes(result.direction));
  assert.ok(['STRONG_BUY', 'BUY', 'HOLD', 'WEAK'].includes(result.signal));
});

test('calculateMTM STRONG_BUY 訊號', () => {
  // 構造: 今天 > 昨天, MTM > 0, MTMMA > 0, MTM > MTMMA
  const data = Array.from({ length: 20 }, (_, i) => ({
    close: 120 - i * 2 // 持續上漲
  }));
  const result = calculateMTM(data);
  assert.strictEqual(result.signal, 'STRONG_BUY');
  assert.ok(result.mtm > 0);
  assert.ok(result.signalStrength >= 70);
});

test('calculateMTM 自訂期數', () => {
  const data = generatePriceData(30, 100);
  const result = calculateMTM(data, { period: 5, maPeriod: 3 });
  assert.ok(typeof result.mtm === 'number');
});

// ─── MA Tests ──────────────────────────────────────
test('calculateMA 資料不足拋出錯誤', () => {
  assert.throws(() => calculateMA([], 20), /至少/);
  assert.throws(() => calculateMA(generatePriceData(10), 20), /至少/);
});

test('calculateMA 正常計算 MA20', () => {
  const data = generatePriceData(25, 100);
  const result = calculateMA(data, 20);
  assert.ok(typeof result.value === 'number');
  assert.strictEqual(result.period, 20);
  assert.ok(['ABOVE', 'BELOW'].includes(result.trend));
  assert.ok(typeof result.deviation === 'number');
});

test('calculateMA 價格在均線上方', () => {
  const data = generatePriceData(10, 100);
  // 最新 close=100, MA5 avg = (100+99.5+99+98.5+98)/5 = 99
  const result = calculateMA(data, 5);
  assert.strictEqual(result.trend, 'ABOVE');
  assert.ok(result.deviation > 0);
});

// ─── MASystem Tests ────────────────────────────────
test('calculateMASystem 資料不足拋出錯誤', () => {
  assert.throws(() => calculateMASystem(generatePriceData(30)), /至少 60/);
});

test('calculateMASystem 正常計算', () => {
  const data = generatePriceData(65, 200);
  const result = calculateMASystem(data);
  assert.ok(result.ma5);
  assert.ok(result.ma10);
  assert.ok(result.ma20);
  assert.ok(result.ma60);
  assert.ok(['BULLISH', 'BEARISH', 'MIXED'].includes(result.alignment));
  assert.ok(typeof result.aboveMA20 === 'boolean');
});

test('calculateMASystem 多頭排列', () => {
  // 持續下跌資料 (最新最高) => MA5 > MA10 > MA20 > MA60
  const data = Array.from({ length: 65 }, (_, i) => ({
    close: 200 - i * 1  // 最新200, 越早越低
  }));
  const result = calculateMASystem(data);
  assert.strictEqual(result.alignment, 'BULLISH');
});

console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
