/**
 * @fileoverview Telegram Bot 整合 - 推播即時行情與警示
 * @module bot/telegram-bot
 * @version 1.0.0
 * @see docs/screener-design-stock-2026.md §6
 *
 * @example
 * const bot = require('./bot/telegram-bot');
 * await bot.sendMessage('測試訊息');
 * await bot.sendDailyReport(quotes);
 */

const https = require('https');
const path = require('path');

// 載入環境變數
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) { /* dotenv optional */ }

const CONFIG = {
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  apiBase: 'https://api.telegram.org',
  maxMessageLength: 4096,
  retries: 3,
  retryDelay: 2000
};

/**
 * 發送 HTTP POST 請求至 Telegram Bot API
 * @param {string} method - API method (e.g. 'sendMessage')
 * @param {Object} body - Request body
 * @returns {Promise<Object>} API response
 * @throws {Error} 設定不完整或 API 錯誤
 */
async function callTelegramAPI(method, body) {
  if (!CONFIG.token) {
    throw new Error('TELEGRAM_BOT_TOKEN 未設定，請在 .env 檔案中設定');
  }

  const url = `${CONFIG.apiBase}/bot${CONFIG.token}/${method}`;
  const payload = JSON.stringify(body);

  let lastError;
  for (let attempt = 1; attempt <= CONFIG.retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const req = https.request({
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 15000
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (!parsed.ok) {
                reject(new Error(`Telegram API error: ${parsed.description || 'Unknown'}`));
              } else {
                resolve(parsed.result);
              }
            } catch (e) {
              reject(new Error(`JSON parse error: ${e.message}`));
            }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        req.write(payload);
        req.end();
      });
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < CONFIG.retries) {
        await new Promise(r => setTimeout(r, CONFIG.retryDelay * attempt));
      }
    }
  }
  throw lastError;
}

/**
 * 發送文字訊息
 * @param {string} text - 訊息內容
 * @param {Object} [options={}]
 * @param {string} [options.chatId] - 目標 chat ID (預設使用環境變數)
 * @param {string} [options.parseMode='HTML'] - 解析模式
 * @param {boolean} [options.silent=false] - 靜音發送
 * @returns {Promise<Object>} 發送結果
 */
async function sendMessage(text, options = {}) {
  const {
    chatId = CONFIG.chatId,
    parseMode = 'HTML',
    silent = false
  } = options;

  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID 未設定');
  }

  // 處理超長訊息 (拆分)
  if (text.length > CONFIG.maxMessageLength) {
    const chunks = splitMessage(text, CONFIG.maxMessageLength);
    const results = [];
    for (const chunk of chunks) {
      results.push(await callTelegramAPI('sendMessage', {
        chat_id: chatId,
        text: chunk,
        parse_mode: parseMode,
        disable_notification: silent
      }));
    }
    return results;
  }

  return callTelegramAPI('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_notification: silent
  });
}

/**
 * 拆分過長訊息
 * @param {string} text
 * @param {number} maxLen
 * @returns {Array<string>}
 */
function splitMessage(text, maxLen) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // 盡量在換行處斷開
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt);
  }
  return chunks;
}

/**
 * 格式化數字 (加千分位)
 * @param {number} num
 * @returns {string}
 */
function fmt(num) {
  if (num == null || isNaN(num)) return '-';
  return Number(num).toLocaleString('zh-TW');
}

/**
 * 產生並發送每日投資組合報告
 * @param {Array<Object>} quotes - 行情資料陣列
 *   每筆含 { code, name, price, change, changePct, volume, shares?, category? }
 * @returns {Promise<Object>} 發送結果
 */
async function sendDailyReport(quotes) {
  if (!quotes || quotes.length === 0) {
    return sendMessage('⚠️ 今日無行情資料');
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  const upCount = quotes.filter(q => q.change > 0).length;
  const downCount = quotes.filter(q => q.change < 0).length;
  const flatCount = quotes.filter(q => q.change === 0).length;

  let msg = `📊 <b>【${dateStr} 投資組合日報】</b>\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📈 上漲: ${upCount} | 📉 下跌: ${downCount} | ➖ 平盤: ${flatCount}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 依漲跌幅排序
  const sorted = [...quotes].sort((a, b) => (b.changePct || 0) - (a.changePct || 0));

  for (const q of sorted) {
    const emoji = q.change > 0 ? '🟢' : q.change < 0 ? '🔴' : '⚪';
    const sign = q.change > 0 ? '+' : '';
    msg += `${emoji} <b>${q.code} ${q.name}</b>\n`;
    msg += `   💰 ${q.price?.toFixed(2) ?? '-'} | ${sign}${q.change?.toFixed(2) ?? '-'} (${sign}${q.changePct?.toFixed(2) ?? '-'}%)\n`;
    msg += `   📊 量: ${fmt(q.volume)}`;
    if (q.shares) msg += ` | 持有: ${fmt(q.shares)}股`;
    msg += '\n\n';
  }

  msg += `📌 <i>以上為系統自動產生，僅供參考。</i>`;

  return sendMessage(msg);
}

/**
 * 發送警示通知 (停損/量能異常/訊號)
 * @param {Object} alert
 * @param {string} alert.type - 警示類型 ('STOP_LOSS'|'VOLUME_SPIKE'|'SIGNAL')
 * @param {string} alert.symbol - 股票代碼
 * @param {string} alert.name - 股票名稱
 * @param {string} alert.message - 警示內容
 * @param {number} [alert.price] - 當前價格
 * @returns {Promise<Object>}
 */
async function sendAlert(alert) {
  const typeEmoji = {
    STOP_LOSS: '🚨',
    VOLUME_SPIKE: '📢',
    SIGNAL: '🔥',
    TAKE_PROFIT: '💰'
  };

  const emoji = typeEmoji[alert.type] || '⚠️';
  let msg = `${emoji} <b>【${alert.type} 警示】</b>\n\n`;
  msg += `📌 ${alert.symbol} ${alert.name}\n`;
  if (alert.price != null) msg += `💰 價格: ${alert.price}\n`;
  msg += `\n${alert.message}`;

  return sendMessage(msg);
}

/**
 * 發送選股結果報表
 * @param {Object} screenerResult - 選股引擎結果
 * @param {Array} screenerResult.tier1 - 強勢關注
 * @param {Array} screenerResult.tier2 - 穩健清單
 * @param {number} screenerResult.totalScanned - 掃描總數
 * @param {number} screenerResult.totalFiltered - 通過篩選數
 * @returns {Promise<Object>}
 */
async function sendScreenerReport(screenerResult) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  let msg = `🔥 <b>【${dateStr} 選股快報】</b>\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 市場概況\n`;
  msg += `• 全市場: ${fmt(screenerResult.totalScanned)} 檔\n`;
  msg += `• 符合篩選: ${screenerResult.totalFiltered} 檔\n`;
  msg += `• 強勢關注: ${(screenerResult.tier1 || []).length} 檔\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (screenerResult.tier1 && screenerResult.tier1.length > 0) {
    msg += `🔥 <b>Tier 1 - 強勢關注</b>\n\n`;
    screenerResult.tier1.forEach((s, i) => {
      msg += `${i + 1}️⃣ <b>${s.symbol} ${s.name || ''}</b>\n`;
      msg += `   總分: ${s.totalScore}/100\n`;
      msg += `   📈 技術: ${s.technicalScore} | 🏦 籌碼: ${s.institutionalScore} | 📊 量能: ${s.volumeScore}\n`;
      if (s.price) msg += `   💰 收盤: ${s.price}\n`;
      msg += '\n';
    });
  }

  if (screenerResult.tier2 && screenerResult.tier2.length > 0) {
    msg += `✅ <b>Tier 2 - 穩健清單</b>\n`;
    msg += screenerResult.tier2.map(s => `• ${s.symbol} ${s.name || ''} (${s.totalScore}分)`).join('\n');
    msg += '\n\n';
  }

  msg += `📌 <i>風險提示: 以上為系統篩選結果，僅供參考。</i>`;

  return sendMessage(msg);
}

/**
 * 驗證 Bot 連線
 * @returns {Promise<Object>} Bot 資訊
 */
async function getMe() {
  return callTelegramAPI('getMe', {});
}

module.exports = {
  sendMessage,
  sendDailyReport,
  sendAlert,
  sendScreenerReport,
  getMe,
  CONFIG
};
