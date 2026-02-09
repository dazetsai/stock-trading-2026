/**
 * @fileoverview MTM (Momentum) 動能指標與 MA (Moving Average) 均線系統
 * @module indicators/momentum
 * @version 1.0.0
 * @see docs/screener-design-stock-2026.md §2.3.2
 *
 * @example
 * const { calculateMTM, calculateMA } = require('./indicators/momentum');
 * const mtm = calculateMTM(priceData, { period: 10, maPeriod: 5 });
 * const ma20 = calculateMA(priceData, 20);
 */

const { average } = require('./vao');

/**
 * 計算 MTM 動能指標
 * @description 識別價格加速度與動能持續性
 * @param {Array<Object>} data - 歷史價格 (最新在前，需至少 period+maPeriod 筆)
 *   每筆含 { close }
 * @param {Object} [options={}]
 * @param {number} [options.period=10] - MTM 回看期數
 * @param {number} [options.maPeriod=5] - MTMMA 平滑期數
 * @returns {Object} MTM 結果
 * @returns {number} return.mtm - 當前 MTM 值
 * @returns {number} return.mtmma - MTM 移動平均
 * @returns {string} return.direction - 動能方向 ('ACCELERATING'|'DECELERATING')
 * @returns {string} return.signal - 訊號 ('STRONG_BUY'|'BUY'|'HOLD'|'WEAK')
 * @returns {number} return.signalStrength - 訊號強度 (0-100)
 * @throws {Error} 資料不足
 */
function calculateMTM(data, options = {}) {
  const { period = 10, maPeriod = 5 } = options;
  const minRequired = period + maPeriod;

  if (!Array.isArray(data) || data.length < minRequired) {
    throw new Error(`MTM 計算需要至少 ${minRequired} 筆資料，目前 ${data ? data.length : 0} 筆`);
  }

  const closes = data.map(d => d.close);

  // MTM = 當日收盤 - N日前收盤
  const mtm = closes[0] - closes[period];

  // MTMMA = 近 maPeriod 天 MTM 的平均
  const mtmSeries = [];
  for (let i = 0; i < maPeriod; i++) {
    mtmSeries.push(closes[i] - closes[i + period]);
  }
  const mtmma = average(mtmSeries);

  // 動能方向
  const direction = mtm > mtmma ? 'ACCELERATING' : 'DECELERATING';

  // 訊號強度
  let signalStrength = 0;
  if (mtm > 0 && mtmma > 0) signalStrength += 40;  // 雙正
  if (mtm > mtmma) signalStrength += 30;            // 加速
  if (closes[0] > closes[1]) signalStrength += 30;  // 連續上漲

  let signal;
  if (signalStrength >= 70) signal = 'STRONG_BUY';
  else if (signalStrength >= 50) signal = 'BUY';
  else if (signalStrength >= 30) signal = 'HOLD';
  else signal = 'WEAK';

  return {
    mtm: Math.round(mtm * 100) / 100,
    mtmma: Math.round(mtmma * 100) / 100,
    direction,
    signal,
    signalStrength
  };
}

/**
 * 計算簡單移動平均線 (SMA)
 * @param {Array<Object>} data - 歷史價格 (最新在前)
 *   每筆含 { close }
 * @param {number} period - 均線天數 (5, 10, 20, 60)
 * @returns {Object} MA 結果
 * @returns {number} return.value - 均線值
 * @returns {number} return.period - 期數
 * @returns {string} return.trend - 趨勢 ('ABOVE'|'BELOW')
 * @returns {number} return.deviation - 乖離率 (%)
 * @throws {Error} 資料不足
 */
function calculateMA(data, period) {
  if (!Array.isArray(data) || data.length < period) {
    throw new Error(`MA${period} 計算需要至少 ${period} 筆資料，目前 ${data ? data.length : 0} 筆`);
  }

  const closes = data.slice(0, period).map(d => d.close);
  const value = average(closes);
  const currentPrice = data[0].close;
  const trend = currentPrice >= value ? 'ABOVE' : 'BELOW';
  const deviation = value > 0
    ? Math.round(((currentPrice - value) / value) * 10000) / 100
    : 0;

  return {
    value: Math.round(value * 100) / 100,
    period,
    trend,
    deviation
  };
}

/**
 * 計算均線多頭/空頭排列
 * @param {Array<Object>} data - 歷史價格 (最新在前，至少 60 筆)
 * @returns {Object} 均線排列結果
 * @returns {Object} return.ma5 - MA5 結果
 * @returns {Object} return.ma10 - MA10 結果
 * @returns {Object} return.ma20 - MA20 結果
 * @returns {Object} return.ma60 - MA60 結果
 * @returns {string} return.alignment - 排列狀態 ('BULLISH'|'BEARISH'|'MIXED')
 * @returns {boolean} return.aboveMA20 - 收盤價是否站穩 MA20
 */
function calculateMASystem(data) {
  if (!Array.isArray(data) || data.length < 60) {
    throw new Error(`均線系統需要至少 60 筆資料，目前 ${data ? data.length : 0} 筆`);
  }

  const ma5 = calculateMA(data, 5);
  const ma10 = calculateMA(data, 10);
  const ma20 = calculateMA(data, 20);
  const ma60 = calculateMA(data, 60);

  // 多頭排列: MA5 > MA10 > MA20 > MA60
  const bullish = ma5.value > ma10.value && ma10.value > ma20.value && ma20.value > ma60.value;
  const bearish = ma5.value < ma10.value && ma10.value < ma20.value && ma20.value < ma60.value;
  const alignment = bullish ? 'BULLISH' : bearish ? 'BEARISH' : 'MIXED';

  return {
    ma5,
    ma10,
    ma20,
    ma60,
    alignment,
    aboveMA20: data[0].close >= ma20.value
  };
}

module.exports = { calculateMTM, calculateMA, calculateMASystem };
