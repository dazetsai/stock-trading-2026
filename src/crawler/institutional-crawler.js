/**
 * @fileoverview 法人買賣超資料爬蟲 (TWSE 三大法人)
 * @module crawler/institutional-crawler
 * @version 1.0.0
 * @see docs/architecture-stock-2026.md
 *
 * @example
 * const { fetchInstitutionalData } = require('./crawler/institutional-crawler');
 * const data = await fetchInstitutionalData('2026-02-09');
 */

const https = require('https');
const path = require('path');

const CONFIG = {
  /** TWSE 三大法人買賣超日報 API */
  twseUrl: 'https://www.twse.com.tw/rwd/zh/fund/T86',
  /** 請求超時 (ms) */
  timeout: 20000,
  /** 重試次數 */
  retries: 3,
  /** 重試延遲基數 (ms) */
  retryBaseDelay: 2000
};

/**
 * 格式化日期為 TWSE 格式 (YYYYMMDD)
 * @param {string|Date} date - 日期
 * @returns {string} YYYYMMDD 格式
 */
function formatDateTWSE(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * HTTP GET 請求 (含重試)
 * @param {string} url - URL
 * @param {number} [timeout] - 超時 ms
 * @param {number} [retries] - 重試次數
 * @returns {Promise<Object>} JSON response
 */
async function fetchWithRetry(url, timeout = CONFIG.timeout, retries = CONFIG.retries) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.get(url, {
          timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.twse.com.tw/'
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
              }
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`JSON parse error: ${e.message}`));
            }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      });
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = CONFIG.retryBaseDelay * attempt;
        console.log(`   ⚠️ 第 ${attempt} 次失敗，${delay}ms 後重試...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`請求失敗 (${retries} 次): ${lastError.message}`);
}

/**
 * 解析法人數字 (移除逗號，轉換為整數)
 * @param {string} str - 數字字串 (可能含逗號)
 * @returns {number} 整數值
 */
function parseIntSafe(str) {
  if (str == null) return 0;
  const cleaned = String(str).replace(/,/g, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * 抓取三大法人買賣超日報 (全市場)
 * @async
 * @param {string} date - 日期 (YYYY-MM-DD 格式)
 * @returns {Promise<Array<Object>>} 法人買賣超資料陣列
 *   每筆含 { symbol, date, foreign_net, trust_net, dealer_net }
 * @throws {Error} API 錯誤或無資料
 */
async function fetchInstitutionalData(date) {
  const dateStr = formatDateTWSE(date);
  const url = `${CONFIG.twseUrl}?date=${dateStr}&selectType=ALL&response=json`;

  console.log(`📥 抓取法人資料: ${date} (${dateStr})`);

  const raw = await fetchWithRetry(url);

  if (raw.stat !== 'OK' || !raw.data || raw.data.length === 0) {
    console.log(`   ⚠️ 無資料或非交易日: ${raw.stat || 'unknown'}`);
    return [];
  }

  const results = [];

  for (const row of raw.data) {
    // T86 欄位順序 (依 TWSE 文件):
    // [0] 證券代號, [1] 證券名稱
    // [2] 外陸資買進股數(不含外資自營商), [3] 外陸資賣出股數(不含外資自營商), [4] 外陸資買賣超股數(不含外資自營商)
    // [5] 外資自營商買進股數, [6] 外資自營商賣出股數, [7] 外資自營商買賣超股數
    // [8] 投信買進股數, [9] 投信賣出股數, [10] 投信買賣超股數
    // [11] 自營商買賣超股數, [12-17] 自營商明細
    const symbol = String(row[0]).trim();

    // 跳過非一般股票 (ETF 代碼通常 00 開頭)
    if (!symbol || symbol.length > 6) continue;

    results.push({
      symbol,
      name: String(row[1]).trim(),
      date,
      foreign_net: parseIntSafe(row[4]),   // 外資買賣超 (張)
      trust_net: parseIntSafe(row[10]),     // 投信買賣超 (張)
      dealer_net: parseIntSafe(row[11]),    // 自營商買賣超 (張)
      margin_balance: 0,   // 資券需另外 API
      short_balance: 0
    });
  }

  console.log(`   ✅ 取得 ${results.length} 筆法人資料`);
  return results;
}

/**
 * 抓取並儲存法人資料至資料庫
 * @async
 * @param {string} date - 日期
 * @param {Object} DB - 資料庫介面 (需有 saveInstitutionalTrade 方法)
 * @param {Array<string>} [filterSymbols=null] - 僅儲存指定股票 (null = 全部)
 * @returns {Promise<number>} 儲存筆數
 */
async function fetchAndSave(date, DB, filterSymbols = null) {
  const data = await fetchInstitutionalData(date);

  if (data.length === 0) return 0;

  let saved = 0;
  for (const row of data) {
    if (filterSymbols && !filterSymbols.includes(row.symbol)) continue;
    try {
      DB.saveInstitutionalTrade(row);
      saved++;
    } catch (err) {
      console.warn(`   ⚠️ 儲存失敗 ${row.symbol}: ${err.message}`);
    }
  }

  console.log(`   💾 已儲存 ${saved} 筆法人資料至資料庫`);
  return saved;
}

module.exports = {
  fetchInstitutionalData,
  fetchAndSave,
  formatDateTWSE,
  parseIntSafe,
  CONFIG
};
