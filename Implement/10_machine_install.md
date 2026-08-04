# 10 · Machine-Install Track (T-309)
<!-- DOC-MAP:START (auto · gen_doc_labels.py) -->
<!-- topic: doc_navigation · jump: python3 scripts/lookup.py "<label>" -->
- L34 · ## Engine vs Project — the split
- L50 · ## Two environment variables
- L61 · ## Cross-machine learning sharing (opt-in · T-319)
- L85 · ## Update detection (T-332)
- L101 · ## Step 0 — clean old conflicting config first (MANDATORY)
- L134 · ## Install
- L156 · ## Choose ONE canonical install method (never run both)
- L172 · ### Method A — install as a Claude Code plugin (canonical)
- L202 · ### Method B — manual self-host
- L208 · ## AI-guided setup from a downloaded repo (🤖 AI vs 👤 you)
- L224 · ### Runbook
- L278 · ### The exact message the AI hands the user (copy-paste template)
- L291 · ### Updating later (same split)
- L298 · ## Per-project bootstrap
- L316 · ## How boot + hooks split engine vs project
- L325 · ## Verify (Verify-6)
- L336 · ## Coexisting with an existing global config
- L342 · ### De-dup rule — avoid double-firing hooks
- L367 · ### CLAUDE.md placement decision
- L377 · ## Update — bring an installed harness up-to-date
- L399 · ## Uninstall
- L414 · ## Prune stale plugin versions (optional)
- L433 · ## Health check (self-test)
<!-- DOC-MAP:END -->


> Install the harness **engine once, machine-wide**, so many projects share ONE copy
> of the engine code with **no per-project duplication**. Each project keeps its own
> knowledge, sessions, and docs. "Project ใคร Project มัน."

## Engine vs Project — the split

| Layer | Lives where | Contents | Owner |
|---|---|---|---|
| **ENGINE** | `~/.claude/` (once per machine) | `scripts/`, `.agents/` (skills, platform, manifest), `Implement/`, constitution files, **+ the `knowledge/` engine-spec subset** (loop specs, rubric, glossary, skill specs — per `scripts/knowledge_engine.manifest`, T-335) | shared, identical everywhere |
| **PROJECT** | each project dir | `knowledge/` **project-state** (index_*, cfp_*, error_*, out_of_scope, session history), `.sessions/`, `docs/`, `CLAUDE.md`, `AGENTS.md`, `src/` | one per project, never shared |
| **USER** | `~/.claude/knowledge-shared/` | `user_learning_profile.json` (the learner, not the project); `machine_id` (generate-once, T-319); `cfp/` cross-machine CFP failure store — `export_<id>.json` (this machine's own counts) + `merged/<origin>.json` (per-origin contributions from other machines) | shared, follows the user (see S3) |

The engine code is byte-identical across projects, so it is copied **once**. Project data
is unique, so it is generated fresh per project by `scripts/project_init.py` (see §Per-project).
`knowledge/` is a **mixed** dir: its engine-reference specs (listed in
`scripts/knowledge_engine.manifest`) are seeded into each project by `scripts/seed_knowledge.py`
(called from `project_init.py`, mirroring `seed_constitution`) so `lookup.py` — which reads
specs from the project's own `knowledge/` — can resolve them; the project-state files alongside
them are generated fresh/empty and never carried over. (T-335)

## Two environment variables

| Var | Set by | Meaning | Unset default |
|---|---|---|---|
| `HARNESS_ENGINE_ROOT` | the installer / your shell | where the engine code lives (`~/.claude`) | falls back to the project root → **self-hosted, byte-identical to today** |
| `CLAUDE_PROJECT_DIR` | the host (Claude Code) | which project is active | walk-up from CWD to `.sessions/`/`CLAUDE.md` |

`scripts/harness_paths.py` is the single resolver for both. Every rewired script/hook uses
`${HARNESS_ENGINE_ROOT:-<project>}` for **engine** paths and the project root for **data**
paths. When `HARNESS_ENGINE_ROOT` is unset the two collapse to one dir — exactly today's behavior.

## Cross-machine learning sharing (opt-in · T-319)

The harness can share two kinds of learning across your machines: **CFP failures** that keep
recurring (Track 1) and **skill/tool successes** worth promoting (Track 2). It is **OFF by
default** — nothing ever leaves a machine until you turn it on, per machine.

**The transport is a synced folder — there is NO network code.** The shared store lives at
`~/.claude/knowledge-shared/`. Point that folder at a location your machines already sync
(iCloud Drive, Dropbox, a network share), and the OS's file-sync IS the pipe.

| Step | What | How |
|---|---|---|
| 1 · pick the pipe | make `~/.claude/knowledge-shared` a synced location | symlink it to a synced dir, **or** set `HARNESS_SHARED_HOME=/path/to/synced/knowledge-shared` in your shell |
| 2 · opt in (per machine) | create the machine-local flag | `touch ~/.claude/harness_share.enabled` (delete it to opt out; env `HARNESS_SHARE_ENABLED=0/1` overrides) |

When the flag is present, the `share_close.py` **Stop hook** publishes THIS machine's sanitized
blocks (`cfp/merged/<id>.json`, `skills/merged/<id>.json`) into the shared folder at session
close. Reads happen live during escalation. The hook is **fail-open** — any error is swallowed
and never blocks or slows session close — and a **no-op** the instant the flag is absent.

**What is shared (allow-list — nothing else can leak):** only `{topic, own_count, n_patterns}`
per entry. No free-text symptom/root, no code, no file paths; skill-success `context` is stored
as an 8-hex hash on the local machine and is never exported at all.

## Update detection (T-332)

Once installed, every session start runs `scripts/version_check.py` (a SessionStart
hook). It tells you when a NEWER harness version exists — released on another machine —
so a stale plugin does not silently keep running. Layered + non-blocking:

- **online + git repo** → throttled (≤ once/day) `git fetch origin main` (prompt-proof,
  5s timeout) → if the remote is ahead, prints `[harness-update] ⬆ vX → vY available`
  with a one-line-per-commit change summary.
- **offline / plugin-only** → compares the running version against the newest sibling
  plugin-cache dir (`.../harness-agent/<version>/`). No data → stays silent.
- **up-to-date** → silent (no nag). **any error / offline** → silent, never crashes boot.

It NEVER applies the update — that stays a user action:
`/plugin update` (plugin consumer) or `git pull && bash scripts/machine_install.sh` (self-host).

## Step 0 — clean old conflicting config first (MANDATORY)

> **Do this BEFORE any install method below. It is not optional.**
> Skipping it is what caused T-316/T-317: a stale OLD-generation harness left in your
> global config (`~/.claude/CLAUDE.md` + `~/.claude/settings.json` hooks) **double- or
> triple-fires** every event and can even **block edits in unrelated projects**. The
> plugin/engine you are about to install is the single source of truth — the old copy
> must be neutralized first so hooks never clash.

**Rule: back up first, then remove — never a silent delete of the user's config.**

```bash
# 1. GLOBAL settings hooks — back up, then inspect for an old harness hook block:
cp ~/.claude/settings.json ~/.claude/settings.json.bak-$(date +%F)      # backup FIRST
grep -nE "posttool_track|compact_reset|real_context|phase_gate|skill_gate|danger_gate|git_guard|cache_guard_hook|index_reconcile|boot_init" ~/.claude/settings.json
#   → any match = an old-gen harness copy living in your GLOBAL settings.
#     Remove the whole "hooks" key ONLY if every entry is harness (0 personal hooks).
#     Keep all non-hook keys (permissions, enabledPlugins, tui, …). If you have your
#     OWN personal hooks mixed in, delete only the harness lines, not the key.

# 2. GLOBAL rulebook — a stale full harness CLAUDE.md/AGENTS.md in ~/.claude conflicts
#    with the project-tier rulebook. Back up, then reduce it to a personal-only stub:
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-$(date +%F) 2>/dev/null || true
grep -lE "R1 ·|Boot Gate|Per-Turn Routing|MECE" ~/.claude/CLAUDE.md 2>/dev/null
#   → a match means the OLD full harness is in your GLOBAL file. It must NOT live there
#     (it loads into every project and fights the plugin). Trim it to personal
#     cross-project preferences only; the harness constitution belongs at the PROJECT layer.
```

Consent gate: this step edits the user's personal `~/.claude` config, so it is **R14-destructive**. Show the backup path + the exact lines to be removed and get an explicit "yes" before deleting. Never auto-confirm.

Only after Step 0 is clean, continue with ONE install method below.

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

## Choose ONE canonical install method (never run both)

There are two ways to install the engine, and they are **mutually exclusive**. Running
both duplicates the engine (one copy under `~/.claude/scripts`, one under the plugin
cache) and re-introduces the double-firing Step 0 just cleaned up.

| Method | Engine lives in | Update via | Pick this when |
|---|---|---|---|
| **A · Plugin (canonical / default)** | plugin cache, managed by Claude Code | `/plugin update` | normal use — Claude Code manages it for you |
| **B · Manual self-host** | `~/.claude/scripts` + `~/.claude/.agents` | re-run `machine_install.sh --confirm` | you are hacking on the engine itself / no plugin loader |

**Guard:** if `grep -c posttool_track ~/.claude/settings.json` > 0 **or** `~/.claude/scripts`
exists, you already self-host (Method B). Do **not** also install the plugin. Conversely,
if the plugin is enabled, do **not** run `machine_install.sh` against `~/.claude`. One
engine copy, one registration.

### Method A — install as a Claude Code plugin (canonical)

Add the marketplace from a **stable central clone**, never from the dev/source repo on an
external volume. If the marketplace points at `/Volumes/…` (or any removable/drive path),
every `/plugin update` breaks when that volume is unmounted.

```bash
# 1. clone (or copy) the repo to a STABLE central path that always exists at login:
git clone <harness-repo-url> ~/.claude/harness-src      # or: cp -R "<source-repo>" ~/.claude/harness-src
# 2. add the marketplace from that central clone (NOT the external-volume dev repo):
/plugin marketplace add ~/.claude/harness-src
/plugin install harness-agent@harness-agent-marketplace
```

> Already added the marketplace from an external-volume path? Re-point it:
> `/plugin marketplace remove harness-agent-marketplace` then re-add from `~/.claude/harness-src`.

When installed this way, Claude Code sets `${CLAUDE_PLUGIN_ROOT}` to the plugin's own
directory (under the plugin cache — decoupled from wherever the marketplace was added).
The plugin's `.claude-plugin/hooks.json` resolves every engine script through
`${HARNESS_ENGINE_ROOT:-...}` after exporting `HARNESS_ENGINE_ROOT="${CLAUDE_PLUGIN_ROOT}"`
— so `scripts/…` and `.agents/…` are found inside the installed plugin, while
session/knowledge paths stay under `CLAUDE_PROJECT_DIR` (the active project).

> **Why a central clone, not the dev repo:** the plugin *runtime* already runs from the
> plugin cache, so it survives an unmounted volume. But the marketplace *registration*
> (used by `/plugin update`) still points at whatever path you added. Adding from
> `~/.claude/harness-src` keeps both the runtime and the update path independent of the
> external-volume dev repo. The dev repo stays purely for editing the engine (Method B / self-host).

### Method B — manual self-host

Use the §Install block above (`machine_install.sh --confirm` + `export HARNESS_ENGINE_ROOT`).
This is the same engine-vs-project split as the plugin, wired by an `export` in your shell
instead of the plugin loader. Choose this **only** if you are not using the plugin.

## AI-guided setup from a downloaded repo (🤖 AI vs 👤 you)

> Scenario: a user has `git clone`d / downloaded this harness repo onto their machine and
> tells the AI *"set this up for me."* This is the exact runbook the AI follows — and it
> spells out which steps the AI does itself vs which steps the user must do by hand.

**The one rule that governs everything here:** the AI can run **shell commands** (Bash:
`git`, `cp`, `python3`, `grep`, the harness scripts) but it **cannot run Claude Code
slash-commands** (`/plugin …`). Slash-commands only execute when the **user types them into
their own Claude Code terminal** — they never reach the model, so the AI can never run them
on the user's behalf. Therefore **every `/plugin` step below is a 👤 user step**: the AI's
job is to prepare everything around it and hand the user the exact commands to paste.

Legend: **🤖 = the AI runs this** (Bash tool) · **👤 = the user runs this** (interactive, in
their terminal — the AI must ask and then wait).

### Runbook

1. **🤖 Detect the current state** — decide Method A (plugin, default) vs B (self-host), and
   never install both:
   ```bash
   grep -c posttool_track ~/.claude/settings.json 2>/dev/null   # >0 → already self-hosting (Method B)
   ls ~/.claude/scripts 2>/dev/null                             # exists → already self-hosting
   grep -o '"harness-agent@[^"]*"' ~/.claude/settings.json 2>/dev/null   # present → plugin already enabled
   ```
   If a plugin is already enabled AND `~/.claude/scripts` exists → warn the user they have
   both (duplicate engine) and stop to reconcile before continuing.

2. **🤖 Make a STABLE central clone** — the marketplace must never be served from the
   downloaded repo if that repo sits on an external / removable volume (`/Volumes/…`): every
   `/plugin update` breaks when the volume is unmounted. Copy the repo to a path that always
   exists at login:
   ```bash
   cp -R "<downloaded-repo-path>" ~/.claude/harness-src    # or: git clone <url> ~/.claude/harness-src
   ```
   (If the repo is already on a stable internal path, the AI may skip this and use that path.)

3. **🤖 Step 0 cleanup** — back up and de-conflict the global config so the plugin is the
   single hook source (full detail in §Step 0 above): back up `~/.claude/settings.json` +
   `~/.claude/CLAUDE.md`, then remove any stale harness hook block / stale full-harness
   rulebook from the GLOBAL files. Verify:
   ```bash
   grep -cE 'posttool_track|compact_reset|real_context|phase_gate|skill_gate|danger_gate|git_guard|cache_guard_hook|index_reconcile' ~/.claude/settings.json
   # must print 0 when the plugin will own the hooks
   ```

4. **👤 Register + install the plugin (INTERACTIVE — the AI cannot do this).** The AI stops
   here and tells the user to paste these into their Claude Code terminal:
   ```
   /plugin marketplace add ~/.claude/harness-src
   /plugin install harness-agent@harness-agent-marketplace
   ```
   The AI must say plainly: *"I can't run `/plugin` commands — they're interactive. Please
   paste the two lines above into your terminal, then tell me when it's done."* Then **wait**.

5. **🤖 Verify after the user confirms** — the plugin is enabled and the engine resolves:
   ```bash
   grep -o '"harness-agent@[^"]*": *true' ~/.claude/settings.json   # enabled globally
   ls -t ~/.claude/plugins/cache/*/harness-agent/*/scripts/boot_init.sh | head -1   # engine present
   bash ~/.claude/harness-src/scripts/harness_selftest.sh; echo "selftest_exit=$?"  # 0 = healthy
   ```

6. **🤖 Bootstrap the actual project** (if the user is setting up a project, not just the
   engine) — seeds only that project's empty data, borrows the engine from the plugin:
   ```bash
   python3 ~/.claude/harness-src/scripts/project_init.py /path/to/their-project
   ```
   Then have the user open that project and confirm the boot line runs (it resolves
   `boot_init.sh` from the plugin cache — see §How boot + hooks split engine vs project).

### The exact message the AI hands the user (copy-paste template)

> I've prepared the engine (central clone at `~/.claude/harness-src`, global config cleaned).
> The next two commands are **interactive `/plugin` commands that I can't run for you** —
> please paste them into your Claude Code terminal one at a time:
>
> ```
> /plugin marketplace add ~/.claude/harness-src
> /plugin install harness-agent@harness-agent-marketplace
> ```
>
> Tell me once they finish and I'll verify the install + set up your project.

### Updating later (same split)

- **🤖** `git -C ~/.claude/harness-src pull` — refresh the central clone.
- **👤** `/plugin update harness-agent@harness-agent-marketplace` — the user runs this
  interactive command to activate the new version. (The AI cannot run it; a hand-staged
  cache dir is **not** enough — activation goes through this command.)

## Per-project bootstrap

A new project does **not** copy any engine code. Point it at the machine engine and
scaffold only its own (empty) data:

```bash
export HARNESS_ENGINE_ROOT="$HOME/.claude"
python3 "$HARNESS_ENGINE_ROOT/scripts/project_init.py" /path/to/new-project
```

`project_init.py` seeds empty indexes + skeleton roadmap/CFP/`.sessions/` with **zero
carryover** of project STATE from any other project. It DOES copy the engine-reference
`knowledge/` specs in (via `seed_knowledge.py` — additive, engine-sourced, no-op when
self-hosted), so the project can resolve them without inheriting anyone's state. It
deliberately does **not** create
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

Coexistence rule (**MANDATORY, not advisory** — this is Step 0 enforced): **register each
passive tracker in exactly ONE place.** The default is:

- **Plugin owns the hooks (default / canonical):** Step 0 already removed the harness hook
  entries from your global `~/.claude/settings.json`; the plugin's `hooks.json` is the single
  source. (The Step 0 grep for `posttool_track`, `compact_reset`, `real_context`,
  `phase_gate`, `skill_gate`, `danger_gate`, `git_guard`, `cache_guard_hook`,
  `index_reconcile` must return nothing in your global settings.)
- **Global owns the hooks (only if you deliberately self-host):** keep them in
  `~/.claude/settings.json` and do **not** enable the plugin's hooks — install only its
  skills/`.agents` engine.

Either way the invariant is one registration per tracker — enforced, not merely suggested.
A quick check:
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

## Update — bring an installed harness up-to-date

When a new engine version lands in the repo, update **with the tools you already have** —
there is no separate update script (the installer is idempotent, so re-running it *is* the
update). Use the path that matches the method you installed with:

```bash
# Method A (plugin): pull the central clone, then let Claude Code re-install the plugin:
git -C ~/.claude/harness-src pull            # refresh the stable central clone
/plugin update harness-agent@harness-agent-marketplace

# Method B (self-host): re-run the idempotent installer — it copies only changed files:
git -C <source-repo> pull                    # refresh your engine source
bash scripts/machine_install.sh --confirm    # rsync -a (no --delete) = safe re-copy
```

Both paths are **idempotent and non-clobbering**: they refresh only the ENGINE
(`scripts/` + `.agents/`) and never touch PROJECT data (`knowledge/`, `.sessions/`,
`CLAUDE.md`, `AGENTS.md`, `docs/`). After updating, run the self-test below to confirm the
engine still resolves. For a full old→current re-wire (not just a version bump) see
`Implement/09_migration.md`.

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

## Prune stale plugin versions (optional)

Each `/plugin install` / `/plugin update` leaves the older cached versions on disk
(e.g. `~/.claude/plugins/cache/harness-agent-marketplace/harness-agent/1.0.0`, `…/1.0.1`).
Only the version listed in `~/.claude/plugins/installed_plugins.json` is live; the rest are
dead disk. Safe to delete the stale version dirs (back up / confirm first — this touches the
plugin cache):

```bash
grep -o '"installPath": *"[^"]*"' ~/.claude/plugins/installed_plugins.json   # the LIVE version
ls ~/.claude/plugins/cache/harness-agent-marketplace/harness-agent/          # all cached versions
# remove only the version dirs NOT equal to the live installPath (after confirming)
```

> **Single source of truth:** one engine copy (plugin cache *or* self-host `~/.claude`, never
> both), one marketplace registration, one live version. Duplication anywhere — two install
> methods, two hook registrations, a stale global rulebook — is the root of every clash Step 0
> and the never-both guard exist to prevent.

## Health check (self-test)

`scripts/harness_selftest.sh` is a thin wrapper that shells out to the existing
verifiers (`verify_runner.py`, `repo_map_check.py`, `loop_engineer_preflight.py`),
prints one PASS/FAIL line per verifier, and exits non-zero if ANY sub-verifier
fails (aggregate exit code). Run it after an install to confirm the engine resolves:

```bash
bash scripts/harness_selftest.sh; echo "selftest_exit=$?"   # exit 0 = healthy
```
