/**
 * @fileoverview 回測引擎單元測試
 * @module test/backtest-engine
 */

const {
  BacktestEngine,
  MACrossStrategy,
  VAOBreakoutStrategy,
  calculatePerformance,
  DEFAULT_CONFIG
} = require('../src/backtest/backtest-engine');
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

// 產生模擬價格序列 (日期升序)
function generateAscPriceData(days, opts = {}) {
  const { baseClose = 100, baseVolume = 10000, volatility = 0.02, trend = 0.001 } = opts;
  const data = [];
  let price = baseClose;
  const startDate = new Date('2025-01-02');
  for (let i = 0; i < days; i++) {
    const change = (Math.random() - 0.48) * volatility * price + trend * price;
    price += change;
    price = Math.max(price, 1);
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    data.push({
      symbol: '2330',
      date: d.toISOString().slice(0, 10),
      open: price - 0.5,
      high: price + 1.5,
      low: price - 1.5,
      close: Math.round(price * 100) / 100,
      volume: baseVolume + Math.floor(Math.random() * 5000)
    });
  }
  return data;
}

console.log('\n📊 回測引擎測試\n');

// ─── MACrossStrategy Tests ────────────────────────
console.log('--- MACrossStrategy ---');

test('MACrossStrategy 預設參數', () => {
  const s = new MACrossStrategy();
  assert.strictEqual(s.shortPeriod, 10);
  assert.strictEqual(s.longPeriod, 20);
  assert.strictEqual(s.stopLoss, 0.07);
});

test('MACrossStrategy shouldExit 停損', () => {
  const s = new MACrossStrategy({ stopLoss: 0.07 });
  const position = { entryPrice: 100 };
  const bar = { close: 92 }; // -8%
  const result = s.shouldExit(position, bar, 100);
  assert.strictEqual(result.exit, true);
  assert.ok(result.reason.includes('停損'));
});

test('MACrossStrategy shouldExit 停利', () => {
  const s = new MACrossStrategy({ takeProfit: 0.15 });
  const position = { entryPrice: 100 };
  const bar = { close: 116 };
  const result = s.shouldExit(position, bar, 116);
  assert.strictEqual(result.exit, true);
  assert.ok(result.reason.includes('停利'));
});

test('MACrossStrategy shouldExit 移動停利', () => {
  const s = new MACrossStrategy({ trailingActivation: 0.10, trailingStop: 0.03 });
  const position = { entryPrice: 100 };
  const bar = { close: 107.5 }; // 高點回檔 >3%
  const result = s.shouldExit(position, bar, 112); // 高點 112, 回到 107.5 = 4% 回檔
  assert.strictEqual(result.exit, true);
  assert.ok(result.reason.includes('移動停利'));
});

test('MACrossStrategy shouldExit 未觸發', () => {
  const s = new MACrossStrategy();
  const position = { entryPrice: 100 };
  const bar = { close: 105 };
  const result = s.shouldExit(position, bar, 105);
  assert.strictEqual(result.exit, false);
});

// ─── VAOBreakoutStrategy Tests ────────────────────
console.log('\n--- VAOBreakoutStrategy ---');

test('VAOBreakoutStrategy 預設參數', () => {
  const s = new VAOBreakoutStrategy();
  assert.strictEqual(s.volumeMultiple, 1.5);
  assert.strictEqual(s.priceChangeMin, 2);
});

// ─── calculatePerformance Tests ───────────────────
console.log('\n--- calculatePerformance ---');

test('calculatePerformance 空交易', () => {
  const result = calculatePerformance([], [1000000], DEFAULT_CONFIG);
  assert.strictEqual(result.totalTrades, 0);
  assert.strictEqual(result.winRate, 0);
  assert.strictEqual(result.sharpeRatio, 0);
});

test('calculatePerformance 有交易', () => {
  const trades = [
    { entryDate: '2025-01-10', exitDate: '2025-01-20', pnl: 5000, returnPct: 5 },
    { entryDate: '2025-02-01', exitDate: '2025-02-10', pnl: -2000, returnPct: -2 },
    { entryDate: '2025-03-01', exitDate: '2025-03-15', pnl: 8000, returnPct: 8 }
  ];
  const equity = [1000000, 1005000, 1003000, 1011000];
  const result = calculatePerformance(trades, equity, DEFAULT_CONFIG);
  assert.strictEqual(result.totalTrades, 3);
  assert.strictEqual(result.winCount, 2);
  assert.strictEqual(result.loseCount, 1);
  assert.ok(result.winRate > 60);
  assert.ok(result.totalReturn > 0);
});

test('calculatePerformance MDD 計算', () => {
  const equity = [100, 120, 110, 130, 105, 140];
  const result = calculatePerformance(
    [{ entryDate: '2025-01-01', exitDate: '2025-01-05', pnl: 40, returnPct: 40 }],
    equity,
    { ...DEFAULT_CONFIG, initialCapital: 100 }
  );
  // Peak=130, Trough=105, DD=25/130=19.23%
  assert.ok(result.maxDrawdownPct > 19 && result.maxDrawdownPct < 20,
    `MDD ${result.maxDrawdownPct} should be ~19.23%`);
});

test('calculatePerformance 月度報酬', () => {
  const trades = [
    { entryDate: '2025-01-01', exitDate: '2025-01-15', pnl: 3000, returnPct: 3 },
    { entryDate: '2025-01-16', exitDate: '2025-01-25', pnl: 2000, returnPct: 2 },
    { entryDate: '2025-02-01', exitDate: '2025-02-10', pnl: -1000, returnPct: -1 }
  ];
  const result = calculatePerformance(trades, [1000000], DEFAULT_CONFIG);
  assert.ok(result.monthlyReturns.length >= 2);
  const jan = result.monthlyReturns.find(m => m.month === '2025-01');
  assert.ok(jan);
  assert.strictEqual(jan.trades, 2);
});

test('calculatePerformance profitFactor', () => {
  const trades = [
    { entryDate: '2025-01-01', exitDate: '2025-01-10', pnl: 10000, returnPct: 10 },
    { entryDate: '2025-02-01', exitDate: '2025-02-10', pnl: -5000, returnPct: -5 }
  ];
  const result = calculatePerformance(trades, [1000000], DEFAULT_CONFIG);
  assert.strictEqual(result.profitFactor, 2.0);
});

// ─── BacktestEngine Class Tests ───────────────────
console.log('\n--- BacktestEngine Class ---');

test('BacktestEngine 建構正確', () => {
  const engine = new BacktestEngine({}, { initialCapital: 500000 });
  assert.strictEqual(engine.config.initialCapital, 500000);
  assert.strictEqual(engine.config.commission, DEFAULT_CONFIG.commission);
});

test('BacktestEngine._createStrategy MA_CROSS', () => {
  const engine = new BacktestEngine({});
  const strategy = engine._createStrategy({ type: 'MA_CROSS', params: { shortPeriod: 5 } });
  assert.ok(strategy instanceof MACrossStrategy);
  assert.strictEqual(strategy.shortPeriod, 5);
});

test('BacktestEngine._simulate 基本模擬', () => {
  const engine = new BacktestEngine({});
  // 產生明確上漲資料讓 MA 交叉能被觸發
  const data = generateAscPriceData(100, { trend: 0.005, volatility: 0.01 });
  const strategy = new MACrossStrategy({ shortPeriod: 5, longPeriod: 10 });
  const { trades, equityCurve } = engine._simulate(data, strategy);
  assert.ok(Array.isArray(trades));
  assert.ok(Array.isArray(equityCurve));
  assert.strictEqual(equityCurve.length, data.length);
});

test('BacktestEngine.formatReport 格式正確', () => {
  const engine = new BacktestEngine({});
  const mockReport = {
    symbol: '2330',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    strategyType: 'MA_CROSS',
    tradingDays: 245,
    performance: {
      totalReturnPct: 15.5,
      totalReturn: 155000,
      maxDrawdownPct: 8.2,
      sharpeRatio: 1.3,
      profitFactor: 2.1,
      expectancy: 1.5,
      totalTrades: 12,
      winRate: 66.67,
      winCount: 8,
      loseCount: 4,
      avgWin: 5.2,
      avgLoss: 3.1,
      monthlyReturns: [
        { month: '2025-01', pnl: 20000, trades: 2, returnPct: 2.0 }
      ],
      equityCurve: []
    },
    trades: []
  };
  const report = engine.formatReport(mockReport);
  assert.ok(report.includes('2330'));
  assert.ok(report.includes('15.5%'));
  assert.ok(report.includes('夏普比率'));
  assert.ok(report.includes('MA_CROSS'));
});

// ─── 結果 ──────────────────────────────────────────
console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
