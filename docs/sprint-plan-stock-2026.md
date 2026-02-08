# Sprint Plan: 2026 股票操作

**Date:** 2026-02-08
**Scrum Master:** Antigravity (Agent)
**Version:** 1.0
**Project Level:** 2 (中型專案)
**Estimated Duration:** 2 Sprints (4 weeks)

---

## 相關文件
- **Product Brief:** [product-brief-stock-2026.md](./product-brief-stock-2026.md)
- **PRD:** [prd-stock-2026.md](./prd-stock-2026.md)
- **Architecture:** [architecture-stock-2026.md](./architecture-stock-2026.md)
- **Screener Design:** [screener-design-stock-2026.md](./screener-design-stock-2026.md)
- **Project Overview:** [project-overview-stock-2026.md](./project-overview-stock-2026.md)

---

## Sprint 1: 基礎數據管道與指標核心 (Foundation & Core)
**Duration:** 2 weeks  
**Goal:** 建立穩定的數據抓取流程，並落實 VAO/MTM 核心指標運算與 Telegram 基礎整合。  
**總點數:** 23 Points

| ID            | Title                       | Epic    | Points | Priority |
| :------------ | :-------------------------- | :------ | :----- | :------- |
| **STORY-001** | TWSE 盤後價量爬蟲實作       | EPIC-01 | 5      | Must     |
| **STORY-002** | 法人買賣超與資券資料對接    | EPIC-01 | 5      | Must     |
| **STORY-004** | SQLite 資料庫與 Schema 設計 | EPIC-01 | 3      | Must     |
| **STORY-005** | VAO (量價爆發) 指標演算實作 | EPIC-02 | 3      | Must     |
| **STORY-006** | MTM 動能與 MA 均線演算實作  | EPIC-02 | 2      | Should   |
| **STORY-010** | Telegram Bot API 整合與測試 | EPIC-04 | 5      | Must     |
| **STORY-015** | GitHub 平台設置與 AI DevOps 基礎 | EPIC-04 | 3      | Must     | ⭐ NEW |

**Sprint 1 合計：26 Points** (含 STORY-015 AI DevOps 設置)

---

## Sprint 2: 深度分析、回測與選股系統 (Execution & Validation)
**Duration:** 2 weeks  
**Goal:** 實作三維選股引擎、回測驗證系統並完成 Telegram 自動化通知。  
**總點數:** 24 Points

| ID | Title | Epic | Points | Priority | 說明 |
|:---|:------|:-----|:-------|:---------|:-----|
| **STORY-010** | 全市場收盤數據同步 | EPIC-01 | 5 | Must | 每日自動抓取並更新全市場 ~1700 檔股票資料 |
| **STORY-011A** | 技術面分析模組 | EPIC-03 | 3 | Must | 實作趨勢確認、均線系統、買點訊號邏輯 |
| **STORY-011B** | 籌碼面分析模組 | EPIC-03 | 3 | Must | 法人連續追蹤、籌碼健康度評分 |
| **STORY-011C** | VAO/MTM 指標引擎 | EPIC-02 | 3 | Must | 量價爆發與動能指標計算實作 |
| **STORY-011D** | 綜合評分引擎 | EPIC-03 | 3 | Must | 三維加權評分、Tier 分級邏輯 |
| **STORY-007** | 自動化回測引擎 | EPIC-02 | 5 | Should | 歷史訊號回測、勝率/MDD/期望值統計 |
| **STORY-010B** | Telegram Bot 實機 | EPIC-04 | 2 | Must | 每日選股報表自動發送 |

**Sprint 2 合計：24 Points**

---

## Sprint 1 詳細任務說明

### STORY-015: GitHub 平台設置與 AI DevOps 基礎 ⭐ NEW
**詳細內容:**
- 建立 GitHub Repository (公開或私有)
- 設定 Branch Protection (main 分支保護)
- 啟用 GitHub Actions (基礎 workflow)
- 設定 Issue Templates (STORY/BUG/FEATURE)
- 建立 GitHub Project Board (Kanban 看板)
- 設定 PR Template (含 ZVQ 驗證清單)
- 配置 GitHub webhook (OpenCode 整合準備)

**驗收標準:**
- [ ] Repository 可正常推送/拉取
- [ ] Actions workflow 能執行 (即使空的)
- [ ] Issue template 可正常建立
- [ ] Project board 有 Sprint 1 所有 tasks

**參考文件:** [AI DevOps Evaluation](./ai-devops-evaluation.md)

---

## 待規劃任務 (Backlog)

| ID | Title | Epic | 預估點數 | 優先級 |
|:---|:------|:-----|:---------|:-------|
| **STORY-008** | 績效看板與多時間維度分析 | EPIC-04 | 5 | Could |
| **STORY-009** | 雲端資料庫備份同步 | EPIC-01 | 3 | Could |
| **STORY-012** | 分點當沖資料抓取 | EPIC-01 | 5 | Won't (本階段) |
| **STORY-013** | 風控引擎完整實作 | EPIC-04 | 5 | Should |
| **STORY-014** | 參數優化與機器學習 | EPIC-02 | 8 | Won't (未來) |
| **STORY-016** | GitHub Copilot 進階整合 | EPIC-04 | 3 | Could |
| **STORY-017** | AI 自動化部署 (CD) | EPIC-04 | 5 | Should |

---

## Definition of Done (DoD)

### 通用 DoD (所有 Stories)
- [ ] 代碼完成並通過單元測試 (Unit Test)
- [ ] 符合 PRD 中定義的計算精準度 (誤差 < 0.1%)
- [ ] 程式碼提交至 Git 並附帶清晰提交訊息
- [ ] 文件同步更新 (如需)

### Sprint 1 特定 DoD
- [ ] SQLite 資料庫能正確讀寫 (STORY-004)
- [ ] TWSE 資料抓取穩定運行 3 天無錯誤 (STORY-001)
- [ ] VAO/MTM 計算結果與手工驗證一致 (STORY-005~006)
- [ ] Telegram Bot 能發送測試訊息 (STORY-010)

### Sprint 2 特定 DoD
- [ ] 全市場資料抓取完成 (< 30 分鐘) (STORY-010)
- [ ] 選股訊號寫入 screener_signals 表 (STORY-011D)
- [ ] Telegram 報表格式符合設計規範 ([Screener Design](./screener-design-stock-2026.md) §6.1)
- [ ] 回測結果產出勝率/MDD/期望值報告 (STORY-007)

---

## 時程規劃

```
Week 1-2: Sprint 1 (Foundation)
  Day 1-3:  STORY-004 資料庫建立 + STORY-001 爬蟲開發
  Day 4-7:  STORY-001 爬蟲完善 + STORY-002 法人資料
  Day 8-10: STORY-005 VAO + STORY-006 MTM + STORY-010 Telegram
  Day 11-14: Sprint Review + Sprint 2 Planning

Week 3-4: Sprint 2 (Execution)
  Day 15-17: STORY-010 全市場同步 + STORY-011A 技術面
  Day 18-21: STORY-011B 籌碼面 + STORY-011C VAO/MTM
  Day 22-24: STORY-011D 綜合評分 + STORY-010B Telegram
  Day 25-28: STORY-007 回測 + 總結驗收
```

---

## 風險與因應

| 風險 | 影響 | 因應措施 |
|:-----|:-----|:---------|
| TWSE API 變動 | 高 | 實作 API 版本檢查與錯誤處理機制 |
| 資料抓取失敗 | 中 | 自動重試 3 次，失敗則 Telegram 通知 |
| 選股訊號不準確 | 高 | Sprint 2 保留 1 週進行回測與參數調整 |
| Telegram Bot 被封 | 低 | 保留 Email 通知作為備案 |

---

**This document was created using BMAD Method v6 - Phase 4 (Implementation)**

---

## 文件連結總覽

| 階段 | 文件 | 路徑 |
|:-----|:-----|:-----|
| Phase 1 | Product Brief | [product-brief-stock-2026.md](./product-brief-stock-2026.md) |
| Phase 2 | PRD | [prd-stock-2026.md](./prd-stock-2026.md) |
| Phase 3 | System Architecture | [architecture-stock-2026.md](./architecture-stock-2026.md) |
| Phase 3 | Screener Design | [screener-design-stock-2026.md](./screener-design-stock-2026.md) |
| Phase 4 | **Sprint Plan** (本文件) | [sprint-plan-stock-2026.md](./sprint-plan-stock-2026.md) |
| 總覽 | Project Overview | [project-overview-stock-2026.md](./project-overview-stock-2026.md) |
