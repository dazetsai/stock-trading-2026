# Test Plan: 2026 股票操作系統 - Sprint 1 Validation

**專案:** wk-antigravity/notebooklm  
**測試階段:** Sprint 1 驗收  
**日期:** 2026-02-08  
**測試負責:** Zeda (Quality Validation)  

---

## 🎯 測試目標

驗證 Sprint 1 所有 deliverables 符合 PRD 與 Architecture 設計要求，確保程式碼品質與功能正確性。

---

## 📋 測試範圍

### A. 研究驗證 (Gemini CLI 負責)
- [ ] TWSE API 資料來源確認
- [ ] 資料欄位完整性驗證
- [ ] 抓取限制與替代方案評估

### B. 程式碼實作與測試 (OpenCode 負責)
- [ ] STORY-001: TWSE 爬蟲實作
- [ ] STORY-004: SQLite 資料庫整合
- [ ] 單元測試通過
- [ ] 整合測試通過

---

## 🔍 測試項目詳細

### T-001: API Research Validation (Gemini)
**Assignee:** Gemini CLI  
**Priority:** Must  
**Estimated Time:** 10 分鐘

**測試步驟:**
1. 確認 TWSE 公開 API 端點
2. 驗證資料欄位：symbol, date, open, high, low, close, volume, turnover
3. 檢查請求限制 (rate limit, authentication)
4. 提供可行替代方案 (第三方 API, 網頁爬蟲)

**Acceptance Criteria:**
- [ ] 至少找到 1 個可行的資料來源
- [ ] 提供具體的請求範例 (curl 或 Node.js)
- [ ] 文件化資料欄位對應表

---

### T-002: Crawler Implementation (OpenCode)
**Assignee:** OpenCode  
**Priority:** Must  
**Estimated Time:** 30 分鐘

**測試步驟:**
1. 實作 `src/crawler.js` 模組
2. 整合 `src/database.js` 現有 DB 連線
3. 實作 `fetchDailyPrices(date)` 函數
4. 實作 retry 機制 (最多 3 次)
5. 實作 rate limiting (每秒最多 5 請求)
6. 錯誤處理與日誌記錄

**Acceptance Criteria:**
- [ ] 程式碼風格符合專案規範
- [ ] 所有函數有 JSDoc 註解
- [ ] 使用現有 `src/database.js` 模式
- [ ] 有明確的錯誤處理 try-catch

---

### T-003: Unit Testing (OpenCode)
**Assignee:** OpenCode  
**Priority:** Must  
**Estimated Time:** 15 分鐘

**測試步驟:**
1. 建立 `test/crawler.test.js`
2. 測試 fetchDailyPrices 函數
3. 測試資料解析邏輯
4. 測試錯誤重試機制
5. 測試資料庫寫入

**Acceptance Criteria:**
- [ ] 測試覆蓋率 > 80%
- [ ] 能成功執行 `npm test`
- [ ] 有 mock 避免真實 API 呼叫

---

### T-004: Integration Testing (Zeda + OpenCode)
**Assignee:** Zeda 驗證，OpenCode 修復  
**Priority:** Must  
**Estimated Time:** 10 分鐘

**測試步驟:**
1. 執行整合測試腳本
2. 抓取 2330 (台積電) 2026-02-06 資料
3. 驗證資料寫入 daily_prices 表
4. 驗證欄位型別正確

**Test Script:**
```javascript
// test/integration.test.js
const { fetchDailyPrices } = require('../src/crawler');
const db = require('../src/database');

async function testIntegration() {
  // Test: Fetch and save 2330 data
  const result = await fetchDailyPrices('20260206', ['2330']);
  
  // Verify: Check database
  const saved = db.prepare('SELECT * FROM daily_prices WHERE symbol=? AND date=?')
    .get('2330', '20260206');
    
  // Assertions
  console.assert(saved, 'Data should be saved');
  console.assert(saved.close > 0, 'Close price should be positive');
  console.assert(saved.volume > 0, 'Volume should be positive');
  
  console.log('✅ Integration test passed');
}

testIntegration();
```

**Acceptance Criteria:**
- [ ] 成功抓取台積電資料
- [ ] 資料正確寫入資料庫
- [ ] 欄位型別正確 (數值不為字串)

---

### T-005: Performance Testing (Zeda)
**Assignee:** Zeda  
**Priority:** Should  
**Estimated Time:** 5 分鐘

**測試步驟:**
1. 測試單檔抓取時間
2. 預估全市場 1700 檔抓取時間

**Acceptance Criteria:**
- [ ] 單檔抓取 < 3 秒
- [ ] 全市場抓取 < 30 分鐘

---

### T-006: Code Review (Zeda)
**Assignee:** Zeda  
**Priority:** Must  
**Estimated Time:** 10 分鐘

**Review Checklist:**
- [ ] 程式碼風格一致性
- [ ] 命名規範 (camelCase, 有意義的命名)
- [ ] 錯誤處理完整性
- [ ] 日誌記錄適當
- [ ] 無硬編碼 API key
- [ ] 符合 Architecture 設計

---

## 📝 測試交付物

1. **Test Report** - 測試結果總結
2. **Bug Report** (如有的話) - 錯誤追蹤
3. **Updated Code** - 修復後的程式碼
4. **Documentation** - 測試覆蓋說明

---

## ✅ 驗收標準 (Definition of Done)

Sprint 1 完成條件：
- [ ] T-001 ~ T-006 全部通過
- [ ] 程式碼提交至 Git
- [ ] 測試報告文件化
- [ ] Daze 最終確認

---

## 🚀 執行指令

### Gemini CLI 負責
```bash
# T-001: API Research
gemini --model gemini-2.0-flash "研究台灣證券交易所盤後資料 API：
1. TWSE 是否有公開免費 API？
2. 如果沒有，列出 3 個最佳替代方案 (iTick, Fubon, 其他)
3. 針對每個方案，給出：
   - API 端點格式
   - 認證方式
   - 資料欄位
   - 費用/限制
   - Node.js 範例程式碼
詳細回應，JSON 格式優先。"
```

### OpenCode 負責
```bash
# T-002 ~ T-004: Implementation & Testing
opencode run "實作完整的 TWSE crawler 並測試：

1. 建立 src/crawler.js 抓取台股盤後資料
2. 整合 src/database.js 寫入 SQLite
3. 實作單元測試 test/crawler.test.js
4. 實作整合測試 test/integration.test.js (抓取 2330 測試)
5. 確保 npm test 通過
6. 提交 git commit

參考設計文件：
- PRD: docs/prd-stock-2026.md (STORY-001)
- Architecture: docs/architecture-stock-2026.md
- Sprint Plan: docs/sprint-plan-stock-2026.md

使用專案現有風格，JSDoc 註解，完整錯誤處理。"
```

---

## ⏱️ 時程預估

| 任務 | 預估時間 | 負責 |
|:--|:--|:--|
| T-001 API Research | 10 min | Gemini |
| T-002 Implementation | 30 min | OpenCode |
| T-003 Unit Testing | 15 min | OpenCode |
| T-004 Integration Test | 10 min | OpenCode + Zeda |
| T-005 Performance | 5 min | Zeda |
| T-006 Code Review | 10 min | Zeda |
| **總計** | **~80 min** | |

---

*Test Plan created by Zeda 🌙 | BMAD Method v6 | Ready for execution*
