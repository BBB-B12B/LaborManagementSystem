# Token Optimization Benchmark — T-042
date: 2026-05-31
tool: scripts/safe_run.py (THRESHOLD=40 · CHUNK_SIZE=25)

## Test Results

### Test A — Long sequential output (seq 1 100)
| | Lines | Est. tokens (×0.3 chars/line ×20ch) |
|---|---|---|
| Before (raw) | 100 | ~600 |
| After (safe_run) | 27 | ~162 |
| **Saved** | **73 lines** | **~438 tokens (73%)** |

Behaviour: no signal lines → chunk 25 non-signal + "[+75 more]"

---

### Test B — Git non-monotonic error storm (simulated T-041)
| | Lines | Est. tokens |
|---|---|---|
| Before (raw) | 82 | ~1,640 |
| After (safe_run) | 2 | ~40 |
| **Saved** | **80 lines** | **~1,600 tokens (97.5%)** |

Behaviour: 80 "non-monotonic" lines removed by NOISE_RE · only real output preserved:
```
To https://github.com/user/repo.git
   32bd588..c65d035  main -> main
```

---

### Test C — backlink_analyzer (7 lines)
| | Lines |
|---|---|
| Before (raw) | 7 |
| After (safe_run) | 7 |
| **Saved** | **0 (pass-through — ≤THRESHOLD)** |

Behaviour: short output → pass-through unchanged ✅ (no false truncation)

---

## Real-world Projection (T-041-equivalent task)

T-041 had 2 git operations (commit + push) with ~200 total non-monotonic lines:

| Source | Before | After safe_run | Saved |
|---|---|---|---|
| git commit (100 lines) | ~2,000 tok | ~40 tok | ~1,960 |
| git push (100 lines) | ~2,000 tok | ~40 tok | ~1,960 |
| long script outputs (~50 lines avg × 3) | ~900 tok | ~450 tok | ~450 |
| **Total** | **~4,900 tok** | **~530 tok** | **~4,370 tok** |

Combined with other optimizations:
| Optimization | Est. saving/session |
|---|---|
| safe_run.py (bash filter) | ~4-5k tokens |
| Reviewer inline (≤3 Verify-N) | ~8-11k tokens |
| Compact at 30k (multi-section) | ~10-15k tokens |
| **Total** | **~22-31k tokens** |

**T-041 equivalent: 48k → ~17-26k ≈ 45-65% reduction**

---

## Notes
- NOISE_RE removes known-noisy patterns unconditionally (non-monotonic, Cloning into, etc.)
- SIGNAL_RE preserves all error/warn/fail/exception lines — never truncated
- Test B demonstrates the primary use case: git operations with macOS pack index warnings
- safe_run.py exit code = original command exit code (callers can check $?)

---

## T-045 · Formula Accuracy Test (2026-05-31)

**Method:** Boot new session after /compact → compare harness CHAT_TOTAL vs actual API counter.

### Boot Accuracy

| Parameter | Value |
|---|---|
| date | 2026-05-31 |
| compact_size (from compact_state.md) | 21,150 |
| sys_fixed (dynamic: CLAUDE.md+AGENTS.md×0.3+3500) | 11,115 |
| harness_start (compact_size + sys_fixed) | 32,265 |
| actual_start (API counter after /compact) | 40,600 |
| error% | 20.5% |
| ratio (actual/harness) | 1.26× |

### Per-Turn Growth

| Parameter | Value |
|---|---|
| API growth (2 turns) | +2,700 (40.6k → 43.3k) |
| Harness growth (2 turns) | +2,135 (32.3k → 34.4k) |
| Per-turn actual avg | ~1,350 tokens |
| Per-turn harness avg | ~1,068 tokens |
| Per-turn ratio | 1.26× |

### Formula Accuracy History

| Task | compact_size ratio | sys_fixed | hooks/turn | boot_error% | ratio |
|---|---|---|---|---|---|
| pre-T-019 | N/A | hardcoded 7,300 | N/A | ~137% | ~5× |
| T-019 | 0.30 | hardcoded 7,300 | 1,300 | ~33% | ~1.5× |
| T-043 | 0.30 | hardcoded 7,300 | 1,300 | ~33% | ~1.49× |
| **T-044** | **0.45** | **dynamic ~11,115** | **700** | **20.5%** | **1.26×** |

### Analysis
- Remaining gap (20.5%) = triangular accumulation: each turn re-sends full conversation history
  to API, whereas harness tracks only new tokens per turn
- Compact ratio 0.45 is accurate; primary remaining error source is history re-accumulation
- 1.26× is consistent across both boot and per-turn measurements → systematic undercount, not noise
- Recommendation: T-046 — add triangular correction factor (×1.3) to CHAT_TOTAL formula
