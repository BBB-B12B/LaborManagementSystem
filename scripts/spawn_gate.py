#!/usr/bin/env python3
"""spawn_gate.py -- T-321 PreToolUse hard-block for unproven parallel/spawn cycles.

WHY: T-321 promotes Phase 3 to a two-level loop -- an OUTER cycle loop that spawns
a cycle's sections in PARALLEL (and delegates `Model: model_low` sections). Design
alone does not make it happen; an agent can silently fall back to serial-all-main.
This gate makes the parallel/spawn contract HARD: you cannot mark a parallel-cycle
section [X] (or close the plan) unless the spawn actually ran and left a proof file
`.sessions/cycle_<N>_<S>.json`. Mirrors cfp_fix_plan_gate.py / danger_gate.py.

CONTRACT:
  * Fires on PreToolUse Edit/Write. Enforces ONLY on a "closing" edit -- one that
    marks a section [X] in mece_plan.md (new_string contains "[X] S<N>"). Every other
    edit passes untouched, so building the cycle + writing the proof are never blocked.
  * If the section being marked [X] belongs to a PARALLEL cycle and its proof file
    `.sessions/cycle_<N>_<S>.json` is absent -> BLOCK (exit 2) with a clear message.
  * Serial-only cycles, or a plan with no parallel cycle and no `Model: model_low`,
    are never blocked. A gate must never over-block honest serial work.

ESCAPE HATCH: HARNESS_SKIP_SPAWN_GATE=1 -> exit 0 always (never bricks editing).

FAIL-OPEN: on any internal/parse error the gate logs to stderr and exits 0. A block
gate that crashes must not break every edit -- under-blocking beats bricking.

USAGE:
  (hook)   echo '<PreToolUse-json>' | python3 scripts/spawn_gate.py
  (test)   python3 scripts/spawn_gate.py --self-test
"""
import glob
import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import cycle_plan   # noqa: E402 — the ONE shared Cycle-grouping parser (T-321c)
import execution_schedule as sched   # noqa: E402 — ONE source of the tier→spawn decision (T-328)

REPO = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.dirname(_HERE)
# tests override these two to point at a temp fixture
PLAN = os.path.join(REPO, ".sessions", "mece_plan.md")
SESSIONS_DIR = os.path.join(REPO, ".sessions")

BLOCK = 2   # PreToolUse exit 2 = hard block
PASS = 0


def _skip():
    return os.environ.get("HARNESS_SKIP_SPAWN_GATE") == "1"


def _read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return ""


# --- plan parsing (delegates to the ONE shared parser · T-321c item c) -----------
def parse_cycles(plan_text):
    """Return {section_id: {"cycle": N, "parallel": bool}} from '### Cycle grouping'.

    Thin projection over cycle_plan.parse_cycle_grouping — the SINGLE source of
    how a Cycle-grouping line is parsed (arrow-normalized · en-dash delimiter ·
    phantom-dup guarded). spawn_gate only needs the section→cycle map."""
    return cycle_plan.parse_cycle_grouping(plan_text)["section_map"]


def has_model_low(plan_text):
    return bool(re.search(r"Model:\s*model_low", plan_text))


def marked_done_section(new_string):
    """Which section id is this edit marking [X]?  '- [X] S2 ...' -> 'S2'. Else None."""
    m = re.search(r"\[X\]\s*(S\d+)\b", new_string or "")
    return m.group(1) if m else None


def _valid_proof(path, section_id):
    """A proof file counts ONLY if it is well-formed JSON that actually
    attests THIS section finished: an object with section==section_id and
    status=="done". Presence alone is NOT enough — an empty `touch`ed or
    garbage file must never satisfy the gate (that would defeat the whole
    hard-enforcement premise). Both the exact-name and glob paths use this
    single check, so they can never disagree."""
    try:
        with open(path, encoding="utf-8-sig") as fh:   # utf-8-sig tolerates a BOM
            data = json.load(fh)
    except (OSError, ValueError):
        return False
    # status compared case-insensitively so a genuine "done"/"Done" proof is
    # not wrongly rejected (over-block halts a legitimate close · fix-pass-3).
    return (isinstance(data, dict)
            and data.get("section") == section_id
            and str(data.get("status", "")).strip().lower() == "done")


def proof_exists(section_id, cycle):
    """True only if a CONTENT-VALID proof for this section exists (not just
    a file at the path). Checks the exact name first, then any
    cycle_<cycle>_*.json that attests this section."""
    exact = os.path.join(SESSIONS_DIR, f"cycle_{cycle}_{section_id}.json")
    if _valid_proof(exact, section_id):
        return True
    for p in glob.glob(os.path.join(SESSIONS_DIR, f"cycle_{cycle}_*.json")):
        if _valid_proof(p, section_id):
            return True
    return False


# --- decision (pure) ------------------------------------------------------------
def _is_delegated(plan_text, section):
    """Does the plan mark this section for delegation (spawn)? Reuses
    execution_schedule's tier→spawn decision so there is exactly ONE source of
    the model_low/model_medium + MAIN-marker rule (T-328). Fail-safe False on
    any parse error — under-block beats bricking an honest edit."""
    try:
        models, raw_lines = sched.parse_section_models(plan_text)
        return sched.is_delegated(section, models, raw_lines)
    except Exception:
        return False


def decide(plan_text, new_string):
    """Return (exit_code, message). BLOCK when a section that MUST spawn is
    marked [X] with no proof file. 'Must spawn' = it is in a parallel cycle,
    OR the plan delegates it by tier (Model: model_low/model_medium with no
    MAIN marker · T-328 tier-binding — makes the Model: field BINDING, not
    decorative). Serial main-context judgment work (model_high, or any tier
    with a MAIN marker) is never blocked."""
    section = marked_done_section(new_string)
    if not section:
        return PASS, ""                       # not a close/mark-done edit
    cycles = parse_cycles(plan_text)
    info = cycles.get(section)
    parallel = bool(info and info.get("parallel"))
    delegated = _is_delegated(plan_text, section)
    if not parallel and not delegated:
        return PASS, ""                       # serial main-context work -> never block
    if info is None:
        return PASS, ""                       # delegated but no cycle map -> fail-open (can't locate proof)
    cyc = info["cycle"]
    if proof_exists(section, cyc):
        return PASS, ""
    why = ("in parallel Cycle" if parallel
           else "delegated by tier (Model: model_low/model_medium, no MAIN marker) in Cycle")
    return (BLOCK,
            f"[spawn-gate] BLOCKED: {section} is {why} {cyc} "
            f"but proof .sessions/cycle_{cyc}_{section}.json is missing. "
            f"Spawn it to its Model: tier (leave the proof file) before marking it [X], "
            f"mark it MAIN if it must stay on opus, or set HARNESS_SKIP_SPAWN_GATE=1 to override.")


# --- hook mode ------------------------------------------------------------------
def _is_plan_file(fp):
    """True iff fp is a path to mece_plan.md, tolerant of Windows separators.

    os.path.basename is separator-specific to the HOST os: on POSIX it splits
    on '/' only, so a Windows-style path like 'C:\\p\\.sessions\\mece_plan.md'
    (no '/') returns the whole string → the gate never recognizes the plan and
    silently under-blocks (T-321c item d). Normalize '\\'→'/' before basename."""
    return os.path.basename((fp or "").replace("\\", "/")) == "mece_plan.md"


def handle_stdin():
    try:
        data = json.load(sys.stdin)
    except (ValueError, OSError):
        return PASS
    if data.get("tool_name") not in ("Edit", "Write"):
        return PASS
    ti = data.get("tool_input", {}) or {}
    fp = ti.get("file_path", "") or ""
    if not _is_plan_file(fp):
        return PASS
    new_string = ti.get("new_string") or ti.get("content") or ""
    code, msg = decide(_read(PLAN), new_string)
    if code == BLOCK:
        sys.stderr.write(msg + "\n")
    return code


# --- self-test (S3 Verify: pure in-memory + temp proof, never touches real plan) -
def _self_test():
    global SESSIONS_DIR
    import tempfile
    fails = []

    parallel_plan = (
        "### Cycle grouping\n"
        "Cycle 1 — serial   · agents: 1   → S1 (foo)\n"
        "Cycle 2 — parallel · agents: 2   → S2 (bar), S3 (baz)\n"
        "### Per-Section Invariants\n"
    )
    serial_plan = (
        "### Cycle grouping\n"
        "Cycle 1 — serial · agents: 1 → S1 (only)\n"
        "### next\n"
    )

    # V1: parallel section marked [X], no proof -> BLOCK
    tmp = tempfile.mkdtemp()
    SESSIONS_DIR = tmp
    code, _ = decide(parallel_plan, "- [X] S2 (done)")
    if code != BLOCK:
        fails.append("V1 no-proof-should-block")

    # V2a: same but proof present -> PASS
    with open(os.path.join(tmp, "cycle_2_S2.json"), "w", encoding="utf-8") as fh:
        json.dump({"cycle": 2, "section": "S2", "status": "done"}, fh)
    code, _ = decide(parallel_plan, "- [X] S2 (done)")
    if code != PASS:
        fails.append("V2 proof-present-should-pass")

    # V2b: escape hatch wins even with no proof
    os.environ["HARNESS_SKIP_SPAWN_GATE"] = "1"
    if _skip() is not True:
        fails.append("V2 escape-hatch")
    os.environ.pop("HARNESS_SKIP_SPAWN_GATE", None)

    # V3: serial-only plan, section marked [X] -> never block
    code, _ = decide(serial_plan, "- [X] S1 (done)")
    if code != PASS:
        fails.append("V3 serial-should-pass")

    # extra: a non-mark edit never blocks
    code, _ = decide(parallel_plan, "Context: some edit that is not a [X] mark")
    if code != PASS:
        fails.append("non-mark-edit-should-pass")

    # extra: model_low presence detected (informational contract)
    if not has_model_low("Model: model_low"):
        fails.append("model_low-detect")

    # extra: _is_plan_file tolerates Windows separators (item d)
    if not (_is_plan_file("C:\\p\\.sessions\\mece_plan.md")
            and _is_plan_file("/x/mece_plan.md")
            and not _is_plan_file("/x/other.md")):
        fails.append("is_plan_file-windows")

    # T-328 tier-binding: a SERIAL section the plan delegates by tier
    # (Model: model_medium, no MAIN marker) must have a proof to be marked [X].
    tier_plan = (
        "### Cycle grouping\n"
        "Cycle 1 — serial · agents: 1 → S1 (setup), S2 (mechanical)\n"
        "### S1 · foo   [Cycle 1 · serial]\nModel: model_high\n"
        "### S2 · bar   [Cycle 1 · serial]\nModel: model_medium\n"
    )
    tier_main_plan = tier_plan.replace(
        "### S2 · bar   [Cycle 1 · serial]\nModel: model_medium\n",
        "### S2 · bar   [Cycle 1 · serial · MAIN context]\n"
        "Model: model_medium  (MAIN context — sensitive)\n")
    # T1: delegated-by-tier serial section, no proof -> BLOCK
    code, _ = decide(tier_plan, "- [X] S2 (done)")
    if code != BLOCK:
        fails.append("T-328 tier-bind-no-proof-should-block")
    # T2: same section but a MAIN marker -> stays main -> PASS (safety-list wins)
    code, _ = decide(tier_main_plan, "- [X] S2 (done)")
    if code != PASS:
        fails.append("T-328 MAIN-marker-should-pass")
    # T4: a model_high serial section is NEVER blocked (regression guard)
    code, _ = decide(tier_plan, "- [X] S1 (done)")
    if code != PASS:
        fails.append("T-328 model_high-serial-should-pass")
    # T3: delegated-by-tier WITH proof present -> PASS
    with open(os.path.join(tmp, "cycle_1_S2.json"), "w", encoding="utf-8") as fh:
        json.dump({"cycle": 1, "section": "S2", "status": "done"}, fh)
    code, _ = decide(tier_plan, "- [X] S2 (done)")
    if code != PASS:
        fails.append("T-328 tier-bind-proof-should-pass")

    if fails:
        print("[spawn-gate self-test] FAIL:", "; ".join(fails))
        return 1
    print("[spawn-gate self-test] PASS "
          "(no-proof->block · proof->pass · escape · serial->pass · "
          "non-mark->pass · model_low-detect · tier-bind T-328)")
    return 0


def main():
    if "--self-test" in sys.argv:
        return _self_test()
    if _skip():
        return PASS
    try:
        return handle_stdin()
    except Exception as exc:                   # fail-open: never brick an edit
        try:                                   # loud fail-open (T-355): log + [gate-error]
            import gatelib; gatelib.report_fail_open("spawn_gate", exc)
        except Exception:                      # F1: a missing/broken helper must never crash the gate
            sys.stderr.write(f"[gate-error] gate:spawn_gate · fail-open(allowed) · {exc!r}\n")
        return PASS


if __name__ == "__main__":
    sys.exit(main())
