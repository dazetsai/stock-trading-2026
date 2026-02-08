# 選股系統設計文件 (Stock Selection System Design)

**專案:** 2026 股票操作  
**文件類型:** 技術設計補充 (Phase 3.5 - Solutioning Extension)  
**日期:** 2026-02-08  
**版本:** 1.0  
**關聯:** Sprint 2 - STORY-011 三維選股引擎實作  

---

## 1. 系統概述

### 1.1 設計目標
建立基於多維度分析的智能化選股引擎，透過技術面、籌碼面、量能面三維度交叉驗證，篩選出高勝率的「🔥強勢關注」標的。

### 1.2 核心指標回顧
根據 PRD 定義：
- **VAO (Volume-Price Action Opportunity)** - 量價爆發指標
- **MTM (Momentum)** - 價格動能指標
- **MA (Moving Average)** - 均線趨勢框架

---

## 2. 三維選股模型

### 2.1 第一維：技術面 (Technical Dimension)

#### 2.1.1 趨勢確認指標
| 指標 | 權重 | 條件 | 計算方式 |
|------|------|------|----------|
| **趨勢方向** | 25% | 收盤價 > MA20 > MA60 | 確認中期上升趨勢 |
| **價格位置** | 20% | 收盤價在 MA20 的 ±3% 範圍內 | 避免過高追價 |
| **波動收斂** | 15% | (最高-最低)/收盤 < 4% | 篩選穩定盤整標的 |

#### 2.1.2 買點訊號 (Entry Signals)
```
條件 A: 價格突破前高 + 量能 > 5日均量 1.2倍
條件 B: 收盤價站上 MA10 + MTM > 0 且遞增
條件 C: 回檔至 MA20 附近 + 出現止跌 K 線

買入訊號 = (A AND B) OR (B AND C)
```

---

### 2.2 第二維：籌碼面 (Institutional Dimension)

#### 2.2.1 法人動向分析
| 指標 | 權重 | 條件 | 資料來源 |
|------|------|------|----------|
| **外資連續** | 25% | 連 3 日買超 或 5日累計買超 > 1000張 | institutional_trades.foreign_net |
| **投信布局** | 20% | 單日買超 > 500張 或 連續買超 | institutional_trades.trust_net |
| **自營動向** | 10% | 避險部位減少 + 自營買超 | institutional_trades.dealer_net |
| **資券變化** | 15% | 融資餘額減少 或 券資比 < 20% | margin_balance / short_balance |

#### 2.2.2 籌碼集中度評分
```
籌碼健康度 = (外資連續買超 * 0.4) + (投信布局 * 0.35) + (自營動向 * 0.15) + (資券健康 * 0.1)

等級：
- 🔥 強勢 (≥ 80分): 法人同步做多
- ✅ 健康 (60-79分): 主流籌碼穩定
- ⚠️ 觀察 (40-59分): 籌碼有分歧
- ❌ 迴避 (< 40分): 法人出脫
```

---

### 2.3 第三維：量能面 (Volume Dimension)

#### 2.3.1 VAO 量價爆發指標 (核心)
**定義：** 識別量能異常放大且價格同步突破的強勢訊號

```javascript
// VAO 計算邏輯
function calculateVAO(data) {
  const today = data[0];
  const avgVolume5 = average(data.slice(0, 5).map(d => d.volume));
  const avgVolume20 = average(data.slice(0, 20).map(d => d.volume));
  const priceChange = (today.close - data[1].close) / data[1].close * 100;
  const turnoverRate = today.volume / totalShares * 100; // 周轉率
  
  // VAO Score (0-100)
  let vaoScore = 0;
  
  // 量能條件 (50%)
  if (today.volume > avgVolume5 * 1.5) vaoScore += 25;
  if (today.volume > avgVolume20 * 2.0) vaoScore += 25;
  
  // 價格條件 (30%)
  if (priceChange > 3) vaoScore += 15;
  if (priceChange > 5) vaoScore += 15;
  
  // 周轉條件 (20%)
  if (turnoverRate > 5) vaoScore += 10;
  if (turnoverRate > 10) vaoScore += 10;
  
  return {
    score: vaoScore,
    signal: vaoScore >= 70 ? 'STRONG' : vaoScore >= 50 ? 'MODERATE' : 'WEAK',
    details: {
      volumeRatio5: today.volume / avgVolume5,
      volumeRatio20: today.volume / avgVolume20,
      priceChange: priceChange,
      turnoverRate: turnoverRate
    }
  };
}
```

#### 2.3.2 MTM 動能指標
**定義：** 識別價格加速度與動能持續性

```javascript
// MTM 計算邏輯
function calculateMTM(data, period = 10) {
  const closes = data.map(d => d.close).slice(0, period + 5);
  
  // MTM = 當日收盤價 - N日前收盤價
  const mtm = closes[0] - closes[period];
  
  // MTMMA = MTM 的 M 日移動平均
  const mtmSeries = [];
  for (let i = 0; i < 5; i++) {
    mtmSeries.push(closes[i] - closes[i + period]);
  }
  const mtmma = average(mtmSeries);
  
  // 動能方向
  const momentum = mtm > mtmma ? 'ACCELERATING' : 'DECELERATING';
  
  // 訊號強度
  let signalStrength = 0;
  if (mtm > 0 && mtmma > 0) signalStrength += 40; // 雙正
  if (mtm > mtmma) signalStrength += 30; // 加速
  if (closes[0] > closes[1]) signalStrength += 30; // 連續上漲
  
  return {
    mtm: mtm,
    mtmma: mtmma,
    direction: momentum,
    signal: signalStrength >= 70 ? 'STRONG_BUY' : 
            signalStrength >= 50 ? 'BUY' : 
            signalStrength >= 30 ? 'HOLD' : 'WEAK'
  };
}
```

---

## 3. 綜合選股評分模型

### 3.1 加權評分公式
```
總分 = (技術面得分 × 0.35) + (籌碼面得分 × 0.35) + (量能面得分 × 0.30)

門檻：
- 🔥 強勢關注: 總分 ≥ 75 且 單一維度不低於 60
- ✅ 穩健選擇: 總分 60-74 且 無維度低於 50
- 👀 觀察清單: 總分 45-59
- ❌ 不符合: 總分 < 45
```

### 3.2 篩選流程圖
```
Step 1: 全市場資料載入 (約 1700 檔台股)
    ↓
Step 2: 基礎過濾 (流動性篩選)
    - 日均量 > 1000張
    - 收盤價 > 10元
    - 排除 ETN/權證
    ↓
Step 3: 三維指標計算
    - 技術面: 趨勢 + 均線 + 型態
    - 籌碼面: 法人 + 資券
    - 量能面: VAO + MTM
    ↓
Step 4: 綜合評分與排名
    ↓
Step 5: 分級輸出
    - 🔥 Tier 1 (Top 10): 強勢關注
    - ✅ Tier 2 (Top 11-30): 穩健清單
    - 👀 Tier 3: 觀察追蹤
```

---

## 4. 資料庫擴展設計

### 4.1 新增資料表
```sql
-- 選股訊號紀錄表
CREATE TABLE screener_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    signal_date TEXT NOT NULL, -- 產生訊號日期
    technical_score REAL,      -- 技術面得分
    institutional_score REAL,  -- 籌碼面得分
    volume_score REAL,         -- 量能面得分
    total_score REAL,          -- 總分
    tier TEXT,                 -- Tier 1/2/3
    vao_score REAL,
    mtm_score REAL,
    ma_trend TEXT,             -- 均線趨勢狀態
    foreign_sentiment TEXT,    -- 外資情緒
    notes TEXT,                -- 額外備註
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(symbol, date) REFERENCES daily_prices(symbol, date)
);

-- 選股歷史績效追蹤
CREATE TABLE screener_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    signal_date TEXT NOT NULL,
    entry_price REAL,
    current_price REAL,
    return_pct REAL,
    max_return_pct REAL,
    max_drawdown_pct REAL,
    holding_days INTEGER,
    exit_signal TEXT,
    exited BOOLEAN DEFAULT 0,
    exit_date TEXT,
    FOREIGN KEY(symbol, signal_date) REFERENCES screener_signals(symbol, signal_date)
);
```

---

## 5. 系統模組設計

### 5.1 模組架構
```
src/
├── screener/
│   ├── index.js                 # 主入口
│   ├── filters/
│   │   ├── liquidityFilter.js   # 流動性篩選
│   │   └── priceFilter.js       # 價格篩選
│   ├── indicators/
│   │   ├── technical.js         # 技術面計算
│   │   ├── institutional.js     # 籌碼面計算
│   │   ├── vao.js               # VAO 指標
│   │   └── mtm.js               # MTM 指標
│   ├── scoring/
│   │   ├── technicalScorer.js   # 技術面評分
│   │   ├── institutionalScorer.js
│   │   ├── volumeScorer.js
│   │   └── compositeScorer.js   # 綜合評分
│   ├── output/
│   │   ├── telegramFormatter.js # Telegram 格式
│   │   └── reportGenerator.js   # 報表產生
│   └── database/
│       └── signalRecorder.js    # 訊號寫入資料庫
```

### 5.2 核心類別設計
```javascript
// ScreenerEngine.js - 選股引擎主類別
class ScreenerEngine {
  constructor(db) {
    this.db = db;
    this.technicalAnalyzer = new TechnicalAnalyzer();
    this.institutionalAnalyzer = new InstitutionalAnalyzer();
    this.volumeAnalyzer = new VolumeAnalyzer();
    this.scorer = new CompositeScorer();
  }
  
  async run(date = null) {
    const targetDate = date || this.getLatestTradingDay();
    
    // 1. 載入全市場資料
    const allStocks = await this.loadAllStocks(targetDate);
    
    // 2. 基礎篩選
    const filtered = this.applyFilters(allStocks);
    
    // 3. 三維分析
    const analyzed = await Promise.all(
      filtered.map(stock => this.analyzeThreeDimensions(stock))
    );
    
    // 4. 綜合評分
    const scored = this.scorer.scoreAll(analyzed);
    
    // 5. 分級與輸出
    const results = this.categorize(scored);
    
    // 6. 儲存訊號
    await this.saveSignals(results, targetDate);
    
    return results;
  }
  
  async analyzeThreeDimensions(stockData) {
    const [technical, institutional, volume] = await Promise.all([
      this.technicalAnalyzer.analyze(stockData),
      this.institutionalAnalyzer.analyze(stockData),
      this.volumeAnalyzer.analyze(stockData)
    ]);
    
    return {
      symbol: stockData.symbol,
      technical,
      institutional,
      volume,
      prices: stockData.prices,
      trades: stockData.trades
    };
  }
}
```

---

## 6. Telegram 通知格式

### 6.1 每日選股報表
```
🔥 【2026/02/08 選股快報】

━━━━━━━━━━━━━━━━━━━━
📊 市場概況
• 全市場: 1,687 檔
• 符合篩選: 23 檔
• 強勢關注: 3 檔

━━━━━━━━━━━━━━━━━━━━
🔥 Tier 1 - 強勢關注 (Top 3)

1️⃣ 2330 台積電
   總分: 87/100
   📈 技術: 85 | 🏦 籌碼: 88 | 📊 量能: 90
   ➤ VAO: 75 (量價齊揚)
   ➤ 外資: 連3買 +6,574張
   ➤ 均線: 站穩MA20，趨勢向上
   💰 收盤: 1,780 (+2.01%)

2️⃣ 2317 鴻海
   ...

3️⃣ 2454 聯發科
   ...

━━━━━━━━━━━━━━━━━━━━
✅ Tier 2 - 穩健清單 (Top 10)
[略]

📌 風險提示: 以上為系統篩選結果，僅供參考，投資需自行判斷。
```

---

## 7. 實作 Roadmap (Sprint 2 拆解)

### Week 1: 指標引擎完成
- [ ] Day 1-2: VAO 指標實作 + 測試
- [ ] Day 3-4: MTM 指標實作 + 測試
- [ ] Day 5: 技術面分析模組 (均線系統)

### Week 2: 籌碼與整合
- [ ] Day 6-7: 籌碼面分析模組 (法人連續追蹤)
- [ ] Day 8-9: 綜合評分引擎
- [ ] Day 10: Telegram 整合 + 報表格式

### Week 3: 回測驗證
- [ ] Day 11-12: 歷史訊號回測
- [ ] Day 13-14: 勝率/期望值統計
- [ ] Day 15: 參數優化

---

## 8. 與現有系統整合

### 8.1 資料流整合
```
TWSE API → Crawler → SQLite → 
  ├── IndicatorEngine (VAO/MTM/MA)
  ├── ScreenerEngine (三維評分)
  ├── RiskEngine (風控監測)
  └── Telegram Bot (通知發送)
```

### 8.2 排程設計
```javascript
// 盤後自動執行 (15:30 後)
const schedule = {
  '15:30': 'crawlDailyData',      // 抓取價量
  '15:45': 'crawlInstitutional',  // 抓取法人
  '16:00': 'calculateIndicators', // 計算指標
  '16:15': 'runScreener',         // 執行選股
  '16:30': 'sendTelegramReport'   // 發送報表
};
```

---

## 9. 風險與免責聲明

### 9.1 系統限制
- ⚠️ 選股系統基於歷史資料與技術指標，不保證未來績效
- ⚠️ 回測結果可能過度擬合 (Overfitting)
- ⚠️ 需搭配人工判斷與風險管理

### 9.2 使用建議
- 先用小部位測試策略有效性
- 嚴格遵守停損停利 SOP
- 定期檢視與優化選股參數

---

**下一步建議:**
1. 實作 VAO/MTM 指標計算模組 (Sprint 1)
2. 建立三維評分引擎雛型 (Sprint 2)
3. 整合至 Telegram 通知系統 (Sprint 2)

---

## 10. 文件連結

### 相關文件
- **PRD:** [prd-stock-2026.md](./prd-stock-2026.md) - 需求規格 (FR-005~007)
- **Architecture:** [architecture-stock-2026.md](./architecture-stock-2026.md) - 系統架構
- **Sprint Plan:** [sprint-plan-stock-2026.md](./sprint-plan-stock-2026.md) - 實作時程 (STORY-011)
- **總覽:** [project-overview-stock-2026.md](./project-overview-stock-2026.md)

### BMAD 流程位置
- **Phase:** 3 (Solutioning) - 詳細技術設計
- **Precedes:** Phase 4 (Implementation)
- **Related:** System Architecture (同屬 Phase 3)

---
*Design by Zeda 🌙 | BMAD Method v6 | Phase 3.5 Solutioning*

---

*Document Status: ✅ Complete | Cross-references updated 2026-02-08*
