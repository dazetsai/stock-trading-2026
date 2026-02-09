/**
 * @fileoverview SQLite Schema + DB 操作單元測試
 * @module test/db
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const assert = require('assert');

// 使用暫時測試資料庫
const TEST_DB_PATH = path.resolve(__dirname, '../test_stock_data.db');
const SCHEMA_PATH = path.resolve(__dirname, '../src/database/schema.sql');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (err) { failed++; console.log(`  ❌ ${name}: ${err.message}`); }
}

console.log('\n📊 SQLite Schema + DB 測試\n');

// Setup: 建立測試 DB
let db;
try {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  db = new Database(TEST_DB_PATH);
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
} catch (err) {
  console.error(`❌ Setup 失敗: ${err.message}`);
  process.exit(1);
}

test('所有資料表已建立', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const names = tables.map(t => t.name);
  assert.ok(names.includes('daily_prices'));
  assert.ok(names.includes('institutional_trades'));
  assert.ok(names.includes('indicators'));
  assert.ok(names.includes('screener_signals'));
  assert.ok(names.includes('screener_performance'));
  assert.ok(names.includes('positions'));
  assert.ok(names.includes('trades_history'));
  assert.ok(names.includes('alert_log'));
});

test('daily_prices INSERT + SELECT', () => {
  db.prepare(`INSERT INTO daily_prices (symbol, date, open, high, low, close, volume)
    VALUES ('2330', '2026-02-09', 100, 105, 98, 103, 50000)`).run();
  const row = db.prepare('SELECT * FROM daily_prices WHERE symbol = ?').get('2330');
  assert.strictEqual(row.symbol, '2330');
  assert.strictEqual(row.close, 103);
  assert.strictEqual(row.volume, 50000);
});

test('daily_prices UNIQUE 約束 (INSERT OR REPLACE)', () => {
  db.prepare(`INSERT OR REPLACE INTO daily_prices (symbol, date, open, high, low, close, volume)
    VALUES ('2330', '2026-02-09', 101, 106, 99, 104, 60000)`).run();
  const row = db.prepare('SELECT * FROM daily_prices WHERE symbol = ? AND date = ?').get('2330', '2026-02-09');
  assert.strictEqual(row.close, 104);
});

test('indicators INSERT + SELECT', () => {
  db.prepare(`INSERT INTO indicators (symbol, date, indicator_type, value, signal, metadata)
    VALUES ('2330', '2026-02-09', 'VAO', 75.5, 'STRONG', '{"volumeRatio5":2.3}')`).run();
  const row = db.prepare('SELECT * FROM indicators WHERE symbol = ? AND indicator_type = ?').get('2330', 'VAO');
  assert.strictEqual(row.value, 75.5);
  assert.strictEqual(row.signal, 'STRONG');
  assert.ok(JSON.parse(row.metadata).volumeRatio5 === 2.3);
});

test('screener_signals INSERT + SELECT', () => {
  db.prepare(`INSERT INTO screener_signals 
    (symbol, date, signal_date, technical_score, institutional_score, volume_score, total_score, tier)
    VALUES ('2330', '2026-02-09', '2026-02-09', 85, 88, 90, 87, 'TIER1')`).run();
  const row = db.prepare('SELECT * FROM screener_signals WHERE tier = ?').get('TIER1');
  assert.strictEqual(row.total_score, 87);
});

test('alert_log INSERT', () => {
  db.prepare(`INSERT INTO alert_log (alert_type, symbol, message)
    VALUES ('STOP_LOSS', '2457', '已觸及停損線')`).run();
  const row = db.prepare('SELECT * FROM alert_log WHERE alert_type = ?').get('STOP_LOSS');
  assert.strictEqual(row.symbol, '2457');
});

test('trades_history INSERT', () => {
  db.prepare(`INSERT INTO trades_history (symbol, action, price, quantity, trade_date, pnl, pnl_pct)
    VALUES ('2454', 'SELL', 1200, 70, '2026-02-09', 5000, 5.5)`).run();
  const row = db.prepare('SELECT * FROM trades_history WHERE symbol = ?').get('2454');
  assert.strictEqual(row.pnl, 5000);
});

test('索引已建立', () => {
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all();
  assert.ok(indexes.length >= 5, `索引數量 ${indexes.length} 應 >= 5`);
});

// Cleanup
db.close();
fs.unlinkSync(TEST_DB_PATH);

console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
