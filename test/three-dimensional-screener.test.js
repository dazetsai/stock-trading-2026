/**
 * @fileoverview 三維選股引擎單元測試
 * @module test/three-dimensional-screener
 */

const {
  scoreTechnical,
  scoreInstitutional,
  scoreFundamental,
  calculateCompositeScore,
  ThreeDimensionalScreener,
  WEIGHTS,
  TIER_THRESHOLDS
} = require('../src/screener/three-dimensional-screener');
const assert = require('assert');

// ─── Test Helpers ──────────────────────────────────
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

function generatePriceData(count, opts = {}) {
  const { baseClose = 100, baseVolume = 10000, trend = 'up' } = opts;
  return Array.from({ length: count }, (_, i) => {
    const close = trend === 'up'
      ? baseClose + (count - i) * 0.5
      : baseClose - i * 0.5;
    return {
      close,
      open: close - 0.3,
      high: close + 1,
      low: close - 1,
      volume: baseVolume + Math.floor(Math.random() * 500),
      date: `2026-01-${String(count - i).padStart(2, '0')}`
    };
  });
}

function generateInstitutionalData(count, opts = {}) {
  const { foreignBuy = true, trustBuy = true } = opts;
  return Array.from({ length: count }, (_, i) => ({
    foreign_net: foreignBuy ? 500 + i * 100 : -200,
    trust_net: trustBuy ? 300 + i * 50 : -100,
    dealer_net: 100,
    margin_balance: 5000 - i * 10,
    short_balance: 800,
    date: `2026-01-${String(count - i).padStart(2, '0')}`
  }));
}

// ─── scoreTechnical Tests ──────────────────────────
console.log('\n📊 三維選股引擎測試\n');
console.log('--- scoreTechnical ---');

test('scoreTechnical 資料不足回傳 score 0', () => {
  const result = scoreTechnical([]);
  assert.strictEqual(result.score, 0);
  assert.ok(result.error);
});

test('scoreTechnical 正常計算回傳 0-100', () => {
  const data = generatePriceData(65, { trend: 'up', baseVolume: 10000 });
  const result = scoreTechnical(data);
  assert.ok(typeof result.score === 'number');
  assert.ok(result.score >= 0 && result.score <= 100, `Score ${result.score} out of range`);
  assert.ok(result.vao);
  assert.ok(result.mtm);
  assert.ok(result.ma);
});

test('scoreTechnical 多頭趨勢得分較高', () => {
  const bullish = generatePriceData(65, { trend: 'up', baseClose: 50 });
  // 讓 VAO 爆量
  bullish[0].volume = 200000;
  bullish[0].close = 90;
  bullish[1].close = 84;
  const result = scoreTechnical(bullish);
  assert.ok(result.score > 20, `Bullish score ${result.score} should be > 20`);
});

test('scoreTechnical 包含 entrySignal', () => {
  const data = generatePriceData(65);
  const result = scoreTechnical(data);
  assert.ok(result.entrySignal !== undefined);
  assert.ok('triggered' in result.entrySignal);
  assert.ok('conditions' in result.entrySignal);
});

// ─── scoreInstitutional Tests ──────────────────────
console.log('\n--- scoreInstitutional ---');

test('scoreInstitutional 資料不足回傳 score 0', () => {
  const result = scoreInstitutional([]);
  assert.strictEqual(result.score, 0);
});

test('scoreInstitutional 法人連續買超得分較高', () => {
  const data = generateInstitutionalData(10, { foreignBuy: true, trustBuy: true });
  const result = scoreInstitutional(data);
  assert.ok(result.score >= 50, `Score ${result.score} should be >= 50 for consecutive buy`);
  assert.ok(result.sentiment);
});

test('scoreInstitutional 法人賣超得分較低', () => {
  const data = generateInstitutionalData(10, { foreignBuy: false, trustBuy: false });
  const result = scoreInstitutional(data);
  assert.ok(result.score < 50, `Score ${result.score} should be < 50 for selling`);
});

test('scoreInstitutional 回傳 details', () => {
  const data = generateInstitutionalData(5);
  const result = scoreInstitutional(data);
  assert.ok(result.details);
  assert.ok('foreignScore' in result.details);
  assert.ok('trustScore' in result.details);
  assert.ok('foreignConsecutiveBuy' in result.details);
});

// ─── scoreFundamental Tests ────────────────────────
console.log('\n--- scoreFundamental ---');

test('scoreFundamental null 資料給中性分 50', () => {
  const result = scoreFundamental(null);
  assert.strictEqual(result.score, 50);
});

test('scoreFundamental 高成長得分高', () => {
  const result = scoreFundamental({
    revenueGrowthYoY: 35,
    revenueGrowthMoM: 15,
    eps: 10,
    epsPrevYear: 6,
    peRatio: 12
  });
  assert.ok(result.score >= 70, `Score ${result.score} should be >= 70 for high growth`);
});

test('scoreFundamental 衰退得分低', () => {
  const result = scoreFundamental({
    revenueGrowthYoY: -20,
    revenueGrowthMoM: -15,
    eps: 2,
    epsPrevYear: 5,
    peRatio: 40
  });
  assert.ok(result.score <= 35, `Score ${result.score} should be <= 35 for declining`);
});

test('scoreFundamental 部分缺失仍可計算', () => {
  const result = scoreFundamental({ revenueGrowthYoY: 10 });
  assert.ok(typeof result.score === 'number');
  assert.ok(result.score > 0);
});

// ─── calculateCompositeScore Tests ─────────────────
console.log('\n--- calculateCompositeScore ---');

test('calculateCompositeScore 加權計算正確', () => {
  const result = calculateCompositeScore(80, 70, 60);
  const expected = Math.round(80 * 0.40 + 70 * 0.30 + 60 * 0.30);
  assert.strictEqual(result.totalScore, expected);
});

test('calculateCompositeScore TIER1 分級', () => {
  const result = calculateCompositeScore(80, 80, 80);
  assert.strictEqual(result.tier, 'TIER1');
  assert.strictEqual(result.recommendation, '買入');
});

test('calculateCompositeScore TIER2 分級', () => {
  const result = calculateCompositeScore(70, 60, 55);
  assert.strictEqual(result.tier, 'TIER2');
});

test('calculateCompositeScore EXCLUDED 低分', () => {
  const result = calculateCompositeScore(20, 20, 20);
  assert.strictEqual(result.tier, 'EXCLUDED');
  assert.strictEqual(result.recommendation, '迴避');
});

test('calculateCompositeScore 單維度過低阻止升級', () => {
  // 總分高但某維度低於 60 → 不能 TIER1
  const result = calculateCompositeScore(95, 90, 50);
  assert.ok(result.tier !== 'TIER1', `Should not be TIER1 when one dim is 50`);
});

test('WEIGHTS 合計為 1', () => {
  const sum = WEIGHTS.TECHNICAL + WEIGHTS.INSTITUTIONAL + WEIGHTS.FUNDAMENTAL;
  assert.strictEqual(sum, 1.0);
});

// ─── ThreeDimensionalScreener Class Tests ──────────
console.log('\n--- ThreeDimensionalScreener Class ---');

test('ThreeDimensionalScreener 建構正確', () => {
  const mockDb = {};
  const screener = new ThreeDimensionalScreener(mockDb, { topN: 10 });
  assert.ok(screener);
  assert.strictEqual(screener.config.topN, 10);
  assert.strictEqual(screener.config.minAvgVolume, 1000);
});

test('formatTelegramReport 格式正確', () => {
  const mockDb = {};
  const screener = new ThreeDimensionalScreener(mockDb);
  const mockResults = {
    date: '2026-02-08',
    tier1: [{
      symbol: '2330',
      latestPrice: 1780,
      technical: { score: 85 },
      institutional: { score: 88 },
      fundamental: { score: 75 },
      composite: { totalScore: 83, recommendation: '買入' }
    }],
    tier2: [],
    tier3: [],
    summary: { totalMarket: 1687, afterFilter: 23, tier1Count: 1, tier2Count: 0, tier3Count: 0 }
  };
  const report = screener.formatTelegramReport(mockResults);
  assert.ok(report.includes('選股快報'));
  assert.ok(report.includes('2330'));
  assert.ok(report.includes('1687'));
});

// ─── 結果 ──────────────────────────────────────────
console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
