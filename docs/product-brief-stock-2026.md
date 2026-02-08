# Product Brief: 2026 股票操作

**Date:** 2026-02-08
**Author:** Antigravity (Agent)
**Version:** 1.0
**Project Type:** 股市量化交易系統
**Project Level:** 2 (中型專案)

---

## Executive Summary

本專案旨在 2026 年內透過系統化的股市交易架構，建立穩定的第二收入來源。核心目標是利用 AI 與自動化工具，達成每月 10% 的穩定已實現投資報酬率。

---

## Problem Statement

### The Problem
目前交易者面臨資訊過載、缺乏科學化的選股邏輯，且手動盯盤與管理進出場點 (SOP) 容易受到情緒干擾。此外，缺乏一個整合歷史數據與即時指標的個人化資料庫。

### Why Now?
2026 年具備成熟的 AI 輔助開發工具 (如 Gemini)，且台灣證券交易所提供完善的 API 介面，是構建自動化量化交易系統的最佳時機。

### Impact if Unsolved
若不解決系統化問題，投資者將持續面臨不穩定的損益，無法達成財務獨立或穩定的第二收入目標。

---

## Solution Overview

### Proposed Solution
建立一個基於 Google Apps Script (GAS) 與台灣證券交易所 API 的量化交易平台，整合 AI 指標計算與自動化篩選。

### Key Features
1.  **自動化資料庫**：定期從 TWSE API 抓取並備份股市資料。
2.  **指標計算工作流**：實作 MTM (動能) 與 VAO (量價爆發) 等自創指標。
3.  **弱勢/強勢篩選**：每日產出「🔥強勢關注」信號與警報。
4.  **避坑手冊/SOP**：建立標準化的倉位管理與進出場 SOP。

---

## Business Objectives

### Goals
*   **短期**：完善資料庫爬蟲與基礎指標計算。
*   **中期**：建立選股與擇時的回測系統。
*   **長期**：達成並維持每月 10% 的穩健收益。

### Success Metrics
*   每月已實現收益率 ≥ 10%。
*   選股信號的準確率與風險報酬比優於市場平均。

---

## Scope

### In Scope
*   台灣股市 (TWSE/TPEx) 資料對接。
*   基於 GAS 的運算邏輯開發。
*   核心指標程式碼 (VAO, MTM)。
*   倉位管理邏輯定義。

### Out of Scope
*   高頻交易 (HFT)。
*   美股或其他國際市場 (初步階段不包含)。
*   全自動下單 (暫定手動執行訊號)。

---

## 相關文件
- **Next:** [PRD](./prd-stock-2026.md) (Phase 2 - 需求規劃)
- **Architecture:** [System Architecture](./architecture-stock-2026.md) (Phase 3)
- **Screener:** [Screener Design](./screener-design-stock-2026.md) (Phase 3)
- **Sprint Plan:** [Sprint Plan](./sprint-plan-stock-2026.md) (Phase 4)
- **總覽:** [Project Overview](./project-overview-stock-2026.md)

---

## Next Steps

1.  ✅ 已完成：執行 `/prd` 定義具體功能需求
2.  🔄 進行中：完善資料庫自動化備份邏輯
3.  ⏭️ 待開始：設計歷史數據回測架構

---
**This document was created using BMAD Method v6 - Phase 1 (Analysis)**

---

*Document Status: ✅ Complete | Cross-references updated 2026-02-08 by Zeda*
