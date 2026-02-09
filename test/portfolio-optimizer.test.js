/**
 * @fileoverview 投資組合優化器單元測試
 * @module test/portfolio-optimizer
 */

const { PortfolioOptimizer } = require('../src/portfolio/optimizer');
const assert = require('assert');

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

// Mock DB
function createMockDb(positions = [], prices = {}) {
  return {
    prepare: (sql) => ({
      all: () => positions,
      get: (symbol) => prices[symbol] ? { close: prices[symbol] } : null
    })
  };
}

console.log('\n📊 投資組合優化器測試\n');

test('空庫存回傳無需優化', async () => {
  const optimizer = new PortfolioOptimizer(createMockDb([]));
  const result = await optimizer.optimize([]);
  assert.ok(result.message.includes('無庫存'));
});

test('基本優化正常運作', async () => {
  const positions = [
    { symbol: '2330', shares: 1000, buyPrice: 500, sector: '半導體' },
    { symbol: '2317', shares: 2000, buyPrice: 100, sector: '電子代工' },
    { symbol: '2454', shares: 500, buyPrice: 800, sector: '半導體' }
  ];
  const optimizer = new PortfolioOptimizer(createMockDb([], {
    '2330': 550, '2317': 110, '2454': 850
  }));
  const result = await optimizer.optimize(positions);
  assert.ok(result.totalValue > 0);
  assert.ok(result.positions.length === 3);
  assert.ok(result.analysis);
  assert.ok(result.riskMetrics);
});

test('偵測單檔過度集中', async () => {
  const positions = [
    { symbol: '2330', shares: 10000, buyPrice: 500, sector: '半導體' },
    { symbol: '2317', shares: 100, buyPrice: 100, sector: '電子代工' }
  ];
  const optimizer = new PortfolioOptimizer(createMockDb([], {
    '2330': 500, '2317': 100
  }));
  const result = await optimizer.optimize(positions);
  const reduceRec = result.recommendations.find(r => r.type === 'REDUCE');
  assert.ok(reduceRec, '應有 REDUCE 建議');
  assert.ok(reduceRec.symbol === '2330');
});

test('偵測持股過少', async () => {
  const positions = [
    { symbol: '2330', shares: 1000, buyPrice: 500, sector: '半導體' }
  ];
  const optimizer = new PortfolioOptimizer(createMockDb([], { '2330': 500 }));
  const result = await optimizer.optimize(positions);
  const addRec = result.recommendations.find(r => r.type === 'ADD');
  assert.ok(addRec, '應有 ADD 建議');
});

test('偵測虧損嚴重持股', async () => {
  const positions = [
    { symbol: '2330', shares: 1000, buyPrice: 600, sector: '半導體' },
    { symbol: '9999', shares: 1000, buyPrice: 100, sector: '其他' }
  ];
  const optimizer = new PortfolioOptimizer(createMockDb([], {
    '2330': 600, '9999': 80  // -20%
  }));
  const result = await optimizer.optimize(positions);
  const reviewRec = result.recommendations.find(r => r.type === 'REVIEW' && r.symbol === '9999');
  assert.ok(reviewRec, '應有 REVIEW 建議');
});

test('HHI 分散度計算', async () => {
  const positions = [
    { symbol: '2330', shares: 1000, buyPrice: 100, sector: 'A' },
    { symbol: '2317', shares: 1000, buyPrice: 100, sector: 'B' },
    { symbol: '2454', shares: 1000, buyPrice: 100, sector: 'C' },
    { symbol: '2412', shares: 1000, buyPrice: 100, sector: 'D' }
  ];
  const optimizer = new PortfolioOptimizer(createMockDb([], {
    '2330': 100, '2317': 100, '2454': 100, '2412': 100
  }));
  const result = await optimizer.optimize(positions);
  // 4 equal positions → HHI = 4 * (0.25)^2 = 0.25
  assert.strictEqual(result.analysis.hhi, 0.25);
});

test('formatReport 格式正確', async () => {
  const positions = [
    { symbol: '2330', shares: 1000, buyPrice: 500, sector: '半導體' }
  ];
  const optimizer = new PortfolioOptimizer(createMockDb([], { '2330': 550 }));
  const result = await optimizer.optimize(positions);
  const report = optimizer.formatReport(result);
  assert.ok(report.includes('投資組合'));
  assert.ok(report.includes('持股數'));
});

console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
