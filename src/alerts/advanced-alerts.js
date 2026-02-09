/**
 * @fileoverview 即時警示系統升級 - 技術面/籌碼面多維度警示
 * @module alerts/advanced-alerts
 * @version 1.0.0
 * @see docs/prd-stock-2026.md §FR-010
 *
 * @example
 * const { AdvancedAlertEngine } = require('./alerts/advanced-alerts');
 * const engine = new AdvancedAlertEngine(db);
 * const alerts = await engine.scan(['2330', '2454']);
 */

const { calculateVAO } = require('../indicators/vao');
const { calculateMTM, calculateMASystem } = require('../indicators/momentum');

// ─── 常數定義 ─────────────────────────────────────
const ALERT_TYPES = {
  // 技術面
  MA_BREAKOUT: 'MA_BREAKOUT',
  VAO_EXPLOSION: 'VAO_EXPLOSION',
  MTM_REVERSAL: 'MTM_REVERSAL',
  VOLUME_SPIKE_DOWN: 'VOLUME_SPIKE_DOWN',
  // 籌碼面
  FOREIGN_CONSECUTIVE_BUY: 'FOREIGN_CONSECUTIVE_BUY',
  MARGIN_SURGE: 'MARGIN_SURGE',
  INSTITUTIONAL_SYNC: 'INSTITUTIONAL_SYNC',
  // 風控
  STOP_LOSS: 'STOP_LOSS',
  TRAILING_STOP: 'TRAILING_STOP',
  MA_BREAKDOWN: 'MA_BREAKDOWN'
};

const SEVERITY = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

/**
 * 進階警示引擎
 * @class
 */
class AdvancedAlertEngine {
  /**
   * @param {Object} db - 資料庫實例
   * @param {Object} [config={}]
   * @param {number} [config.vaoThreshold=70] - VAO 爆量門檻
   * @param {number} [config.foreignConsecutiveDays=3] - 外資連續買超天數
   * @param {number} [config.marginSurgeRate=0.10] - 融資暴增率門檻
   */
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      vaoThreshold: config.vaoThreshold || 70,
      foreignConsecutiveDays: config.foreignConsecutiveDays || 3,
      marginSurgeRate: config.marginSurgeRate || 0.10,
      stopLossRate: config.stopLossRate || 0.07,
      trailingStopRate: config.trailingStopRate || 0.03,
      trailingActivation: config.trailingActivation || 0.10
    };
    this.channels = [];
  }

  /**
   * 註冊通知管道
   * @param {Object} channel - 通知管道 { name, send(message) }
   */
  registerChannel(channel) {
    if (channel && typeof channel.send === 'function') {
      this.channels.push(channel);
      console.log(`[${new Date().toISOString()}] [INFO] [Alerts] 已註冊通知管道: ${channel.name || 'unnamed'}`);
    }
  }

  /**
   * 掃描股票清單，產生警示
   * @async
   * @param {Array<string>} symbols - 股票代碼清單
   * @param {Object} [options={}]
   * @param {boolean} [options.includePositionAlerts=true] - 是否包含持倉警示
   * @returns {Promise<Array<Object>>} 警示清單
   */
  async scan(symbols, options = {}) {
    const { includePositionAlerts = true } = options;
    const alerts = [];

    for (const symbol of symbols) {
      try {
        // 技術面警示
        const techAlerts = this._scanTechnical(symbol);
        alerts.push(...techAlerts);

        // 籌碼面警示
        const instAlerts = this._scanInstitutional(symbol);
        alerts.push(...instAlerts);

        // 持倉風控警示
        if (includePositionAlerts) {
          const riskAlerts = this._scanPositionRisk(symbol);
          alerts.push(...riskAlerts);
        }
      } catch (err) {
        console.warn(`⚠️ 掃描 ${symbol} 警示失敗: ${err.message}`);
      }
    }

    // 依嚴重度排序
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9));

    return alerts;
  }

  /**
   * 掃描並發送警示
   * @async
   * @param {Array<string>} symbols
   * @returns {Promise<Array<Object>>}
   */
  async scanAndNotify(symbols) {
    const alerts = await this.scan(symbols);

    if (alerts.length > 0) {
      const message = this.formatAlerts(alerts);
      await this._sendToChannels(message);
    }

    return alerts;
  }

  /**
   * 技術面警示掃描
   * @private
   */
  _scanTechnical(symbol) {
    const alerts = [];
    const priceData = this._getPriceHistory(symbol, 80);
    if (!priceData || priceData.length < 60) return alerts;

    try {
      // VAO 爆量
      const vao = calculateVAO(priceData);
      if (vao.score >= this.config.vaoThreshold) {
        alerts.push({
          type: ALERT_TYPES.VAO_EXPLOSION,
          symbol,
          severity: SEVERITY.WARNING,
          message: `VAO 爆量訊號 (${vao.score}分)，量比5日: ${vao.details.volumeRatio5?.toFixed(1)}x`,
          data: vao
        });
      }

      // MTM 轉折
      const mtm = calculateMTM(priceData);
      const prevData = priceData.slice(1);
      if (prevData.length >= 15) {
        const prevMtm = calculateMTM(prevData);
        // MTM 由負轉正 = 多頭轉折
        if (prevMtm.mtm <= 0 && mtm.mtm > 0) {
          alerts.push({
            type: ALERT_TYPES.MTM_REVERSAL,
            symbol,
            severity: SEVERITY.INFO,
            message: `MTM 動能由負轉正 (${mtm.mtm})，可能開始轉強`,
            data: { current: mtm, previous: prevMtm }
          });
        }
      }

      // 均線突破
      const ma = calculateMASystem(priceData);
      if (ma.aboveMA20 && priceData.length > 1) {
        const prevClose = priceData[1].close;
        const prevMA20Value = ma.ma20.value; // 近似
        if (prevClose < prevMA20Value && priceData[0].close >= ma.ma20.value) {
          alerts.push({
            type: ALERT_TYPES.MA_BREAKOUT,
            symbol,
            severity: SEVERITY.INFO,
            message: `突破 MA20 (${ma.ma20.value})，均線排列: ${ma.alignment}`,
            data: ma
          });
        }
      }

      // 異常放量下跌
      const today = priceData[0];
      const yesterday = priceData[1];
      if (yesterday.close > 0) {
        const dayChange = ((today.close - yesterday.close) / yesterday.close) * 100;
        const avgVol5 = priceData.slice(0, 5).reduce((s, d) => s + d.volume, 0) / 5;
        if (dayChange < -4 && today.volume > avgVol5 * 1.5) {
          alerts.push({
            type: ALERT_TYPES.VOLUME_SPIKE_DOWN,
            symbol,
            severity: SEVERITY.CRITICAL,
            message: `異常放量下跌 ${dayChange.toFixed(1)}%，量比5日: ${(today.volume / avgVol5).toFixed(1)}x`,
            data: { dayChange, volumeRatio: today.volume / avgVol5 }
          });
        }
      }
    } catch (err) {
      console.warn(`[Alerts] ${symbol} 技術面掃描錯誤: ${err.message}`);
    }

    return alerts;
  }

  /**
   * 籌碼面警示掃描
   * @private
   */
  _scanInstitutional(symbol) {
    const alerts = [];
    const instData = this._getInstitutionalHistory(symbol, 10);
    if (!instData || instData.length < 3) return alerts;

    try {
      // 外資連續買超
      let consecutiveBuy = 0;
      let totalBuy = 0;
      for (const d of instData) {
        if (d.foreign_net > 0) {
          consecutiveBuy++;
          totalBuy += d.foreign_net;
        } else break;
      }
      if (consecutiveBuy >= this.config.foreignConsecutiveDays) {
        alerts.push({
          type: ALERT_TYPES.FOREIGN_CONSECUTIVE_BUY,
          symbol,
          severity: SEVERITY.WARNING,
          message: `外資連續 ${consecutiveBuy} 日買超，累計 ${totalBuy} 張`,
          data: { consecutiveBuy, totalBuy }
        });
      }

      // 三大法人同步做多
      const latest = instData[0];
      if (latest.foreign_net > 0 && latest.trust_net > 0 && latest.dealer_net > 0) {
        alerts.push({
          type: ALERT_TYPES.INSTITUTIONAL_SYNC,
          symbol,
          severity: SEVERITY.WARNING,
          message: `三大法人同步買超 (外資:${latest.foreign_net} 投信:${latest.trust_net} 自營:${latest.dealer_net})`,
          data: latest
        });
      }

      // 融資暴增
      if (instData.length >= 2) {
        const curr = instData[0].margin_balance || 0;
        const prev = instData[1].margin_balance || 0;
        if (prev > 0) {
          const changeRate = (curr - prev) / prev;
          if (changeRate > this.config.marginSurgeRate) {
            alerts.push({
              type: ALERT_TYPES.MARGIN_SURGE,
              symbol,
              severity: SEVERITY.CRITICAL,
              message: `融資暴增 ${(changeRate * 100).toFixed(1)}%，餘額: ${curr}`,
              data: { changeRate, currentBalance: curr, previousBalance: prev }
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[Alerts] ${symbol} 籌碼面掃描錯誤: ${err.message}`);
    }

    return alerts;
  }

  /**
   * 持倉風控警示
   * @private
   */
  _scanPositionRisk(symbol) {
    const alerts = [];

    try {
      const position = this.db.prepare(
        'SELECT * FROM positions WHERE symbol = ?'
      ).get(symbol);
      if (!position) return alerts;

      const latest = this.db.prepare(
        'SELECT close, high FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1'
      ).get(symbol);
      if (!latest) return alerts;

      const buyPrice = position.buy_price;
      const currentReturn = (latest.close - buyPrice) / buyPrice;

      // 固定停損
      if (currentReturn <= -this.config.stopLossRate) {
        alerts.push({
          type: ALERT_TYPES.STOP_LOSS,
          symbol,
          severity: SEVERITY.CRITICAL,
          message: `⚠️ 觸及停損! 虧損 ${(currentReturn * 100).toFixed(1)}% (門檻: -${(this.config.stopLossRate * 100)}%)`,
          data: { buyPrice, currentPrice: latest.close, returnPct: currentReturn * 100 }
        });
      }

      // 跌破 MA20
      const priceData = this._getPriceHistory(symbol, 25);
      if (priceData && priceData.length >= 20) {
        const ma20 = priceData.slice(0, 20).reduce((s, d) => s + d.close, 0) / 20;
        if (latest.close < ma20 && priceData.length > 1 && priceData[1].close >= ma20) {
          alerts.push({
            type: ALERT_TYPES.MA_BREAKDOWN,
            symbol,
            severity: SEVERITY.WARNING,
            message: `跌破 MA20 (${ma20.toFixed(1)})，收盤 ${latest.close}`,
            data: { ma20, close: latest.close }
          });
        }
      }
    } catch {
      // 靜默處理
    }

    return alerts;
  }

  /**
   * 格式化警示為文字
   * @param {Array<Object>} alerts
   * @returns {string}
   */
  formatAlerts(alerts) {
    if (alerts.length === 0) return '✅ 目前無警示';

    const lines = [];
    lines.push(`🔔 警示通知 (${alerts.length} 則)\n`);

    const critical = alerts.filter(a => a.severity === SEVERITY.CRITICAL);
    const warning = alerts.filter(a => a.severity === SEVERITY.WARNING);
    const info = alerts.filter(a => a.severity === SEVERITY.INFO);

    if (critical.length > 0) {
      lines.push('🚨 緊急:');
      critical.forEach(a => lines.push(`• ${a.symbol}: ${a.message}`));
      lines.push('');
    }
    if (warning.length > 0) {
      lines.push('⚠️ 警告:');
      warning.forEach(a => lines.push(`• ${a.symbol}: ${a.message}`));
      lines.push('');
    }
    if (info.length > 0) {
      lines.push('ℹ️ 資訊:');
      info.forEach(a => lines.push(`• ${a.symbol}: ${a.message}`));
    }

    return lines.join('\n');
  }

  // ─── 資料存取 (private) ──────────────────────────

  /** @private */
  _getPriceHistory(symbol, limit) {
    try {
      return this.db.prepare(
        'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?'
      ).all(symbol, limit);
    } catch { return []; }
  }

  /** @private */
  _getInstitutionalHistory(symbol, limit) {
    try {
      return this.db.prepare(
        'SELECT * FROM institutional_trades WHERE symbol = ? ORDER BY date DESC LIMIT ?'
      ).all(symbol, limit);
    } catch { return []; }
  }

  /**
   * 發送到所有已註冊的通知管道
   * @private
   */
  async _sendToChannels(message) {
    for (const channel of this.channels) {
      try {
        await channel.send(message);
        console.log(`[${new Date().toISOString()}] [INFO] [Alerts] 已發送至 ${channel.name}`);
      } catch (err) {
        console.error(`[Alerts] 發送至 ${channel.name} 失敗: ${err.message}`);
      }
    }
  }
}

/**
 * Telegram 通知管道
 * @param {Object} bot - Telegram bot 實例
 * @param {string} chatId - 聊天 ID
 * @returns {Object} 通知管道物件
 */
function createTelegramChannel(bot, chatId) {
  return {
    name: 'Telegram',
    send: async (message) => {
      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }
  };
}

/**
 * Email 通知管道 (預留)
 * @param {Object} transporter - nodemailer transporter
 * @param {string} to - 收件人
 * @returns {Object} 通知管道物件
 */
function createEmailChannel(transporter, to) {
  return {
    name: 'Email',
    send: async (message) => {
      await transporter.sendMail({
        to,
        subject: '📊 股票警示通知',
        text: message
      });
    }
  };
}

module.exports = {
  AdvancedAlertEngine,
  ALERT_TYPES,
  SEVERITY,
  createTelegramChannel,
  createEmailChannel
};
