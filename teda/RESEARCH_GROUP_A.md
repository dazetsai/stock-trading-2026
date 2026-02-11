# Group A Research: Agent Framework + Communication
## Research Report - 2026-02-11
## Teda Bot Improvement Project

---

## Executive Summary

**Recommendation:** Use **MCP (Model Context Protocol)** as the communication standard with a **lightweight custom Python agent** implementation, not heavy frameworks like AutoGPT.

---

## 1. Communication Protocol Research

### Option A: MCP (Model Context Protocol) ✅ RECOMMENDED

**What is it:**
- Anthropic's open standard (Nov 2024) for LLM-external tool communication
- Official Python SDK: `github.com/modelcontextprotocol/python-sdk`
- Standardizes context provision separate from LLM interaction

**Pros:**
- ✅ Industry standard (Anthropic, IBM, Thoughtworks backing)
- ✅ Official Python SDK available
- ✅ Well-documented specification
- ✅ Can work with Ollama local models
- ✅ Lightweight - just protocol implementation

**Cons:**
- ⚠️ New standard (2024), still evolving
- ⚠️ Requires learning curve
- ⚠️ Ecosystem still growing

**Implementation:**
```python
# Using official MCP Python SDK
from mcp import ClientSession, StdioServerParameters

# Teda as MCP server
# Zeda as MCP client querying Teda status
```

### Option B: Custom ACP (Agent Communication Protocol)

**What is it:**
- Build our own lightweight protocol
- Simple HTTP/JSON or WebSocket between Zeda and Teda

**Pros:**
- ✅ Full control over design
- ✅ Minimal dependencies
- ✅ Can be tailored to exact needs

**Cons:**
- ⚠️ Reinventing the wheel
- ⚠️ Must maintain ourselves
- ⚠️ No ecosystem support

**Verdict:** Use MCP instead unless specific limitations found.

### Option C: Telegram Bot API as Primary ❌ NOT RECOMMENDED

**Why not:**
- ❌ Not designed for agent-to-agent communication
- ❌ Message delays (seconds vs milliseconds)
- ❌ Limited to 4096 characters
- ❌ Good for human notification, bad for technical coordination

**Use case:** Keep as auxiliary channel for human-readable alerts only.

---

## 2. Agent Framework Research

### Option A: AutoGPT ❌ TOO HEAVY

**Characteristics:**
- Complex multi-step goal automation
- Built-in planning, memory, tool use
- Heavy resource requirements

**Why not for Teda:**
- ❌ Overkill for focused data collection tasks
- ❌ Complex to configure and maintain
- ❌ Designed for general AI, not specific executor role

### Option B: BabyAGI ❌ RESEARCH-FOCUSED

**Characteristics:**
- Lightweight task loop
- Research-oriented, cognitive approach
- Minimal implementation

**Why not for Teda:**
- ❌ Designed for exploration, not reliable execution
- ❌ No production-grade error handling
- ❌ Too experimental

### Option C: MCP-Agent Framework ⚠️ PROMISING BUT NEW

**Characteristics:**
- `github.com/lastmile-ai/mcp-agent`
- Built specifically for MCP-based agents
- Workflow patterns included

**Consideration:**
- ⚠️ Only 6 months old (as of Aug 2025)
- ⚠️ Small community
- ✅ Native MCP support

### Option D: Custom Lightweight Python ✅ RECOMMENDED

**Design:**
```python
# Simple Teda structure
class TedaAgent:
    def __init__(self):
        self.mcp_server = MCPServer()  # For Zeda queries
        self.telegram_bot = TelegramBot()  # For alerts
        self.ollama_client = OllamaClient()  # Local LLM
        
    async def run(self):
        # Main loop: listen to MCP + Telegram
        # Execute tasks autonomously
        # Report status via logs
        pass
```

**Pros:**
- ✅ Exactly what we need, no bloat
- ✅ Full control over behavior
- ✅ Easy to integrate Ollama
- ✅ Simple to debug and maintain
- ✅ Can use MCP SDK for standard parts

**Cons:**
- ⚠️ Must build ourselves (but Teda is simple enough)
- ⚠️ No framework magic (explicit control)

---

## 3. Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Teda (Independent Agent)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  MCP Server  │  │  Telegram Bot │  │ Ollama Client│     │
│  │  (Zeda Query)│  │  (Alerts)     │  │ (Local LLM)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Core Agent Loop (Custom Python)            │   │
│  │  - Listen to MCP requests from Zeda                 │   │
│  │  - Execute data collection tasks                    │   │
│  │  - Log all activities                                │   │
│  │  - Report status via MCP + Telegram                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
         MCP Protocol         │         Telegram (Auxiliary)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Zeda (Coordinator)                     │
│  - Query Teda status via MCP                                  │
│  - Update Teda's agents.md for training                       │
│  - Receive alerts from Teda via Telegram                     │
│  - Coordinate with Stock Trading 2026 main project            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Key Technical Decisions

### Communication: MCP Primary + Telegram Auxiliary
- **MCP:** Agent-to-agent technical communication (status queries, commands)
- **Telegram:** Human-readable alerts and summaries

### Framework: Custom Python with MCP SDK
- Don't use heavy frameworks (AutoGPT, BabyAGI)
- Use official `modelcontextprotocol/python-sdk` for MCP parts
- Build lightweight custom agent for Teda-specific logic

### Implementation Stack
```
Core: Python 3.10+
MCP: Official MCP Python SDK
LLM: Ollama (Qwen or other local model)
Comm: MCP (primary), python-telegram-bot (auxiliary)
Logs: Structured JSON logging
Config: agents.md (loaded at startup, hot-reloadable)
```

---

## 5. Research Findings Summary

| Aspect | Finding | Recommendation |
|--------|---------|----------------|
| Communication Protocol | MCP is emerging standard with official SDK | ✅ Use MCP |
| Agent Framework | Heavy frameworks overkill for Teda | ✅ Custom Python + MCP SDK |
| Telegram | Good for alerts, bad for technical comms | ✅ Auxiliary only |
| Implementation Complexity | Moderate - need to build custom agent | Acceptable for requirements |

---

## 6. Next Steps

### For Group B Research (Execution Environment):
Need to research:
1. Ollama model selection for home server hardware
2. One-time startup mechanism
3. Log structure and rotation

### For Group C Research (Professional Role):
Need to design:
1. Teda's agents.md content (skills, boundaries)
2. Zeda's coordination role definition
3. Escalation rules (when Teda → Zeda)

---

*Research completed: 2026-02-11*  
*Status: Group A findings ready for review*
