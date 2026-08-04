# Implement Plan — Local LLM Deployment for the Harness Agent

> Standalone implementation roadmap. Goal: run the Harness Agent against a self-hosted
> open-source LLM (Qwen3) on owned hardware, wired into Claude Code as an executor tier.
> Created 2026-06-17. Derived from the advisory thread (hardware sizing + serving + bridge wiring).
> Status: PLANNING. Each phase = a future task needing its own Phase 1→2→3 + MECE + user confirm.

---

## 0. Locked Decisions (from research thread)

| Topic | Decision | Why |
|---|---|---|
| Hardware | **Mac Studio M1 Max 32GB (used)** | ~400 GB/s memory bandwidth vs M4 base ~120 GB/s (~3× faster inference). Fits ≤35k THB budget. |
| Executor model | **Qwen3-14B (Q4 weights)** | ~9 GB weights. Hard reasoning is offloaded to cloud Sonnet; 14B is enough for section execution. |
| Planner model | **Claude Sonnet (cloud, via Claude Code)** | Does MECE planning, writes `mece_plan.md`. Local model only executes sections. |
| Context goal | **~200k** achievable with 14B + **Q8 KV cache** (~215k). 32B caps at ~40–80k usable on 32GB. | KV cache (context memory) grows per token; smaller model + quantized cache leaves more room. |
| Serving | **Ollama** first (simplest, OpenAI-compatible API) → **vLLM** later for concurrency + prefix caching | Prefix caching reuses the shared harness system prompt across requests. |
| Concurrency | One model instance, **batch up to 3 requests** (shared weights + per-request KV) | 32GB can't hold 3 copies; batching = one server, many requests. |
| Bridge | **Bash wrapper first → MCP server later** | Claude Code subagents run on Claude models only; local model must be exposed as a *tool*. |

**Glossary (plain):** *Unified memory* = RAM that doubles as graphics memory (why a small Mac runs LLMs). *KV cache* = the model's short-term memory of the current conversation, eats RAM per token. *Quantization (Q4/Q8)* = compressing the model to use less memory, slight quality trade. *MCP* = a standard way to plug an external tool into Claude Code.

---

## Phase 1 — Procure & Verify Hardware
- [ ] 1.1 Source used Mac Studio M1 Max **32GB** within budget; confirm RAM = 32GB, storage ≥512GB SSD.
- [ ] 1.2 Boot, update macOS, install Homebrew.
- [ ] 1.3 Record baseline: chip, RAM, free disk, `sysctl hw.memsize`.
- **Verify:** machine boots; 32GB confirmed; ≥300GB free disk for models + cache.

## Phase 2 — Install Serving Layer + Pull Model
- [ ] 2.1 Install Ollama (`brew install ollama` or app).
- [ ] 2.2 Pull `qwen3:14b` (Q4 quant).
- [ ] 2.3 Smoke test: `ollama run qwen3:14b` — measure tokens/sec.
- [ ] 2.4 Start API server (`ollama serve`) — confirm OpenAI-compatible endpoint at `localhost:11434`.
- **Verify:** model answers a prompt; tok/s recorded; `/v1/chat/completions` returns JSON.

## Phase 3 — Tune Context + KV Cache
- [ ] 3.1 Set context window (`num_ctx`) toward target; enable Q8 KV cache.
- [ ] 3.2 Load-test rising context (10k → 50k → 150k → 200k tokens); watch RAM headroom + speed.
- [ ] 3.3 Find the safe usable ceiling on 32GB (leave ~4GB OS overhead).
- **Verify:** stable run at chosen context size without swap/OOM; document the real usable ceiling.

## Phase 4 — Bridge to Claude Code (Step A: Bash wrapper)
- [ ] 4.1 Write `scripts/call_qwen.sh` (or `.py`): takes a prompt, POSTs to Ollama API, prints the result.
- [ ] 4.2 Test from Claude Code: Sonnet runs the script via Bash → result returns into its context.
- [ ] 4.3 Define the call contract: input = section spec from `mece_plan.md`; output = section result text.
- **Verify:** Sonnet can invoke the script and read back Qwen's output in one turn.

## Phase 5 — Bridge Upgrade (Step B: MCP server)
- [ ] 5.1 Write a minimal MCP server exposing one tool `run_local_model(prompt, [context])`.
- [ ] 5.2 Register the MCP server in Claude Code config (`.mcp.json` / settings).
- [ ] 5.3 Confirm the tool appears and returns synchronously (result auto-flows back to Sonnet).
- [ ] 5.4 (Optional) Add tools: `summarize`, `classify`, `execute_section`.
- **Verify:** `run_local_model` callable like any built-in tool; result returns automatically.

## Phase 6 — Harness Wiring (REACT loop integration)
- [ ] 6.1 Map to loop: Sonnet selects next section → calls `run_local_model` → observes → verifies.
- [ ] 6.2 Pass only a **section summary** between sections (reuse `session_handoff` pattern) to keep context lean.
- [ ] 6.3 Choose default mode: **sequential + reset** (clear KV each section) vs **batch-3 parallel** for independent sections.
- [ ] 6.4 Define routing rule: which work goes to Qwen (execution) vs stays on Sonnet (planning/reasoning).
- **Verify:** a real `mece_plan.md` runs end-to-end with Qwen executing ≥2 sections; outputs land back correctly.

## Phase 7 — Optimize + Validate Quality
- [ ] 7.1 (If concurrency needed) move to **vLLM**; enable **prefix caching** for the shared harness system prompt.
- [ ] 7.2 Benchmark Qwen3-14B output vs Sonnet baseline on 3–5 representative sections.
- [ ] 7.3 Tune KV quant / context for the 200k goal; record throughput + cost savings.
- **Verify:** quality acceptable on sample tasks; documented tok/s, context ceiling, $ saved vs all-cloud.

## Phase 8 — Package (optional, only if sharing/reuse)
- [ ] 8.1 Bundle MCP server + related skills into a Claude Code **plugin**.
- [ ] 8.2 Document install steps so it drops into another project/machine in one step.
- **Verify:** plugin installs cleanly on a second project and the local-model tool works there.

---

## Risks / Watch-outs
- **Used-hardware risk:** verify RAM/SSD health before paying; battery/thermals on a desktop Mac Studio are fine but check for prior repairs.
- **200k context is memory-bound:** the declared window ≠ usable; Phase 3 must confirm the real ceiling empirically.
- **Quality gap:** if 14B underperforms on some sections, route those back to Sonnet (don't force everything local).
- **Concurrency:** batch-3 shares one KV pool — heavy context per request shrinks how many fit at once.

## Success Criteria (whole project)
1. Mac Studio running Qwen3-14B with a stable API.
2. Claude Code (Sonnet) can delegate a `mece_plan.md` section to Qwen and get the result back automatically.
3. Documented usable context ceiling + tok/s + measured cost reduction vs all-cloud.

## Related
- See advisory thread + [[context-compression-roadmap-vps-agent-2026-05-29]] (prior local/VPS agent thinking).
- Harness loop mapping: AGENTS.md §Loop Architecture (REACT loop, L4.5 PURGE, session_handoff).
