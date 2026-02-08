const Crawler = require('./src/crawler');
const DB = require('./src/database');

/**
 * 完整同步測試 (價量 + 籌碼 + 資券)
 */
async function syncAllData(symbol, date) {
    console.log(`\n🚀 [${date}] 開始同步 ${symbol} 的完整數據...`);

    // 1. 抓取價量
    const priceResult = await Crawler.fetchDailyPrice(symbol, date);
    if (!priceResult.success) {
        console.error(`❌ 價量抓取失敗: ${priceResult.message}`);
        return;
    }
    DB.saveDailyPrice(priceResult.data);
    console.log('✅ 價量存入資料庫');

    // 2. 抓取全市場籌碼與資券 (這部分可以優化為一次性抓取後過濾)
    const instMap = await Crawler.fetchInstitutionalData(date);
    const margMap = await Crawler.fetchMarginData(date);
    console.log(`DEBUG: instMap symbols: ${Object.keys(instMap).length}, margMap symbols: ${Object.keys(margMap).length}`);

    const instData = instMap[symbol] || {};
    const margData = margMap[symbol] || {};

    const fullChipData = {
        symbol: symbol,
        date: date,
        foreign_net: instData.foreign_net,
        trust_net: instData.trust_net,
        dealer_net: instData.dealer_net,
        margin_balance: margData.margin_balance,
        short_balance: margData.short_balance
    };

    DB.saveInstitutionalTrade(fullChipData);
    console.log('✅ 籌碼與資券數據存入資料庫');

    // 3. 驗證
    console.log('📊 最終資料同步結果:');
    console.log(JSON.stringify(fullChipData, null, 2));
}

// 執行測試
syncAllData('2330', '20260206');
