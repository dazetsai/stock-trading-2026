const Database = require('better-sqlite3');
const path = require('path');

// 初始化資料庫連線
const dbPath = path.resolve(__dirname, '../stock_data.db');
const db = new Database(dbPath);

/**
 * 建立資料表
 */
function initDb() {
    // 每日股價表
    db.prepare(`
        CREATE TABLE IF NOT EXISTS daily_prices (
            symbol TEXT,
            date TEXT,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume INTEGER,
            turnover INTEGER,
            transactions INTEGER,
            PRIMARY KEY(symbol, date)
        )
    `).run();

    // 籌碼與資券資料表
    db.prepare(`
        CREATE TABLE IF NOT EXISTS institutional_trades (
            symbol TEXT,
            date TEXT,
            foreign_net INTEGER,
            trust_net INTEGER,
            dealer_net INTEGER,
            margin_balance INTEGER,
            short_balance INTEGER,
            PRIMARY KEY(symbol, date)
        )
    `).run();

    // 持股倉位表
    db.prepare(`
        CREATE TABLE IF NOT EXISTS positions (
            symbol TEXT PRIMARY KEY,
            buy_price REAL,
            quantity INTEGER,
            stop_loss_price REAL
        )
    `).run();

    console.log('✅ SQLite 資料庫與資料表初始化完成');
}

/**
 * 資料庫操作介面
 */
const DB = {
    init: initDb,

    /**
     * 儲存日成交資料
     */
    saveDailyPrice: (data) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO daily_prices (
                symbol, date, open, high, low, close, volume, turnover, transactions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            data.symbol,
            data.date,
            data.open,
            data.high,
            data.low,
            data.close,
            data.volume,
            data.turnover,
            data.transactions
        );
    },

    /**
     * 儲存籌碼與資券資料
     */
    saveInstitutionalTrade: (data) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO institutional_trades (
                symbol, date, foreign_net, trust_net, dealer_net, margin_balance, short_balance
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            data.symbol,
            data.date,
            data.foreign_net || 0,
            data.trust_net || 0,
            data.dealer_net || 0,
            data.margin_balance || 0,
            data.short_balance || 0
        );
    },

    /**
     * 查詢特定股票的歷史價格
     */
    getHistory: (symbol, limit = 30) => {
        return db.prepare('SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?')
            .all(symbol, limit);
    }
};

// 自動初始化
initDb();

module.exports = DB;
