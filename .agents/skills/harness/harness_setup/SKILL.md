---
name: Harness Setup
description: >
  One-command guided onboarding. Runs harness_onboard.py (detect-only), tells the user which
  case the project is in (init / upgrade / noop), and guides — or runs on explicit confirm —
  the matching next step. Delivered as the native command /harness-agent:harness_setup.
  Trigger on: "setup harness", "setupHarness", "onboard project", "ตั้งค่า harness",
  "harness เข้าโปรเจกต์", "new project harness".
triggers: ["setup harness", "setupHarness", "onboard project", "ตั้งค่า harness", "harness เข้าโปรเจกต์", "new project harness"]
activates_at: [manual]
---

# Harness Setup Skill

## Overview
A single guided entry point for "I opened a project — what do I do about the harness?".
It REUSES the existing detector (`harness_onboard.py`) and installers — it adds NO new
detection logic. Its job: run the detector, translate the route into plain language, and
either guide the user to the right next command or (on an explicit yes) run the safe one.

Value over the automatic SessionStart onboard hook: that hook only PRINTS a route line.
This skill INTERPRETS it and OFFERS the next action — while keeping the same detect-only,
confirm-before-acting safety.

Two install LAYERS this skill guides:
- **Layer 1 — machine install (once per machine):** the harness ENGINE is installed into
  `~/.claude` so every project on the machine shares ONE copy. A freshly-cloned engine repo,
  opened in Claude Code, needs this FIRST — it shows up as `noop · self-hosted (project is the
  engine)`. Guided in Step 5 (the user runs it themselves — writing `~/.claude` is R14-gated).
- **Layer 2 — per-project (each project after that):** add the harness to an individual project
  via the plugin or `project_init.py`. This is the `init` / `upgrade` route.

## Operating Stance
- Detect first, act only on an explicit "yes". Detection is free and safe; every ACTION
  (install / migrate / detach) waits for the user to confirm in their own words.
- Reuse, never re-implement. onboard detects; project_init installs; 09_migration upgrades;
  detach cleans up. This skill orchestrates them — it owns none of their logic (single source).
- Engine-resolve every path. In a plugin-only project there is NO local `scripts/`; the engine
  lives centrally. ALWAYS resolve `<ENG>` (the boot `[engine-root]` path / R5 engine-script
  rule) and run/propose `"<ENG>/scripts/…"`. Never propose a bare `scripts/X` — it 404s in
  exactly the consumer projects this skill serves (the T-314 trap).
- Real commands only. Propose commands that actually exist — no invented flags.
- Never self-confirm a destructive step. `detach --confirm` and any delete/overwrite escalate
  to the user (interactive) or the review queue (headless) — this skill issues no self-"yes".

## Prerequisites
Refuse and emit `[setup-refused] reason:<X>` if:
- Engine root not resolvable (no `[engine-root]` from boot, `<ENG>` empty)
  → Why: cannot run the detector without the engine · reason:no-engine
- `"<ENG>/scripts/harness_onboard.py"` not found
  → Why: the detector is the whole basis of the skill · reason:no-onboard

## Refusal Contract
- Do not run any installer / migration / detach before the user types an explicit confirmation.
- Do not hand-edit files — this skill guides + runs whole scripts; it does not edit the project.
- Headless (no human to confirm): detection is fine; any ACTION escalates to the review queue.

## Workflow
Sequential. Emit `[setup] step:<n>` at each step.

### Step 1 — Resolve the engine root `<ENG>`
Read the boot `[engine-root]` line (B1). If absent, resolve per the R5 engine-script rule
(`HARNESS_ENGINE_ROOT` → `$CLAUDE_PLUGIN_ROOT` → newest plugin-cache glob). Quote it (may
contain spaces). Every later command uses `"<ENG>/scripts/…"`.

### Step 2 — Run the detector (read-only)
`python3 "<ENG>/scripts/harness_onboard.py"` in the target project. It NEVER mutates —
it only prints `[harness-onboard] route: <init|upgrade|noop> · <reason> · [run: <cmd>]`.

### Step 3 — Parse the route
Extract `route:` and `reason:` from the printed line. Route ∈ {init, upgrade, noop}.
For `init`, `reason` distinguishes `A1 fresh` (empty) vs `A2 mid-dev` (existing source).

### Step 4 — Explain the case in plain language
Tell the user, briefly, which case they are in and what it means:
- `init · A1 fresh` — brand-new project, no harness yet → first-time install.
- `init · A2 mid-dev` — existing source code, no harness yet → SAME install; it also
  auto-builds REPO_MAP + auto-picks a domain from the existing code (behavior, not a flag).
- `upgrade` — project already has a harness but its constitution files drift from the engine
  → run the migration, then optionally clean up stale local copies.
- `noop · self-hosted (project is the engine)` — this IS the engine repo (usually a fresh clone
  opened in Claude Code). NOT "nothing to do": this is the LAYER-1 moment — offer to install the
  engine machine-wide (Step 5). Skip only if it is already installed on this machine.
- `noop · consumer up-to-date` — a consumer project already current → truly nothing to do.

### Step 5 — Propose the engine-resolved next command
- `init` (A1 or A2): `python3 "<ENG>/scripts/project_init.py" <target-dir>` — `<target-dir>` is
  the project onboard just detected (the CURRENT project, usually `.`). Same command both cases;
  add `--dry-run` to preview, `--force` ONLY to overwrite existing files.
- `upgrade`: walk `"<ENG>/Implement/09_migration.md"` M0→M5; THEN OFFER cleanup —
  `python3 "<ENG>/scripts/harness_onboard.py" detach` (dry-run) → `… detach --confirm` to remove
  stale local engine copies.
- `noop · self-hosted (engine repo)`: LAYER-1 guided machine install. Do this in order:
  1. Auto-detect + confirm the path — the user never types it. The repo root is the CURRENT
     project root (Claude Code runs inside the folder) = the boot `[engine-root]` / `pwd`. State
     it and ask the user to confirm it is right. NOTE: this is the ONE case where a bare `scripts/…`
     is a correct LOCAL path (cwd IS the engine), so the "always `<ENG>`-resolve" Hard Rule below
     does NOT apply here — that rule is for plugin-only CONSUMER projects, which this is not.
  2. Already installed on this machine? `test -f "$HOME/.claude/.harness_source" && echo yes`
     (machine_install.sh writes that marker). If yes → say so; offer only an UPDATE (`git pull`
     in the repo, then re-run the installer) and stop. If no → go to step 3.
  3. NOT installed → lay out these commands for the USER to run THEMSELVES, one per line, with the
     plain-language note beside each (writing `~/.claude` is R14-gated — you guide + verify, you
     never run it for them; assume the user is not technical, skip nothing):
       `pwd`                                         # confirm you are inside the repo folder
       `bash scripts/machine_install.sh --dry-run`   # PREVIEW only — changes nothing yet
       `bash scripts/machine_install.sh --confirm`   # real install into ~/.claude (R14 needs --confirm)
       `export HARNESS_ENGINE_ROOT="$HOME/.claude"`  # tell every project where the engine lives
                                                     #   (add this line to ~/.zshrc to make it permanent)
     Full step-by-step reference: `Implement/10_machine_install.md` (single source — point there
     for the details; do not re-explain all of it inside this skill).
  4. After the machine install, each NEW project uses LAYER 2 (`init` / plugin) — point the user
     back to this same skill in that project.
- `noop · consumer up-to-date`: nothing — say so plainly.
Re-emit the command with `<ENG>` resolved even if onboard printed a bare `scripts/…` path
(except the Layer-1 self-hosted case above, where `scripts/…` is the correct local path).

### Step 6 — Act only on an explicit confirmation
Present the proposed command and WAIT. Proceed only after the user types an explicit
"yes" / "ตกลง" / "ลุย". Then:
- Non-destructive (project_init `--dry-run`, detach dry-run, reading the migration): run it.
- Destructive (`project_init --force`, `detach --confirm`, any delete/overwrite): R14-gated —
  surface `[gate]`, require the user's explicit yes, never self-confirm; headless → escalate to
  the review queue and HALT.
- Layer-1 machine install (`machine_install.sh --confirm`): writes the user's `~/.claude` → R14-gated.
  Do NOT run it for them — present the Step-5 numbered commands and let the USER run each one. You
  guide + verify the result; you never self-confirm the `~/.claude` write.

## Hard Rules
- Every proposed / run script path is `<ENG>`-resolved — never a bare `scripts/X` — EXCEPT the
  Layer-1 self-hosted case (Step 5), where cwd IS the engine so `scripts/…` is the correct local path.
- No action before an explicit user confirmation ("yes" / "ตกลง").
- Reuse existing scripts; add no detection logic here.
