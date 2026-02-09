# Multi-Bot Ecosystem Architecture
# 多 Bot 生態系統架構設計

**專案:** 2026 股票操作系統 + nanobot 整合  
**日期:** 2026-02-09  
**版本:** 1.0  

---

## 🎯 目標

建立 **Bot Fleet (Bot 艦隊)**，每個 Bot 負責特定任務，協同工作：

```
┌───────────────────────────────────────────────────────────────┐
│                    多 Bot 協作架構                              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   使用者                                                      │
│     ↓                                                         │
│   ┌─────────────┐                                            │
│   │ 指令路由層   │  ← 解析使用者意圖，分派給對應 Bot           │
│   └──────┬──────┘                                            │
│          │                                                    │
│   ┌──────┴──────┬──────────────┬──────────────┬──────────┐   │
│   │             │              │              │          │   │
│   ▼             ▼              ▼              ▼          ▼   │
│ ┌──────┐   ┌──────┐     ┌────────┐   ┌────────┐  ┌──────┐│
│ │Stock │   │Nano  │     │Gemini  │   │Open    │  │Zeda  ││
│ │Bot   │   │Bot   │     │Bot     │   │Code    │  │Bot   ││
│ │交易   │   │助手  │     │研究    │   │開發    │  │協調  ││
│ └──────┘   └──────┘     └────────┘   └────────┘  └──────┘│
│                                                               │
│   各 Bot 可以互相呼叫、協同工作                                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 🤖 Bot 艦隊成員

### 1. Stock Bot (股票交易 Bot) ⭐ 核心
**負責:** 股票資料、選股、交易邏輯
```python
class StockBot:
    """
    股票交易專業 Bot
    """
    
    async def fetch_market_data(self, symbols: list):
        """抓取市場資料"""
        pass
    
    async def run_screener(self, date: str):
        """執行選股"""
        pass
    
    async def get_portfolio(self):
        """取得投資組合"""
        pass
    
    async def send_alert(self, signal: dict):
        """發送交易訊號"""
        pass
```

**整合方式:**
- 直接呼叫 `stock-trading-2026/src/` 模組
- 提供 HTTP API 供其他 Bot 使用
- 專注資料與計算

---

### 2. Nano Bot (nanobot) ⭐ 前端介面
**負責:** 自然語言理解、使用者互動、協調其他 Bot
```python
class NanoBot:
    """
    輕量級 AI 助手 - 使用者介面層
    """
    
    async def understand_intent(self, message: str):
        """理解使用者意圖"""
        # 使用本地 Gemma/Ollama
        # 解析指令類型
        pass
    
    async def route_to_bot(self, intent: str, params: dict):
        """路由到對應 Bot"""
        if intent == "stock_query":
            return await stock_bot.handle(params)
        elif intent == "code_development":
            return await opencode_bot.handle(params)
        elif intent == "research":
            return await gemini_bot.handle(params)
    
    async def format_response(self, raw_data, user_friendly=True):
        """格式化回應"""
        # 自然語言生成
        pass
```

**整合方式:**
- 作為主要對外介面
- 使用 Ollama 本地模型 (gemma3:4b)
- 協調其他專業 Bot

---

### 3. Gemini Bot (研究 Bot)
**負責:** 深度研究、分析、文件生成
```python
class GeminiBot:
    """
    Google Gemini 驅動的研究 Bot
    """
    
    async def research_topic(self, topic: str):
        """主題研究"""
        # 使用 Gemini API
        pass
    
    async def analyze_trends(self, data: list):
        """趨勢分析"""
        pass
    
    async def generate_report(self, template: str, data: dict):
        """產生報表"""
        pass
    
    async def explain_strategy(self, strategy: str):
        """解釋交易策略"""
        pass
```

**整合方式:**
- 使用 Gemini CLI (已設定 API Key)
- 深度分析與研究任務
- 專業文件產生

---

### 4. OpenCode Bot (開發 Bot)
**負責:** 程式碼開發、測試、除錯
```python
class OpenCodeBot:
    """
    OpenCode 驅動的開發 Bot
    """
    
    async def implement_feature(self, spec: str):
        """實作功能"""
        # 使用 OpenCode run
        pass
    
    async def fix_bug(self, error: str, context: dict):
        """修復錯誤"""
        pass
    
    async def write_tests(self, function_code: str):
        """撰寫測試"""
        pass
    
    async def review_code(self, file_path: str):
        """程式碼審查"""
        pass
```

**整合方式:**
- 背景執行 OpenCode
- 自動化開發任務
- 與 GitHub 整合

---

### 5. Zeda Bot (協調 Bot) ⭐ 你熟悉的 Zeda
**負責:** 品質驗證、流程管理、跨 Bot 協調
```python
class ZedaBot:
    """
    Zeda - 品質驗證與專案協調
    """
    
    async def validate_output(self, bot_name: str, output: any):
        """驗證 Bot 產出"""
        # ZVQ 標準檢查
        pass
    
    async def coordinate_workflow(self, workflow: list):
        """協調多 Bot 工作流程"""
        # 管理執行順序
        pass
    
    async def handle_errors(self, error: Exception, context: dict):
        """錯誤處理與恢復"""
        pass
    
    async def generate_summary(self, all_outputs: list):
        """產生總結報告"""
        pass
```

**整合方式:**
- 我在 OpenClaw 中執行
- 監督所有 Bot 工作
- 品質把關與協調

---

## 🔄 Bot 協作流程範例

### 範例 1: 完整開發流程

```
使用者: 「幫我實作一個 RSI 指標計算功能」

Nano Bot (理解)
  ↓ 解析意圖: implement_feature
  ↓ 提取需求: RSI indicator

OpenCode Bot (開發)
  ↓ 實作 src/indicators/rsi.js
  ↓ 撰寫 test/indicators/rsi.test.js
  ↓ Git commit

Zeda Bot (驗證)
  ↓ 檢查 ZVQ 標準
  ↓ 執行測試
  ↓ 驗證通過

Nano Bot (回應)
  ↓ 格式化結果
  ↓ 「RSI 指標已實作完成！包含...」
```

### 範例 2: 每日選股流程

```
使用者: 「執行今日選股並發送報表」

Nano Bot (排程)
  ↓ 確認指令
  ↓ 觸發工作流程

Stock Bot (資料)
  ↓ 抓取 TWSE 資料
  ↓ 計算 VAO/MTM 指標
  ↓ 執行三維選股
  ↓ 儲存訊號到資料庫

Gemini Bot (分析)
  ↓ 分析選股結果
  ↓ 產生市場洞察
  ↓ 撰寫報表摘要

Zeda Bot (驗證)
  ↓ 驗證資料完整性
  ↓ 檢查訊號合理性
  ↓ 確認品質

Stock Bot (通知)
  ↓ 格式化 Telegram 報表
  ↓ 發送給使用者

Nano Bot (確認)
  ↓ 「選股完成！已發送報表，包含 3 檔 Tier 1 標的」
```

### 範例 3: 研究與開發結合

```
使用者: 「研究動能交易策略並實作回測」

Gemini Bot (研究)
  ↓ 搜尋動能交易策略文獻
  ↓ 分析學術論文
  ↓ 產生策略設計文件

OpenCode Bot (實作)
  ↓ 根據設計實作回測引擎
  ↓ 整合到現有系統
  ↓ 撰寫測試案例

Stock Bot (測試)
  ↓ 執行歷史資料回測
  ↓ 計算勝率/MDD/期望值
  ↓ 產生結果報告

Zeda Bot (評估)
  ↓ 驗證回測結果合理性
  ↓ 檢查程式碼品質
  ↓ 提供改進建議

Nano Bot (呈現)
  ↓ 總結研究與實作成果
  ↓ 建議下一步行動
```

---

## 🛠️ 技術實作

### 架構圖

```
workspace/
├── stock-trading-2026/          # 股票系統核心
│   ├── src/
│   ├── test/
│   └── api-server.js            # HTTP API 供 Bots 呼叫
│
├── nanobot/                     # nanobot 本體
│   ├── nanobot/
│   │   └── plugins/
│   │       ├── stock_plugin.py  # Stock Bot 外掛
│   │       ├── gemini_plugin.py # Gemini Bot 外掛
│   │       └── opencode_plugin.py # OpenCode 外掛
│   └── config.json              # Bot 配置
│
├── bot-fleet/                   # Bot 協調中心 ⭐ NEW
│   ├── router.py                # 指令路由器
│   ├── coordinator.py           # 工作流協調器
│   ├── message_bus.py           # Bot 間通訊
│   └── registry.py              # Bot 註冊中心
│
└── shared/                      # 共享資源
    ├── memory/                  # 共享記憶 (QMD)
    ├── logs/                    # 統一日誌
    └── config/                  # 統一配置
```

### Bot 通訊協定

```python
# bot-fleet/message_bus.py

class BotMessageBus:
    """
    Bot 間通訊匯流排
    """
    
    async def publish(self, channel: str, message: dict):
        """發布訊息到頻道"""
        pass
    
    async def subscribe(self, channel: str, bot_handler):
        """訂閱頻道"""
        pass
    
    async def request_response(self, target_bot: str, request: dict):
        """請求-回應模式"""
        pass

# 使用範例
await message_bus.publish("stock.alerts", {
    "signal": "BUY",
    "symbol": "2330",
    "confidence": 0.85
})
```

### 配置範例

```json
// bot-fleet/config.json
{
  "bots": {
    "stock": {
      "enabled": true,
      "path": "../stock-trading-2026",
      "api_port": 3000
    },
    "nano": {
      "enabled": true,
      "provider": "ollama",
      "model": "gemma3:4b"
    },
    "gemini": {
      "enabled": true,
      "api_key": "AIzaSy..."
    },
    "opencode": {
      "enabled": true,
      "workdir": "../stock-trading-2026"
    },
    "zeda": {
      "enabled": true,
      "role": "coordinator"
    }
  },
  "workflows": {
    "daily_screener": [
      "stock.fetch_data",
      "stock.run_screener",
      "gemini.analyze",
      "zeda.validate",
      "stock.send_alert"
    ],
    "feature_development": [
      "gemini.research",
      "opencode.implement",
      "zeda.validate",
      "stock.test"
    ]
  }
}
```

---

## 🎯 開發優先級

### 第一優先 (今天-明天)
1. **Stock Bot API** - 讓股票系統可被呼叫
2. **Nano Bot 基礎** - 啟動 nanobot 本地模型
3. **Bot 間通訊** - 簡單訊息傳遞

### 第二優先 (本週)
4. **Gemini Bot 整合** - 研究能力
5. **OpenCode Bot 自動化** - 自動開發
6. **工作流引擎** - 自動化流程

### 第三優先 (下週)
7. **Zeda Bot 強化** - 自動驗證
8. **Telegram 多 Bot 切換** - 對外介面
9. **儀表板** - Bot 狀態監控

---

## 💡 立即行動

**既然 Gemma 下載中，我們可以先做：**

**A.** 開發 **Stock Bot HTTP API** (獨立進行)  
**B.** 設置 **Bot Fleet 協調中心** 架構  
**C.** 整合 **現有模型** (glm-4.7-flash) 先測試  
**D.** 撰寫 **Bot Fleet 配置檔案**

**選哪個？** 還是多個並行？ 🚀
