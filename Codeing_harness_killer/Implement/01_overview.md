# Implement.md — Agent System Bootstrap & Integration Spec
> **How to use:** Give this file + your repo (zip or path) to any capable AI agent.
> The agent will read this spec and either set up the system from scratch (fresh project)
> or integrate seamlessly into your existing codebase without touching source files.

---

## 1. System Capabilities

This agent management system provides three core capabilities:

| Capability | What it does |
|---|---|
| **Token tracking** | Estimates input + output tokens per session using per-character formulas (Thai × 1.7 / English × 0.3), warns before hitting limits |
| **Session continuity** | Active thread file lets any agent resume mid-task across sessions |
| **File + symbol indexing** | Backlink graph of files and exported symbols — agent looks up before editing |

---

## 2. Required Directory Structure

```
project-root/
│
├── AGENTS.md                          # Vendor-agnostic harness — any AI agent reads this first
├── CLAUDE.md                          # Claude-specific gateway rules (full detail)
├── INVARIANTS.md                      # Destructive-action gates + hard stops
├── REPO_MAP.md                        # Directory structure + protected zones
├── CODING_FAILURE_PATTERNS.md         # Known failure modes (empty at setup, fill as bugs occur)
│
├── knowledge/
│   ├── index_files.json               # Backlink graph: which files import which
│   ├── index_variables.json           # Symbol index: exported functions/components/types + line numbers
│   └── error_index.md                 # ERR-XXX catalog: known errors + resolutions
│
├── .agents/
│   └── skills/
│       ├── skill-manifest.json        # ★ Machine-readable routing: keywords → skill → context_files (Boot step 5)
│       ├── registry.md                # Human-readable micro-rules + fast-match table (fallback)
│       ├── mece/
│       │   └── SKILL.md               # MECE plan template — auto-loaded before editor/coder
│       ├── coder/
│       │   └── SKILL.md               # Rules for creating new files + Roadmap Protocol
│       ├── editor/
│       │   └── SKILL.md               # Rules for editing existing code + Roadmap Protocol
│       ├── file_manager/
│       │   └── SKILL.md               # Rules for updating index_files.json
│       ├── variable_manager/
│       │   └── SKILL.md               # Rules for updating index_variables.json
│       ├── agent/
│       │   └── SKILL.md               # Fallback orchestrator — re-routes to correct skill
│       ├── identity/
│       │   └── SKILL.md               # Persona + communication style + loop trace format
│       ├── session_manager/
│       │   └── SKILL.md               # Session rotation, pause/blocked handling, manual close
│       ├── token_auditor/
│       │   └── SKILL.md               # Token waste audit + self-healing rule injection
│       └── token_tracker/
│           └── SKILL.md               # In-memory token estimation + threshold triggers
│
├── scripts/
│   └── symbol_indexer.py              # Auto-scans src/ and refreshes line numbers in index_variables.json
│
└── .sessions/
    ├── active_thread.md               # 3-line state: task / phase / next
    ├── session_tokens.md              # Cumulative output token counter
    ├── session_handoff.md             # Brief written before /clear (optional)
    └── mece_plan.md                   # Persistent MECE plan — survives chat resets, cleared only by "จบ session"
```

> `.sessions/` may be named `memory/` in Claude Code projects — same purpose.

---

## 3. Index Schemas

### 3a. `knowledge/index_files.json`

```json
{
  "files": {
    "src/path/to/file.ts": {
      "description": "One-line summary of what this file does.",
      "associated_tasks": ["T-001", "session_005"],
      "backlinks": [
        "src/path/to/importer-a.ts",
        "src/path/to/importer-b.tsx"
      ]
    }
  }
}
```

- `backlinks`: files that **import** this file (many-to-many)
- `associated_tasks`: task IDs or session IDs that touched this file
- Agent must update backlinks whenever imports change (add/remove)

### 3b. `knowledge/index_variables.json`

```json
{
  "variables": {
    "SymbolName": {
      "type": "ReactComponent | DBTable | Function | Hook | Type | Class | Constant",
      "source": "src/path/to/file.ts",
      "line": 42,
      "fields": ["field1", "field2"],
      "used_in": [
        "src/path/to/consumer-a.tsx",
        "src/path/to/consumer-b.ts"
      ]
    }
  }
}
```

- `line`: must stay current — run `symbol_indexer.py` after any code edit
- `fields`: for DBTable/class only; omit for functions/hooks
- `used_in`: files that call/import this symbol

### 3c. `knowledge/error_index.md` format

```markdown
## ERR-XXX · <Short title>
- **Task:** T-{Parent}-{BugID}-{AttemptID} · **Session:** session_<NNN>
- **File:** src/path/to/file.ts · **Line:** <N>
- **Symptom:** What the error looks like
- **Root Cause:** Why it happens
- **Resolution:** How to fix it
```

> Cross-link rule: roadmap entry must reference `→ ERR-XXX` and error_index entry must reference the Task ID. Both must exist.

---
