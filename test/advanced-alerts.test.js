/**
 * @fileoverview 即時警示系統單元測試
 * @module test/advanced-alerts
 */

const {
  AdvancedAlertEngine,
  ALERT_TYPES,
  SEVERITY,
  createTelegramChannel
} = require('../src/alerts/advanced-alerts');
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
function createMockDb(priceData = [], instData = [], positions = []) {
  return {
    prepare: (sql) => ({
      all: (symbol, limit) => {
        if (sql.includes('daily_prices')) return priceData;
        if (sql.includes('institutional')) return instData;
        return [];
      },
      get: (symbol) => {
        if (sql.includes('positions')) return positions.find(p => p.symbol === symbol) || null;
        if (sql.includes('daily_prices')) return priceData[0] || null;
        return null;
      }
    })
  };
}

function generatePriceData(count, opts = {}) {
  const { baseClose = 100, baseVolume = 10000 } = opts;
  return Array.from({ length: count }, (_, i) => ({
    close: baseClose - i * 0.3,
    open: baseClose - i * 0.3 - 0.2,
    high: baseClose - i * 0.3 + 1,
    low: baseClose - i * 0.3 - 1,
    volume: baseVolume,
    date: `2026-01-${String(count - i).padStart(2, '0')}`
  }));
}

console.log('\n📊 即時警示系統測試\n');

test('建構正確', () => {
  const engine = new AdvancedAlertEngine(createMockDb());
  assert.ok(engine);
  assert.strictEqual(engine.config.vaoThreshold, 70);
  assert.strictEqual(engine.channels.length, 0);
});

test('registerChannel 註冊管道', () => {
  const engine = new AdvancedAlertEngine(createMockDb());
  engine.registerChannel({ name: 'test', send: async () => {} });
  assert.strictEqual(engine.channels.length, 1);
});

test('registerChannel 拒絕無效管道', () => {
  const engine = new AdvancedAlertEngine(createMockDb());
  engine.registerChannel({});
  engine.registerChannel(null);
  assert.strictEqual(engine.channels.length, 0);
});

test('scan 空清單回傳空陣列', async () => {
  const engine = new AdvancedAlertEngine(createMockDb());
  const alerts = await engine.scan([]);
  assert.strictEqual(alerts.length, 0);
});

test('scan 資料不足時不崩潰', async () => {
  const engine = new AdvancedAlertEngine(createMockDb([], []));
  const alerts = await engine.scan(['2330']);
  assert.ok(Array.isArray(alerts));
});

test('技術面 VAO 爆量警示', async () => {
  const priceData = generatePriceData(65, { baseVolume: 5000 });
  priceData[0].volume = 100000; // 爆量
  priceData[0].close = 120;
  priceData[1].close = 100;
  const engine = new AdvancedAlertEngine(createMockDb(priceData));
  const alerts = await engine.scan(['2330']);
  const vaoAlert = alerts.find(a => a.type === ALERT_TYPES.VAO_EXPLOSION);
  assert.ok(vaoAlert, '應有 VAO 爆量警示');
});

test('技術面異常放量下跌警示', async () => {
  const priceData = generatePriceData(65, { baseClose: 100, baseVolume: 5000 });
  priceData[0].close = 94; // -6%
  priceData[1].close = 100;
  priceData[0].volume = 15000; // 3x avg
  const engine = new AdvancedAlertEngine(createMockDb(priceData));
  const alerts = await engine.scan(['2330']);
  const spikeAlert = alerts.find(a => a.type === ALERT_TYPES.VOLUME_SPIKE_DOWN);
  assert.ok(spikeAlert, '應有放量下跌警示');
  assert.strictEqual(spikeAlert.severity, SEVERITY.CRITICAL);
});

test('籌碼面外資連續買超警示', async () => {
  const instData = Array.from({ length: 5 }, (_, i) => ({
    foreign_net: 600,
    trust_net: 100,
    dealer_net: 50,
    margin_balance: 5000,
    short_balance: 800
  }));
  const engine = new AdvancedAlertEngine(createMockDb(generatePriceData(65), instData));
  const alerts = await engine.scan(['2330']);
  const foreignAlert = alerts.find(a => a.type === ALERT_TYPES.FOREIGN_CONSECUTIVE_BUY);
  assert.ok(foreignAlert, '應有外資連續買超警示');
});

test('籌碼面融資暴增警示', async () => {
  const instData = [
    { foreign_net: 0, trust_net: 0, dealer_net: 0, margin_balance: 12000, short_balance: 800 },
    { foreign_net: 0, trust_net: 0, dealer_net: 0, margin_balance: 10000, short_balance: 800 }
  ];
  // margin +20%
  const engine = new AdvancedAlertEngine(createMockDb(generatePriceData(65), instData));
  const alerts = await engine.scan(['2330']);
  const marginAlert = alerts.find(a => a.type === ALERT_TYPES.MARGIN_SURGE);
  assert.ok(marginAlert, '應有融資暴增警示');
});

test('formatAlerts 空警示', () => {
  const engine = new AdvancedAlertEngine(createMockDb());
  const text = engine.formatAlerts([]);
  assert.ok(text.includes('無警示'));
});

test('formatAlerts 有警示', () => {
  const engine = new AdvancedAlertEngine(createMockDb());
  const alerts = [
    { type: 'TEST', symbol: '2330', severity: SEVERITY.CRITICAL, message: '測試警示' },
    { type: 'TEST2', symbol: '2454', severity: SEVERITY.INFO, message: '資訊' }
  ];
  const text = engine.formatAlerts(alerts);
  assert.ok(text.includes('2330'));
  assert.ok(text.includes('緊急'));
  assert.ok(text.includes('資訊'));
});

test('警示依嚴重度排序', async () => {
  const priceData = generatePriceData(65, { baseVolume: 5000 });
  priceData[0].close = 94;
  priceData[1].close = 100;
  priceData[0].volume = 15000;
  const instData = Array.from({ length: 5 }, () => ({
    foreign_net: 600, trust_net: 100, dealer_net: 50,
    margin_balance: 5000, short_balance: 800
  }));
  const engine = new AdvancedAlertEngine(createMockDb(priceData, instData));
  const alerts = await engine.scan(['2330']);
  if (alerts.length > 1) {
    const sevOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    for (let i = 1; i < alerts.length; i++) {
      assert.ok(
        (sevOrder[alerts[i].severity] || 9) >= (sevOrder[alerts[i - 1].severity] || 9),
        '警示應依嚴重度排序'
      );
    }
  }
});

test('ALERT_TYPES 常數完整', () => {
  assert.ok(ALERT_TYPES.MA_BREAKOUT);
  assert.ok(ALERT_TYPES.VAO_EXPLOSION);
  assert.ok(ALERT_TYPES.STOP_LOSS);
  assert.ok(ALERT_TYPES.FOREIGN_CONSECUTIVE_BUY);
  assert.ok(ALERT_TYPES.MARGIN_SURGE);
});

console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
