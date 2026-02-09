/**
 * @fileoverview TWSE 即時行情爬蟲 - Yahoo Finance 版本
 * @description 抓取 20 檔庫存股的即時行情（股價、漲跌、成交量）
 * @module crawler/intraday-crawler-yahoo
 * @version 1.1.0
 * @license ZVQ
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const CONFIG = {
  watchlistPath: path.join(__dirname, '../../data/watchlist_portfolio.json'),
  outputDir: path.join(__dirname, '../../data/intraday'),
  updateInterval: 10 * 60 * 1000, // 10 minutes
  csvHeaders: ['timestamp', 'code', 'name', 'price', 'change', 'change_pct', 'volume', 'open', 'high', 'low', 'prev_close']
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
 * Fetch stock quote from Yahoo Finance
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
 * Fetch stock quote from TWSE MIS API (backup)
 * @param {string} stockCode - Stock code (e.g., "2454")
 * @returns {Promise<Object|null>} Stock quote data or null if failed
 */
async function fetchTWSEQuote(stockCode) {
  try {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${stockCode}.tw`;
    const data = await fetchWithRetry(url, 10000, 2);
    
    if (!data.msgArray || data.msgArray.length === 0) {
      throw new Error('No data from TWSE');
    }
    
    const raw = data.msgArray[0];
    
    // Parse TWSE format
    const price = parseFloat(raw.z || raw.price || 0);
    const prevClose = parseFloat(raw.y || raw.prevClose || 0);
    const open = parseFloat(raw.o || raw.open || 0);
    const high = parseFloat(raw.h || raw.high || 0);
    const low = parseFloat(raw.l || raw.low || 0);
    const volume = parseInt(raw.v || raw.volume || 0, 10);
    
    // If current price is 0, try to use open price
    const effectivePrice = price || open || prevClose;
    const change = effectivePrice - prevClose;
    
    return {
      code: stockCode,
      name: raw.n || raw.name || stockCode,
      price: effectivePrice,
      open: open || prevClose,
      high: high || effectivePrice,
      low: low || effectivePrice,
      prevClose: prevClose,
      volume: volume,
      change: change,
      changePct: prevClose ? (change / prevClose) * 100 : 0,
      timestamp: new Date().toISOString(),
      source: 'TWSE'
    };
  } catch (error) {
    console.error(`      ❌ TWSE error for ${stockCode}: ${error.message}`);
    return null;
  }
}

/**
 * Fetch quotes for all stocks with fallback
 * @param {Array} watchlist - List of stock objects
 * @returns {Promise<Array<Object>>} Array of stock quotes
 */
async function fetchAllQuotes(watchlist) {
  const results = [];
  const timestamp = new Date().toISOString();
  
  console.log(`\n🚀 Starting data fetch at ${timestamp}`);
  console.log(`📊 Target: ${watchlist.length} stocks`);
  console.log('=' .repeat(70));
  
  for (const stock of watchlist) {
    process.stdout.write(`⏳ ${stock.code} ${stock.name} ... `);
    
    // Try Yahoo first, fallback to TWSE
    let quote = await fetchYahooQuote(stock.code);
    let source = 'Yahoo';
    
    if (!quote || quote.price === 0) {
      process.stdout.write('(TWSE backup) ... ');
      quote = await fetchTWSEQuote(stock.code);
      source = quote ? 'TWSE' : null;
    }
    
    if (quote && quote.price > 0) {
      // Merge with watchlist metadata
      quote.category = stock.category;
      quote.shares = stock.shares;
      quote.priority = stock.priority;
      quote.source = source;
      results.push(quote);
      
      const changeSymbol = quote.change >= 0 ? '📈' : '📉';
      const changeSign = quote.change > 0 ? '+' : '';
      console.log(`✅ ${quote.price.toFixed(2)} ${changeSymbol} ${changeSign}${quote.change.toFixed(2)} (${changeSign}${quote.changePct.toFixed(2)}%) [${source}]`);
    } else {
      console.log('❌ Failed');
    }
    
    // Delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 800));
  }
  
  console.log('=' .repeat(70));
  console.log(`✅ Successfully fetched ${results.length}/${watchlist.length} stocks\n`);
  
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
      '來源': q.source
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
  
  const data = {
    metadata: {
      generatedAt: date.toISOString(),
      generatedAtLocal: date.toLocaleString('zh-TW', { hour12: false }),
      count: quotes.length,
      source: 'TWSE Intraday Crawler v1.1.0',
      crawler: 'intraday-crawler.js'
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
    console.log('  📊 TWSE INTRADAY CRAWLER v1.1.0 (Yahoo Finance + TWSE Backup)');
    console.log('  📋 ZVQ Standard Compliant | JSDoc | Error Handling');
    console.log('='.repeat(70));
    
    // Setup
    ensureOutputDir();
    const watchlist = loadWatchlist();
    
    console.log(`\n📋 Watchlist loaded: ${watchlist.length} stocks`);
    console.log(`📁 Output directory: ${CONFIG.outputDir}`);
    
    // Fetch data
    const quotes = await fetchAllQuotes(watchlist);
    
    if (quotes.length === 0) {
      throw new Error('No quotes fetched - check data sources');
    }
    
    // Display and save
    displayResults(quotes);
    
    const csvPath = saveToCsv(quotes);
    const jsonPath = saveToJson(quotes);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('='.repeat(70));
    console.log('✅ CRAWLER COMPLETED SUCCESSFULLY');
    console.log(`   ⏱️  Duration: ${duration}s`);
    console.log(`   📊 Stocks: ${quotes.length}/${watchlist.length}`);
    console.log(`   📁 CSV: ${csvPath}`);
    console.log(`   📁 JSON: ${jsonPath}`);
    console.log('='.repeat(70) + '\n');
    
    return {
      success: true,
      count: quotes.length,
      total: watchlist.length,
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
TWSE Intraday Crawler - 台股即時行情爬蟲

Usage: node intraday-crawler.js [options]

Options:
  --monitor, -m    Start continuous monitoring (10min intervals)
  --once, -o       Run once and exit (default)
  --help, -h       Show this help

Features:
  ✅ Yahoo Finance primary + TWSE backup
  ✅ 20 stocks from watchlist_portfolio.json
  ✅ CSV + JSON output
  ✅ Priority-based sorting (urgent/high/medium/low)
  ✅ Error handling with retry logic
  ✅ ZVQ standard compliant

Files:
  Input:  ${CONFIG.watchlistPath}
  Output: ${CONFIG.outputDir}
    `);
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
  CONFIG
};
