# 10 · Machine-Install Track (T-309)

> Install the harness **engine once, machine-wide**, so many projects share ONE copy
> of the engine code with **no per-project duplication**. Each project keeps its own
> knowledge, sessions, and docs. "Project ใคร Project มัน."

## Engine vs Project — the split

| Layer | Lives where | Contents | Owner |
|---|---|---|---|
| **ENGINE** | `~/.claude/` (once per machine) | `scripts/`, `.agents/` (skills, platform, manifest) | shared, identical everywhere |
| **PROJECT** | each project dir | `knowledge/`, `.sessions/`, `docs/`, `CLAUDE.md`, `AGENTS.md`, `src/` | one per project, never shared |
| **USER** | `~/.claude/knowledge-shared/` | `user_learning_profile.json` (the learner, not the project) | shared, follows the user (see S3) |

The engine code is byte-identical across projects, so it is copied **once**. Project data
is unique, so it is generated fresh per project by `scripts/project_init.py` (see §Per-project).

## Two environment variables

| Var | Set by | Meaning | Unset default |
|---|---|---|---|
| `HARNESS_ENGINE_ROOT` | the installer / your shell | where the engine code lives (`~/.claude`) | falls back to the project root → **self-hosted, byte-identical to today** |
| `CLAUDE_PROJECT_DIR` | the host (Claude Code) | which project is active | walk-up from CWD to `.sessions/`/`CLAUDE.md` |

`scripts/harness_paths.py` is the single resolver for both. Every rewired script/hook uses
`${HARNESS_ENGINE_ROOT:-<project>}` for **engine** paths and the project root for **data**
paths. When `HARNESS_ENGINE_ROOT` is unset the two collapse to one dir — exactly today's behavior.

## Install

```bash
# 1. safe sandbox test first (writes to a throwaway target, never your real config):
bash scripts/machine_install.sh ~/.claude-test

# 2. real machine install (R14 — writing to the live ~/.claude requires --confirm):
bash scripts/machine_install.sh --confirm

# 3. point your shell / project at the installed engine:
export HARNESS_ENGINE_ROOT="$HOME/.claude"
```

`machine_install.sh` copies `scripts/` + `.agents/` into the target with `rsync -a`
(**no `--delete`**), so it is:

- **copy, not move** — the source repo stays fully intact
- **idempotent** — a re-run copies only changed files; a second run shows no diff
- **additive** — never removes files the target already had, so it is safe to install
  alongside your existing `~/.claude/` global config
- **R14-gated** — the real `~/.claude` target refuses to write without `--confirm`

## Install as a Claude Code plugin

Instead of copying the engine by hand, install the harness as a **plugin** through
Claude Code's plugin mechanism. This repo ships a **local marketplace**
(`.claude-plugin/marketplace.json`) whose single plugin `source` is `./` — the repo
is both the marketplace and the plugin, so there is no dev-vs-shipped drift.

```bash
# 1. add this repo as a local plugin marketplace, then install the plugin:
/plugin marketplace add /Volumes/BriteBrain/Projects/Harness\ Agent
/plugin install harness-agent@harness-agent-marketplace
```

When installed this way, Claude Code sets `${CLAUDE_PLUGIN_ROOT}` to the plugin's
own directory. The plugin's `.claude-plugin/hooks.json` resolves every engine script
through `${HARNESS_ENGINE_ROOT:-...}` after exporting
`HARNESS_ENGINE_ROOT="${CLAUDE_PLUGIN_ROOT}"` — so `scripts/…` and `.agents/…` are
found inside the installed plugin, while session/knowledge paths stay under
`CLAUDE_PROJECT_DIR` (the active project). This is the same engine-vs-project split
as the manual install, just wired automatically by the plugin loader instead of by
an `export` in your shell. The manual `machine_install.sh` path and the plugin path
are interchangeable — pick one.

## Per-project bootstrap

A new project does **not** copy any engine code. Point it at the machine engine and
scaffold only its own (empty) data:

```bash
export HARNESS_ENGINE_ROOT="$HOME/.claude"
python3 "$HARNESS_ENGINE_ROOT/scripts/project_init.py" /path/to/new-project
```

`project_init.py` seeds empty indexes + skeleton roadmap/CFP/`.sessions/` with **zero
carryover** from any other project. It deliberately does **not** create
`user_learning_profile.json` in the project — that is USER-tier and lives in
`~/.claude/knowledge-shared/`, proving project isolation.

## How boot + hooks split engine vs project

- **`scripts/boot_init.sh`** reads project data by relative path (`.sessions/…`, `CLAUDE.md`)
  and engine data via `${HARNESS_ENGINE_ROOT:-.}` (`sys_fixed_base.txt`, `cfp_fix_probe.py`).
- **`.claude/settings.json`** hooks resolve script paths through
  `${HARNESS_ENGINE_ROOT:-$ROOT}/scripts/…` (engine) while session/knowledge paths stay
  under `$ROOT` (= `CLAUDE_PROJECT_DIR`, the project). For machine-wide hooks, install this
  settings block to `~/.claude/settings.json` and set `HARNESS_ENGINE_ROOT`.

## Verify (Verify-6)

```bash
bash scripts/machine_install.sh ~/.claude-test           # install to sandbox
diff -rq scripts ~/.claude-test/scripts                  # empty = identical (copy ok)
bash scripts/machine_install.sh ~/.claude-test --dry-run # re-run itemize = no transfers (idempotent)
```

Self-hosting safety: with `HARNESS_ENGINE_ROOT` unset, `boot_init.sh` and every rewired
hook resolve to the current repo — byte-identical to pre-T-309 behavior.

## Coexisting with an existing global config

You may already have a global `~/.claude/settings.json` (with your own hooks) and a
personal global `~/.claude/CLAUDE.md`. The plugin is built to sit **alongside** that,
not overwrite it — but two things need a rule.

### De-dup rule — avoid double-firing hooks

The plugin's `hooks.json` registers the harness passive trackers (e.g.
`posttool_track.py`, `compact_reset.py`, `real_context.py`). Claude Code runs **both**
the plugin's hooks **and** any hooks in your global `~/.claude/settings.json`. If the
**same** tracker is registered in both places it will **fire twice per event** — which
double-counts tokens and can double-reset the compact counter.

Coexistence rule: **register each passive tracker in exactly ONE place.** Pick one:

- **Plugin owns the hooks (recommended):** remove the harness hook entries from your
  global `~/.claude/settings.json` and let the plugin's `hooks.json` be the single
  source. (Grep your global settings for `posttool_track`, `compact_reset`,
  `real_context`, `phase_gate`, `skill_gate`, `danger_gate`, `git_guard`,
  `cache_guard_hook`, `index_reconcile` and delete the duplicates.)
- **Global owns the hooks:** if you prefer to keep them in `~/.claude/settings.json`,
  do **not** enable the plugin's hooks — install only its skills/`.agents` engine.

Either way the invariant is one registration per tracker. A quick check:
`grep -c posttool_track ~/.claude/settings.json` should be `0` when the plugin owns
the hooks.

### CLAUDE.md placement decision

The harness core rulebook (`CLAUDE.md` + `AGENTS.md`) is **PROJECT-tier** — it lives
in each project's root, versioned with that project, and is loaded as project
instructions. The plugin installs the **engine** (`scripts/` + `.agents/`) and, when
its hooks are enabled, wiring — it does **NOT** install or overwrite the user's
personal global `~/.claude/CLAUDE.md`. Your global `CLAUDE.md` is yours; the harness
rulebook stays at the project layer where it belongs. This keeps the two clearly
separated: personal global preferences vs. per-project harness constitution.

## Uninstall

`scripts/harness_uninstall.sh` is the additive-safe reverse of `machine_install.sh`.
It removes ONLY the engine files the harness installed (every file present in this
repo's `scripts/` + `.agents/`) and leaves project data (`knowledge/`, `.sessions/`,
`docs/`, `CLAUDE.md`, …) and any pre-existing / non-harness file untouched. Empty
engine dirs are pruned; a dir still holding your own files is kept.

```bash
# sandbox uninstall (any non-~/.claude target runs freely):
bash scripts/harness_uninstall.sh ~/.claude-test
# R14: the real ~/.claude refuses to uninstall without explicit consent:
bash scripts/harness_uninstall.sh --confirm
```

## Health check (self-test)

`scripts/harness_selftest.sh` is a thin wrapper that shells out to the existing
verifiers (`verify_runner.py`, `repo_map_check.py`, `loop_engineer_preflight.py`),
prints one PASS/FAIL line per verifier, and exits non-zero if ANY sub-verifier
fails (aggregate exit code). Run it after an install to confirm the engine resolves:

```bash
bash scripts/harness_selftest.sh; echo "selftest_exit=$?"   # exit 0 = healthy
```
