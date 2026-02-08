# 2026 股票操作系統 (Stock Trading System 2026)

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-green?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/SQLite-3-blue?logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/OpenClaw-AI%20Powered-orange" alt="OpenClaw">
  <img src="https://img.shields.io/badge/BMAD-v6-purple" alt="BMAD">
</p>

<p align="center">
  <b>AI 輔助量化交易平台 - 建立穩定的第二收入來源</b>
</p>

---

## 🎯 專案願景

本專案旨在 2026 年內透過系統化的股市交易架構，建立穩定的第二收入來源。核心目標是利用 AI 與自動化工具，達成每月 **10% 的穩定已實現投資報酬率**。

### 核心價值
- 🤖 **AI 輔助開發** - 使用 OpenCode 與 Gemini CLI 加速實作
- 📊 **數據驅動決策** - 基於 VAO/MTM 指標的科學化選股
- 🔔 **自動化通知** - Telegram Bot 即時推送交易訊號
- 📈 **回測驗證** - 歷史資料回測確保策略有效性

---

## 🏗️ 技術架構

### 技術堆疊
| 層級 | 技術 | 用途 |
|:-----|:-----|:-----|
| **執行環境** | Node.js 20+ | 後端執行環境 |
| **資料庫** | SQLite 3 | 輕量級本地資料儲存 |
| **資料抓取** | Axios | TWSE API 整合 |
| **指標計算** | 自研演算法 | VAO、MTM 技術指標 |
| **通知** | Telegram Bot API | 即時訊號推送 |
| **AI 輔助** | OpenCode/Gemini | 程式碼開發與研究 |
| **品質保證** | ZVQ Standards | 程式碼品質驗證 |

### 系統架構
```
┌─────────────────────────────────────────────────────────┐
│  資料層 (Data Layer)                                    │
│  ├── TWSE API (盤後價量)                                │
│  ├── TWSE API (法人籌碼)                                │
│  └── 分點當沖資料 (未來)                                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  分析引擎 (Analysis Engine)                              │
│  ├── VAO (量價爆發指標)                                │
│  ├── MTM (動能指標)                                    │
│  └── MA (均線系統)                                      │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  選股引擎 (Screener Engine)                             │
│  ├── 技術面評分 (35%)                                   │
│  ├── 籌碼面評分 (35%)                                   │
│  └── 量能面評分 (30%)                                   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  通知層 (Notification)                                   │
│  ├── Telegram Bot (每日報表)                            │
│  ├── 風控警示 (停損/停利)                              │
│  └── 選股訊號 (🔥強勢關注)                             │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 功能規格

### 已實作功能 ✅
- [x] BMAD 設計階段 (Phase 1-3)
- [x] 系統架構設計
- [x] 三維選股引擎設計
- [x] QMD 知識庫系統
- [x] GitHub 平台整合

### 開發中 🚧
- [ ] **STORY-001** TWSE 盤後資料抓取
- [ ] **STORY-004** SQLite Schema 完善
- [ ] **STORY-005** VAO 量價爆發指標
- [ ] **STORY-006** MTM 動能指標
- [ ] **STORY-010** Telegram Bot 整合

### 待開發 📅
- [ ] **STORY-011** 三維選股引擎實作
- [ ] **STORY-007** 回測系統
- [ ] **STORY-010B** 每日自動報表

---

## 🚀 快速開始

### 系統需求
- Node.js 20+
- SQLite 3
- Git

### 安裝步驟

```bash
# 1. 複製專案
git clone https://github.com/dazetsai/stock-trading-2026.git
cd stock-trading-2026

# 2. 安裝依賴
npm install

# 3. 設定環境變數
cp .env.example .env
# 編輯 .env 檔案，填入你的 Telegram Bot Token

# 4. 初始化資料庫
node scripts/init-db.js

# 5. 執行測試
npm test

# 6. 啟動開發
npm run dev
```

### 基本使用

```javascript
// 抓取單檔股票資料
const crawler = require('./src/crawler');
const data = await crawler.fetchDailyPrice('2330', '20260206');
console.log(data);

// 執行選股
const screener = require('./src/screener');
const picks = await screener.run('20260206');
console.log(picks);
```

---

## 📊 選股系統

### 三維評分模型

| 維度 | 權重 | 關鍵指標 | 說明 |
|:-----|:-----|:---------|:-----|
| **技術面** | 35% | MA趨勢、價格位置、波動收斂 | 確認上升趨勢 |
| **籌碼面** | 35% | 外資連續、投信布局、資券健康 | 法人同步做多 |
| **量能面** | 30% | VAO量價爆發、MTM動能 | 量能確認突破 |

### 訊號分級
- 🔥 **Tier 1 (強勢關注)** - 總分 ≥ 75，單一維度 ≥ 60
- ✅ **Tier 2 (穩健清單)** - 總分 60-74，無維度 < 50
- 👀 **Tier 3 (觀察追蹤)** - 總分 45-59

---

## 🧪 測試

```bash
# 單元測試
npm run test:unit

# 整合測試
npm run test:integration

# 覆蓋率報告
npm run test:coverage
```

---

## 🛡️ 品質標準 (ZVQ)

本專案採用 **Zeda Quality Validation (ZVQ) v1.0** 品質標準：

- ✅ **JSDoc 文件** - 所有函數完整註解
- ✅ **錯誤處理** - Enriched errors with context
- ✅ **單元測試** - 覆蓋率 > 80%
- ✅ **命名規範** - camelCase / UPPER_SNAKE_CASE
- ✅ **日誌記錄** - ISO timestamp + level + context

詳細標準見：[ZVQ Standards](./docs/zeda-quality-standards.md)

---

## 🗄️ 資料庫結構

```sql
-- 每日價量資料
CREATE TABLE daily_prices (
    symbol TEXT,
    date TEXT,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume INTEGER,
    turnover INTEGER,
    transactions INTEGER,
    PRIMARY KEY(symbol, date)
);

-- 法人籌碼資料
CREATE TABLE institutional_trades (
    symbol TEXT,
    date TEXT,
    foreign_net INTEGER,
    trust_net INTEGER,
    dealer_net INTEGER,
    margin_balance INTEGER,
    short_balance INTEGER,
    PRIMARY KEY(symbol, date)
);

-- 選股訊號
CREATE TABLE screener_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    date TEXT,
    signal_date TEXT,
    technical_score REAL,
    institutional_score REAL,
    volume_score REAL,
    total_score REAL,
    tier TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

完整 Schema：[Architecture Doc](./docs/architecture-stock-2026.md)

---

## 📁 專案結構

```
stock-trading-2026/
├── src/                          # 原始碼
│   ├── crawler.js                # TWSE 資料抓取
│   ├── database.js               # SQLite 資料庫操作
│   ├── indicators/               # 技術指標
│   │   ├── vao.js                # 量價爆發
│   │   └── mtm.js                # 動能指標
│   ├── screener.js               # 選股引擎
│   ├── risk.js                   # 風控引擎
│   └── telegram.js               # Telegram Bot
├── test/                         # 測試檔案
│   ├── crawler.test.js
│   ├── screener.test.js
│   └── integration.test.js
├── docs/                         # 文件
│   ├── product-brief-*.md        # 願景
│   ├── prd-*.md                  # 需求
│   ├── architecture-*.md         # 架構
│   ├── screener-design-*.md      # 選股設計
│   ├── sprint-plan-*.md          # Sprint 規劃
│   ├── zeda-quality-standards.md # 品質標準
│   ├── ai-devops-evaluation.md   # DevOps 評估
│   └── PROJECT_QMD.md            # QMD 知識庫
├── .github/workflows/            # CI/CD
│   └── ci.yml                    # GitHub Actions
├── stock_data.db                 # SQLite 資料庫
├── package.json
└── README.md                     # 本檔案
```

---

## 🎯 Sprint 進度

### Sprint 1 (進行中) - 基礎建設
- **目標:** 資料抓取 + 指標計算 + Telegram
- **時間:** Week 1-2
- **點數:** 26 points

| STORY | 任務 | 狀態 |
|:-----|:-----|:-----|
| STORY-001 | TWSE 爬蟲 | 🚧 開發中 |
| STORY-002 | 法人資料 | ⏳ 待開始 |
| STORY-004 | SQLite Schema | ⏳ 待開始 |
| STORY-005 | VAO 指標 | ⏳ 待開始 |
| STORY-006 | MTM + MA | ⏳ 待開始 |
| STORY-010 | Telegram Bot | ⏳ 待開始 |
| STORY-015 | GitHub 設置 | ✅ 完成 |

### Sprint 2 (規劃中) - 核心功能
- **目標:** 選股引擎 + 回測 + 自動化
- **時間:** Week 3-4

---

## 🤝 開發團隊

| 角色 | 說明 |
|:-----|:-----|
| **Daze** | 專案主導、決策者、投資策略 |
| **Zeda** 🌙 | AI 助手、品質驗證、技術顧問 |
| **OpenCode** | AI 程式碼開發 |
| **Gemini CLI** | AI 研究與分析 |

---

## 📝 文件索引

| 類型 | 文件 | 說明 |
|:-----|:-----|:-----|
| 願景 | [Product Brief](./docs/product-brief-stock-2026.md) | 專案目標與範圍 |
| 需求 | [PRD](./docs/prd-stock-2026.md) | 14 項功能需求 |
| 架構 | [Architecture](./docs/architecture-stock-2026.md) | 系統設計與資料模型 |
| 詳設 | [Screener Design](./docs/screener-design-stock-2026.md) | 三維選股引擎 |
| 計畫 | [Sprint Plan](./docs/sprint-plan-stock-2026.md) | Sprint 規劃 |
| 測試 | [Test Plan](./docs/test-plan-sprint1-2026.md) | 測試策略 |
| 品質 | [ZVQ Standards](./docs/zeda-quality-standards.md) | 品質驗證標準 |
| DevOps | [AI DevOps Eval](./docs/ai-devops-evaluation.md) | 平台評估 |
| 知識庫 | [QMD](./docs/PROJECT_QMD.md) | 可搜尋專案記憶 |
| 總覽 | [Summary](./PROJECT_SUMMARY.md) | 進度總結 |

---

## ⚠️ 免責聲明

⚠️ **重要提示：**

本系統為教育與研究用途開發的量化交易工具，**不構成投資建議**。

- 股市投資有風險，過去績效不代表未來結果
- 本系統基於歷史資料與技術指標，不保證未來績效
- 使用前請充分了解策略風險，建議先用小部位測試
- 實際交易請自行判斷並承擔風險

**使用本系統即表示您理解並同意上述風險。**

---

## 📄 授權

MIT License - 詳見 [LICENSE](./LICENSE)

---

## 🙏 特別感謝

- **BMAD Method v6** - 專案管理方法論
- **OpenClaw** - AI 助手執行環境
- **OpenCode/Gemini** - AI 開發輔助
- **TWSE** - 台灣證券交易所資料

---

<p align="center">
  <b>由 Daze 與 Zeda 🌙 共同打造</b>
</p>

<p align="center">
  <i>「系統化交易，科學化投資」</i>
</p>
