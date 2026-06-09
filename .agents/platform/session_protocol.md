# Session Protocol — Provider-Agnostic

Defines how to manage context window across providers. Check `detected.md` for active provider.

---

## Provider Routing

| Provider | Has /compact | Has /clear | Recommended pattern |
|---|---|---|---|
| Claude Code (CLI) | ✅ | ✅ | Option A: /compact + continue same chat |
| Gemini (Antigravity) | ❌ | ❌ | Option B: close session → new chat |
| OpenAI / other | ❌ | ❌ | Option B: close session → new chat |
| Unknown | check detected.md | — | Default Option B |

---

## Option A — /compact + Continue (Claude Code only)

Use when: task complete AND provider = claude-code AND SESSION_TOTAL < 90k

```
1. Run session_manager §3 (5-file close sequence)
2. Write compact_state.md (dt/sk/sk_h/mece_h/p3) — BEFORE /compact
3. /compact — CLI resets context window
4. Continue same chat → next task: B1 detects [compact-restore] → resume
```

Token effect: context window reset · compact_state.md enables ~2.9k tokens saved at next boot

---

## Option B — Close + New Chat (all providers)

Use when: task complete OR SESSION_TOTAL > 80k OR provider ≠ claude-code

```
1. Run session_manager §3 (5-file close sequence)
2. Write compact_state.md (dt/sk/sk_h/mece_h/p3)
3. Write session_handoff.md: status + next_session_start + skill_name
4. Tell user: "Session ปิดแล้ว — เปิด chat ใหม่แล้วสั่งงานต่อได้เลยครับ"
5. User opens new chat → B1 loads handoff.md → resume at Phase 3 pending section
```

Token effect: context window fully reset · base cost starts fresh · most efficient across all providers

---

## Mid-Session Context Control (when SESSION_TOTAL > 60k, no /compact)

For providers without /compact — use session_manager §1 Mid-Session Compact:
```
1. Summarize everything older than last 6 loop interactions → ≤300 tokens
2. Write .sessions/context_compact_<N>.md (summary + keep_loops + compacted_at)
3. Emit [compact] Context: ~Nk → compacted
4. Drop old tool results from working context — use summary as new anchor
5. Continue task immediately (non-blocking)
```
Note: this does NOT reset context window — it only manages working memory.
True reset requires Option B (new chat).

---

## Caching Optimization

| Situation | Action |
|---|---|
| Claude Code (auto-cache) | compress CLAUDE.md + AGENTS.md → smaller cache write = cheaper |
| Gemini without explicit cache | compress is critical — every token = full rate per turn |
| Gemini with Context Caching API | implement in Antigravity code — harness unchanged |
| Unknown provider | compress always safe — no downside |

Gemini Context Caching: requires Antigravity code change to pass `cached_content` ID.
Harness cannot implement this — only spec behavior. Implement when ready in Antigravity.

---

## Session Close Checklist (all providers)

Before telling user "session closed":
```
□ session_*.json → status: completed + summary_context written
□ session_tokens.md → SESSION_TOTAL: 0
□ active_thread.md → phase: done
□ session_handoff.md → next_session_start written
□ compact_state.md → dt/sk/sk_h/mece_h/p3 written
□ session_indexer.py run → index_sessions.json updated
```
