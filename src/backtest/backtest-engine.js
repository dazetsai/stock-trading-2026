/**
 * @fileoverview 回測引擎 - 支援歷史資料策略回測與績效報告
 * @module backtest/backtest-engine
 * @version 1.0.0
 * @see docs/prd-stock-2026.md §FR-007
 *
 * @example
 * const { BacktestEngine } = require('./backtest/backtest-engine');
 * const engine = new BacktestEngine(db);
 * const report = await engine.run({
 *   symbol: '2330',
 *   startDate: '2025-01-01',
 *   endDate: '2025-12-31',
 *   strategy: { entryCondition: 'MA_CROSS', stopLoss: 0.07, takeProfit: 0.15 }
 * });
 */

// ─── 常數定義 ─────────────────────────────────────
const DEFAULT_CONFIG = {
  initialCapital: 1000000,
  positionSize: 1.0,        // 每次投入比例 (1.0 = 全押)
  commission: 0.001425,     // 手續費率 (買賣各 0.1425%)
  tax: 0.003,               // 交易稅 (賣出 0.3%)
  slippage: 0.001,          // 滑價估計 0.1%
  riskFreeRate: 0.02        // 無風險利率 (年化 2%)
};

const STRATEGY_TYPES = {
  MA_CROSS: 'MA_CROSS',
  VAO_BREAKOUT: 'VAO_BREAKOUT',
  THREE_DIMENSIONAL: 'THREE_DIMENSIONAL',
  CUSTOM: 'CUSTOM'
};

// ─── 交易紀錄類別 ─────────────────────────────────
/**
 * 單筆交易紀錄
 * @typedef {Object} Trade
 * @property {string} symbol - 股票代碼
 * @property {string} entryDate - 進場日期
 * @property {number} entryPrice - 進場價格
 * @property {string} [exitDate] - 出場日期
 * @property {number} [exitPrice] - 出場價格
 * @property {number} shares - 股數
 * @property {number} [pnl] - 損益
 * @property {number} [returnPct] - 報酬率 (%)
 * @property {string} [exitReason] - 出場原因
 */

// ─── 策略基礎類別 ─────────────────────────────────
/**
 * 策略介面
 * @description 所有策略須實作 shouldEntry / shouldExit 方法
 */
class BaseStrategy {
  /**
   * @param {Object} params - 策略參數
   * @param {number} [params.stopLoss=0.07] - 停損比例
   * @param {number} [params.takeProfit=0.15] - 停利比例
   * @param {number} [params.trailingStop=0.03] - 移動停利回檔比例
   * @param {number} [params.trailingActivation=0.10] - 移動停利啟動門檻
   */
  constructor(params = {}) {
    this.stopLoss = params.stopLoss !== undefined ? params.stopLoss : 0.07;
    this.takeProfit = params.takeProfit !== undefined ? params.takeProfit : 0.15;
    this.trailingStop = params.trailingStop !== undefined ? params.trailingStop : 0.03;
    this.trailingActivation = params.trailingActivation !== undefined ? params.trailingActivation : 0.10;
  }

  /**
   * 判斷是否進場
   * @param {Array<Object>} priceHistory - 歷史價格 (最新在前)
   * @param {number} index - 目前索引
   * @returns {boolean}
   */
  shouldEntry(priceHistory, index) {
    throw new Error('子類別必須實作 shouldEntry()');
  }

  /**
   * 判斷是否出場
   * @param {Object} position - 目前持倉
   * @param {Object} currentBar - 當前 K 線
   * @param {number} highestSinceEntry - 進場後最高價
   * @returns {{ exit: boolean, reason: string }}
   */
  shouldExit(position, currentBar, highestSinceEntry) {
    const currentReturn = (currentBar.close - position.entryPrice) / position.entryPrice;

    // 固定停損
    if (currentReturn <= -this.stopLoss) {
      return { exit: true, reason: `停損 (${(currentReturn * 100).toFixed(1)}%)` };
    }

    // 固定停利
    if (currentReturn >= this.takeProfit) {
      return { exit: true, reason: `停利 (${(currentReturn * 100).toFixed(1)}%)` };
    }

    // 移動停利
    if (highestSinceEntry > 0) {
      const highReturn = (highestSinceEntry - position.entryPrice) / position.entryPrice;
      if (highReturn >= this.trailingActivation) {
        const drawdownFromHigh = (highestSinceEntry - currentBar.close) / highestSinceEntry;
        if (drawdownFromHigh >= this.trailingStop) {
          return { exit: true, reason: `移動停利 (高點回檔 ${(drawdownFromHigh * 100).toFixed(1)}%)` };
        }
      }
    }

    return { exit: false, reason: '' };
  }
}

/**
 * 均線交叉策略
 * @extends BaseStrategy
 */
class MACrossStrategy extends BaseStrategy {
  /**
   * @param {Object} params
   * @param {number} [params.shortPeriod=10] - 短均線
   * @param {number} [params.longPeriod=20] - 長均線
   */
  constructor(params = {}) {
    super(params);
    this.shortPeriod = params.shortPeriod || 10;
    this.longPeriod = params.longPeriod || 20;
  }

  shouldEntry(data, index) {
    if (index + this.longPeriod + 1 >= data.length) return false;

    const shortMA = _sma(data, index, this.shortPeriod);
    const longMA = _sma(data, index, this.longPeriod);
    const prevShortMA = _sma(data, index + 1, this.shortPeriod);
    const prevLongMA = _sma(data, index + 1, this.longPeriod);

    // 黃金交叉: 短均線由下往上穿越長均線
    return prevShortMA <= prevLongMA && shortMA > longMA;
  }
}

/**
 * VAO 爆量突破策略
 * @extends BaseStrategy
 */
class VAOBreakoutStrategy extends BaseStrategy {
  /**
   * @param {Object} params
   * @param {number} [params.volumeMultiple=1.5] - 量能倍數門檻
   * @param {number} [params.priceChangeMin=2] - 最低漲幅 (%)
   */
  constructor(params = {}) {
    super(params);
    this.volumeMultiple = params.volumeMultiple || 1.5;
    this.priceChangeMin = params.priceChangeMin || 2;
  }

  shouldEntry(data, index) {
    if (index + 20 >= data.length) return false;

    const today = data[index];
    const yesterday = data[index + 1];
    const avgVol5 = _avgVolume(data, index, 5);
    const priceChange = yesterday.close > 0
      ? ((today.close - yesterday.close) / yesterday.close) * 100
      : 0;

    return today.volume > avgVol5 * this.volumeMultiple && priceChange >= this.priceChangeMin;
  }
}

// ─── 工具函數 ─────────────────────────────────────
/**
 * 計算簡單移動平均
 * @private
 */
function _sma(data, startIndex, period) {
  let sum = 0;
  for (let i = startIndex; i < startIndex + period && i < data.length; i++) {
    sum += data[i].close;
  }
  return sum / period;
}

/**
 * 計算平均成交量
 * @private
 */
function _avgVolume(data, startIndex, period) {
  let sum = 0;
  for (let i = startIndex; i < startIndex + period && i < data.length; i++) {
    sum += data[i].volume;
  }
  return sum / period;
}

// ─── 績效計算 ─────────────────────────────────────
/**
 * 計算回測績效指標
 * @param {Array<Trade>} trades - 交易紀錄
 * @param {Array<number>} equityCurve - 權益曲線
 * @param {Object} config - 回測設定
 * @returns {Object} 績效報告
 */
function calculatePerformance(trades, equityCurve, config) {
  const completedTrades = trades.filter(t => t.exitDate);
  const totalTrades = completedTrades.length;

  if (totalTrades === 0) {
    return {
      totalReturn: 0,
      totalReturnPct: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      winRate: 0,
      sharpeRatio: 0,
      totalTrades: 0,
      winCount: 0,
      loseCount: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      monthlyReturns: [],
      equityCurve
    };
  }

  const wins = completedTrades.filter(t => t.pnl > 0);
  const losses = completedTrades.filter(t => t.pnl <= 0);
  const winRate = wins.length / totalTrades;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.returnPct, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.returnPct, 0) / losses.length) : 0;

  // 總報酬
  const finalEquity = equityCurve[equityCurve.length - 1] || config.initialCapital;
  const totalReturn = finalEquity - config.initialCapital;
  const totalReturnPct = (totalReturn / config.initialCapital) * 100;

  // 最大回撤 (MDD)
  const { maxDrawdown, maxDrawdownPct } = _calculateMaxDrawdown(equityCurve);

  // 夏普比率
  const sharpeRatio = _calculateSharpe(equityCurve, config.riskFreeRate);

  // 獲利因子
  const totalWin = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

  // 期望值
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  // 月度報酬
  const monthlyReturns = _calculateMonthlyReturns(trades, config.initialCapital);

  return {
    totalReturn: Math.round(totalReturn),
    totalReturnPct: Math.round(totalReturnPct * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown),
    maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
    winRate: Math.round(winRate * 10000) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    totalTrades,
    winCount: wins.length,
    loseCount: losses.length,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    monthlyReturns,
    equityCurve
  };
}

/**
 * 計算最大回撤
 * @private
 */
function _calculateMaxDrawdown(equityCurve) {
  if (!equityCurve || equityCurve.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPct: 0 };
  }

  let peak = equityCurve[0];
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  for (const equity of equityCurve) {
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = drawdownPct;
    }
  }

  return { maxDrawdown, maxDrawdownPct };
}

/**
 * 計算年化夏普比率
 * @private
 */
function _calculateSharpe(equityCurve, riskFreeRate = 0.02) {
  if (!equityCurve || equityCurve.length < 2) return 0;

  // 日報酬率
  const dailyReturns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i - 1] > 0) {
      dailyReturns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    }
  }

  if (dailyReturns.length === 0) return 0;

  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const dailyRiskFree = riskFreeRate / 252;
  const sharpe = ((avgReturn - dailyRiskFree) / stdDev) * Math.sqrt(252);
  return sharpe;
}

/**
 * 計算月度報酬
 * @private
 */
function _calculateMonthlyReturns(trades, initialCapital) {
  const monthlyMap = {};
  let runningCapital = initialCapital;

  for (const trade of trades) {
    if (!trade.exitDate || !trade.pnl) continue;
    const month = trade.exitDate.slice(0, 7); // YYYY-MM
    if (!monthlyMap[month]) {
      monthlyMap[month] = { month, pnl: 0, trades: 0 };
    }
    monthlyMap[month].pnl += trade.pnl;
    monthlyMap[month].trades++;
  }

  // 轉換為報酬率
  const result = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
  for (const m of result) {
    m.returnPct = Math.round((m.pnl / initialCapital) * 10000) / 100;
  }
  return result;
}

// ─── 回測引擎主類別 ───────────────────────────────
/**
 * 回測引擎
 * @description 支援歷史資料回測，可設定策略參數，輸出完整績效報告
 * @class
 */
class BacktestEngine {
  /**
   * @param {Object} db - 資料庫實例
   * @param {Object} [config={}] - 回測設定 (覆蓋 DEFAULT_CONFIG)
   */
  constructor(db, config = {}) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 執行回測
   * @async
   * @param {Object} params - 回測參數
   * @param {string} params.symbol - 股票代碼
   * @param {string} params.startDate - 開始日期 (YYYY-MM-DD)
   * @param {string} params.endDate - 結束日期 (YYYY-MM-DD)
   * @param {Object} params.strategy - 策略設定
   * @param {string} params.strategy.type - 策略類型 ('MA_CROSS'|'VAO_BREAKOUT'|'CUSTOM')
   * @param {Object} [params.strategy.params] - 策略參數
   * @returns {Promise<Object>} 回測報告
   * @throws {Error} 資料不足或參數錯誤
   */
  async run(params) {
    const { symbol, startDate, endDate, strategy: strategyConfig } = params;
    console.log(`[${new Date().toISOString()}] [INFO] [Backtest] 開始回測: ${symbol} ${startDate}~${endDate}`);

    try {
      // 1. 載入歷史資料
      const priceData = this._loadPriceData(symbol, startDate, endDate);
      if (priceData.length < 30) {
        throw new Error(`資料不足: ${symbol} 在 ${startDate}~${endDate} 僅有 ${priceData.length} 筆，至少需 30 筆`);
      }

      // 2. 建立策略
      const strategy = this._createStrategy(strategyConfig);

      // 3. 模擬交易
      const { trades, equityCurve } = this._simulate(priceData, strategy);

      // 4. 計算績效
      const performance = calculatePerformance(trades, equityCurve, this.config);

      // 5. 組裝報告
      const report = {
        symbol,
        startDate,
        endDate,
        strategyType: strategyConfig.type || 'CUSTOM',
        strategyParams: strategyConfig.params || {},
        config: this.config,
        tradingDays: priceData.length,
        performance,
        trades
      };

      console.log(`[${new Date().toISOString()}] [INFO] [Backtest] 完成: ${performance.totalTrades} 筆交易, 報酬 ${performance.totalReturnPct}%`);
      return report;
    } catch (err) {
      const enrichedError = new Error(
        `[BacktestEngine.run] 回測失敗: ${err.message}\n` +
        `參數: symbol=${symbol}, ${startDate}~${endDate}\n` +
        `建議: 確認資料庫中有該股票的歷史資料`
      );
      enrichedError.originalError = err;
      enrichedError.code = 'BACKTEST_RUN_FAILED';
      console.error(enrichedError.message);
      throw enrichedError;
    }
  }

  /**
   * 批量回測多檔股票
   * @async
   * @param {Array<string>} symbols - 股票代碼清單
   * @param {string} startDate
   * @param {string} endDate
   * @param {Object} strategyConfig
   * @returns {Promise<Array<Object>>} 多檔回測結果 (依報酬率排序)
   */
  async runBatch(symbols, startDate, endDate, strategyConfig) {
    const results = [];
    for (const symbol of symbols) {
      try {
        const report = await this.run({ symbol, startDate, endDate, strategy: strategyConfig });
        results.push(report);
      } catch (err) {
        console.warn(`⚠️ 回測 ${symbol} 失敗: ${err.message}`);
      }
    }
    return results.sort((a, b) => b.performance.totalReturnPct - a.performance.totalReturnPct);
  }

  /**
   * 載入歷史價格資料
   * @private
   */
  _loadPriceData(symbol, startDate, endDate) {
    try {
      return this.db.prepare(
        'SELECT * FROM daily_prices WHERE symbol = ? AND date >= ? AND date <= ? ORDER BY date ASC'
      ).all(symbol, startDate, endDate);
    } catch (err) {
      throw new Error(`載入 ${symbol} 資料失敗: ${err.message}`);
    }
  }

  /**
   * 建立策略實例
   * @private
   */
  _createStrategy(strategyConfig) {
    const { type, params = {} } = strategyConfig;

    switch (type) {
      case STRATEGY_TYPES.MA_CROSS:
        return new MACrossStrategy(params);
      case STRATEGY_TYPES.VAO_BREAKOUT:
        return new VAOBreakoutStrategy(params);
      default:
        return new MACrossStrategy(params); // 預設使用均線交叉
    }
  }

  /**
   * 模擬交易
   * @private
   * @param {Array<Object>} data - 歷史價格 (日期升序)
   * @param {BaseStrategy} strategy - 策略實例
   * @returns {{ trades: Array<Trade>, equityCurve: Array<number> }}
   */
  _simulate(data, strategy) {
    const trades = [];
    const equityCurve = [];
    let capital = this.config.initialCapital;
    let position = null;
    let highestSinceEntry = 0;

    // 將資料反轉 (供策略用，最新在前)
    const reversedData = [...data].reverse();

    for (let i = 0; i < data.length; i++) {
      const bar = data[i];
      const reversedIndex = data.length - 1 - i;

      if (position) {
        // 更新最高價
        if (bar.high) {
          highestSinceEntry = Math.max(highestSinceEntry, bar.high);
        } else {
          highestSinceEntry = Math.max(highestSinceEntry, bar.close);
        }

        // 檢查出場
        const exitResult = strategy.shouldExit(position, bar, highestSinceEntry);
        if (exitResult.exit) {
          const exitPrice = bar.close * (1 - this.config.slippage);
          const sellCommission = exitPrice * position.shares * this.config.commission;
          const sellTax = exitPrice * position.shares * this.config.tax;
          const proceeds = exitPrice * position.shares - sellCommission - sellTax;
          const pnl = proceeds - position.cost;
          const returnPct = (pnl / position.cost) * 100;

          trades.push({
            ...position,
            exitDate: bar.date,
            exitPrice: Math.round(exitPrice * 100) / 100,
            pnl: Math.round(pnl),
            returnPct: Math.round(returnPct * 100) / 100,
            exitReason: exitResult.reason,
            holdingDays: _daysBetween(position.entryDate, bar.date)
          });

          capital += proceeds;
          position = null;
          highestSinceEntry = 0;
        }
      } else {
        // 檢查進場
        if (strategy.shouldEntry(reversedData, reversedIndex)) {
          const entryPrice = bar.close * (1 + this.config.slippage);
          const investAmount = capital * this.config.positionSize;
          const shares = Math.floor(investAmount / (entryPrice * 1000)) * 1000; // 整張 (1000股)
          if (shares <= 0) continue;

          const buyCommission = entryPrice * shares * this.config.commission;
          const cost = entryPrice * shares + buyCommission;

          if (cost > capital) continue;

          capital -= cost;
          highestSinceEntry = bar.high || bar.close;

          position = {
            symbol: data[0].symbol || 'UNKNOWN',
            entryDate: bar.date,
            entryPrice: Math.round(entryPrice * 100) / 100,
            shares,
            cost: Math.round(cost)
          };
        }
      }

      // 記錄權益
      const unrealized = position
        ? position.shares * bar.close - position.cost
        : 0;
      equityCurve.push(Math.round(capital + (position ? position.shares * bar.close : 0)));
    }

    // 若回測結束仍有持倉，強制平倉
    if (position && data.length > 0) {
      const lastBar = data[data.length - 1];
      const exitPrice = lastBar.close;
      const proceeds = exitPrice * position.shares * (1 - this.config.commission - this.config.tax);
      const pnl = proceeds - position.cost;
      trades.push({
        ...position,
        exitDate: lastBar.date,
        exitPrice,
        pnl: Math.round(pnl),
        returnPct: Math.round((pnl / position.cost) * 10000) / 100,
        exitReason: '回測結束強制平倉',
        holdingDays: _daysBetween(position.entryDate, lastBar.date)
      });
    }

    return { trades, equityCurve };
  }

  /**
   * 產生文字格式回測報告
   * @param {Object} report - run() 的回傳結果
   * @returns {string} 格式化報告
   */
  formatReport(report) {
    const p = report.performance;
    const lines = [];

    lines.push('═══════════════════════════════════════');
    lines.push(`📊 回測報告: ${report.symbol}`);
    lines.push(`📅 期間: ${report.startDate} ~ ${report.endDate} (${report.tradingDays} 交易日)`);
    lines.push(`📋 策略: ${report.strategyType}`);
    lines.push('═══════════════════════════════════════\n');

    lines.push('📈 績效摘要');
    lines.push('───────────────────────────────────────');
    lines.push(`• 總報酬率: ${p.totalReturnPct >= 0 ? '+' : ''}${p.totalReturnPct}%`);
    lines.push(`• 總損益: ${p.totalReturn >= 0 ? '+' : ''}$${p.totalReturn.toLocaleString()}`);
    lines.push(`• 最大回撤: -${p.maxDrawdownPct}%`);
    lines.push(`• 夏普比率: ${p.sharpeRatio}`);
    lines.push(`• 獲利因子: ${p.profitFactor}`);
    lines.push(`• 期望值: ${p.expectancy}%\n`);

    lines.push('📋 交易統計');
    lines.push('───────────────────────────────────────');
    lines.push(`• 總交易次數: ${p.totalTrades}`);
    lines.push(`• 勝率: ${p.winRate}% (${p.winCount}勝 ${p.loseCount}敗)`);
    lines.push(`• 平均獲利: +${p.avgWin}%`);
    lines.push(`• 平均虧損: -${p.avgLoss}%\n`);

    if (p.monthlyReturns && p.monthlyReturns.length > 0) {
      lines.push('📅 月度績效');
      lines.push('───────────────────────────────────────');
      for (const m of p.monthlyReturns) {
        const sign = m.returnPct >= 0 ? '+' : '';
        lines.push(`• ${m.month}: ${sign}${m.returnPct}% (${m.trades} 筆)`);
      }
      lines.push('');
    }

    lines.push('═══════════════════════════════════════');
    lines.push('⚠️ 注意: 回測結果不代表未來績效');

    return lines.join('\n');
  }
}

/**
 * 計算兩個日期間的天數
 * @private
 */
function _daysBetween(dateStr1, dateStr2) {
  try {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    return Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

module.exports = {
  BacktestEngine,
  BaseStrategy,
  MACrossStrategy,
  VAOBreakoutStrategy,
  calculatePerformance,
  STRATEGY_TYPES,
  DEFAULT_CONFIG
};
