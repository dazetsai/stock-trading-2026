# Research Analysis: Auto-Skill for Zeda/Teda Skill Systems
## Meta-Skill Architecture Study
## Source: github.com/Toolsai/auto-skill
## Analysis Date: 2026-02-11
## Context: Teda Bot Improvement Project

---

## 1. Core Architecture Analysis

### Auto-Skill's 5-Step Loop (The Loop)

```
Fingerprinting → Topic Detection → Experience Read → Knowledge Retrieval → Write Back
```

**Breakdown:**
1. **关键词指纹 (Fingerprinting)** - Extract core keywords, generate topic fingerprint
2. **话题切换侦测** - Detect if user switched to new topic
3. **经验读取** - Check past "pitfall records" or "success parameters"
4. **知识库检索** - Auto-match index, load best practices
5. **主动记录** - Propose recording experience when task completes

---

## 2. Applicability to Teda (Executor Agent)

### A. Direct Applicable Mechanisms

#### Mechanism 1: Skill Experience Library
**Auto-Skill Concept:**
- Specific skill experience: parameters, error solutions
- Cross-skill memory: learnings transfer between skills

**Teda Application:**
```
Teda Skill Experience Library:
├── stock_data_collection/
│   ├── success_parameters/     # Best time to fetch, reliable sources
│   ├── pitfall_records/        # "Yahoo API timeout at 06:05"
│   └── error_solutions/        # "Use backup source when primary fails"
├── technical_indicator_calc/
│   ├── rsi_optimization/       # Best parameters for TW stocks
│   └── macd_failures/          # When MACD gives false signals
└── alert_generation/
    ├── threshold_tuning/       # Best anomaly thresholds
    └── notification_timing/    # Best time to send alerts
```

**Implementation:**
- JSON index + Markdown content (human-readable, machine-usable)
- Local SQLite or JSON files
- Teda self-updates after each task cycle

---

#### Mechanism 2: Proactive Experience Capture
**Auto-Skill Concept:**
- Don't wait for manual notes
- Auto-detect task completion
- Propose: "Should I record this experience?"

**Teda Application:**
```
After 06:00 data collection completes:
    ↓
Teda analyzes: Success? Fail? Any anomalies?
    ↓
If pattern detected:
    "Today's data collection completed in 45s (vs avg 60s).
     Source A was faster than Source B.
     Record this finding for future reference?"
    ↓
Store in: stock_data_collection/success_parameters/
```

**Key Insight:** Teda can self-optimize without Zeda intervention for routine tasks

---

#### Mechanism 3: Cross-Context Learning
**Auto-Skill Concept:**
- When using remotion-video-gen, remind about FPS issue from previous project
- Learning transfers across different skills

**Teda Application:**
```
Scenario:
Teda is monitoring stock 2330 (TSMC)
    ↓
Teda checks: Is this similar to past monitoring patterns?
    ↓
Find: "Last time monitoring high-volatility stock (like 2454 MediaTek),
        RSI threshold of 70 gave false signals.
        Suggest adjusting to 75 for semiconductor sector."
    ↓
Apply learning to current 2330 monitoring
```

**Key Insight:** Pattern recognition across different stocks/tasks

---

### B. NOT Applicable to Teda (Keep in Zeda)

| Auto-Skill Feature | Why NOT for Teda | Where It Belongs |
|-------------------|------------------|------------------|
| "Second Brain" concept | Too complex for executor | Zeda's coordination role |
| Long-term preference learning | Teda should be consistent | Zeda defines preferences in agents.md |
| Multi-domain general knowledge | Teda is focused (stock monitoring) | Zeda handles cross-domain |
| Creative style adaptation | Not needed for data collection | Zeda handles creative tasks |

---

## 3. Applicability to Zeda (Coordinator Agent)

### Mechanism 1: Meta-Learning for Training
**Concept:** Zeda learns how to best train Teda

**Implementation:**
```
Zeda Training Experience Library:
├── teda_training/
│   ├── successful_updates/     # Which agents.md changes improved Teda
│   ├── failed_attempts/        # Which updates caused confusion
│   └── escalation_patterns/  # When does Teda need help vs self-solve
```

**Loop:**
1. Zeda updates Teda's agents.md
2. Observe Teda's performance over next N tasks
3. Record: Did this training method work?
4. Optimize future training approaches

---

### Mechanism 2: Cross-Agent Pattern Recognition
**Concept:** Learn from Teda's issues, apply to future agent designs

**Example:**
```
Teda Issue: "Ollama timeout at 06:00 due to cold start"
    ↓
Zeda records: "Local LLM cold start issue"
    ↓
Future Agent (e.g., Research Assistant):
    "Pre-warm Ollama 5 minutes before scheduled task"
```

---

## 4. Hybrid System Design (Zeda + Teda + Auto-Skill Concepts)

### Teda's Self-Learning Scope (Executor Level)
```
CAN Self-Learn:
✓ Best data fetch times (empirical optimization)
✓ API timeout patterns (error recovery)
✓ Alert thresholds (statistical tuning)
✓ Data source reliability (historical tracking)

CANNOT Self-Learn:
✗ Role definition (what is Teda's job) → Zeda defines
✗ Escalation rules (when to ask Zeda) → Zeda defines
✗ New capabilities (add new monitoring types) → Zeda decides
```

### Zeda's Meta-Learning Scope (Coordinator Level)
```
Zeda Learns:
✓ How to best write agents.md for Teda
✓ When Teda needs intervention vs autonomy
✓ Optimal communication patterns (MCP/ACP frequency)
✓ Training effectiveness metrics
```

---

## 5. Specific Mechanisms to Adopt

### For Teda (Immediate Value)

1. **JSON Index + Markdown Storage**
   - Simple, human-readable, git-friendly
   - Structure: `skill_name/experience_type/entries.md`

2. **Post-Task Auto-Analysis**
   - After each 06:00 collection: analyze duration, errors, success
   - Auto-record if anomaly detected

3. **Similarity-Based Retrieval**
   - Before monitoring new stock: check past similar stocks
   - Suggest: "Stock X similar to Y, use same parameters?"

### For Zeda (Training Optimization)

1. **Training Effectiveness Tracking**
   - Each agents.md update → track Teda performance change
   - Learn: "Direct instruction works better than examples for Teda"

2. **Escalation Pattern Learning**
   - Track when Teda successfully self-resolved vs asked Zeda
   - Optimize escalation thresholds

---

## 6. Implementation Priority

**Phase 1 (Teda Core):**
- Basic skill experience library (JSON + Markdown)
- Post-task auto-analysis for 06:00 collection

**Phase 2 (Teda Enhancement):**
- Similarity-based experience retrieval
- Cross-stock pattern learning

**Phase 3 (Zeda Enhancement):**
- Training effectiveness tracking
- Meta-learning for agent coordination

---

## 7. Key Insight Summary

**Auto-Skill teaches us:**

1. **Separation of Concerns:**
   - Teda: Self-optimizes execution details
   - Zeda: Defines boundaries and escalations

2. **Structured Knowledge Storage:**
   - JSON index for machine speed
   - Markdown for human readability
   - Git-friendly for version control

3. **Proactive, Not Reactive:**
   - Don't wait for manual training
   - Auto-capture when patterns emerge

4. **Experience Transfer:**
   - Learn once, apply across similar contexts
   - Teda: Cross-stock monitoring
   - Zeda: Cross-agent training

---

## 8. Open Questions for Discussion

1. Should Teda propose experience recording (like Auto-Skill) or auto-record without asking?
2. How often should Teda purge old experiences (data lifecycle)?
3. Should experiences be shared between Zeda and Teda or kept separate?
4. How to balance "self-learning" vs "Zeda-defined consistency"?

---

*Analysis complete: Auto-Skill provides valuable architecture patterns for both Zeda's coordination and Teda's execution layers.*
