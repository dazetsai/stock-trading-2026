/**
 * @fileoverview TWSE 證交所即時行情爬蟲
 * @description 使用 TWSE MIS API 抓取上市/上櫃股票即時行情
 * @module crawler/twse-realtime-crawler
 * @version 1.0.0
 * @license ZVQ v1.0
 * @author System Agent
 */

const https = require('https');
const { URL } = require('url');
const zlib = require('zlib');

/**
 * TWSE 證交所即時行情爬蟲類別
 * @class TWSERealtimeCrawler
 * @implements {ZVQCrawler}
 */
class TWSERealtimeCrawler {
  /**
   * 創建爬蟲實例
   * @param {Object} [options={}] - 配置選項
   * @param {number} [options.maxRetries=3] - 最大重試次數
   * @param {number} [options.rateLimitMs=334] - 速率限制（毫秒，預設每秒3次）
   * @param {number} [options.timeoutMs=15000] - 請求超時時間
   * @param {boolean} [options.enableCache=false] - 是否啟用快取
   * @param {number} [options.cacheTTLMs=5000] - 快取存活時間
   */
  constructor(options = {}) {
    this.config = {
      maxRetries: options.maxRetries ?? 3,
      rateLimitMs: options.rateLimitMs ?? 334, // 1000ms / 3 = 333.33ms
      timeoutMs: options.timeoutMs ?? 15000,
      enableCache: options.enableCache ?? false,
      cacheTTLMs: options.cacheTTLMs ?? 5000
    };

    /** @private @type {Map<string, {data: Object, timestamp: number}>} */
    this.cache = new Map();

    /** @private @type {number} */
    this.lastRequestTime = 0;

    /** @private @type {number} */
    this.requestCount = 0;

    // API 端點配置
    this.endpoints = {
      twse: 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp',
      tpex: 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp'
    };

    // 上櫃股票代碼範圍（根據台灣證券交易所規則）
    this.otcRanges = [
      { start: 4000, end: 4999 }, // 上櫃一般股
      { start: 5000, end: 6999 }, // 上櫃電子股、中小型股
      { start: 8000, end: 8999 }, // 上櫃特殊股
      { start: 9000, end: 9999 }  // 興櫃轉上櫃
    ];

    // 特殊上櫃股票代碼（不在標準 OTC 範圍內）
    this.otcExceptions = new Set([
      '1815', // 富喬 - 1開頭但實際為上櫃
      '3141', // 晶宏
      '3260', // 威剛科技
      '3288', // 上櫃生技股等
    ]);

    // 特殊上市股票代碼（在 OTC 範圍內但實際上市）
    this.tseExceptions = new Set([
      '6282', // 康舒 - 6開頭但實際為上市
    ]);
  }

  /**
   * 根據股票代碼自動判斷市場類型
   * @param {string} code - 股票代碼（如 "2454"、"5340"）
   * @returns {'tse'|'otc'} 市場類型代碼
   * @example
   * crawler.detectMarketType('2454'); // 'tse'（上市）
   * crawler.detectMarketType('5340'); // 'otc'（上櫃）
   */
  detectMarketType(code) {
    if (!code || code === '') {
      return 'unknown';
    }

    const codeNum = parseInt(code, 10);

    if (isNaN(codeNum)) {
      throw new Error(`Invalid stock code: ${code}`);
    }

    // 檢查是否在上市例外清單中
    if (this.tseExceptions.has(code)) {
      return 'tse';
    }

    // 檢查是否在上櫃例外清單中
    if (this.otcExceptions.has(code)) {
      return 'otc';
    }

    // 檢查是否在上櫃範圍內
    const isOTC = this.otcRanges.some(
      range => codeNum >= range.start && codeNum <= range.end
    );

    return isOTC ? 'otc' : 'tse';
  }

  /**
   * 解析 TWSE JSONP 回應格式
   * @param {string} raw - 原始 JSONP 字串
   * @returns {Object} 解析後的資料物件
   * @throws {Error} 當解析失敗時拋出錯誤
   * @example
   * const raw = 'callback({"msgArray":[{"c":"2454","n":"聯發科"}]});';
   * const data = crawler.parseTWSEData(raw);
   */
  parseTWSEData(raw) {
    try {
      // 處理 JSONP 格式：移除 callback 函數名稱和尾部括號
      let cleaned = raw.trim();

      // 移除常見的 callback 函數名稱
      const callbackPatterns = [
        /^[\w$]+\(/,           // genericCallback(
        /^jsonp\(/,            // jsonp(
        /^callback\(/,         // callback(
        /^\(/,                 // (
        /\);?$/               // ); 或 )
      ];

      callbackPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });

      // 確保最後一個字符不是分號或閉合括號
      cleaned = cleaned.replace(/[);\s]+$/, '');

      const data = JSON.parse(cleaned);

      // 驗證必要欄位
      if (!data || typeof data !== 'object') {
        throw new Error('Parsed data is not an object');
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to parse TWSE data: ${error.message}. Raw: ${raw.substring(0, 200)}`);
    }
  }

  /**
   * 將 TWSE 原始資料轉換為標準格式
   * @param {Object} raw - TWSE API 原始資料中的單筆股票資料
   * @returns {Object} 標準化的股票行情資料
   * @private
   */
  _normalizeStockData(raw) {
    // 解析價格欄位（處理空字串和特殊值）
    const parsePrice = (val) => {
      if (!val || val === '-' || val === '') return 0;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    // 解析成交量
    const parseVolume = (val) => {
      if (!val || val === '-' || val === '') return 0;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    // 嘗試從多個可能的位置獲取代碼
    let code = raw.c || raw.code || '';
    
    // 如果 c 為空，嘗試從 @ 欄位解析 (格式: "1234.tw")
    if (!code && raw['@']) {
      const match = raw['@'].toString().match(/(\d+)/);
      if (match) code = match[1];
    }
    
    // 如果還是為空，嘗試從 key 欄位解析 (格式: "tse_1234.tw_20260101")
    if (!code && raw.key) {
      const match = raw.key.toString().match(/_(\d+)\.tw/);
      if (match) code = match[1];
    }

    const name = raw.n || raw.name || '';
    const price = parsePrice(raw.z);        // 最新成交價
    const open = parsePrice(raw.o);         // 開盤價
    const high = parsePrice(raw.h);         // 最高價
    const low = parsePrice(raw.l);          // 最低價
    const prevClose = parsePrice(raw.y);    // 昨收價
    const volume = parseVolume(raw.v);      // 累計成交量
    const tv = parseVolume(raw.tv);         // 當筆成交量
    const time = raw.t || '';               // 時間

    // 計算漲跌
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    return {
      code,
      name,
      price: price || open || prevClose,    // 優先使用成交價，其次是開盤價或昨收
      open: open || prevClose,
      high: high || price || open || prevClose,
      low: low || price || open || prevClose,
      prevClose,
      volume,
      tv,                                   // 當筆成交量
      change,
      changePct,
      time,
      market: code ? this.detectMarketType(code) : 'unknown',
      raw                                   // 保留原始資料以供參考
    };
  }

  /**
   * 執行速率限制等待
   * @private
   * @returns {Promise<void>}
   */
  async _applyRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.rateLimitMs) {
      const waitTime = this.config.rateLimitMs - timeSinceLastRequest;
      await this._sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * 延遲函數
   * @private
   * @param {number} ms - 毫秒
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 計算指數退避延遲時間
   * @private
   * @param {number} attempt - 當前嘗試次數（從1開始）
   * @returns {number} 延遲毫秒數
   */
  _calculateBackoff(attempt) {
    // 指數退避：2^attempt * 1000ms，加上隨機抖動
    const baseDelay = Math.pow(2, attempt) * 1000;
    const jitter = Math.random() * 500;
    return Math.min(baseDelay + jitter, 10000); // 最大10秒
  }

  /**
   * 發送 HTTP GET 請求
   * @private
   * @param {string} url - 請求 URL
   * @returns {Promise<string>} 回應內容
   * @throws {Error} 當請求失敗時拋出錯誤
   */
  async _httpGet(url) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        timeout: this.config.timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://mis.twse.com.tw/',
          'Connection': 'keep-alive'
        }
      };

      const req = https.request(options, (res) => {
        let chunks = [];
        const encoding = res.headers['content-encoding'];

        // 處理重定向
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this._httpGet(res.headers.location).then(resolve).catch(reject);
          return;
        }

        res.on('data', chunk => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const buffer = Buffer.concat(chunks);
            let data;

            // 處理壓縮編碼
            if (encoding === 'gzip') {
              data = zlib.gunzipSync(buffer).toString('utf-8');
            } else if (encoding === 'deflate') {
              data = zlib.inflateSync(buffer).toString('utf-8');
            } else if (encoding === 'br') {
              data = zlib.brotliDecompressSync(buffer).toString('utf-8');
            } else {
              data = buffer.toString('utf-8');
            }

            resolve(data);
          } else {
            const buffer = Buffer.concat(chunks);
            const errorData = buffer.toString('utf-8').substring(0, 200);
            reject(new Error(`HTTP ${res.statusCode}: ${errorData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.config.timeoutMs}ms`));
      });

      req.end();
    });
  }

  /**
   * 帶重試機制的請求
   * @private
   * @param {string} url - 請求 URL
   * @returns {Promise<string>} 回應內容
   * @throws {Error} 當所有重試都失敗時拋出錯誤
   */
  async _fetchWithRetry(url) {
    let lastError;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this._applyRateLimit();
        const response = await this._httpGet(url);
        return response;
      } catch (error) {
        lastError = error;

        if (attempt < this.config.maxRetries) {
          const delay = this._calculateBackoff(attempt);
          console.log(`   ⚠️  Attempt ${attempt}/${this.config.maxRetries} failed: ${error.message}`);
          console.log(`   ⏱️  Retrying in ${delay.toFixed(0)}ms...`);
          await this._sleep(delay);
        }
      }
    }

    throw new Error(`Failed after ${this.config.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * 查詢單檔股票即時行情
   * @param {string} code - 股票代碼（如 "2454"）
   * @param {string} [marketType] - 市場類型（'tse' 或 'otc'），未提供則自動判斷
   * @returns {Promise<Object|null>} 股票行情資料，失敗時返回 null
   * @example
   * const quote = await crawler.fetchStock('2454');
   * console.log(quote.name, quote.price);
   */
  async fetchStock(code, marketType) {
    try {
      // 檢查快取
      if (this.config.enableCache) {
        const cached = this._getFromCache(code);
        if (cached) return cached;
      }

      // 自動判斷市場類型
      const market = marketType || this.detectMarketType(code);
      const url = `${this.endpoints.twse}?ex_ch=${market}_${code}.tw&json=1&delay=0`;

      const raw = await this._fetchWithRetry(url);
      const data = this.parseTWSEData(raw);

      if (!data.msgArray || data.msgArray.length === 0) {
        throw new Error(`No data returned for stock ${code}`);
      }

      const normalized = this._normalizeStockData(data.msgArray[0]);

      // 存入快取
      if (this.config.enableCache) {
        this._setCache(code, normalized);
      }

      return normalized;
    } catch (error) {
      console.error(`❌ Failed to fetch stock ${code}: ${error.message}`);
      return null;
    }
  }

  /**
   * 批次查詢多檔股票即時行情（最多100檔）
   * @param {Array<string|{code: string, marketType?: string}>} codes - 股票代碼列表
   * @returns {Promise<Array<Object>>} 股票行情資料陣列
   * @throws {Error} 當 codes 超過100檔時拋出錯誤
   * @example
   * // 使用字串陣列
   * const quotes = await crawler.fetchBatch(['2454', '2344', '5340']);
   *
   * // 使用物件陣列（明確指定市場類型）
   * const quotes = await crawler.fetchBatch([
   *   { code: '2454', marketType: 'tse' },
   *   { code: '5340', marketType: 'otc' }
   * ]);
   */
  async fetchBatch(codes) {
    if (!Array.isArray(codes)) {
      throw new Error('codes must be an array');
    }

    if (codes.length === 0) {
      return [];
    }

    if (codes.length > 100) {
      throw new Error('Maximum 100 stocks per batch request');
    }

    try {
      // 構建批次查詢參數
      const queryParts = codes.map(item => {
        if (typeof item === 'string') {
          const market = this.detectMarketType(item);
          return `${market}_${item}.tw`;
        } else if (item && typeof item === 'object' && item.code) {
          const market = item.marketType || this.detectMarketType(item.code);
          return `${market}_${item.code}.tw`;
        }
        throw new Error(`Invalid stock code format: ${JSON.stringify(item)}`);
      });

      const batchQuery = queryParts.join('|');
      const url = `${this.endpoints.twse}?ex_ch=${batchQuery}&json=1&delay=0`;

      const raw = await this._fetchWithRetry(url);
      const data = this.parseTWSEData(raw);

      if (!data.msgArray || data.msgArray.length === 0) {
        console.warn('⚠️  No data returned for batch request');
        return [];
      }

      // 標準化所有結果，過濾掉無效資料（沒有股票代碼的）
      const results = data.msgArray
        .map(stock => this._normalizeStockData(stock))
        .filter(quote => quote.code && quote.code.length > 0);

      if (results.length < data.msgArray.length) {
        const filteredCount = data.msgArray.length - results.length;
        console.warn(`   ⚠️  Filtered out ${filteredCount} invalid stock entries (no valid code)`);
      }

      // 更新快取
      if (this.config.enableCache) {
        results.forEach(quote => {
          this._setCache(quote.code, quote);
        });
      }

      return results;
    } catch (error) {
      console.error(`❌ Batch fetch failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 從快取取得資料
   * @private
   * @param {string} code - 股票代碼
   * @returns {Object|null}
   */
  _getFromCache(code) {
    const cached = this.cache.get(code);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTTLMs) {
      this.cache.delete(code);
      return null;
    }

    return cached.data;
  }

  /**
   * 存入快取
   * @private
   * @param {string} code - 股票代碼
   * @param {Object} data - 股票資料
   */
  _setCache(code, data) {
    this.cache.set(code, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 清除快取
   */
  clearCache() {
    this.cache.clear();
    console.log('✅ Cache cleared');
  }

  /**
   * 取得爬蟲統計資訊
   * @returns {Object} 統計資料
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      cacheSize: this.cache.size,
      config: { ...this.config }
    };
  }

  /**
   * 測試特定股票代碼範例
   * @returns {Array<{code: string, name: string, market: string}>}
   */
  static getTestSamples() {
    return [
      { code: '2454', name: '聯發科', market: 'tse', note: '上市大型股' },
      { code: '2344', name: '華邦電', market: 'tse', note: '上市中型股' },
      { code: '5340', name: '建榮', market: 'otc', note: '上櫃小型股（Yahoo抓不到）' },
      { code: '5347', name: '世界', market: 'otc', note: '上櫃小型股（Yahoo抓不到）' },
      { code: '5425', name: '台半', market: 'otc', note: '上櫃小型股（Yahoo抓不到）' },
      { code: '6127', name: '九豪', market: 'otc', note: '上櫃小型股（Yahoo抓不到）' },
      { code: '6182', name: '合晶', market: 'otc', note: '上櫃小型股（Yahoo抓不到）' },
      { code: '1815', name: '富喬', market: 'tse', note: '上市小型股（Yahoo抓不到）' }
    ];
  }
}

module.exports = TWSERealtimeCrawler;
