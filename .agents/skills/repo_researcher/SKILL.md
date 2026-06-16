---
name: Repo Researcher
description: Analyzes external Git repos — clones or reads local path, maps structure, synthesizes 3 knowledge .md files for TS/Next.js harness adaptation.
keywords: ["วิจัย", "analyze", "research", "explore", "สรุป repo", "repo researcher", "github", "clone", "repository"]
triggers: ["research this repo", "explore codebase", "analyze project structure", "find patterns in code", "map this repository", "ค้นหา repo", "วิเคราะห์ codebase", "สรุป repo นี้", "what does this repo do", "summarize the codebase"]
on_demand_files: ["docs/session_templates/research_summary.md", "docs/session_templates/research_improvement.md", "docs/session_templates/research_repo_map.md"]
---

## Sections
```
- id: 1
  name: "Clone & Scout"
  steps: ["run repo_scout.py → JSON metadata", "detect size_tier (S/M/L/XL)", "emit [scout-done]"]
- id: 2
  name: "Read & Map"
  steps: ["read entry points + key files (R5 offset/limit)", "build file tree", "emit [map-done]"]
- id: 3
  name: "Synthesize & Write"
  steps: ["write 3 output .md from templates", "index sync R8", "emit [research-done]"]
```

---

# Repo Researcher

## Trigger
Keywords: วิจัย / analyze / research / explore / สรุป repo / github / clone / repository

## When to Invoke
- User wants to understand an unfamiliar repo's structure, patterns, or conventions
- Task involves adapting or porting code from an external project into this harness
- Need a structured map of key files, entry points, and architectural patterns
- User says "research this repo", "explore codebase", "analyze project structure", or similar

## When NOT to Use
- Task requires modifying files in the repo → use coder skill instead
- Single-file lookup → use Read tool directly (no skill needed)
- Real-time data or live API responses needed → out of scope
- You already have the answer from context → skip and reply directly

## Operating Stance
- Depth-first over breadth: understand key files fully before expanding scope
- Index before reading: check index_files.json / repo_scout.py output before any Read
- Grep before Read: always grep for symbols/patterns before opening a full file
- Surface patterns not just facts: identify conventions, anti-patterns, and reuse opportunities

## Refusal Contract
Halt and emit `[research-refused]` if:
- Repo requires authentication and no local path provided → ask for local clone path
- size_tier = XL (>5k files) AND user has not confirmed phased approach
- Output path collision: `knowledge/research/<repo_name>_*.md` already exists → ask overwrite?

## Behavior Contract — Clone Gate
```
Pre:    about to call repo_scout.py with a URL or path argument
Contract: URL → validate is public (no auth required) before clone attempt
          local path → validate path exists + is git repo (git -C <path> rev-parse HEAD)
          clone fails (auth/network) → emit [clone-failed] URL: <url> · Reason: <err> → ask for local path
          local invalid → emit [path-invalid] · ask user to re-enter
Post:   repo_scout.py JSON written to .sessions/repo_scout_<repo_name>.json · [scout-done] emitted
Enforce: proceeding to Read/Map without valid scout JSON = [violation] BC-clone-gate → re-run scout first
```

## Behavior Contract — Size Routing
```
Pre:    repo_scout.py JSON available with size_tier field
Contract: S (≤200 files)  → read all key_files[] in single G2 batch · 1-phase synthesis
          M (201–1k files) → read entry_points[] + top-20 key_files · 1-phase synthesis
          L (1k–5k files)  → read entry_points[] only Phase 1 · Phase 2 selective deep-dive
          XL (>5k files)   → emit [size-xl] · ask user confirm phased approach before proceeding
          all tiers: NEVER full-clone-read · always R5 offset/limit reads
Post:   read plan matches size_tier · [size-routing] emitted with tier + file_count + read_plan
Enforce: reading >50 files without size routing check = [violation] BC-size-routing → re-assess tier
```

## Behavior Contract — Output Write
```
Pre:    synthesis complete · 3 output sections ready (summary / improvement / repo_map)
Contract: load templates: docs/session_templates/research_summary.md
                          docs/session_templates/research_improvement.md
                          docs/session_templates/research_repo_map.md
          fill frontmatter: repo_name · date · source_url · language · size_tier
          output paths: knowledge/research/<repo_name>_summary.md
                        knowledge/research/<repo_name>_improvement.md
                        knowledge/research/<repo_name>_repo_map.md
          improvement.md: adapt ALL code refs to TS/Next.js ecosystem
          repo_map.md: every key file entry includes reference_count + line_range
          after write → R8 Index Sync: add entry to knowledge/index_files.json for each file
            (file_manager skill OR python3 scripts/backfill_knowledge_index.py)
Post:   3 files written · [✓ written] emitted per file · index_files.json updated · [research-done] emitted
Enforce: writing output without loading template first = [violation] BC-output-write → load template · re-write
         missing index sync after write = R8 violation → update index_files.json before marking done
```

## Prerequisites
- [ ] Repo root path accessible
      Why: cannot search or grep without a root path
      Missing: ask user "what is the repo root path?"
- [ ] Search scope defined (keyword / file type / symbol name)
      Why: unbounded search wastes tokens and returns noise
      Missing: ask "what specifically are you looking for?"
- [ ] index_files.json present (optional but preferred)
      Why: index lookup is faster than find; reduces tool calls
      Missing: run `find . -name "*.ts" | head -20` as fallback probe

## Workflow
Phase 1 (Clone & Scout) → Phase 2 (Read & Map) → Phase 3 (Synthesize & Write)
Tool: `python3 scripts/repo_scout.py <url_or_path>` → JSON at `.sessions/repo_scout_<repo_name>.json`
Stop conditions: HALT if clone-gate fails (no valid scout JSON) · HALT if size_tier=XL without user confirm · HALT if output path collision without overwrite confirm

## Output Contract
| Event | Emit |
|---|---|
| Scout success | `[scout-done] repo: <name> · tier: <S/M/L/XL> · files: <N> · lang: <lang>` |
| Size routing | `[size-routing] tier: <T> · reading: <N> files · strategy: <desc>` |
| Clone failure | `[clone-failed] URL: <url> · Reason: <err>` |
| Path invalid | `[path-invalid] path: <path>` |
| Size XL warn | `[size-xl] files: <N> · confirm phased approach?` |
| Output written | `[✓ written] knowledge/research/<repo>_<type>.md` × 3 |
| All done | `[research-done] repo: <name> · outputs: 3 files · index: synced` |

## Context Gate
Discovery of new architectural pattern in researched repo → add to `knowledge/research/<repo>_summary.md §Patterns` before closing task.

## Hard Rules
- Never Read a full file >80L without grepping for the target symbol/pattern first
- Never return findings without including exact file paths (and line numbers where applicable)
- Always confirm a file exists (via find/ls) before reporting it as a key file
- Never skip index_files.json lookup when the file is available in the project
- Never fabricate code snippets — only quote exact lines from files you have read
- Never mark research done without all 3 output .md files written and R8 index sync complete

## Tone Guide
- Keep: file paths + line numbers with every finding
- Strip: "I searched..." / "I looked at..." preamble — omit entirely
- Format: bullet findings with `path:line` notation
- Prohibited: "I found that..." openers · vague "the code does X" without citation
