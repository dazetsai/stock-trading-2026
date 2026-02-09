/**
 * @fileoverview VAO (Volume-Price Action Opportunity) 量價爆發指標
 * @module indicators/vao
 * @version 1.0.0
 * @see docs/screener-design-stock-2026.md §2.3.1
 *
 * @example
 * const { calculateVAO } = require('./indicators/vao');
 * const result = calculateVAO(priceData, { totalShares: 500000 });
 * // => { score: 75, signal: 'STRONG', details: { ... } }
 */

/**
 * 計算陣列平均值
 * @param {Array<number>} arr
 * @returns {number}
 */
function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 計算 VAO 量價爆發指標
 * @description 識別量能異常放大且價格同步突破的強勢訊號
 * @param {Array<Object>} data - 歷史價格資料 (最新在前，至少 20 筆)
 *   每筆需含 { close, volume, high?, low? }
 * @param {Object} [options={}]
 * @param {number} [options.totalShares] - 總發行股數 (用於計算周轉率)
 * @param {number} [options.shortPeriod=5] - 短期均量天數
 * @param {number} [options.longPeriod=20] - 長期均量天數
 * @returns {Object} VAO 計算結果
 * @returns {number} return.score - VAO 分數 (0-100)
 * @returns {string} return.signal - 訊號強度 ('STRONG'|'MODERATE'|'WEAK')
 * @returns {Object} return.details - 詳細數據
 * @throws {Error} 資料不足時拋出錯誤
 */
function calculateVAO(data, options = {}) {
  const {
    totalShares = null,
    shortPeriod = 5,
    longPeriod = 20
  } = options;

  if (!Array.isArray(data) || data.length < longPeriod) {
    throw new Error(`VAO 計算需要至少 ${longPeriod} 筆歷史資料，目前僅 ${data ? data.length : 0} 筆`);
  }

  const today = data[0];
  const yesterday = data[1];

  // 短期與長期均量
  const volumes = data.map(d => d.volume);
  const avgVolume5 = average(volumes.slice(0, shortPeriod));
  const avgVolume20 = average(volumes.slice(0, longPeriod));

  // 價格變化率 (%)
  const priceChange = yesterday.close > 0
    ? ((today.close - yesterday.close) / yesterday.close) * 100
    : 0;

  // 周轉率 (%)
  const turnoverRate = totalShares && totalShares > 0
    ? (today.volume / totalShares) * 100
    : null;

  // ─── VAO Score 計算 (0-100) ────────────────────
  let score = 0;

  // 量能條件 (50%)
  if (avgVolume5 > 0 && today.volume > avgVolume5 * 1.5) score += 25;
  if (avgVolume20 > 0 && today.volume > avgVolume20 * 2.0) score += 25;

  // 價格條件 (30%)
  if (priceChange > 3) score += 15;
  if (priceChange > 5) score += 15;

  // 周轉條件 (20%)
  if (turnoverRate !== null) {
    if (turnoverRate > 5) score += 10;
    if (turnoverRate > 10) score += 10;
  }

  // 訊號分級
  let signal;
  if (score >= 70) {
    signal = 'STRONG';
  } else if (score >= 50) {
    signal = 'MODERATE';
  } else {
    signal = 'WEAK';
  }

  return {
    score,
    signal,
    details: {
      volumeRatio5: avgVolume5 > 0 ? today.volume / avgVolume5 : null,
      volumeRatio20: avgVolume20 > 0 ? today.volume / avgVolume20 : null,
      priceChange: Math.round(priceChange * 100) / 100,
      turnoverRate: turnoverRate !== null ? Math.round(turnoverRate * 100) / 100 : null,
      todayVolume: today.volume,
      avgVolume5: Math.round(avgVolume5),
      avgVolume20: Math.round(avgVolume20)
    }
  };
}

/**
 * 批量計算多檔股票的 VAO
 * @param {Object} stocksData - { symbol: priceDataArray, ... }
 * @param {Object} [sharesMap={}] - { symbol: totalShares, ... }
 * @returns {Array<Object>} 排序後的 VAO 結果 (高分在前)
 */
function calculateVAOBatch(stocksData, sharesMap = {}) {
  const results = [];

  for (const [symbol, data] of Object.entries(stocksData)) {
    try {
      const result = calculateVAO(data, { totalShares: sharesMap[symbol] });
      results.push({ symbol, ...result });
    } catch (err) {
      console.warn(`⚠️ VAO 計算跳過 ${symbol}: ${err.message}`);
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

module.exports = { calculateVAO, calculateVAOBatch, average };
