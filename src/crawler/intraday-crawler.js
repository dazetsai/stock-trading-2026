/**
 * @fileoverview TWSE 即時行情爬蟲 - 整合版本
 * @description 使用 TWSE API 為主要來源，Yahoo Finance 作為備份
 * @module crawler/intraday-crawler
 * @version 2.0.0
 * @license ZVQ
 * @author System Agent
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const TWSERealtimeCrawler = require('./twse-realtime-crawler');

// Configuration
const CONFIG = {
  watchlistPath: path.join(__dirname, '../../data/watchlist_portfolio.json'),
  outputDir: path.join(__dirname, '../../data/intraday'),
  updateInterval: 10 * 60 * 1000, // 10 minutes
  csvHeaders: ['timestamp', 'code', 'name', 'price', 'change', 'change_pct', 'volume', 'open', 'high', 'low', 'prev_close'],
  crawler: {
    maxRetries: 3,
    rateLimitMs: 334, // 3 requests per second
    enableCache: true,
    cacheTTLMs: 5000
  }
};

/**
 * Ensure output directory exists
 * @returns {void}
 */
function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
}

/**
 * Load watchlist from JSON file
 * @returns {Array<{code: string, name: string, category: string, shares: number, priority: string}>}
 * @throws {Error} If file not found or invalid JSON
 */
function loadWatchlist() {
  try {
    const data = fs.readFileSync(CONFIG.watchlistPath, 'utf8');
    const parsed = JSON.parse(data);
    
    if (!parsed.watchlist || !Array.isArray(parsed.watchlist)) {
      throw new Error('Invalid watchlist format: watchlist array not found');
    }
    
    return parsed.watchlist;
  } catch (error) {
    throw new Error(`Failed to load watchlist: ${error.message}`);
  }
}

/**
 * Make HTTP request with timeout and retry
 * @param {string} url - API endpoint URL
 * @param {number} [timeout=15000] - Request timeout in ms
 * @param {number} [retries=3] - Number of retry attempts
 * @returns {Promise<Object>} Parsed JSON response
 */
async function fetchWithRetry(url, timeout = 15000, retries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.get(url, { 
          timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }, (res) => {
          let data = '';
          
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
                return;
              }
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`JSON parse error: ${e.message}`));
            }
          });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`   ⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw new Error(`Failed after ${retries} attempts: ${lastError.message}`);
}

/**
 * Fetch stock quote from Yahoo Finance (Backup source)
 * @param {string} stockCode - Stock code (e.g., "2454")
 * @returns {Promise<Object|null>} Stock quote data or null if failed
 */
async function fetchYahooQuote(stockCode) {
  try {
    // Yahoo Finance v8 API
    const symbol = `${stockCode}.TW`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    
    const data = await fetchWithRetry(url, 15000, 3);
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('No data from Yahoo Finance');
    }
    
    const result = data.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    
    // Get latest valid price
    const closes = quote?.close || [];
    const validCloses = closes.filter(c => c !== null && !isNaN(c));
    const currentPrice = validCloses.length > 0 
      ? validCloses[validCloses.length - 1] 
      : (meta.regularMarketPrice || meta.previousClose);
    
    const prevClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
    const change = currentPrice - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    
    // Get OHLC
    const opens = quote?.open || [];
    const highs = quote?.high || [];
    const lows = quote?.low || [];
    const volumes = quote?.volume || [];
    
    const validOpens = opens.filter(o => o !== null && !isNaN(o));
    const validHighs = highs.filter(h => h !== null && !isNaN(h));
    const validLows = lows.filter(l => l !== null && !isNaN(l));
    const validVolumes = volumes.filter(v => v !== null && !isNaN(v));
    
    return {
      code: stockCode,
      name: meta.shortName || meta.longName || stockCode,
      price: currentPrice || 0,
      open: validOpens[0] || meta.regularMarketOpen || currentPrice,
      high: validHighs.length > 0 ? Math.max(...validHighs) : (meta.regularMarketDayHigh || currentPrice),
      low: validLows.length > 0 ? Math.min(...validLows) : (meta.regularMarketDayLow || currentPrice),
      prevClose: prevClose,
      volume: validVolumes.reduce((a, b) => a + b, 0) || meta.regularMarketVolume || 0,
      change: change,
      changePct: changePct,
      timestamp: new Date().toISOString(),
      source: 'Yahoo'
    };
  } catch (error) {
    console.error(`      ❌ Yahoo error for ${stockCode}: ${error.message}`);
    return null;
  }
}

/**
 * Fetch stock quote from TWSE MIS API (Primary source)
 * @param {TWSERealtimeCrawler} crawler - TWSE crawler instance
 * @param {string} stockCode - Stock code (e.g., "2454")
 * @param {string} [marketType] - Market type ('tse' or 'otc')
 * @returns {Promise<Object|null>} Stock quote data or null if failed
 */
async function fetchTWSEQuote(crawler, stockCode, marketType) {
  try {
    const quote = await crawler.fetchStock(stockCode, marketType);
    if (quote) {
      return {
        code: quote.code,
        name: quote.name,
        price: quote.price,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        prevClose: quote.prevClose,
        volume: quote.volume,
        change: quote.change,
        changePct: quote.changePct,
        timestamp: new Date().toISOString(),
        source: 'TWSE'
      };
    }
    return null;
  } catch (error) {
    console.error(`      ❌ TWSE error for ${stockCode}: ${error.message}`);
    return null;
  }
}

/**
 * Fetch quotes for all stocks with TWSE primary + Yahoo fallback
 * @param {Array} watchlist - List of stock objects
 * @param {TWSERealtimeCrawler} crawler - TWSE crawler instance
 * @returns {Promise<Array<Object>>} Array of stock quotes
 */
async function fetchAllQuotes(watchlist, crawler) {
  const results = [];
  const timestamp = new Date().toISOString();
  
  console.log(`\n🚀 Starting data fetch at ${timestamp}`);
  console.log(`📊 Target: ${watchlist.length} stocks`);
  console.log(`🔧 Source: TWSE Primary + Yahoo Backup`);
  console.log('=' .repeat(70));
  
  // 批次處理以提高效率
  const batchSize = 50; // TWSE API 支援最多 100，但分批更安全
  const totalBatches = Math.ceil(watchlist.length / batchSize);
  
  console.log(`📦 Processing in ${totalBatches} batches (max ${batchSize} per batch)\n`);
  
  for (let i = 0; i < watchlist.length; i += batchSize) {
    const batch = watchlist.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    console.log(`📦 Batch ${batchNum}/${totalBatches}: ${batch.map(s => s.code).join(', ')}`);
    
    try {
      // 嘗試批次查詢 TWSE
      const batchCodes = batch.map(s => s.code);
      const twseQuotes = await crawler.fetchBatch(batchCodes);
      
      // 建立成功查詢的代碼映射
      const successfulCodes = new Set(twseQuotes.map(q => q.code));
      
      // 處理成功的 TWSE 結果
      for (const quote of twseQuotes) {
        if (quote.price > 0) {
          const stock = batch.find(s => s.code === quote.code);
          if (stock) {
            results.push({
              ...quote,
              category: stock.category,
              shares: stock.shares,
              priority: stock.priority,
              timestamp: new Date().toISOString(),
              source: 'TWSE'
            });
            const changeSymbol = quote.change >= 0 ? '📈' : '📉';
            const changeSign = quote.change > 0 ? '+' : '';
            console.log(`   ✅ ${quote.code} ${quote.name}: ${quote.price.toFixed(2)} ${changeSymbol} ${changeSign}${quote.change.toFixed(2)} (${changeSign}${quote.changePct.toFixed(2)}%) [TWSE]`);
          }
        }
      }
      
      // 處理 TWSE 失敗的股票（使用 Yahoo 備份）
      const failedStocks = batch.filter(s => !successfulCodes.has(s.code));
      
      for (const stock of failedStocks) {
        process.stdout.write(`   ⏳ ${stock.code} ${stock.name} (Yahoo backup) ... `);
        
        const yahooQuote = await fetchYahooQuote(stock.code);
        
        if (yahooQuote && yahooQuote.price > 0) {
          results.push({
            ...yahooQuote,
            category: stock.category,
            shares: stock.shares,
            priority: stock.priority,
            source: 'Yahoo'
          });
          const changeSymbol = yahooQuote.change >= 0 ? '📈' : '📉';
          const changeSign = yahooQuote.change > 0 ? '+' : '';
          console.log(`✅ ${yahooQuote.price.toFixed(2)} ${changeSymbol} ${changeSign}${yahooQuote.change.toFixed(2)} (${changeSign}${yahooQuote.changePct.toFixed(2)}%) [Yahoo]`);
        } else {
          console.log('❌ Failed');
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Batch ${batchNum} failed: ${error.message}`);
      
      // 批次失敗時，逐一嘗試 Yahoo
      for (const stock of batch) {
        process.stdout.write(`   ⏳ ${stock.code} ${stock.name} (Yahoo fallback) ... `);
        
        const yahooQuote = await fetchYahooQuote(stock.code);
        
        if (yahooQuote && yahooQuote.price > 0) {
          results.push({
            ...yahooQuote,
            category: stock.category,
            shares: stock.shares,
            priority: stock.priority,
            source: 'Yahoo'
          });
          console.log(`✅ ${yahooQuote.price.toFixed(2)} [Yahoo]`);
        } else {
          console.log('❌ Failed');
        }
      }
    }
    
    console.log(''); // 批次間隔行
  }
  
  console.log('=' .repeat(70));
  
  // 統計來源
  const twseCount = results.filter(r => r.source === 'TWSE').length;
  const yahooCount = results.filter(r => r.source === 'Yahoo').length;
  const successRate = ((results.length / watchlist.length) * 100).toFixed(1);
  
  console.log(`✅ Successfully fetched ${results.length}/${watchlist.length} stocks (${successRate}%)`);
  console.log(`   📊 Source breakdown: TWSE=${twseCount}, Yahoo=${yahooCount}`);
  console.log('');
  
  return results;
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  if (!num || isNaN(num)) return '0';
  return num.toLocaleString('zh-TW');
}

/**
 * Display results in console table format
 * @param {Array} quotes - Array of stock quotes
 */
function displayResults(quotes) {
  console.log('\n📈 REAL-TIME STOCK QUOTES - 即時行情');
  console.log('Generated at:', new Date().toLocaleString('zh-TW', { hour12: false }));
  console.log('-'.repeat(110));
  
  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...quotes].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  // Build table rows
  const tableData = sorted.map(q => {
    const changeStr = q.change > 0 ? `+${q.change.toFixed(2)}` : q.change.toFixed(2);
    const changePctStr = q.changePct > 0 ? `+${q.changePct.toFixed(2)}%` : `${q.changePct.toFixed(2)}%`;
    const priorityEmoji = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[q.priority] || '⚪';
    const sourceEmoji = q.source === 'TWSE' ? '🇹🇼' : '🌐';
    
    return {
      '優先': priorityEmoji,
      '代號': q.code,
      '名稱': q.name.substring(0, 8),
      '股價': q.price.toFixed(2),
      '漲跌': changeStr,
      '漲幅': changePctStr,
      '成交量': formatNumber(q.volume),
      '持有': q.shares,
      '類別': q.category.substring(0, 8),
      '來源': sourceEmoji
    };
  });
  
  console.table(tableData);
  
  // Summary stats
  const upStocks = quotes.filter(q => q.change > 0).length;
  const downStocks = quotes.filter(q => q.change < 0).length;
  const flatStocks = quotes.filter(q => q.change === 0).length;
  const totalChange = quotes.reduce((sum, q) => sum + q.change, 0);
  
  console.log('\n📊 SUMMARY 統計');
  console.log(`   📈 上漲: ${upStocks} 檔 | 📉 下跌: ${downStocks} 檔 | ➖ 平盤: ${flatStocks} 檔`);
  console.log(`   📁 總追蹤: ${quotes.length} 檔 | 平均漲跌: ${(totalChange / quotes.length).toFixed(3)}`);
  console.log('-'.repeat(110) + '\n');
}

/**
 * Save results to CSV file
 * @param {Array} quotes - Array of stock quotes
 * @returns {string} Path to saved file
 */
function saveToCsv(quotes) {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  const filename = `intraday_${dateStr}_${timeStr}.csv`;
  const filepath = path.join(CONFIG.outputDir, filename);
  
  // Build CSV content
  const rows = quotes.map(q => [
    q.timestamp,
    q.code,
    q.name,
    q.price,
    q.change,
    q.changePct,
    q.volume,
    q.open,
    q.high,
    q.low,
    q.prevClose
  ].join(','));
  
  const csv = [CONFIG.csvHeaders.join(','), ...rows].join('\n');
  
  fs.writeFileSync(filepath, '\uFEFF' + csv, 'utf8');
  
  // Also save to latest file for easy access
  const latestPath = path.join(CONFIG.outputDir, 'intraday_latest.csv');
  fs.writeFileSync(latestPath, '\uFEFF' + csv, 'utf8');
  
  console.log(`💾 CSV saved: ${filepath}`);
  console.log(`💾 CSV latest: ${latestPath}`);
  
  return filepath;
}

/**
 * Save results to JSON for API access
 * @param {Array} quotes - Array of stock quotes
 * @returns {string} Path to saved file
 */
function saveToJson(quotes) {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  
  // Source breakdown
  const twseCount = quotes.filter(r => r.source === 'TWSE').length;
  const yahooCount = quotes.filter(r => r.source === 'Yahoo').length;
  
  const data = {
    metadata: {
      generatedAt: date.toISOString(),
      generatedAtLocal: date.toLocaleString('zh-TW', { hour12: false }),
      count: quotes.length,
      source: 'TWSE Intraday Crawler v2.0.0',
      crawler: 'intraday-crawler.js',
      engine: {
        primary: 'TWSE API (twse-realtime-crawler)',
        backup: 'Yahoo Finance',
        twseCount,
        yahooCount
      }
    },
    quotes: quotes
  };
  
  const filepath = path.join(CONFIG.outputDir, `intraday_${dateStr}_${timeStr}.json`);
  const latestPath = path.join(CONFIG.outputDir, 'intraday_latest.json');
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(latestPath, JSON.stringify(data, null, 2), 'utf8');
  
  console.log(`💾 JSON saved: ${filepath}`);
  console.log(`💾 JSON latest: ${latestPath}\n`);
  
  return filepath;
}

/**
 * Main crawler execution
 * @returns {Promise<Object>} Execution result
 */
async function runCrawler() {
  const startTime = Date.now();
  
  try {
    console.log('\n' + '='.repeat(70));
    console.log('  📊 TWSE INTRADAY CRAWLER v2.0.0 (TWSE Primary + Yahoo Backup)');
    console.log('  📋 ZVQ Standard Compliant | JSDoc | Error Handling');
    console.log('  🔧 Powered by twse-realtime-crawler.js');
    console.log('='.repeat(70));
    
    // Setup
    ensureOutputDir();
    const watchlist = loadWatchlist();
    
    console.log(`\n📋 Watchlist loaded: ${watchlist.length} stocks`);
    console.log(`📁 Output directory: ${CONFIG.outputDir}`);
    
    // Initialize TWSE crawler
    const twseCrawler = new TWSERealtimeCrawler({
      maxRetries: CONFIG.crawler.maxRetries,
      rateLimitMs: CONFIG.crawler.rateLimitMs,
      enableCache: CONFIG.crawler.enableCache,
      cacheTTLMs: CONFIG.crawler.cacheTTLMs
    });
    
    console.log(`\n🔧 Crawler config:`);
    console.log(`   Max retries: ${CONFIG.crawler.maxRetries}`);
    console.log(`   Rate limit: ${CONFIG.crawler.rateLimitMs}ms (${(1000/CONFIG.crawler.rateLimitMs).toFixed(1)} req/sec)`);
    console.log(`   Cache enabled: ${CONFIG.crawler.enableCache}`);
    
    // Fetch data
    const quotes = await fetchAllQuotes(watchlist, twseCrawler);
    
    if (quotes.length === 0) {
      throw new Error('No quotes fetched - check data sources');
    }
    
    // Display and save
    displayResults(quotes);
    
    const csvPath = saveToCsv(quotes);
    const jsonPath = saveToJson(quotes);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successRate = ((quotes.length / watchlist.length) * 100).toFixed(1);
    
    console.log('='.repeat(70));
    console.log('✅ CRAWLER COMPLETED SUCCESSFULLY');
    console.log(`   ⏱️  Duration: ${duration}s`);
    console.log(`   📊 Stocks: ${quotes.length}/${watchlist.length} (${successRate}%)`);
    console.log(`   📁 CSV: ${csvPath}`);
    console.log(`   📁 JSON: ${jsonPath}`);
    console.log('='.repeat(70) + '\n');
    
    return {
      success: true,
      count: quotes.length,
      total: watchlist.length,
      successRate: parseFloat(successRate),
      duration: parseFloat(duration),
      csvPath,
      jsonPath,
      quotes
    };
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error('\n❌ CRAWLER FAILED');
    console.error(`   ⏱️  Duration: ${duration}s`);
    console.error(`   💥 Error: ${error.message}`);
    console.error('='.repeat(70) + '\n');
    
    return {
      success: false,
      error: error.message,
      duration: parseFloat(duration)
    };
  }
}

/**
 * Start continuous monitoring with interval
 */
async function startMonitoring() {
  console.log('\n🔔 Starting continuous monitoring...');
  console.log(`   ⏰ Update interval: ${CONFIG.updateInterval / 1000 / 60} minutes`);
  console.log('   Press Ctrl+C to stop\n');
  
  // Run immediately
  await runCrawler();
  
  // Schedule next runs
  setInterval(async () => {
    console.log(`\n⏰ Scheduled update at ${new Date().toLocaleTimeString('zh-TW')}`);
    await runCrawler();
  }, CONFIG.updateInterval);
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--monitor') || args.includes('-m')) {
    startMonitoring();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
TWSE Intraday Crawler v2.0.0 - 台股即時行情爬蟲

Usage: node intraday-crawler.js [options]

Options:
  --monitor, -m    Start continuous monitoring (10min intervals)
  --once, -o       Run once and exit (default)
  --test, -t       Run test mode (fetch 6 problematic stocks)
  --help, -h       Show this help

Features:
  ✅ TWSE API primary source (twse-realtime-crawler.js)
  ✅ Yahoo Finance backup
  ✅ Batch processing for efficiency
  ✅ 20 stocks from watchlist_portfolio.json
  ✅ CSV + JSON output
  ✅ Priority-based sorting (urgent/high/medium/low)
  ✅ Error handling with retry logic
  ✅ ZVQ standard compliant

Archives:
  Input:  ${CONFIG.watchlistPath}
  Output: ${CONFIG.outputDir}

Updated: 2026-02-09
    `);
  } else if (args.includes('--test') || args.includes('-t')) {
    // 測試模式：測試6檔Yahoo抓不到的股票
    console.log('\n🧪 TEST MODE: Testing 6 problematic stocks');
    console.log('These stocks cannot be fetched from Yahoo Finance:\n');
    
    const crawler = new TWSERealtimeCrawler();
    const testStocks = ['5340', '5347', '5425', '6127', '6182', '1815'];
    
    crawler.fetchBatch(testStocks).then(quotes => {
      console.log(`\n✅ Successfully fetched ${quotes.length}/${testStocks.length} stocks\n`);
      
      quotes.forEach(q => {
        const changeSign = q.change >= 0 ? '+' : '';
        console.log(`   ${q.code} ${q.name}: ${q.price.toFixed(2)} (${changeSign}${q.changePct.toFixed(2)}%)`);
      });
      
      process.exit(quotes.length === testStocks.length ? 0 : 1);
    }).catch(error => {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    });
  } else {
    // Default: run once
    runCrawler().then(result => {
      process.exit(result.success ? 0 : 1);
    });
  }
}

// Export for module usage
module.exports = {
  runCrawler,
  startMonitoring,
  loadWatchlist,
  fetchYahooQuote,
  fetchTWSEQuote,
  fetchAllQuotes,
  CONFIG
};
