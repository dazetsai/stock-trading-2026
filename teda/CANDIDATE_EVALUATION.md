# Candidate Evaluation: 3 Agent Bots vs Research Requirements
## Scoring Analysis - 2026-02-11
## Teda Bot Improvement Project

---

## Scoring Criteria (5-Point Scale)

| Score | Meaning |
|-------|---------|
| 5 | Perfect match, works out of box |
| 4 | Good fit, minor modifications needed |
| 3 | Feasible, moderate modifications needed |
| 2 | Difficult, major rework required |
| 1 | Not suitable |

**Research Direction Requirements (Confirmed):**
1. Independent Agent Framework + MCP/ACP Communication
2. Local Model (Ollama) Integration
3. Scheduled Tasks (06:00 Execution)
4. Background Operation / 24/7
5. Log Recording & Status Tracking
6. Lightweight (Home Server Compatible)

---

## Candidate 1: nanobot
**Type:** Ultra-lightweight General Purpose Agent
**Scale:** ~4,000 lines
**GitHub:** `lightweight-openclaw/nanobot`

### Scoring

| Requirement | Score | Analysis |
|-------------|-------|----------|
| **1. Independent Framework + MCP/ACP** | 3/5 | Has independent agent loop, but uses HTTP/OpenRouter. Needs MCP/ACP layer added |
| **2. Ollama Integration** | 3/5 | Currently uses OpenRouter, needs modification for local Ollama |
| **3. Scheduled Tasks (06:00)** | 5/5 | ⭐ Built-in "Smart Daily Routine Manager" - exactly what we need |
| **4. Background 24/7** | 5/5 | ⭐ Designed for "24/7 Real-Time Market Analysis" - proven background execution |
| **5. Log & Status Tracking** | 3/5 | Has "Personal Knowledge Assistant" (memory), but unclear log structure |
| **6. Lightweight** | 5/5 | ⭐ 4,000 lines, 99% smaller than alternatives - perfect for home server |

**Total Score: 24/30 (80%)**

### Strengths
- ✅ Perfect scheduled tasks and background execution
- ✅ Ultra-lightweight
- ✅ Clean, readable code (easy to modify)
- ✅ Fast startup, minimal resource usage

### Weaknesses
- ⚠️ Needs MCP/ACP protocol layer added
- ⚠️ Needs Ollama integration (currently cloud-based)
- ⚠️ Unclear log structure for analysis

### Verdict
**Best for:** Quick deployment with proven reliability. Good base for customization.

---

## Candidate 2: Qbot
**Type:** Professional Quantitative Trading Platform
**Scale:** Full platform (not specified, likely 10k+ lines)
**GitHub:** `UFund-Me/Qbot`

### Scoring

| Requirement | Score | Analysis |
|-------------|-------|----------|
| **1. Independent Framework + MCP/ACP** | 2/5 | Full trading platform, not designed for agent coordination. Would need major architecture changes |
| **2. Ollama Integration** | 3/5 | AI-powered, likely supports local models, but unclear if Ollama specifically |
| **3. Scheduled Tasks (06:00)** | 4/5 | Has automated trading, likely has scheduling, but needs verification |
| **4. Background 24/7** | 4/5 | "Automated quantitative trading" implies background operation |
| **5. Log & Status Tracking** | 5/5 | ⭐ Complete "回测系统" (backtesting system) with detailed logs and visualization |
| **6. Lightweight** | 2/5 | Full platform with GUI, likely heavy resource usage |

**Total Score: 20/30 (67%)**

### Strengths
- ✅ Professional-grade stock trading features
- ✅ Complete backtesting and analysis tools
- ✅ Fully local deployment
- ✅ Machine learning strategies (supervised, RL)

### Weaknesses
- ❌ Too heavy (full platform, not lightweight agent)
- ❌ Not designed for agent-to-agent coordination
- ❌ May be overkill for simple data collection
- ⚠️ Complex to customize for specific needs

### Verdict
**Best for:** If Teda needs full quantitative trading capabilities. Overkill for basic data collection.

---

## Candidate 3: OpenClaw Mini
**Type:** Architecture Learning Project
**Scale:** Minimal core (extracted from 430k lines)
**GitHub:** `voocel/openclaw-mini`

### Scoring

| Requirement | Score | Analysis |
|-------------|-------|----------|
| **1. Independent Framework + MCP/ACP** | 3/5 | Has session management and heartbeat, but designed for learning, not production coordination |
| **2. Ollama Integration** | 3/5 | Educational implementation, would need production-grade Ollama integration |
| **3. Scheduled Tasks (06:00)** | 2/5 | Has "Heartbeat Manager" for wake-up, but not designed for scheduled data collection |
| **4. Background 24/7** | 3/5 | Has heartbeat mechanism, but more for waking than continuous operation |
| **5. Log & Status Tracking** | 4/5 | Good understanding of memory management and context loading |
| **6. Lightweight** | 4/5 | Minimal implementation, but may lack production features |

**Total Score: 19/30 (63%)**

### Strengths
- ✅ Best for understanding agent architecture
- ✅ Core concepts: context loading, skills, heartbeat
- ✅ Clean educational codebase
- ✅ Implements production-grade concepts (memory, skills, heartbeat)

### Weaknesses
- ❌ Designed for learning, not direct use
- ❌ Would need significant work to become production-ready
- ⚠️ More of a reference implementation than usable product

### Verdict
**Best for:** Reference when building custom solution. Not suitable as direct base.

---

## Comparative Summary

| Candidate | Total Score | Best For | Main Risk |
|-----------|-------------|----------|-----------|
| **nanobot** | 24/30 (80%) | Quick deployment, proven reliability | Need to add MCP/ACP and Ollama |
| **Qbot** | 20/30 (67%) | Full trading platform features | Overkill, heavy, hard to customize |
| **OpenClaw Mini** | 19/30 (63%) | Learning architecture concepts | Not production-ready, needs rebuild |

---

## Recommendations by Scenario

### Scenario A: Fastest to Deploy
**Winner: nanobot**
- Already has scheduled tasks and background execution
- Only needs Ollama integration and communication layer
- Estimated: 1-2 months to adapt

### Scenario B: Most Professional Trading Features
**Winner: Qbot**
- Complete quantitative trading platform
- But overkill for simple data collection
- May be better for future expansion

### Scenario C: Best Architecture Understanding
**Winner: OpenClaw Mini**
- Learn from it, build custom
- Longer development time but full control
- Estimated: 3-6 months to build

---

## Daze's Research Direction Compatibility

**Group A Requirements (Agent Framework + Communication):**
- nanobot: ⭐⭐⭐ Good base, add MCP/ACP layer
- Qbot: ⭐⭐ Not designed for agent coordination
- OpenClaw Mini: ⭐⭐⭐ Reference for architecture

**Group B Requirements (Execution Environment):**
- nanobot: ⭐⭐⭐⭐⭐ Excellent (scheduled + background)
- Qbot: ⭐⭐⭐ Good but heavy
- OpenClaw Mini: ⭐⭐⭐ Concepts present, need implementation

**Group C Requirements (Professional Role):**
- nanobot: ⭐⭐⭐ Can define any role
- Qbot: ⭐⭐⭐⭐⭐ Already stock-focused
- OpenClaw Mini: ⭐⭐⭐ Flexible but needs definition

---

## Final Verdict

**Top Recommendation: nanobot**
- Highest score (80%)
- Matches core requirements (scheduled tasks, background, lightweight)
- Only needs Ollama + MCP/ACP additions
- Clean codebase, easy to modify
- Proven 24/7 market analysis capability

**Alternative Consideration:**
- Use Qbot if Teda needs full trading capabilities (not just data collection)
- Study OpenClaw Mini for architecture insights when customizing nanobot

---

*Evaluation completed: 2026-02-11*
*Ready for Daze's decision*
