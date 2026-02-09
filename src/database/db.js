/**
 * @fileoverview SQLite 資料庫適配器 - 完整 CRUD 介面
 * @module database/db
 * @version 2.0.0
 * @see docs/architecture-stock-2026.md
 *
 * @example
 * const DB = require('./database/db');
 * DB.saveDailyPrice({ symbol: '2330', date: '2026-02-09', open: 100, high: 105, low: 99, close: 103, volume: 50000 });
 * const history = DB.getHistory('2330', 30);
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '../../stock_data.db');
const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql');

let db;

/**
 * 取得資料庫連線 (lazy singleton)
 * @returns {Database} better-sqlite3 instance
 */
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * 執行 schema.sql 初始化所有資料表
 * @returns {void}
 */
function initDb() {
  const conn = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  conn.exec(schema);
  console.log('✅ SQLite 資料庫 Schema 初始化完成');
}

/**
 * 資料庫操作介面
 * @namespace DB
 */
const DB = {
  init: initDb,
  getDb,

  // ─── daily_prices ────────────────────────────────
  /**
   * 儲存每日收盤資料
   * @param {Object} data - { symbol, date, open, high, low, close, volume, turnover?, transactions? }
   * @returns {Object} run result
   */
  saveDailyPrice(data) {
    const stmt = getDb().prepare(`
      INSERT OR REPLACE INTO daily_prices (symbol, date, open, high, low, close, volume, turnover, transactions)
      VALUES (@symbol, @date, @open, @high, @low, @close, @volume, @turnover, @transactions)
    `);
    return stmt.run({
      symbol: data.symbol,
      date: data.date,
      open: data.open ?? null,
      high: data.high ?? null,
      low: data.low ?? null,
      close: data.close ?? null,
      volume: data.volume ?? null,
      turnover: data.turnover ?? null,
      transactions: data.transactions ?? null
    });
  },

  /**
   * 批量儲存每日收盤資料
   * @param {Array<Object>} rows - 資料陣列
   * @returns {number} 寫入筆數
   */
  saveDailyPriceBatch(rows) {
    const insert = getDb().transaction((items) => {
      for (const item of items) {
        DB.saveDailyPrice(item);
      }
      return items.length;
    });
    return insert(rows);
  },

  /**
   * 查詢特定股票的歷史價格 (最新在前)
   * @param {string} symbol - 股票代碼
   * @param {number} [limit=60] - 筆數上限
   * @returns {Array<Object>} 歷史價格
   */
  getHistory(symbol, limit = 60) {
    return getDb()
      .prepare('SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?')
      .all(symbol, limit);
  },

  // ─── institutional_trades ────────────────────────
  /**
   * 儲存法人買賣超與資券資料
   * @param {Object} data
   * @returns {Object} run result
   */
  saveInstitutionalTrade(data) {
    const stmt = getDb().prepare(`
      INSERT OR REPLACE INTO institutional_trades
        (symbol, date, foreign_net, trust_net, dealer_net, margin_balance, short_balance)
      VALUES (@symbol, @date, @foreign_net, @trust_net, @dealer_net, @margin_balance, @short_balance)
    `);
    return stmt.run({
      symbol: data.symbol,
      date: data.date,
      foreign_net: data.foreign_net ?? 0,
      trust_net: data.trust_net ?? 0,
      dealer_net: data.dealer_net ?? 0,
      margin_balance: data.margin_balance ?? 0,
      short_balance: data.short_balance ?? 0
    });
  },

  /**
   * 查詢法人買賣超歷史
   * @param {string} symbol
   * @param {number} [limit=30]
   * @returns {Array<Object>}
   */
  getInstitutionalHistory(symbol, limit = 30) {
    return getDb()
      .prepare('SELECT * FROM institutional_trades WHERE symbol = ? ORDER BY date DESC LIMIT ?')
      .all(symbol, limit);
  },

  // ─── indicators ──────────────────────────────────
  /**
   * 儲存指標計算結果
   * @param {Object} data - { symbol, date, indicator_type, value, signal?, metadata? }
   * @returns {Object}
   */
  saveIndicator(data) {
    const stmt = getDb().prepare(`
      INSERT OR REPLACE INTO indicators (symbol, date, indicator_type, value, signal, metadata)
      VALUES (@symbol, @date, @indicator_type, @value, @signal, @metadata)
    `);
    return stmt.run({
      symbol: data.symbol,
      date: data.date,
      indicator_type: data.indicator_type,
      value: data.value ?? null,
      signal: data.signal ?? null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null
    });
  },

  /**
   * 查詢特定股票的指標歷史
   * @param {string} symbol
   * @param {string} indicatorType
   * @param {number} [limit=30]
   * @returns {Array<Object>}
   */
  getIndicators(symbol, indicatorType, limit = 30) {
    return getDb()
      .prepare('SELECT * FROM indicators WHERE symbol = ? AND indicator_type = ? ORDER BY date DESC LIMIT ?')
      .all(symbol, indicatorType, limit);
  },

  // ─── screener_signals ────────────────────────────
  /**
   * 儲存選股訊號
   * @param {Object} data
   * @returns {Object}
   */
  saveScreenerSignal(data) {
    const stmt = getDb().prepare(`
      INSERT OR REPLACE INTO screener_signals
        (symbol, date, signal_date, technical_score, institutional_score, volume_score, total_score,
         tier, vao_score, mtm_score, ma_trend, foreign_sentiment, notes)
      VALUES (@symbol, @date, @signal_date, @technical_score, @institutional_score, @volume_score,
              @total_score, @tier, @vao_score, @mtm_score, @ma_trend, @foreign_sentiment, @notes)
    `);
    return stmt.run(data);
  },

  // ─── alert_log ───────────────────────────────────
  /**
   * 記錄通知紀錄
   * @param {Object} data - { alert_type, symbol?, message, success? }
   * @returns {Object}
   */
  saveAlertLog(data) {
    const stmt = getDb().prepare(`
      INSERT INTO alert_log (alert_type, symbol, message, success)
      VALUES (@alert_type, @symbol, @message, @success)
    `);
    return stmt.run({
      alert_type: data.alert_type,
      symbol: data.symbol ?? null,
      message: data.message,
      success: data.success ?? 1
    });
  },

  // ─── positions ───────────────────────────────────
  /**
   * 取得所有持倉
   * @returns {Array<Object>}
   */
  getPositions() {
    return getDb().prepare('SELECT * FROM positions').all();
  },

  /**
   * 關閉資料庫連線
   */
  close() {
    if (db) {
      db.close();
      db = null;
    }
  }
};

module.exports = DB;
