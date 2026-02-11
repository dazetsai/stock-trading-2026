## Project: Teda Bot Mechanism Improvement
## Parent Project: Stock Trading System 2026 (Closed-Loop Design)
## Type: Sub-Project / Component
## Status: RESEARCH READY
## Planning Phase Completed: 2026-02-11 15:17
## Created: 2026-02-11 10:09

---

## Relationship to Main Project

**Stock Trading System 2026** requires:
- 06:00 automated data collection (reliable execution layer)
- Independent operation (minimal intervention)
- Zero token consumption for daily tasks (local execution)

**Teda Bot** provides:
- Executor Agent that runs locally on home server
- Uses Qwen local model via Ollama (zero cloud tokens)
- Communicates with Zeda (coordinator) via MCP/ACP
- Supports 06:00 data collection for 3D stock picking engine

```
Stock Trading System 2026 (Main Project)
├── Zeda (Coordinator Agent - Kimi K2.5)
│   ├── Strategy Planning
│   ├── 3D Analysis Engine (Technical 40% / Sentiment 30% / Fundamental 30%)
│   └── Decision Making
│
└── Teda (Executor Agent - Qwen Local) ← THIS SUB-PROJECT
    ├── 06:00 Data Collection
    ├── Local Monitoring
    ├── Alert Generation
    └── Log Recording
```

**GitHub Repository:** Pushed together with main project at `https://github.com/dazetsai/zeda`

---

## Current Problem Statement

### Issues Identified (2026-02-11 Morning)

1. **Automatic Startup Fails**
   - Background process execution encounters Windows environment issues
   - Environment variables not loading properly from .env file
   - Process exits with code 1 immediately after start

2. **Unicode Encoding Issues**
   - Windows cp950 codec cannot encode checkmark symbols (✓)
   - Fixed by replacing with [OK], but indicates broader compatibility concern

3. **Manual Intervention Required**
   - Current state requires manual PowerShell commands to start
   - Not achieving "set it and forget it" operational goal

---

## Target Final Goal (To Be Defined)

**Vision Statement (Draft):**
> Teda operates reliably 24/7 with minimal intervention, automatically handling startup, monitoring, error recovery, and graceful degradation.

**Key Characteristics (Draft):**
- ✅ Auto-starts on system boot (or scheduled time)
- ✅ Self-monitors health (CPU, memory, temperature)
- ✅ Auto-recovers from crashes (max 3 retries)
- ✅ Graceful night mode (23:00-06:00 low power)
- ✅ Alerts Daze on critical failures
- ✅ Zero manual command-line interaction required

---

## Planning Phase Output

### To Be Determined:
1. **Final Goal Definition** - Exact specifications of "improved mechanism"
2. **Success Criteria** - How do we measure "reliable operation"?
3. **Constraints** - Budget? Timeline? Technical limitations?
4. **Scope** - What is included vs excluded?

---

## Status Flow

```
Current: PLANNING (NOW)
    ↓
Daze: Define final goal & success criteria
    ↓
Transition: RESEARCH PHASE
    ↓
Zeda: Research solutions for each requirement
    ↓
Output: Solution proposals with trade-offs
    ↓
Daze: Select preferred approach
    ↓
Transition: DEVELOPMENT PHASE
    ↓
Implementation → Testing → Deployment
    ↓
Target: PRODUCTION (Reliable 24/7 operation)
```

---

## Current Problems & Mechanism Deficiencies

### A. Startup Problems (Confirmed 2026-02-11)

| Problem | Symptom | Impact | Frequency |
|---------|---------|--------|-----------|
| **Environment Variable Loading** | `TELEGRAM_BOT_TOKEN not set!` | Cannot start automatically | Every background start attempt |
| **Unicode Encoding** | `cp950 codec can't encode ✓` | Startup crash on Windows | When printing status messages |
| **Process Exit Code 1** | Process starts then immediately exits | No persistent background operation | Intermittent |
| **Manual Command Required** | Must run PowerShell with env vars | Not "set and forget" | Every startup requires manual intervention |

### B. Reliability Mechanisms - MISSING

| Mechanism | Current State | Needed For | Risk Without It |
|-----------|---------------|------------|-----------------|
| **Auto-restart** | ❌ Not implemented | 99%+ uptime | One crash = permanent downtime until manual restart |
| **Health Monitoring** | ❌ No heartbeat | Know if alive | Silent failures, Daze unaware Teda is down |
| **Failure Alert** | ❌ No notification | Quick response | Hours pass before noticing failure |
| **Retry Logic** | ❌ No exponential backoff | Transient error recovery | Temporary API failure kills process permanently |
| **Graceful Degradation** | ❌ All-or-nothing | Partial service | Complete stop when one feature fails |

### C. Operational Mechanisms - MISSING

| Mechanism | Current State | Needed For | User Experience Without It |
|-----------|---------------|------------|---------------------------|
| **One-click Start** | ❌ Command line only | Easy operation | Must remember commands, paths, env vars |
| **Auto Boot Launch** | ❌ Manual start required | 24/7 readiness | Forgot to start = missed 06:00 data collection |
| **Status Dashboard** | ❌ No visibility | Confidence in system | "Is it working?" = uncertainty |
| **Configuration UI** | ❌ Edit .env files | Easy tuning | Error-prone manual file editing |

### D. Maintenance Mechanisms - MISSING

| Mechanism | Current State | Needed For | Operational Cost Without It |
|-----------|---------------|------------|----------------------------|
| **Log Rotation** | ❌ Unlimited growth | Disk space | Crash when disk full |
| **Auto-update** | ❌ Manual git pull | Latest features | Running outdated, buggy version |
| **Backup/Restore** | ❌ No automated backup | Disaster recovery | Lose all configuration on crash |
| **Performance Metrics** | ❌ No tracking | Optimization | Cannot identify bottlenecks |

---

## Problem Analysis Summary

### Critical (Fix First)
1. **Cannot auto-start** - Requires manual intervention every time
2. **No failure detection** - Silent crashes, no recovery
3. **No notification** - Daze unaware of problems

### High Priority
4. **No auto-restart** - Single point of failure
5. **No health dashboard** - Cannot verify operation status
6. **No log management** - Will crash system eventually

### Medium Priority  
7. **No graceful degradation** - Brittle system
8. **No auto-update** - Maintenance burden
9. **No backup mechanism** - Risk of configuration loss

---

## Impact on Stock Trading 2026

### Main Project Risk: **HIGH** 🔴

| Main Project Requirement | Teda Current Capability | Gap |
|-------------------------|------------------------|-----|
| 06:00 automatic data collection | Manual start required | ❌ **Cannot fulfill** |
| Zero human intervention | Requires command line + env vars | ❌ **Cannot fulfill** |
| Reliable 24/7 operation | Crashes silently, no restart | ❌ **Cannot fulfill** |
| Failure notification | No alert mechanism | ❌ **Cannot fulfill** |

### Conclusion
**Teda in current state CANNOT reliably support Stock Trading 2026 main project goals.**

Improvement is not optional enhancement - it's **blocking requirement** for main project success.

---

## To Be Discussed with Daze

### Urgent Clarifications Needed:

1. **Acceptable downtime?**
   - Option A: 0% (never acceptable to miss 06:00 collection)
   - Option B: <5% (rare misses acceptable)
   - Option C: Manual fallback is fine

2. **Notification urgency?**
   - Option A: Real-time (immediate Telegram alert)
   - Option B: Batch (daily status report)
   - Option C: On-demand (check when remember)

3. **Start method preference?**
   - Option A: Windows Service (auto-boot)
   - Option B: Scheduled Task (06:00 specific)
   - Option C: Docker container (portable)
   - Option D: Keep manual but simplified (one-click .bat)

4. **Recovery preference?**
   - Option A: Auto-restart (infinite loop, alert after 3 fails)
   - Option B: Safe mode (stop after 1 fail, wait for manual)
   - Option C: Degraded mode (core functions only when errors)

---

**These questions define the final goal. Ready for discussion when Daze is available.**

---

## Next Action Required

**From Daze:** 
Define the final goal. What does "Teda Bot mechanism improvement" success look like?

Examples to consider:
- "Double-click an icon, Teda runs forever"?
- "Windows service that auto-starts on boot"?
- "Docker container that runs anywhere"?
- Something else?

## Consensus Reached: Hybrid Solution with Meta-Learning (2026-02-11 18:42)

### ✅ Final Decision

**Architecture: Hybrid Approach with Auto-Skill Meta-Learning Integration**

**Evolution from Original Plan:**
- **Base:** nanobot execution + Qbot intelligence + Ollama local + MCP coordination
- **Enhancement:** Auto-Skill meta-learning patterns for self-improvement
- **Result:** Self-evolving executor agent that optimizes execution without constant Zeda intervention

---

### 🧠 New Component: Meta-Skill Layer (From Auto-Skill Research)

**Teda's Self-Learning Capabilities:**

```
Teda Agent (Enhanced with Meta-Learning)
├── Core Execution (nanobot base)
│   ├── Scheduled tasks
│   ├── Background operation
│   └── Local LLM (Ollama)
│
├── Intelligence Layer (Qbot modules)
│   ├── Data fetching
│   ├── Technical indicators
│   └── AI monitoring
│
├── NEW: Meta-Skill System (Auto-Skill inspired)
│   ├── Experience Library
│   │   ├── stock_data_collection/success_parameters/
│   │   ├── stock_data_collection/pitfall_records/
│   │   └── stock_data_collection/error_solutions/
│   ├── Post-Task Auto-Analysis
│   │   └── After 06:00: analyze duration, errors, anomalies
│   ├── Cross-Context Learning
│   │   └── Apply learnings from stock A to similar stock B
│   └── Proactive Experience Capture
│       └── "Record this pattern for future reference?"
│
└── Communication Layer (MCP + Telegram)
    ├── Zeda coordination
    └── Human-readable alerts
```

---

### 📚 Knowledge Storage Structure (From Auto-Skill)

**Experience Library Format:**
```
teda/experiences/
├── stock_monitoring/
│   ├── 2026-02-11_060000_fetch_tsmc.md
│   │   "Duration: 45s (vs avg 60s). Source A faster than B."
│   ├── 2026-02-10_error_timeout.md
│   │   "Yahoo API timeout at 06:05. Switched to backup source."
│   └── index.json
│       {
│         "topic": "stock_monitoring",
│         "patterns": [
│           {"fingerprint": ["yahoo", "timeout", "06:00"], 
│            "solution": "use_backup_source"}
│         ]
│       }
├── alert_generation/
│   └── threshold_optimization.md
└── index.json (master index for all skills)
```

---

### 🔄 Self-Improvement Loop (The Loop)

**After Each 06:00 Data Collection:**

1. **Execute Task** → Collect stock data
2. **Auto-Analyze** → Check: duration? errors? anomalies?
3. **Pattern Detect** → Is this similar to past experiences?
4. **Experience Retrieve** → Load relevant past learnings
5. **Self-Optimize** → Adjust: timing? source order? parameters?
6. **Propose Record** → "Should I record this for next time?"
   - If clear pattern: Auto-record
   - If uncertain: Ask Zeda/Daze on next communication
7. **Apply Learning** → Use optimized approach next cycle

---

### 🎯 Revised Component Responsibilities

| Component | Source | Role | Key Contribution |
|-----------|--------|------|------------------|
| **nanobot** | lightweight-openclaw/nanobot | Execution engine | Reliable scheduling & background operation |
| **Qbot modules** | UFund-Me/Qbot | Intelligence layer | Professional quant capabilities |
| **Auto-Skill concepts** | Toolsai/auto-skill | Meta-learning layer | Self-improvement without constant training |
| **Ollama** | ollama/ollama | Local LLM | Zero cloud token inference |
| **MCP/ACP** | Custom/Protocol | Communication | Agent coordination |

---

### 💡 Why This Enhanced Hybrid?

**Original Hybrid:**
- ✅ Reliable execution
- ✅ Professional capabilities
- ❌ Still requires Zeda to train/improve Teda manually

**Enhanced with Auto-Skill:**
- ✅ Teda self-optimizes execution details
- ✅ Teda learns from its own experiences
- ✅ Zeda only intervenes for strategic decisions (role changes, new capabilities)
- ✅ Reduced coordination overhead

---

### 🚀 Revised Implementation Timeline

**Phase 1: Core Execution (Week 1-2)**
- [ ] nanobot integration with Ollama
- [ ] Basic scheduled task (06:00)
- [ ] Log structure design

**Phase 2: Intelligence Layer (Week 3-4)**
- [ ] Qbot data fetching modules
- [ ] Technical indicator calculation
- [ ] Alert generation

**Phase 3: Meta-Learning System (Week 5-6)** ⭐ NEW
- [ ] Experience library structure (JSON + Markdown)
- [ ] Post-task auto-analysis engine
- [ ] Pattern matching for experience retrieval
- [ ] Self-optimization decision logic

**Phase 4: Communication & Training (Week 7-8)**
- [ ] MCP/ACP protocol implementation
- [ ] Zeda-Teda coordination
- [ ] Role definition (what Teda can vs cannot self-learn)
- [ ] Escalation rules

**Phase 5: Testing & Refinement (Week 9-10)**
- [ ] 06:00 operation testing
- [ ] Self-learning validation
- [ ] Performance metrics

---

### ⚖️ Zeda vs Teda Learning Boundaries

**Teda Self-Learns (Auto-Skill):**
- ✅ Optimal data fetch timing (empirical)
- ✅ API timeout patterns & recovery
- ✅ Alert threshold tuning
- ✅ Data source reliability ranking
- ✅ Cross-stock pattern transfer

**Zeda Defines/Trains (Manual):**
- ✗ What Teda's role is (monitoring vs trading)
- ✗ When to escalate to Zeda (escalation rules)
- ✗ New capabilities (add new monitoring types)
- ✗ Strategic decisions (which stocks to monitor)

---

**Status:** ✅ PLANNING COMPLETE → ENHANCED HYBRID ARCHITECTURE CONFIRMED
**Next Phase:** Detailed Design with Meta-Learning System

---


---

## Planning Phase Completed: All 9 Items Confirmed (2026-02-11 15:17)

### Confirmed Architecture Decisions

| # | Item | Confirmed Result |
|---|------|-----------------|
| 1 | Architecture | Independent Agent + ACP/MCP + Telegram auxiliary |
| 2 | Local Model | Ollama API, research model for home server |
| 3 | Decision Logic | Teda autonomous + Zeda supervision |
| 4 | Startup | One-time startup + Crash notification |
| 5 | Communication | MCP/ACP main + Telegram auxiliary |
| 6 | Error Recovery | Log-centric, manual analysis |
| 7 | Status Tracking | Log analysis only |
| 8 | Professional Role | Zeda to define Teda's skill in agents.md |
| 9 | Token Goal | Balance local/capability, research suitable model |

### Research Topics (RESEARCH PHASE)

1. Independent Agent Frameworks (OpenClaw, AutoGPT, etc.)
2. MCP/ACP Protocol Implementation
3. Home Server Model Selection (hardware-capable models)
4. Teda Professional Role Definition (agents.md design)

---
**Status: RESEARCH READY**  
**Next Phase: Research (4 topics identified)**



---

## Research Topics Optimized (3 Groups)

### Group A: Agent Framework + Communication (Items 1+5)
**Research:** Independent agent frameworks with ACP/MCP/Telegram integration
- OpenClaw session isolation capabilities
- AutoGPT, BabyAGI, MetaGPT comparison
- MCP vs ACP protocol selection
- Telegram Bot API as auxiliary channel

### Group B: Execution Environment (Items 2+4+6+7+9)
**Research:** Complete Teda runtime environment
- Ollama model selection for home server hardware
- One-time startup mechanisms
- Log-centric error handling and status tracking
- Token cost vs capability balance

### Group C: Professional Role (Item 8 - Separate)
**Research:** Teda's skill definition and professional positioning
- Agent role design (data collector vs analyst vs executor)
- Agents.md content structure
- Decision boundaries and escalation rules
- Training methodology via file updates

**Total: 3 Research Groups**  
**Next: Begin Group A, B, or C research**

---
**Status: RESEARCH PHASE - Ready to begin**

