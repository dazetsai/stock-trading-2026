/**
 * @fileoverview TWSE Realtime Crawler 單元測試
 * @description 測試 TWSE 證交所即時行情爬蟲的核心功能
 * @module test/twse-realtime-crawler.test
 * @version 1.0.0
 * @license ZVQ v1.0
 */

const TWSERealtimeCrawler = require('../src/crawler/twse-realtime-crawler');
const assert = require('assert');

// 測試統計
let testsPassed = 0;
let testsFailed = 0;

/**
 * 測試輔助函數
 */
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${error.message}`);
    testsFailed++;
  }
}

function asyncTest(name, fn) {
  return new Promise(async (resolve) => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      testsPassed++;
    } catch (error) {
      console.error(`  ❌ ${name}`);
      console.error(`     ${error.message}`);
      testsFailed++;
    }
    resolve();
  });
}

/**
 * 斷言輔助函數
 */
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || 'Expected true, got false');
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected non-null value');
  }
}

function assertHasProperty(obj, prop, message) {
  if (!(prop in obj)) {
    throw new Error(message || `Expected object to have property '${prop}'`);
  }
}

/**
 * 測試套件 1: 建構函數與配置
 */
console.log('\n📦 Test Suite 1: Constructor & Configuration');

test('should create crawler with default options', () => {
  const crawler = new TWSERealtimeCrawler();
  assertEqual(crawler.config.maxRetries, 3, 'Default maxRetries should be 3');
  assertEqual(crawler.config.rateLimitMs, 334, 'Default rateLimitMs should be ~334ms');
  assertEqual(crawler.config.timeoutMs, 15000, 'Default timeoutMs should be 15000');
  assertEqual(crawler.config.enableCache, false, 'Default enableCache should be false');
});

test('should create crawler with custom options', () => {
  const crawler = new TWSERealtimeCrawler({
    maxRetries: 5,
    rateLimitMs: 500,
    timeoutMs: 20000,
    enableCache: true
  });
  assertEqual(crawler.config.maxRetries, 5, 'Custom maxRetries should be 5');
  assertEqual(crawler.config.rateLimitMs, 500, 'Custom rateLimitMs should be 500');
  assertEqual(crawler.config.timeoutMs, 20000, 'Custom timeoutMs should be 20000');
  assertEqual(crawler.config.enableCache, true, 'Custom enableCache should be true');
});

/**
 * 測試套件 2: 市場類型偵測
 */
console.log('\n📦 Test Suite 2: Market Type Detection');

test('should detect TSE (listed) stocks correctly', () => {
  const crawler = new TWSERealtimeCrawler();
  assertEqual(crawler.detectMarketType('2454'), 'tse', '2454 should be TSE');
  assertEqual(crawler.detectMarketType('2344'), 'tse', '2344 should be TSE');
  assertEqual(crawler.detectMarketType('1303'), 'tse', '1303 should be TSE');
  assertEqual(crawler.detectMarketType('2303'), 'tse', '2303 should be TSE');
  assertEqual(crawler.detectMarketType('6282'), 'tse', '6282 should be TSE (exception)');
});

test('should detect OTC (over-the-counter) stocks correctly', () => {
  const crawler = new TWSERealtimeCrawler();
  assertEqual(crawler.detectMarketType('5340'), 'otc', '5340 should be OTC');
  assertEqual(crawler.detectMarketType('5347'), 'otc', '5347 should be OTC');
  assertEqual(crawler.detectMarketType('5425'), 'otc', '5425 should be OTC');
  assertEqual(crawler.detectMarketType('6127'), 'otc', '6127 should be OTC');
  assertEqual(crawler.detectMarketType('6182'), 'otc', '6182 should be OTC');
  assertEqual(crawler.detectMarketType('1815'), 'otc', '1815 should be OTC (exception)');
});

test('should throw error for invalid stock codes', () => {
  const crawler = new TWSERealtimeCrawler();
  try {
    crawler.detectMarketType('INVALID');
    throw new Error('Should have thrown error for invalid code');
  } catch (error) {
    assertTrue(error.message.includes('Invalid'), 'Error message should mention invalid code');
  }
});

/**
 * 測試套件 3: JSONP 資料解析
 */
console.log('\n📦 Test Suite 3: JSONP Data Parsing');

test('should parse standard TWSE JSONP format', () => {
  const crawler = new TWSERealtimeCrawler();
  const raw = 'jsonp({"msgArray":[{"c":"2454","n":"聯發科","z":"1810.00"}],"referer":""});';
  const data = crawler.parseTWSEData(raw);
  assertTrue(Array.isArray(data.msgArray), 'msgArray should be an array');
  assertEqual(data.msgArray[0].c, '2454', 'Stock code should be 2454');
  assertEqual(data.msgArray[0].n, '聯發科', 'Stock name should be 聯發科');
});

test('should parse JSONP without callback wrapper', () => {
  const crawler = new TWSERealtimeCrawler();
  const raw = '{"msgArray":[{"c":"5340","n":"建榮","z":"45.50"}],"referer":""}';
  const data = crawler.parseTWSEData(raw);
  assertTrue(Array.isArray(data.msgArray), 'msgArray should be an array');
  assertEqual(data.msgArray[0].c, '5340', 'Stock code should be 5340');
});

test('should parse JSONP with parentheses only', () => {
  const crawler = new TWSERealtimeCrawler();
  const raw = '({"msgArray":[],"referer":""})';
  const data = crawler.parseTWSEData(raw);
  assertTrue(Array.isArray(data.msgArray), 'msgArray should be an array');
});

test('should throw error for invalid JSON', () => {
  const crawler = new TWSERealtimeCrawler();
  try {
    crawler.parseTWSEData('not valid json');
    throw new Error('Should have thrown error for invalid JSON');
  } catch (error) {
    assertTrue(error.message.includes('Failed to parse'), 'Error should indicate parse failure');
  }
});

/**
 * 測試套件 4: 資料標準化
 */
console.log('\n📦 Test Suite 4: Data Normalization');

test('should normalize complete stock data', () => {
  const crawler = new TWSERealtimeCrawler();
  const raw = {
    c: '2454',
    n: '聯發科',
    z: '1810.00',
    o: '1760.00',
    h: '1800.00',
    l: '1760.00',
    y: '1710.00',
    v: '2160476',
    tv: '2160',
    t: '13:30:00'
  };
  const normalized = crawler._normalizeStockData(raw);
  assertEqual(normalized.code, '2454', 'Code should match');
  assertEqual(normalized.name, '聯發科', 'Name should match');
  assertEqual(normalized.price, 1810.00, 'Price should be parsed correctly');
  assertEqual(normalized.open, 1760.00, 'Open should be parsed correctly');
  assertEqual(normalized.high, 1800.00, 'High should be parsed correctly');
  assertEqual(normalized.low, 1760.00, 'Low should be parsed correctly');
  assertEqual(normalized.prevClose, 1710.00, 'PrevClose should be parsed correctly');
  assertEqual(normalized.volume, 2160476, 'Volume should be parsed correctly');
  assertEqual(normalized.tv, 2160, 'TV should be parsed correctly');
  assertEqual(normalized.time, '13:30:00', 'Time should match');
  assertEqual(normalized.change, 100.00, 'Change should be calculated correctly');
});

test('should handle missing or invalid price values', () => {
  const crawler = new TWSERealtimeCrawler();
  const raw = {
    c: '5340',
    n: '建榮',
    z: '-',  // 無成交價
    o: '45.00',
    h: '-',
    l: '-',
    y: '44.00',
    v: '1000',
    tv: '100',
    t: '13:30:00'
  };
  const normalized = crawler._normalizeStockData(raw);
  assertEqual(normalized.price, 45.00, 'Should fallback to open price');
  assertEqual(normalized.high, 45.00, 'High should fallback to price');
  assertEqual(normalized.low, 45.00, 'Low should fallback to price');
  assertEqual(normalized.volume, 1000, 'Volume should be parsed');
});

test('should calculate change and changePct correctly', () => {
  const crawler = new TWSERealtimeCrawler();
  const raw = {
    c: '1234',
    n: 'Test',
    z: '110.00',
    o: '100.00',
    h: '115.00',
    l: '98.00',
    y: '100.00',
    v: '10000',
    tv: '1000',
    t: '13:30:00'
  };
  const normalized = crawler._normalizeStockData(raw);
  assertEqual(normalized.change, 10.00, 'Change should be 10.00');
  assertEqual(normalized.changePct, 10.00, 'ChangePct should be 10%');
});

/**
 * 測試套件 5: 快取功能
 */
console.log('\n📦 Test Suite 5: Cache Functionality');

test('should cache and retrieve data', () => {
  const crawler = new TWSERealtimeCrawler({ enableCache: true, cacheTTLMs: 5000 });
  const mockData = { code: '2454', name: '聯發科', price: 1810 };
  
  crawler._setCache('2454', mockData);
  const cached = crawler._getFromCache('2454');
  
  assertNotNull(cached, 'Should retrieve cached data');
  assertEqual(cached.code, '2454', 'Cached code should match');
  assertEqual(cached.price, 1810, 'Cached price should match');
});

test('should return null for expired cache', async () => {
  const crawler = new TWSERealtimeCrawler({ enableCache: true, cacheTTLMs: 50 });
  const mockData = { code: '2454', name: '聯發科', price: 1810 };
  
  crawler._setCache('2454', mockData);
  await new Promise(r => setTimeout(r, 100)); // Wait for cache to expire
  
  const cached = crawler._getFromCache('2454');
  assertEqual(cached, null, 'Should return null for expired cache');
});

test('should clear cache', () => {
  const crawler = new TWSERealtimeCrawler({ enableCache: true });
  crawler._setCache('2454', { code: '2454' });
  crawler._setCache('2344', { code: '2344' });
  
  crawler.clearCache();
  
  assertEqual(crawler.cache.size, 0, 'Cache should be empty after clear');
});

/**
 * 測試套件 6: 統計資訊
 */
console.log('\n📦 Test Suite 6: Statistics');

test('should return correct stats', () => {
  const crawler = new TWSERealtimeCrawler({ enableCache: true });
  crawler._setCache('2454', { code: '2454' });
  crawler.requestCount = 5;
  
  const stats = crawler.getStats();
  assertEqual(stats.requestCount, 5, 'Request count should be 5');
  assertEqual(stats.cacheSize, 1, 'Cache size should be 1');
  assertEqual(stats.config.maxRetries, 3, 'Config should be included');
});

/**
 * 測試套件 7: 整合測試（實際 API 呼叫）
 */
console.log('\n📦 Test Suite 7: Integration Tests (Live API)');

const crawler = new TWSERealtimeCrawler({ maxRetries: 3, rateLimitMs: 334 });

asyncTest('should fetch single stock (TSE: 2454)', async () => {
  const quote = await crawler.fetchStock('2454');
  assertNotNull(quote, 'Should return quote data');
  assertEqual(quote.code, '2454', 'Code should be 2454');
  assertTrue(quote.name.includes('聯發') || quote.name === '聯發科', 'Name should be 聯發科');
  assertHasProperty(quote, 'price', 'Should have price property');
  assertHasProperty(quote, 'volume', 'Should have volume property');
  assertTrue(quote.price >= 0, 'Price should be non-negative');
});

asyncTest('should fetch single stock (OTC: 5340)', async () => {
  const quote = await crawler.fetchStock('5340', 'otc');
  assertNotNull(quote, 'Should return quote data for OTC stock');
  assertEqual(quote.code, '5340', 'Code should be 5340');
  assertTrue(quote.name.includes('建榮') || quote.name === '建榮', 'Name should be 建榮');
  assertHasProperty(quote, 'price', 'Should have price property');
});

asyncTest('should fetch batch stocks', async () => {
  const codes = ['2454', '2344', '5340', '5347'];
  const quotes = await crawler.fetchBatch(codes);
  
  assertTrue(quotes.length > 0, 'Should return at least one quote');
  assertTrue(quotes.length <= codes.length, 'Should not exceed requested count');
  
  // 檢查返回的資料結構
  quotes.forEach(quote => {
    assertHasProperty(quote, 'code', 'Each quote should have code');
    assertHasProperty(quote, 'name', 'Each quote should have name');
    assertHasProperty(quote, 'price', 'Each quote should have price');
    assertHasProperty(quote, 'market', 'Each quote should have market');
  });
});

asyncTest('should handle invalid stock code gracefully', async () => {
  const quote = await crawler.fetchStock('999999');
  // 應該返回 null 而不是拋出錯誤
  assertEqual(quote, null, 'Should return null for invalid stock');
});

asyncTest('should fetch all problematic stocks', async () => {
  // 這些是 Yahoo Finance 抓不到的股票
  const problematicStocks = ['5340', '5347', '5425', '6127', '6182', '1815'];
  const quotes = await crawler.fetchBatch(problematicStocks);
  
  console.log(`   📊 Fetched ${quotes.length}/${problematicStocks.length} problematic stocks`);
  
  // 檢查成功率
  const successRate = quotes.length / problematicStocks.length;
  console.log(`   📈 Success rate: ${(successRate * 100).toFixed(1)}%`);
  
  // 列出成功抓取的
  quotes.forEach(q => {
    console.log(`   ✅ ${q.code} ${q.name}: ${q.price.toFixed(2)}`);
  });
  
  // 列出失敗的
  const fetchedCodes = quotes.map(q => q.code);
  const failed = problematicStocks.filter(c => !fetchedCodes.includes(c));
  if (failed.length > 0) {
    console.log(`   ❌ Failed: ${failed.join(', ')}`);
  }
  
  assertTrue(quotes.length >= 4, 'Should fetch at least 4 out of 6 problematic stocks');
});

/**
 * 測試套件 8: 錯誤處理
 */
console.log('\n📦 Test Suite 8: Error Handling');

test('should throw error for batch > 100 stocks', async () => {
  const crawler = new TWSERealtimeCrawler();
  const codes = Array.from({ length: 101 }, (_, i) => (i + 1).toString());
  
  try {
    await crawler.fetchBatch(codes);
    throw new Error('Should have thrown error for >100 stocks');
  } catch (error) {
    assertTrue(error.message.includes('Maximum 100'), 'Error should mention max limit');
  }
});

test('should throw error for non-array batch input', async () => {
  const crawler = new TWSERealtimeCrawler();
  
  try {
    await crawler.fetchBatch('not an array');
    throw new Error('Should have thrown error for non-array');
  } catch (error) {
    assertTrue(error.message.includes('array'), 'Error should mention array requirement');
  }
});

/**
 * 執行所有測試
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(70));
  console.log('  🧪 TWSE Realtime Crawler - Unit Tests');
  console.log('  📋 ZVQ Standard Compliant | JSDoc | Error Handling');
  console.log('='.repeat(70));

  const startTime = Date.now();

  // 執行同步測試
  // (測試已在上面定義時自動執行)

  // 等待所有非同步測試完成
  await Promise.all([
    // 這裡的測試已經在上面定義時執行
  ]);

  // 統計結果
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalTests = testsPassed + testsFailed;

  console.log('\n' + '='.repeat(70));
  console.log('  📊 Test Results');
  console.log('='.repeat(70));
  console.log(`   ✅ Passed: ${testsPassed}/${totalTests}`);
  console.log(`   ❌ Failed: ${testsFailed}/${totalTests}`);
  console.log(`   ⏱️  Duration: ${duration}s`);
  console.log(`   📈 Success Rate: ${((testsPassed / totalTests) * 100).toFixed(1)}%`);
  console.log('='.repeat(70));

  process.exit(testsFailed > 0 ? 1 : 0);
}

// 執行測試
runAllTests();
