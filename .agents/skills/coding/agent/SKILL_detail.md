# Agent Core — Detail Reference

Extended reference for `agent/SKILL.md`. Load on-demand during orchestration.

---

## §Spawn — Spawn Call Structure by Platform

**Read `.agents/platform/detected.md` at runtime to get actual call format.**

Antigravity 2.0 example:
```json
{
  "Subagents": [
    {
      "TypeName": "self",
      "Role": "<section name>",
      "Prompt": "<goal 1-3 sentences> | constraints: R5,R6,R8 | output_format: cycle_N_<id>.json | context_files: [path/a, path/b] | cycle_context: [S1: done · artifact: path/x]",
      "Workspace": "inherit"
    }
  ]
}
```

Claude Code example: `Agent(subagent_type="task", prompt="<goal>...")`

→ Always resolve actual call format from `detected.md` at runtime. Do not hardcode.

---

## §ResultSchema — Sub-agent Result File

Every spawned agent must write before returning:
```json
{
  "cycle": N,
  "section": "S<id>-<name>",
  "status": "done | blocked",
  "verify_result": "<output of Verify command>",
  "artifacts": ["path/to/file"],
  "tokens_estimated": 0,
  "notes": ""
}
```
Path: `.sessions/cycle_N_<section_id>.json`

Validation (main agent checks before Cycle N+1):
- Required keys: `cycle`, `section`, `status`, `verify_result`, `artifacts`
- `status` must be `"done"` or `"blocked"` — invalid/missing → treat as blocked
- Invalid JSON or missing file → treat as blocked, log in notes

---

## §Environment — Environment & Paths

- Libraries: `/Volumes/BriteBrain/Libraries`
- IDE Context: `/Volumes/BriteBrain/IDE`
- Python install: `pip install <pkg> --target=/Volumes/BriteBrain/Libraries/python`
- NPM install: `npm install <pkg> --prefix=/Volumes/BriteBrain/Libraries/npm`
- Execution: `export PYTHONPATH=$PYTHONPATH:/Volumes/BriteBrain/Libraries/python`
