# 爬蟲資料來源擴充方案
## Stock Trading System 2026 - 資料來源擴充計畫

**日期:** 2026-02-09  
**需求:** 擴充爬蟲資料來源，從 20 檔擴充到全市場或更多股票

---

## 一、目前資料來源限制

### 現況
- **主要來源:** Yahoo Finance API (免費)
- **覆蓋範圍:** 僅能抓取大型股，小型股常缺資料
- **更新頻率:** 每 10 分鐘
- **成功率:** ~70% (14/20 檔)

### 問題
1. 小型股 (5340, 5347, 5425, 6127, 6182, 1815) 無法抓取
2. 缺乏即時法人資料 (盤中)
3. 缺乏詳細基本面資料 (營收、EPS)
4. 缺乏選擇權/期貨資料

---

## 二、建議資料來源擴充

### 🔴 Tier 1: 必須新增 (高優先)

#### 1. TWSE 證交所 API (官方)

**即時行情 API:**
```
https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_{code}.tw
```
- ✅ 全部上市股票都有資料
- ✅ 免費使用
- ✅ 盤中即時更新 (5秒延遲)
- ⚠️ 需要處理 JSONP 格式

**收盤資料 API (T84):**
```
https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20260209&stockNo=2454
```
- ✅ 歷史日線資料
- ✅ 價格、成交量、最佳五檔
- ✅ 免費

**實作建議:**
```javascript
// src/crawler/twse-realtime-crawler.js
class TWSERealtimeCrawler {
  async fetchStock(code) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${code}.tw`;
    const response = await fetch(url);
    const data = await response.json();
    return this.parseData(data);
  }
}
```

#### 2. 櫃買中心 API (上櫃股票)

```
https://www.tpex.org.tw/web/stock/trading/intraday/intraday_list.php
```
- ✅ 上櫃股票 (如 5340, 5347 等)
- ✅ 即時行情
- ✅ 免費

### 🟡 Tier 2: 建議新增 (中優先)

#### 3. TWSE 三大法人 API (T86)

**已開發完成!** ✅
```javascript
// src/crawler/institutional-crawler.js 已實作
TWSE T86 API: 外資/投信/自營商買賣超
```

#### 4. 融資融券資料 API

```
https://www.twse.com.tw/exchangeReport/MI_MARGN?response=json&date=20260209&selectType=MS
```
- ✅ 融資餘額、融資買賣
- ✅ 融券餘額、融券賣賣
- ✅ 判斷籌碼面重要指標
- ✅ 免費

**實作:**
```javascript
// src/crawler/margin-crawler.js
class MarginCrawler {
  async fetchMarginData(date) {
    const url = `https://www.twse.com.tw/exchangeReport/MI_MARGN?response=json&date=${date}&selectType=MS`;
    // 抓取全部股票融資券資料
  }
}
```

#### 5. 營收資料 API (公開資訊觀測站)

```
https://mops.twse.com.tw/mops/web/t21sc04_ifrs
```
- ✅ 每月營收資料
- ✅ 年度財報 (EPS、毛利率)
- ✅ 基本面料析必要
- ⚠️ 需要 POST 請求 + Cookie 處理

### 🟢 Tier 3: 進階資料 (低優先)

#### 6. 選擇權/期貨資料

- 臺指期貨持倉
- Put/Call Ratio
- 市場情緒指標

#### 7. 新聞/社群情緒

- Yahoo新聞 API
- PTT 股版情緒分析
- 社群熱門度

#### 8. 國際市場資料

- 美股 (S&P 500, NASDAQ)
- 匯率 (USD/TWD)
- 原物料 (黃金、石油)

---

## 三、擴充後的爬蟲架構

```
src/crawler/
├── intraday-crawler.js          (Yahoo - 現有)
├── twse-realtime-crawler.js     (TWSE即時 - 新增)
├── twse-historical-crawler.js   (TWSE歷史 - 新增)
├── institutional-crawler.js     (三大法人 - 已開發) ✅
├── margin-crawler.js            (融資券 - 新增)
├── fundamental-crawler.js         (營收EPS - 新增)
└── data-aggregator.js           (資料整合器 - 新增)
```

---

## 四、實作計畫

### Phase 1: TWSE 即時行情 (1 天)

**目標:** 解決小型股缺資料問題

**任務:**
1. 開發 `twse-realtime-crawler.js`
2. 修改 `intraday-crawler.js` 使用 TWSE 為主要來源
3. Yahoo 作為備份
4. 測試 20 檔股票成功率

**預期成果:** 成功率從 70% → 95%

### Phase 2: 融資券資料 (1 天)

**目標:** 強化籌碼面分析

**任務:**
1. 開發 `margin-crawler.js`
2. 每日收盤後抓取融資券變化
3. 整合至 `institutional_trades` 表
4. 三維選股引擎加入融資券指標

### Phase 3: 營收資料 (2 天)

**目標:** 補強基本面資料

**任務:**
1. 開發 `fundamental-crawler.js`
2. 建立 `fundamentals` 資料表
3. 抓取每月營收、年度EPS
4. 選股引擎基本面評分實際運作

### Phase 4: 全市場擴充 (2 天)

**目標:** 從 20 檔 → 200 檔或全市場

**任務:**
1. 建立全市場股票清單 (1,700+ 檔)
2. 分批抓取策略 (避免被 ban)
3. 資料庫儲存優化 (分表/索引)
4. 選股引擎正式啟用全市場分析

---

## 五、技術挑戰與解決方案

### 挑戰 1: API 頻率限制

**問題:** TWSE 可能有限制連線頻率

**解決:**
```javascript
// 實作速率限制
const rateLimiter = new RateLimiter({
  tokensPerInterval: 3,
  interval: 'second'
});

async fetchWithLimit(code) {
  await rateLimiter.removeTokens(1);
  return this.fetchStock(code);
}
```

### 挑戰 2: 資料一致性

**問題:** 多來源資料格式不同

**解決:**
```javascript
// data-aggregator.js
class DataAggregator {
  normalizeYahooData(raw) { /* ... */ }
  normalizeTWSEData(raw) { /* ... */ }
  mergeData(sources) {
    // 優先級: TWSE > Yahoo
    return { ...yahoo, ...twse };
  }
}
```

### 挑戰 3: 錯誤處理

**問題:** 部分 API 可能暫時失效

**解決:**
- 實作 3 次重試機制
- 自動切換備份來源
- 記錄錯誤並通知管理員

---

## 六、成本評估

| 資料來源 | 費用 | 資料品質 | 優先級 |
|:---------|:-----|:---------|:-------|
| TWSE API | 免費 | ⭐⭐⭐⭐⭐ | 🔴 必須 |
| 櫃買 API | 免費 | ⭐⭐⭐⭐⭐ | 🔴 必須 |
| 融資券 API | 免費 | ⭐⭐⭐⭐⭐ | 🟡 高 |
| 營收 API | 免費 | ⭐⭐⭐⭐ | 🟡 高 |
| Yahoo | 免費 | ⭐⭐⭐ | 🟢 備份 |
| 付費資料源 | $$$ | ⭐⭐⭐⭐⭐ | ⚪ 未來 |

**總開發成本:** ~4 天工時
**資料取得成本:** $0 (全免費)

---

## 七、下一步建議

立即執行：
1. ✅ 開發 TWSE 即時行情爬蟲 (解決小型股問題)
2. ✅ 整合融資券資料 (強化籌碼面)
3. ⏳ 抓取營收資料 (補強基本面)
4. ⏳ 擴充至全市場 (最終目標)

建議優先執行 **Phase 1 + Phase 2**，約 2 天完成，可立即改善選股品質！

---

**準備好開發 TWSE 爬蟲了嗎？** 🚀
