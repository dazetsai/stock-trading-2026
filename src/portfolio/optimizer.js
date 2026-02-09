/**
 * @fileoverview 投資組合優化器 - 風險分散與配置建議
 * @module portfolio/optimizer
 * @version 1.0.0
 * @see docs/prd-stock-2026.md
 *
 * @example
 * const { PortfolioOptimizer } = require('./portfolio/optimizer');
 * const optimizer = new PortfolioOptimizer(db);
 * const result = await optimizer.optimize();
 */

// ─── 常數定義 ─────────────────────────────────────
const MAX_SINGLE_POSITION = 0.25;   // 單檔最大比例 25%
const MAX_SECTOR_WEIGHT = 0.40;     // 單一產業最大 40%
const MIN_STOCKS = 3;               // 最少持股數
const MAX_STOCKS = 10;              // 最多持股數
const REBALANCE_THRESHOLD = 0.05;   // 偏離 5% 觸發再平衡

/**
 * 投資組合優化器
 * @class
 */
class PortfolioOptimizer {
  /**
   * @param {Object} db - 資料庫實例
   * @param {Object} [config={}]
   * @param {number} [config.maxSinglePosition=0.25]
   * @param {number} [config.maxSectorWeight=0.40]
   */
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      maxSinglePosition: config.maxSinglePosition || MAX_SINGLE_POSITION,
      maxSectorWeight: config.maxSectorWeight || MAX_SECTOR_WEIGHT
    };
  }

  /**
   * 執行投資組合優化
   * @async
   * @param {Array<Object>} [currentPositions] - 目前庫存
   *   每筆 { symbol, shares, buyPrice, sector?, marketCap? }
   * @returns {Promise<Object>} 優化建議
   */
  async optimize(currentPositions = null) {
    try {
      const positions = currentPositions || this._loadPositions();
      if (!positions || positions.length === 0) {
        return { recommendations: [], message: '目前無庫存，無需優化' };
      }

      // 取得最新價格
      const enriched = this._enrichPositions(positions);

      // 分析
      const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);
      const analysis = this._analyzePortfolio(enriched, totalValue);
      const recommendations = this._generateRecommendations(enriched, analysis, totalValue);

      return {
        totalValue,
        positions: enriched,
        analysis,
        recommendations,
        riskMetrics: this._calculateRiskMetrics(enriched, totalValue)
      };
    } catch (err) {
      const enrichedError = new Error(
        `[PortfolioOptimizer.optimize] 優化失敗: ${err.message}\n` +
        `建議: 確認持倉資料正確`
      );
      enrichedError.originalError = err;
      enrichedError.code = 'OPTIMIZER_FAILED';
      console.error(enrichedError.message);
      throw enrichedError;
    }
  }

  /**
   * 載入庫存
   * @private
   */
  _loadPositions() {
    try {
      return this.db.prepare('SELECT * FROM positions').all();
    } catch {
      return [];
    }
  }

  /**
   * 補充最新價格與市值
   * @private
   */
  _enrichPositions(positions) {
    return positions.map(p => {
      let currentPrice = p.buy_price || p.buyPrice || 0;
      try {
        const latest = this.db.prepare(
          'SELECT close FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1'
        ).get(p.symbol);
        if (latest) currentPrice = latest.close;
      } catch { /* 使用買入價 */ }

      const shares = p.quantity || p.shares || 0;
      const buyPrice = p.buy_price || p.buyPrice || 0;
      const currentValue = currentPrice * shares;
      const costBasis = buyPrice * shares;
      const pnl = currentValue - costBasis;
      const returnPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      return {
        symbol: p.symbol,
        shares,
        buyPrice,
        currentPrice,
        currentValue,
        costBasis,
        pnl: Math.round(pnl),
        returnPct: Math.round(returnPct * 100) / 100,
        sector: p.sector || '未分類',
        marketCap: p.marketCap || 'unknown'
      };
    });
  }

  /**
   * 分析投資組合
   * @private
   */
  _analyzePortfolio(positions, totalValue) {
    // 產業分布
    const sectorMap = {};
    for (const p of positions) {
      const sector = p.sector;
      if (!sectorMap[sector]) sectorMap[sector] = { weight: 0, count: 0, symbols: [] };
      sectorMap[sector].weight += p.currentValue / totalValue;
      sectorMap[sector].count++;
      sectorMap[sector].symbols.push(p.symbol);
    }

    // 集中度 (HHI)
    const weights = positions.map(p => p.currentValue / totalValue);
    const hhi = weights.reduce((s, w) => s + w * w, 0);

    // 是否過度集中
    const overConcentrated = positions.some(
      p => (p.currentValue / totalValue) > this.config.maxSinglePosition
    );
    const sectorOverConcentrated = Object.values(sectorMap).some(
      s => s.weight > this.config.maxSectorWeight
    );

    return {
      sectorDistribution: sectorMap,
      hhi: Math.round(hhi * 10000) / 10000,
      diversificationLevel: hhi < 0.15 ? '良好' : hhi < 0.25 ? '尚可' : '過度集中',
      overConcentrated,
      sectorOverConcentrated,
      stockCount: positions.length
    };
  }

  /**
   * 產生優化建議
   * @private
   */
  _generateRecommendations(positions, analysis, totalValue) {
    const recommendations = [];

    // 個股過度集中
    for (const p of positions) {
      const weight = p.currentValue / totalValue;
      if (weight > this.config.maxSinglePosition) {
        recommendations.push({
          type: 'REDUCE',
          symbol: p.symbol,
          reason: `佔比 ${(weight * 100).toFixed(1)}% 超過上限 ${(this.config.maxSinglePosition * 100)}%`,
          targetWeight: this.config.maxSinglePosition,
          action: `建議減碼至 ${(this.config.maxSinglePosition * 100)}% 以下`
        });
      }
    }

    // 產業過度集中
    for (const [sector, info] of Object.entries(analysis.sectorDistribution)) {
      if (info.weight > this.config.maxSectorWeight) {
        recommendations.push({
          type: 'SECTOR_REBALANCE',
          sector,
          reason: `${sector} 佔比 ${(info.weight * 100).toFixed(1)}% 超過上限 ${(this.config.maxSectorWeight * 100)}%`,
          symbols: info.symbols,
          action: `建議分散至其他產業`
        });
      }
    }

    // 虧損嚴重的持股
    for (const p of positions) {
      if (p.returnPct < -15) {
        recommendations.push({
          type: 'REVIEW',
          symbol: p.symbol,
          reason: `虧損 ${p.returnPct}%，建議檢視是否該停損`,
          action: '檢視基本面是否變化，考慮停損'
        });
      }
    }

    // 持股數量建議
    if (positions.length < MIN_STOCKS) {
      recommendations.push({
        type: 'ADD',
        reason: `持股僅 ${positions.length} 檔，建議至少 ${MIN_STOCKS} 檔以分散風險`,
        action: '考慮從選股名單中加入新標的'
      });
    }
    if (positions.length > MAX_STOCKS) {
      recommendations.push({
        type: 'REDUCE_COUNT',
        reason: `持股 ${positions.length} 檔過多，建議精簡至 ${MAX_STOCKS} 檔以內`,
        action: '淘汰弱勢持股，集中火力'
      });
    }

    return recommendations;
  }

  /**
   * 計算風險指標
   * @private
   */
  _calculateRiskMetrics(positions, totalValue) {
    const totalCost = positions.reduce((s, p) => s + p.costBasis, 0);
    const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
    const totalReturnPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    // 最大單檔虧損
    const worstPosition = positions.reduce((worst, p) =>
      p.returnPct < (worst ? worst.returnPct : 0) ? p : worst, null);

    // 最佳持股
    const bestPosition = positions.reduce((best, p) =>
      p.returnPct > (best ? best.returnPct : 0) ? p : best, null);

    return {
      totalCost,
      totalValue,
      totalPnl: Math.round(totalPnl),
      totalReturnPct: Math.round(totalReturnPct * 100) / 100,
      worstPosition: worstPosition ? { symbol: worstPosition.symbol, returnPct: worstPosition.returnPct } : null,
      bestPosition: bestPosition ? { symbol: bestPosition.symbol, returnPct: bestPosition.returnPct } : null,
      exposure: Math.round(totalValue)
    };
  }

  /**
   * 產生文字格式報告
   * @param {Object} result - optimize() 的結果
   * @returns {string}
   */
  formatReport(result) {
    const lines = [];
    lines.push('📊 投資組合分析報告\n');
    lines.push(`💰 總市值: $${result.totalValue.toLocaleString()}`);
    lines.push(`📈 總損益: ${result.riskMetrics.totalReturnPct >= 0 ? '+' : ''}${result.riskMetrics.totalReturnPct}%`);
    lines.push(`📋 持股數: ${result.analysis.stockCount}`);
    lines.push(`🎯 分散程度: ${result.analysis.diversificationLevel}\n`);

    if (result.recommendations.length > 0) {
      lines.push('⚠️ 優化建議:');
      result.recommendations.forEach((r, i) => {
        lines.push(`${i + 1}. [${r.type}] ${r.reason}`);
        lines.push(`   → ${r.action}`);
      });
    } else {
      lines.push('✅ 投資組合配置良好，無需調整');
    }

    return lines.join('\n');
  }
}

module.exports = { PortfolioOptimizer, MAX_SINGLE_POSITION, MAX_SECTOR_WEIGHT };
