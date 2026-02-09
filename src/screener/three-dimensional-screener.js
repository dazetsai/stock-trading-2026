/**
 * @fileoverview 三維選股引擎 - 整合技術面、籌碼面、基本面三維度評分
 * @module screener/three-dimensional-screener
 * @version 1.0.0
 * @see docs/screener-design-stock-2026.md
 *
 * @example
 * const { ThreeDimensionalScreener } = require('./screener/three-dimensional-screener');
 * const screener = new ThreeDimensionalScreener(db);
 * const results = await screener.run('2026-02-08');
 * // => { tier1: [...], tier2: [...], tier3: [...], summary: { ... } }
 */

const { calculateVAO } = require('../indicators/vao');
const { calculateMTM, calculateMASystem } = require('../indicators/momentum');

// ─── 常數定義 ─────────────────────────────────────
const WEIGHTS = {
  TECHNICAL: 0.40,
  INSTITUTIONAL: 0.30,
  FUNDAMENTAL: 0.30
};

const TIER_THRESHOLDS = {
  TIER1: 75,  // 強勢關注
  TIER2: 60,  // 穩健選擇
  TIER3: 45   // 觀察清單
};

const TIER1_MIN_DIMENSION = 60;
const TIER2_MIN_DIMENSION = 50;

const FILTER_DEFAULTS = {
  minAvgVolume: 1000,
  minPrice: 10,
  topN: 20
};

const RECOMMENDATION = {
  BUY: '買入',
  WATCH: '觀察',
  AVOID: '迴避'
};

// ─── 技術面評分器 ─────────────────────────────────
/**
 * 計算技術面綜合得分
 * @description 整合 VAO、MTM、MA 三項技術指標，產出 0-100 分
 * @param {Array<Object>} priceData - 歷史價格 (最新在前，至少 60 筆)
 * @param {Object} [options={}]
 * @param {number} [options.totalShares] - 總發行股數
 * @returns {Object} 技術面評分結果
 * @returns {number} return.score - 技術面得分 (0-100)
 * @returns {Object} return.vao - VAO 指標結果
 * @returns {Object} return.mtm - MTM 指標結果
 * @returns {Object} return.ma - 均線系統結果
 * @returns {Object} return.entrySignal - 買點訊號
 */
function scoreTechnical(priceData, options = {}) {
  if (!Array.isArray(priceData) || priceData.length < 60) {
    return { score: 0, error: '資料不足 (需 60 筆以上)' };
  }

  try {
    const vao = calculateVAO(priceData, { totalShares: options.totalShares });
    const mtm = calculateMTM(priceData, { period: 10, maPeriod: 5 });
    const ma = calculateMASystem(priceData);

    // VAO 佔技術面 35%
    const vaoContrib = (vao.score / 100) * 35;

    // MTM 佔技術面 30%
    const mtmContrib = (mtm.signalStrength / 100) * 30;

    // MA 均線系統佔技術面 35%
    let maScore = 0;
    if (ma.alignment === 'BULLISH') maScore += 50;
    else if (ma.alignment === 'MIXED') maScore += 25;
    if (ma.aboveMA20) maScore += 30;
    // 價格在 MA20 ±3% 範圍內 (好的買點位置)
    const deviation = Math.abs(ma.ma20.deviation);
    if (deviation <= 3) maScore += 20;
    const maContrib = (maScore / 100) * 35;

    const score = Math.round(vaoContrib + mtmContrib + maContrib);

    // 買點訊號判定
    const entrySignal = _evaluateEntrySignal(priceData, vao, mtm, ma);

    return {
      score: Math.min(100, Math.max(0, score)),
      vao,
      mtm,
      ma,
      entrySignal
    };
  } catch (err) {
    return { score: 0, error: `技術面計算失敗: ${err.message}` };
  }
}

/**
 * 評估買點訊號
 * @private
 * @param {Array<Object>} data - 價格資料
 * @param {Object} vao - VAO 結果
 * @param {Object} mtm - MTM 結果
 * @param {Object} ma - MA 結果
 * @returns {Object} 買點訊號
 */
function _evaluateEntrySignal(data, vao, mtm, ma) {
  const today = data[0];
  const yesterday = data[1];
  const avgVolume5 = data.slice(0, 5).reduce((s, d) => s + d.volume, 0) / 5;

  // 條件 A: 價格突破前高 + 量能 > 5日均量 1.2倍
  const recentHigh = Math.max(...data.slice(1, 21).map(d => d.high || d.close));
  const condA = today.close > recentHigh && today.volume > avgVolume5 * 1.2;

  // 條件 B: 站上 MA10 + MTM > 0 且加速
  const condB = ma.ma10 && today.close > ma.ma10.value &&
    mtm.mtm > 0 && mtm.direction === 'ACCELERATING';

  // 條件 C: 回檔至 MA20 附近 + 止跌 K 線
  const nearMA20 = ma.ma20 && Math.abs((today.close - ma.ma20.value) / ma.ma20.value) < 0.03;
  const stopDecline = today.close > today.open && yesterday.close < yesterday.open;
  const condC = nearMA20 && stopDecline;

  const triggered = (condA && condB) || (condB && condC);

  return {
    triggered,
    conditions: { A: condA, B: condB, C: condC },
    type: triggered ? (condA ? 'BREAKOUT' : 'PULLBACK_BOUNCE') : 'NONE'
  };
}

// ─── 籌碼面評分器 ─────────────────────────────────
/**
 * 計算籌碼面綜合得分
 * @description 分析法人買賣超、融資券變化，產出 0-100 分
 * @param {Array<Object>} institutionalData - 籌碼資料 (最新在前)
 *   每筆含 { foreign_net, trust_net, dealer_net, margin_balance, short_balance }
 * @returns {Object} 籌碼面評分結果
 * @returns {number} return.score - 籌碼面得分 (0-100)
 * @returns {Object} return.details - 各子項得分
 */
function scoreInstitutional(institutionalData) {
  if (!Array.isArray(institutionalData) || institutionalData.length < 3) {
    return { score: 0, error: '籌碼資料不足 (需 3 筆以上)' };
  }

  try {
    // ── 外資連續性 (權重 40%) ──
    let foreignScore = 0;
    const foreignConsecutiveBuy = _countConsecutive(institutionalData, d => d.foreign_net > 0);
    const foreign5DaySum = institutionalData.slice(0, 5).reduce((s, d) => s + (d.foreign_net || 0), 0);
    if (foreignConsecutiveBuy >= 3) foreignScore += 50;
    else if (foreignConsecutiveBuy >= 2) foreignScore += 30;
    if (foreign5DaySum > 1000) foreignScore += 30;
    else if (foreign5DaySum > 500) foreignScore += 15;
    if (institutionalData[0].foreign_net > 0) foreignScore += 20;
    foreignScore = Math.min(100, foreignScore);

    // ── 投信布局 (權重 35%) ──
    let trustScore = 0;
    const trustConsecutiveBuy = _countConsecutive(institutionalData, d => d.trust_net > 0);
    if (trustConsecutiveBuy >= 3) trustScore += 50;
    else if (trustConsecutiveBuy >= 2) trustScore += 30;
    if (institutionalData[0].trust_net > 500) trustScore += 30;
    else if (institutionalData[0].trust_net > 100) trustScore += 15;
    if (institutionalData[0].trust_net > 0) trustScore += 20;
    trustScore = Math.min(100, trustScore);

    // ── 自營動向 (權重 15%) ──
    let dealerScore = 0;
    if (institutionalData[0].dealer_net > 0) dealerScore += 50;
    if (institutionalData[0].dealer_net > 500) dealerScore += 30;
    const dealerConsecutive = _countConsecutive(institutionalData, d => d.dealer_net > 0);
    if (dealerConsecutive >= 2) dealerScore += 20;
    dealerScore = Math.min(100, dealerScore);

    // ── 資券健康度 (權重 10%) ──
    let marginScore = 50; // 中性起始
    const latest = institutionalData[0];
    const prev = institutionalData[1];
    if (prev && latest.margin_balance < prev.margin_balance) marginScore += 25; // 融資減少=好
    if (prev && latest.margin_balance > prev.margin_balance) marginScore -= 15; // 融資增加=差
    if (latest.short_balance > 0 && latest.margin_balance > 0) {
      const marginRatio = latest.short_balance / latest.margin_balance;
      if (marginRatio < 0.2) marginScore += 25; // 券資比低=好
    }
    marginScore = Math.min(100, Math.max(0, marginScore));

    // 加權總分
    const score = Math.round(
      foreignScore * 0.40 +
      trustScore * 0.35 +
      dealerScore * 0.15 +
      marginScore * 0.10
    );

    // 籌碼情緒
    let sentiment;
    if (score >= 80) sentiment = '🔥 強勢';
    else if (score >= 60) sentiment = '✅ 健康';
    else if (score >= 40) sentiment = '⚠️ 觀察';
    else sentiment = '❌ 迴避';

    return {
      score: Math.min(100, Math.max(0, score)),
      sentiment,
      details: {
        foreignScore,
        trustScore,
        dealerScore,
        marginScore,
        foreignConsecutiveBuy,
        foreign5DaySum
      }
    };
  } catch (err) {
    return { score: 0, error: `籌碼面計算失敗: ${err.message}` };
  }
}

/**
 * 計算連續滿足條件的天數
 * @private
 */
function _countConsecutive(data, predicate) {
  let count = 0;
  for (const item of data) {
    if (predicate(item)) count++;
    else break;
  }
  return count;
}

// ─── 基本面評分器 ─────────────────────────────────
/**
 * 計算基本面綜合得分
 * @description 分析營收成長與 EPS，產出 0-100 分
 * @param {Object} fundamentalData - 基本面資料
 * @param {number} [fundamentalData.revenueGrowthMoM] - 月營收月增率 (%)
 * @param {number} [fundamentalData.revenueGrowthYoY] - 月營收年增率 (%)
 * @param {number} [fundamentalData.eps] - 最近一季 EPS
 * @param {number} [fundamentalData.epsPrevYear] - 去年同期 EPS
 * @param {number} [fundamentalData.peRatio] - 本益比
 * @returns {Object} 基本面評分結果
 * @returns {number} return.score - 基本面得分 (0-100)
 */
function scoreFundamental(fundamentalData) {
  if (!fundamentalData) {
    return { score: 50, details: { note: '無基本面資料，給予中性分數' } };
  }

  try {
    let score = 0;
    const details = {};

    // ── 營收年增率 (權重 40%) ──
    const yoy = fundamentalData.revenueGrowthYoY;
    if (yoy !== undefined && yoy !== null) {
      let revenueScore = 50; // 中性
      if (yoy > 30) revenueScore = 100;
      else if (yoy > 15) revenueScore = 80;
      else if (yoy > 5) revenueScore = 65;
      else if (yoy > 0) revenueScore = 55;
      else if (yoy > -10) revenueScore = 35;
      else revenueScore = 15;
      score += revenueScore * 0.40;
      details.revenueScore = revenueScore;
    } else {
      score += 50 * 0.40;
      details.revenueScore = 50;
    }

    // ── 營收月增率 (權重 15%) ──
    const mom = fundamentalData.revenueGrowthMoM;
    if (mom !== undefined && mom !== null) {
      let momScore = 50;
      if (mom > 20) momScore = 90;
      else if (mom > 10) momScore = 75;
      else if (mom > 0) momScore = 60;
      else if (mom > -10) momScore = 40;
      else momScore = 20;
      score += momScore * 0.15;
      details.momScore = momScore;
    } else {
      score += 50 * 0.15;
      details.momScore = 50;
    }

    // ── EPS 成長 (權重 30%) ──
    const eps = fundamentalData.eps;
    const epsPrev = fundamentalData.epsPrevYear;
    if (eps !== undefined && epsPrev !== undefined && epsPrev > 0) {
      const epsGrowth = ((eps - epsPrev) / epsPrev) * 100;
      let epsScore = 50;
      if (epsGrowth > 30) epsScore = 100;
      else if (epsGrowth > 15) epsScore = 80;
      else if (epsGrowth > 0) epsScore = 65;
      else if (epsGrowth > -15) epsScore = 35;
      else epsScore = 15;
      score += epsScore * 0.30;
      details.epsScore = epsScore;
      details.epsGrowth = Math.round(epsGrowth * 100) / 100;
    } else {
      score += 50 * 0.30;
      details.epsScore = 50;
    }

    // ── 本益比合理性 (權重 15%) ──
    const pe = fundamentalData.peRatio;
    if (pe !== undefined && pe !== null && pe > 0) {
      let peScore = 50;
      if (pe < 10) peScore = 85;
      else if (pe < 15) peScore = 75;
      else if (pe < 20) peScore = 60;
      else if (pe < 30) peScore = 45;
      else peScore = 25;
      score += peScore * 0.15;
      details.peScore = peScore;
    } else {
      score += 50 * 0.15;
      details.peScore = 50;
    }

    return {
      score: Math.round(Math.min(100, Math.max(0, score))),
      details
    };
  } catch (err) {
    return { score: 50, error: `基本面計算失敗: ${err.message}` };
  }
}

// ─── 綜合評分器 ───────────────────────────────────
/**
 * 計算三維綜合評分
 * @param {number} technicalScore - 技術面得分 (0-100)
 * @param {number} institutionalScore - 籌碼面得分 (0-100)
 * @param {number} fundamentalScore - 基本面得分 (0-100)
 * @returns {Object} 綜合評分結果
 * @returns {number} return.totalScore - 總分 (0-100)
 * @returns {string} return.tier - 分級 ('TIER1'|'TIER2'|'TIER3'|'EXCLUDED')
 * @returns {string} return.recommendation - 建議 ('買入'|'觀察'|'迴避')
 */
function calculateCompositeScore(technicalScore, institutionalScore, fundamentalScore) {
  const totalScore = Math.round(
    technicalScore * WEIGHTS.TECHNICAL +
    institutionalScore * WEIGHTS.INSTITUTIONAL +
    fundamentalScore * WEIGHTS.FUNDAMENTAL
  );

  const minDimension = Math.min(technicalScore, institutionalScore, fundamentalScore);

  let tier;
  let recommendation;

  if (totalScore >= TIER_THRESHOLDS.TIER1 && minDimension >= TIER1_MIN_DIMENSION) {
    tier = 'TIER1';
    recommendation = RECOMMENDATION.BUY;
  } else if (totalScore >= TIER_THRESHOLDS.TIER2 && minDimension >= TIER2_MIN_DIMENSION) {
    tier = 'TIER2';
    recommendation = RECOMMENDATION.WATCH;
  } else if (totalScore >= TIER_THRESHOLDS.TIER3) {
    tier = 'TIER3';
    recommendation = RECOMMENDATION.WATCH;
  } else {
    tier = 'EXCLUDED';
    recommendation = RECOMMENDATION.AVOID;
  }

  return {
    totalScore: Math.min(100, Math.max(0, totalScore)),
    tier,
    recommendation,
    weights: { ...WEIGHTS },
    dimensions: {
      technical: technicalScore,
      institutional: institutionalScore,
      fundamental: fundamentalScore
    }
  };
}

// ─── 主引擎類別 ───────────────────────────────────
/**
 * 三維選股引擎
 * @description 整合技術面、籌碼面、基本面，每日產出 Top 20 選股名單
 * @class
 */
class ThreeDimensionalScreener {
  /**
   * @param {Object} db - 資料庫實例 (better-sqlite3 相容介面)
   * @param {Object} [config={}] - 設定
   * @param {number} [config.minAvgVolume=1000] - 最低日均量 (張)
   * @param {number} [config.minPrice=10] - 最低股價
   * @param {number} [config.topN=20] - 輸出名單數量
   */
  constructor(db, config = {}) {
    this.db = db;
    this.config = { ...FILTER_DEFAULTS, ...config };
  }

  /**
   * 執行三維選股
   * @async
   * @param {string} [date] - 目標日期 (YYYY-MM-DD)，預設最新交易日
   * @returns {Promise<Object>} 選股結果
   * @returns {Array} return.tier1 - 強勢關注名單
   * @returns {Array} return.tier2 - 穩健選擇名單
   * @returns {Array} return.tier3 - 觀察清單
   * @returns {Object} return.summary - 市場摘要
   */
  async run(date = null) {
    const targetDate = date || this._getLatestTradingDay();
    console.log(`[${new Date().toISOString()}] [INFO] [Screener] 開始三維選股: ${targetDate}`);

    try {
      // Step 1: 載入全市場股票清單
      const allSymbols = this._loadAllSymbols(targetDate);
      console.log(`[${new Date().toISOString()}] [INFO] [Screener] 全市場: ${allSymbols.length} 檔`);

      // Step 2: 流動性篩選
      const filtered = this._applyFilters(allSymbols, targetDate);
      console.log(`[${new Date().toISOString()}] [INFO] [Screener] 通過篩選: ${filtered.length} 檔`);

      // Step 3: 三維分析
      const analyzed = [];
      for (const symbol of filtered) {
        try {
          const result = this._analyzeStock(symbol, targetDate);
          if (result) analyzed.push(result);
        } catch (err) {
          console.warn(`⚠️ 分析 ${symbol} 失敗: ${err.message}`);
        }
      }

      // Step 4: 排序 (總分由高到低)
      analyzed.sort((a, b) => b.composite.totalScore - a.composite.totalScore);

      // Step 5: 分級
      const tier1 = analyzed.filter(s => s.composite.tier === 'TIER1').slice(0, 10);
      const tier2 = analyzed.filter(s => s.composite.tier === 'TIER2').slice(0, 20);
      const tier3 = analyzed.filter(s => s.composite.tier === 'TIER3').slice(0, 20);
      const topN = analyzed.slice(0, this.config.topN);

      // Step 6: 儲存訊號
      this._saveSignals(topN, targetDate);

      const results = {
        date: targetDate,
        tier1,
        tier2,
        tier3,
        topN,
        summary: {
          totalMarket: allSymbols.length,
          afterFilter: filtered.length,
          analyzed: analyzed.length,
          tier1Count: tier1.length,
          tier2Count: tier2.length,
          tier3Count: tier3.length
        }
      };

      console.log(`[${new Date().toISOString()}] [INFO] [Screener] 完成: Tier1=${tier1.length}, Tier2=${tier2.length}, Tier3=${tier3.length}`);
      return results;
    } catch (err) {
      const enrichedError = new Error(
        `[ThreeDimensionalScreener.run] 選股失敗: ${err.message}\n` +
        `參數: date=${targetDate}\n` +
        `建議: 確認資料庫中有足夠的歷史資料`
      );
      enrichedError.originalError = err;
      enrichedError.code = 'SCREENER_RUN_FAILED';
      console.error(enrichedError.message);
      throw enrichedError;
    }
  }

  /**
   * 分析單一股票的三維評分
   * @param {string} symbol - 股票代碼
   * @param {string} date - 目標日期
   * @returns {Object|null} 分析結果
   */
  _analyzeStock(symbol, date) {
    // 取得歷史價格 (至少 60 筆)
    const priceData = this._getPriceHistory(symbol, 80);
    if (!priceData || priceData.length < 60) return null;

    // 取得籌碼資料
    const institutionalData = this._getInstitutionalHistory(symbol, 20);

    // 取得基本面資料
    const fundamentalData = this._getFundamentalData(symbol);

    // 三維評分
    const technical = scoreTechnical(priceData);
    const institutional = scoreInstitutional(institutionalData);
    const fundamental = scoreFundamental(fundamentalData);

    // 綜合評分
    const composite = calculateCompositeScore(
      technical.score,
      institutional.score,
      fundamental.score
    );

    return {
      symbol,
      date,
      latestPrice: priceData[0].close,
      technical,
      institutional,
      fundamental,
      composite
    };
  }

  /**
   * 載入所有股票代碼
   * @private
   */
  _loadAllSymbols(date) {
    try {
      const rows = this.db.prepare(
        'SELECT DISTINCT symbol FROM daily_prices WHERE date <= ? ORDER BY symbol'
      ).all(date);
      return rows.map(r => r.symbol);
    } catch (err) {
      console.error(`[Screener] 載入股票清單失敗: ${err.message}`);
      return [];
    }
  }

  /**
   * 流動性與價格篩選
   * @private
   */
  _applyFilters(symbols, date) {
    const result = [];
    for (const symbol of symbols) {
      // 排除 ETN/權證 (代碼長度 != 4)
      if (symbol.length !== 4) continue;

      try {
        const recent = this.db.prepare(
          'SELECT close, volume FROM daily_prices WHERE symbol = ? AND date <= ? ORDER BY date DESC LIMIT 5'
        ).all(symbol, date);

        if (recent.length < 5) continue;

        const avgVolume = recent.reduce((s, r) => s + r.volume, 0) / recent.length;
        const latestPrice = recent[0].close;

        if (avgVolume >= this.config.minAvgVolume && latestPrice >= this.config.minPrice) {
          result.push(symbol);
        }
      } catch {
        // 跳過查詢失敗的股票
      }
    }
    return result;
  }

  /**
   * 取得歷史價格
   * @private
   */
  _getPriceHistory(symbol, limit = 80) {
    try {
      return this.db.prepare(
        'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?'
      ).all(symbol, limit);
    } catch {
      return [];
    }
  }

  /**
   * 取得籌碼歷史
   * @private
   */
  _getInstitutionalHistory(symbol, limit = 20) {
    try {
      return this.db.prepare(
        'SELECT * FROM institutional_trades WHERE symbol = ? ORDER BY date DESC LIMIT ?'
      ).all(symbol, limit);
    } catch {
      return [];
    }
  }

  /**
   * 取得基本面資料
   * @private
   * @param {string} symbol
   * @returns {Object|null}
   */
  _getFundamentalData(symbol) {
    try {
      // 嘗試從 fundamentals 表讀取，若不存在則回傳 null
      const row = this.db.prepare(
        'SELECT * FROM fundamentals WHERE symbol = ? ORDER BY date DESC LIMIT 1'
      ).get(symbol);
      return row || null;
    } catch {
      // fundamentals 表可能不存在
      return null;
    }
  }

  /**
   * 取得最新交易日
   * @private
   */
  _getLatestTradingDay() {
    try {
      const row = this.db.prepare(
        'SELECT MAX(date) as latest FROM daily_prices'
      ).get();
      return row ? row.latest : new Date().toISOString().slice(0, 10);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  /**
   * 儲存選股訊號到資料庫
   * @private
   */
  _saveSignals(results, date) {
    try {
      // 建立 screener_signals 表 (若不存在)
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS screener_signals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          date TEXT NOT NULL,
          signal_date TEXT NOT NULL,
          technical_score REAL,
          institutional_score REAL,
          fundamental_score REAL,
          total_score REAL,
          tier TEXT,
          vao_score REAL,
          mtm_score REAL,
          ma_trend TEXT,
          foreign_sentiment TEXT,
          recommendation TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO screener_signals (
          symbol, date, signal_date, technical_score, institutional_score,
          fundamental_score, total_score, tier, vao_score, mtm_score,
          ma_trend, foreign_sentiment, recommendation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((items) => {
        for (const item of items) {
          stmt.run(
            item.symbol,
            date,
            date,
            item.technical.score,
            item.institutional.score,
            item.fundamental.score,
            item.composite.totalScore,
            item.composite.tier,
            item.technical.vao ? item.technical.vao.score : null,
            item.technical.mtm ? item.technical.mtm.signalStrength : null,
            item.technical.ma ? item.technical.ma.alignment : null,
            item.institutional.sentiment || null,
            item.composite.recommendation
          );
        }
      });

      insertMany(results);
      console.log(`[${new Date().toISOString()}] [INFO] [Screener] 已儲存 ${results.length} 筆訊號`);
    } catch (err) {
      console.error(`[Screener] 儲存訊號失敗: ${err.message}`);
    }
  }

  /**
   * 產生 Telegram 格式報表
   * @param {Object} results - run() 的回傳結果
   * @returns {string} Telegram 格式文字
   */
  formatTelegramReport(results) {
    const lines = [];
    lines.push(`🔥 【${results.date} 選股快報】\n`);
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('📊 市場概況');
    lines.push(`• 全市場: ${results.summary.totalMarket} 檔`);
    lines.push(`• 符合篩選: ${results.summary.afterFilter} 檔`);
    lines.push(`• 強勢關注: ${results.summary.tier1Count} 檔\n`);

    if (results.tier1.length > 0) {
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('🔥 Tier 1 - 強勢關注\n');
      results.tier1.forEach((s, i) => {
        lines.push(`${i + 1}️⃣ ${s.symbol}`);
        lines.push(`   總分: ${s.composite.totalScore}/100`);
        lines.push(`   📈 技術: ${s.technical.score} | 🏦 籌碼: ${s.institutional.score} | 📊 基本: ${s.fundamental.score}`);
        lines.push(`   💰 收盤: ${s.latestPrice}`);
        lines.push(`   ➤ 建議: ${s.composite.recommendation}\n`);
      });
    }

    if (results.tier2.length > 0) {
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push('✅ Tier 2 - 穩健選擇\n');
      results.tier2.slice(0, 5).forEach(s => {
        lines.push(`• ${s.symbol} | 總分: ${s.composite.totalScore} | ${s.composite.recommendation}`);
      });
      lines.push('');
    }

    lines.push('📌 風險提示: 以上為系統篩選結果，僅供參考，投資需自行判斷。');
    return lines.join('\n');
  }
}

module.exports = {
  ThreeDimensionalScreener,
  scoreTechnical,
  scoreInstitutional,
  scoreFundamental,
  calculateCompositeScore,
  WEIGHTS,
  TIER_THRESHOLDS
};
