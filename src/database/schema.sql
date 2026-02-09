-- ============================================================
-- Stock Trading System 2026 - SQLite Schema
-- Version: 1.0.0
-- STORY-004: SQLite Schema 完善
-- Reference: docs/architecture-stock-2026.md §Data Model
-- ============================================================

-- 每日收盤價與成交量歷史
CREATE TABLE IF NOT EXISTS daily_prices (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume INTEGER,
    turnover INTEGER,
    transactions INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(symbol, date)
);

-- 三大法人買賣超與資券餘額
CREATE TABLE IF NOT EXISTS institutional_trades (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    foreign_net INTEGER DEFAULT 0,
    trust_net INTEGER DEFAULT 0,
    dealer_net INTEGER DEFAULT 0,
    margin_balance INTEGER DEFAULT 0,
    short_balance INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(symbol, date)
);

-- 計算後的技術指標 (VAO, MTM, MA)
CREATE TABLE IF NOT EXISTS indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    indicator_type TEXT NOT NULL,  -- 'VAO', 'MTM', 'MA5', 'MA10', 'MA20', 'MA60'
    value REAL,
    signal TEXT,                   -- 'STRONG', 'MODERATE', 'WEAK', 'STRONG_BUY', 'BUY', 'HOLD'
    metadata TEXT,                 -- JSON string for extra details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, indicator_type)
);

-- 選股訊號紀錄表
CREATE TABLE IF NOT EXISTS screener_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    signal_date TEXT NOT NULL,
    technical_score REAL,
    institutional_score REAL,
    volume_score REAL,
    total_score REAL,
    tier TEXT,                     -- 'TIER1', 'TIER2', 'TIER3'
    vao_score REAL,
    mtm_score REAL,
    ma_trend TEXT,
    foreign_sentiment TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, signal_date)
);

-- 選股歷史績效追蹤
CREATE TABLE IF NOT EXISTS screener_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    signal_date TEXT NOT NULL,
    entry_price REAL,
    current_price REAL,
    return_pct REAL,
    max_return_pct REAL,
    max_drawdown_pct REAL,
    holding_days INTEGER,
    exit_signal TEXT,
    exited INTEGER DEFAULT 0,
    exit_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 目前持股、成本與停損設定
CREATE TABLE IF NOT EXISTS positions (
    symbol TEXT PRIMARY KEY,
    name TEXT,
    buy_price REAL,
    quantity INTEGER,
    buy_date TEXT,
    stop_loss_price REAL,
    take_profit_price REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 已實現交易紀錄
CREATE TABLE IF NOT EXISTS trades_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,          -- 'BUY', 'SELL'
    price REAL,
    quantity INTEGER,
    fee REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    trade_date TEXT,
    reason TEXT,
    pnl REAL,
    pnl_pct REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Telegram 通知紀錄
CREATE TABLE IF NOT EXISTS alert_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL,      -- 'DAILY_REPORT', 'STOP_LOSS', 'SIGNAL', 'VOLUME_SPIKE'
    symbol TEXT,
    message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 1
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daily_prices_symbol ON daily_prices(symbol);
CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON daily_prices(date);
CREATE INDEX IF NOT EXISTS idx_institutional_trades_symbol ON institutional_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_indicators_symbol_date ON indicators(symbol, date);
CREATE INDEX IF NOT EXISTS idx_indicators_type ON indicators(indicator_type);
CREATE INDEX IF NOT EXISTS idx_screener_signals_date ON screener_signals(signal_date);
CREATE INDEX IF NOT EXISTS idx_screener_signals_tier ON screener_signals(tier);
CREATE INDEX IF NOT EXISTS idx_alert_log_type ON alert_log(alert_type);
