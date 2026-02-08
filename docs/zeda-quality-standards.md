# Zeda Quality Validation Standards (ZVQ Standards)
# 品質驗證標準規範 v1.0

**專案:** 2026 股票操作系統  
**驗證負責:** Zeda  
**適用對象:** Gemini CLI, OpenCode, 所有開發產出  
**生效日期:** 2026-02-08  

---

## 📋 標準總覽

所有產出必須符合以下 ZVQ (Zeda Quality Validation) 標準，方可通過驗收。

---

## 🎯 標準 1: 程式碼產出 (適用於 OpenCode)

### 1.1 檔案結構規範
```
必須檢查項目:
□ 檔案位於正確路徑 (src/, test/, docs/)
□ 檔案命名: camelCase (例: crawler.js, dataParser.js)
□ 每個檔案開頭有標準註解檔頭
```

**標準檔頭格式:**
```javascript
/**
 * @fileoverview [簡短描述檔案功能]
 * @module [模組名稱]
 * @author [開發者]
 * @version 1.0.0
 * @see [相關文件路徑]
 * 
 * [使用範例]
 * @example
 * const result = await functionName(params);
 */
```

### 1.2 函數規範
```
必須檢查項目:
□ 所有函數有 JSDoc 註解
□ 參數有 @param 標註
□ 回傳值有 @returns 標註
□ 複雜邏輯有 @description 說明
□ 非同步函數標註 @async
```

**標準 JSDoc 格式:**
```javascript
/**
 * [函數功能描述]
 * @description [詳細說明，包含邏輯、邊界條件、錯誤處理]
 * @async
 * @param {string} param1 - [參數說明]
 * @param {number} param2 - [參數說明，單位]
 * @param {Object} [options] - [選項參數]
 * @returns {Promise<Object>} [回傳值說明]
 * @throws {Error} [錯誤類型與條件]
 * @example
 * const result = await functionName('value', 100);
 * // result: { success: true, data: [...] }
 */
```

### 1.3 錯誤處理標準
```
必須檢查項目:
□ 所有外部呼叫有 try-catch
□ 錯誤物件包含 context (哪個函數、參數)
□ 錯誤訊息可讀，包含修復建議
□ 非致命錯誤有 retry 機制
□ 錯誤寫入日誌 (console.error 或 log)
```

**標準錯誤處理模板:**
```javascript
try {
  // 外部呼叫
} catch (error) {
  const enrichedError = new Error(
    `[${functionName}] 失敗: ${error.message}\n` +
    `參數: ${JSON.stringify(params)}\n` +
    `建議: [修復建議]`
  );
  enrichedError.originalError = error;
  enrichedError.code = 'ERROR_CODE';
  console.error(enrichedError);
  throw enrichedError;
}
```

### 1.4 命名規範
```
變數/函數: camelCase (例: fetchData, stockPrice)
常數: UPPER_SNAKE_CASE (例: MAX_RETRY_COUNT)
類別: PascalCase (例: DataCrawler)
檔案: camelCase.js (例: crawler.js)
資料庫表: snake_case (例: daily_prices)
```

### 1.5 日誌規範
```
必須檢查項目:
□ 重要操作有 log (開始/結束/錯誤)
□ 使用 console.log (開發) 或 winston (生產)
□ 日誌包含時間戳、層級、訊息
□ 敏感資料不寫入日誌
```

**標準日誌格式:**
```javascript
console.log(`[${new Date().toISOString()}] [INFO] [Crawler] 開始抓取: ${symbol}`);
console.error(`[${new Date().toISOString()}] [ERROR] [Crawler] 抓取失敗: ${error.message}`);
```

---

## 🧪 標準 2: 測試產出 (適用於 OpenCode)

### 2.1 測試檔案結構
```
test/
├── [module].test.js       # 單元測試
├── integration.test.js   # 整合測試
└── utils/
    └── helpers.js        # 測試工具
```

### 2.2 單元測試標準 (T-003)
```
必須檢查項目:
□ 每個公開函數至少 1 個測試
□ 測試名稱清晰: should [expected] when [condition]
□ 使用 describe/it 結構
□ 有 setup/teardown (beforeEach/afterEach)
□ Mock 外部依賴 (API, DB)
□ 測試隔離，不依賴執行順序
□ 覆蓋率 > 80%
```

**標準測試模板:**
```javascript
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const sinon = require('sinon');

describe('ModuleName', () => {
  let mockDb;
  
  beforeEach(() => {
    mockDb = sinon.stub();
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('functionName', () => {
    it('should return valid data when API responds successfully', async () => {
      // Arrange
      const mockResponse = { data: [...] };
      sinon.stub(axios, 'get').resolves(mockResponse);
      
      // Act
      const result = await functionName('param');
      
      // Assert
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(3);
      expect(axios.get.calledOnce).toBe(true);
    });
    
    it('should throw error with context when API fails', async () => {
      // Arrange
      const apiError = new Error('Network error');
      sinon.stub(axios, 'get').rejects(apiError);
      
      // Act & Assert
      await expect(functionName('param')).rejects.toThrow(/Network error/);
    });
  });
});
```

### 2.3 整合測試標準 (T-004)
```
必須檢查項目:
□ 測試真實流程 (不 mock 核心邏輯)
□ 使用測試資料 (不污染生產資料)
□ 驗證 end-to-end 流程
□ 驗證資料正確性 (型別、值範圍)
□ 測試完成後清理資料
```

**標準整合測試:**
```javascript
// test/integration.test.js
describe('TWSE Crawler Integration', () => {
  const TEST_SYMBOL = '2330';
  const TEST_DATE = '20260206';
  
  afterEach(async () => {
    // 清理測試資料
    await db.prepare('DELETE FROM daily_prices WHERE symbol = ? AND date = ?')
      .run(TEST_SYMBOL, TEST_DATE);
  });
  
  it('should fetch and save 2330 data correctly', async () => {
    // Act
    await crawler.fetchDailyPrices(TEST_DATE, [TEST_SYMBOL]);
    
    // Assert
    const saved = db.prepare('SELECT * FROM daily_prices WHERE symbol = ? AND date = ?')
      .get(TEST_SYMBOL, TEST_DATE);
    
    expect(saved).toBeDefined();
    expect(saved.symbol).toBe(TEST_SYMBOL);
    expect(typeof saved.close).toBe('number');
    expect(saved.close).toBeGreaterThan(0);
    expect(saved.volume).toBeGreaterThan(0);
  });
});
```

---

## 📊 標準 3: 研究產出 (適用於 Gemini)

### 3.1 研究報告格式
```
必須包含章節:
1. 執行摘要 (3-5 點)
2. 詳細發現 (分類列出)
3. 比較分析 (表格)
4. 推薦方案 (含理由)
5. 程式碼範例 (可執行)
6. 風險與限制
```

### 3.2 資料來源標準
```
必須檢查項目:
□ 資料來源可驗證 (URL 或官方文件)
□ 區分官方 vs 第三方
□ 標註資料日期/版本
□ 提供多個方案比較
```

### 3.3 程式碼範例標準
```
必須檢查項目:
□ 完整可執行 (包含 import/require)
□ 有註解說明
□ 錯誤處理
□ 使用範例
□ 說明限制與前提條件
```

---

## ✅ 標準 4: 驗收清單 (Zeda 執行)

### 4.1 程式碼驗收 (T-006)
```
驗證項目:
□ 檔案結構符合 1.1
□ 所有函數有 JSDoc (1.2)
□ 錯誤處理符合 1.3
□ 命名符合 1.4
□ 日誌符合 1.5
□ 無 ESLint 錯誤
□ 無 console.log 殘留 (改用 logger)
□ 無硬編碼密鑰
□ 無死代碼 (unused code)
```

### 4.2 測試驗收
```
驗證項目:
□ npm test 通過
□ 覆蓋率報告 > 80%
□ 無跳過的測試 (.skip)
□ 測試名稱清晰
□ 測試獨立性
```

### 4.3 文件驗收
```
驗證項目:
□ README 更新 (如有變更)
□ 函數文件完整
□ 範例正確可執行
□ 變更紀錄 (CHANGELOG)
```

### 4.4 Git 驗收
```
驗證項目:
□ 提交訊息清晰 (conventional commits)
□ 相關檔案已加入 git
□ .gitignore 正確 (無敏感資料)
□ 無大檔案 (node_modules, logs)
```

---

## 📝 標準 5: 產出格式

### 5.1 程式碼交付格式
```
必須提供:
1. 檔案路徑與名稱
2. 完整程式碼 (無省略)
3. 安裝指令 (npm install ...)
4. 執行指令 (npm test, node ...)
5. 預期輸出範例
```

### 5.2 報告交付格式
```
必須提供:
1. 執行摘要
2. 結構化內容 (標題/列表/表格)
3. 資料來源連結
4. 程式碼範例
5. 明確推薦與下一步
```

---

## 🚀 驗證流程

```
1. 開發者 (OpenCode/Gemini) 完成產出
   ↓
2. 自我檢查 (使用上方 checklist)
   ↓
3. 提交給 Zeda 驗證
   ↓
4. Zeda 執行 T-001 ~ T-006 驗證
   ↓
5. 結果:
   ✅ Pass → 合併至主分支
   ❌ Fail → 回饋修復意見 → 重新提交
```

---

## ⚠️ 常見失敗原因

| 問題 | 嚴重程度 | 修復方式 |
|:-----|:---------|:---------|
| 缺少 JSDoc | Medium | 補上標準註解 |
| 無錯誤處理 | High | 加入 try-catch |
| 測試覆蓋率低 | Medium | 增加測試案例 |
| 命名不規範 | Low | 重構命名 |
| 無日誌 | Medium | 加入 logging |
| 敏感資料硬編碼 | Critical | 改為環境變數 |
| 測試失敗 | High | 修復程式碼或測試 |

---

## 📞 驗證回饋格式

Zeda 將使用以下格式回饋:

```markdown
## 驗證結果: [✅ PASS / ❌ FAIL]

### 通過項目
- [x] 項目 1
- [x] 項目 2

### 待修復項目
- [ ] 項目 3: [說明與建議]
- [ ] 項目 4: [說明與建議]

### 建議改進 (Optional)
- [建議內容]

### 下一步
[明確指示]
```

---

**標準版本:** ZVQ v1.0  
**建立者:** Zeda 🌙  
**適用專案:** 2026 股票操作系統  
**更新日期:** 2026-02-08

---

*「品質不是檢查出來的，是設計出來的」- Zeda*
