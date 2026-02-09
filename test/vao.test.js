/**
 * @fileoverview VAO 指標單元測試
 * @module test/vao
 */

const { calculateVAO, calculateVAOBatch, average } = require('../src/indicators/vao');
const assert = require('assert');

// ─── Test Helpers ──────────────────────────────────
function generatePriceData(count, opts = {}) {
  const { baseClose = 100, baseVolume = 10000 } = opts;
  return Array.from({ length: count }, (_, i) => ({
    close: baseClose - i * 0.5,
    volume: baseVolume + Math.floor(Math.random() * 1000),
    high: baseClose - i * 0.5 + 2,
    low: baseClose - i * 0.5 - 2
  }));
}

// ─── Tests ─────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

console.log('\n📊 VAO 指標測試\n');

test('average() 計算正確', () => {
  assert.strictEqual(average([10, 20, 30]), 20);
  assert.strictEqual(average([]), 0);
  assert.strictEqual(average([5]), 5);
});

test('calculateVAO 資料不足時拋出錯誤', () => {
  assert.throws(() => calculateVAO([]), /至少/);
  assert.throws(() => calculateVAO(null), /至少/);
  assert.throws(() => calculateVAO(generatePriceData(5)), /至少/);
});

test('calculateVAO 正常計算 - WEAK 訊號', () => {
  const data = generatePriceData(25, { baseVolume: 10000 });
  const result = calculateVAO(data);
  assert.ok(typeof result.score === 'number');
  assert.ok(['STRONG', 'MODERATE', 'WEAK'].includes(result.signal));
  assert.ok(result.details.avgVolume5 > 0);
  assert.ok(result.details.avgVolume20 > 0);
});

test('calculateVAO 量能爆發 - STRONG 訊號', () => {
  const data = generatePriceData(25, { baseClose: 100, baseVolume: 5000 });
  // 今日量能 10 倍 + 價格漲 6%
  data[0].volume = 100000;
  data[0].close = 106;
  data[1].close = 100;
  const result = calculateVAO(data);
  assert.ok(result.score >= 70, `Score ${result.score} should >= 70`);
  assert.strictEqual(result.signal, 'STRONG');
});

test('calculateVAO 含 totalShares 周轉率計算', () => {
  const data = generatePriceData(25, { baseVolume: 5000 });
  data[0].volume = 100000;
  data[0].close = 110;
  data[1].close = 100;
  const result = calculateVAO(data, { totalShares: 500000 });
  assert.ok(result.details.turnoverRate !== null);
  assert.ok(result.details.turnoverRate > 0);
});

test('calculateVAOBatch 批量計算', () => {
  const stocks = {
    '2330': generatePriceData(25, { baseVolume: 50000 }),
    '2454': generatePriceData(25, { baseVolume: 30000 })
  };
  stocks['2330'][0].volume = 500000;
  stocks['2330'][0].close = 110;
  stocks['2330'][1].close = 100;
  
  const results = calculateVAOBatch(stocks);
  assert.strictEqual(results.length, 2);
  assert.ok(results[0].score >= results[1].score, '應由高分到低分排序');
});

test('calculateVAOBatch 跳過資料不足的股票', () => {
  const stocks = {
    '2330': generatePriceData(25),
    '9999': generatePriceData(3) // 不足
  };
  const results = calculateVAOBatch(stocks);
  assert.strictEqual(results.length, 1);
});

console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
