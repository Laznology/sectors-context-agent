# MVP

Core MVP hanya 5 hal:

## 1. Watchlist

User menyimpan BBCA, ANTM, TLKM, dst.

## 2. Investigate Stock

Tombol: `Investigate ANTM`

atau prompt:

> Kenapa ANTM bergerak hari ini?

## 3. Agent Orchestration

Agent menjalankan investigation:

```text
User
  ↓
Investigation Request
  ↓
Stock + Market Context
  ↓
Detect unusual movement
  ↓
Agent decides next tools
  ├─ Sector
  ├─ Foreign Flow
  ├─ Broker
  ├─ News
  └─ Filing
  ↓
Evidence synthesis
  ↓
Explanation + confidence
```

## 4. Evidence UI

```text
ANTM
Needs Attention

What changed
+4.1% today
1.8x normal volume
+2.9% vs market

Likely Driver
FLOW-DRIVEN

Evidence
✓ Market movement insufficient to explain move
✓ Foreign inflow strengthened
✓ Broker accumulation detected
✗ No significant new filing

Agent Conclusion
The movement appears more consistent with
changes in market participation than a new
fundamental catalyst.

Confidence: Medium
```

## 5. Memory

Besok agent bisa mengatakan:

```text
Compared with yesterday:
- foreign inflow continued
- volume returned closer to normal
- no new company-specific catalyst detected
```
