#!/usr/bin/env python3
"""share_close.py — T-319 STAGE 2 S6: opt-in, fail-open cross-machine share on session close.

The physical transport is a SYNCED FOLDER (the user points ~/.claude/knowledge-shared at
iCloud/Dropbox/a network drive; the OS file-sync IS the pipe — no network protocol here). This
hook only PUBLISHES this machine's sanitized blocks into that folder, and only when the user
has opted in. Reading others' data happens LIVE at escalation time (cfp_effective / skill_success
read the merged dir the sync has populated) — so there is no separate import step here.

Guarantees (all non-negotiable):
  - opt-in DEFAULT OFF: harness_paths.share_enabled() False → NO-OP, zero shared-store touch.
  - FAIL-OPEN: every step is wrapped; any error/latency is swallowed + logged to
    <shared>/share_close.log. It NEVER blocks or slows session close. ALWAYS exits 0.
  - sanitize: only allow-listed blocks are written (the export builders + sanitize_topics do it).

When opt-in ON:
  1. drain the skill-win marker (.sessions/.skill_win): record each listed approach locally, clear it.
     This is the HARD birth trigger (M4 #3) — the hook fires automatically at close and reads the
     marker, instead of relying on the agent remembering to run a CLI.
  2. publish own CFP block   → <shared>/cfp/merged/<machine_id>.json
  3. publish own skill block → <shared>/skills/merged/<machine_id>.json
"""
from __future__ import annotations

import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_paths

MARKER_ENV = "HARNESS_SKILL_WIN_MARKER"   # test override for the .skill_win marker path


def _log(msg: str) -> None:
    """Best-effort append to the share log. Swallows its own errors (fail-open all the way down)."""
    try:
        p = harness_paths.shared_home() / "share_close.log"
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "a", encoding="utf-8") as fh:
            fh.write(msg.rstrip() + "\n")
    except Exception:
        pass


def _marker_path() -> str:
    override = os.environ.get(MARKER_ENV)
    if override:
        return override
    return str(harness_paths.project_path(".sessions", ".skill_win"))


def _drain_skill_marker() -> int:
    """Record every approach listed in .skill_win (one per line, `key` or `key|context`), then
    clear the marker. Returns how many were recorded. Missing marker → 0 (normal)."""
    import skill_success
    path = _marker_path()
    if not os.path.isfile(path):
        return 0
    n = 0
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        key, _, ctx = line.partition("|")
        skill_success.record(key, ctx or None)
        n += 1
    os.remove(path)
    return n


def publish_cfp(today: str) -> str:
    """Write THIS machine's own CFP block straight into the shared merged store (direct-write:
    the synced folder means other machines just read it — no per-file import needed)."""
    import cfp_export
    import cfp_import
    agg = cfp_export.aggregate_by_topic(cfp_export._load_local_cfp())
    doc = cfp_export.build_export(harness_paths.machine_id(), agg, today)
    return cfp_import.store_origin(cfp_import._merged_dir(), doc)


def publish_skill(today: str) -> str:
    import skill_success
    return skill_success.export_own(today)


def run(today: str | None = None) -> dict:
    """The hook entrypoint. Opt-out → no-op. Opt-in → each step fail-open + logged."""
    today = today or datetime.date.today().isoformat()
    if not harness_paths.share_enabled():
        return {"status": "disabled"}   # zero shared-store touch
    status: dict = {"status": "enabled"}
    for name, fn in (("skill-marker", _drain_skill_marker),
                     ("cfp", lambda: publish_cfp(today)),
                     ("skill", lambda: publish_skill(today))):
        try:
            status[name] = fn()
        except Exception as e:                      # FAIL-OPEN — never propagate
            status[name] = f"error: {e}"
            _log(f"{today} share_close {name} failed: {e}")
    return status


# --- self-test ----------------------------------------------------------------

def _selftest() -> int:
    import json
    import tempfile
    failures = []

    def check(name, cond, detail=""):
        if not cond:
            failures.append(f"{name}: {detail}")

    TODAY = "2026-07-14"

    # (a) opt-OUT → pure no-op: nothing written to the shared store at all.
    with tempfile.TemporaryDirectory() as td:
        os.environ["HARNESS_SHARED_HOME"] = td
        os.environ["HARNESS_SHARE_ENABLED"] = "0"
        os.environ["HARNESS_SKILL_LEDGER"] = os.path.join(td, "ledger.json")
        try:
            st = run(TODAY)
            check("a.disabled", st["status"] == "disabled", str(st))
            # only the machine_id file may exist (created lazily elsewhere); no cfp/ or skills/.
            leftover = [n for n in os.listdir(td) if n in ("cfp", "skills", "share_close.log")]
            check("a.no_shared_write", leftover == [], f"opt-out must not touch shared store: {leftover}")
        finally:
            for k in ("HARNESS_SHARED_HOME", "HARNESS_SHARE_ENABLED", "HARNESS_SKILL_LEDGER"):
                os.environ.pop(k, None)

    # (b) opt-IN → publishes own cfp + skill blocks; skill-marker recorded then cleared.
    with tempfile.TemporaryDirectory() as td:
        os.environ["HARNESS_SHARED_HOME"] = td
        os.environ["HARNESS_SHARE_ENABLED"] = "1"
        os.environ["HARNESS_SKILL_LEDGER"] = os.path.join(td, "ledger.json")
        marker = os.path.join(td, ".skill_win")
        os.environ[MARKER_ENV] = marker
        open(marker, "w", encoding="utf-8").write("edge-runtime-shim|some-context\n")
        try:
            st = run(TODAY)
            check("b.enabled", st["status"] == "enabled", str(st))
            check("b.marker_recorded", st.get("skill-marker") == 1, str(st))
            check("b.marker_cleared", not os.path.isfile(marker), "marker must be removed after drain")
            import harness_paths as hp
            mid = hp.machine_id()
            cfp_blk = os.path.join(td, "cfp", "merged", f"{mid}.json")
            skl_blk = os.path.join(td, "skills", "merged", f"{mid}.json")
            check("b.cfp_published", os.path.isfile(cfp_blk), f"missing {cfp_blk}")
            check("b.skill_published", os.path.isfile(skl_blk), f"missing {skl_blk}")
            if os.path.isfile(skl_blk):
                blk = json.loads(open(skl_blk, encoding="utf-8").read())
                check("b.skill_has_win",
                      any(t["topic"] == "edge-runtime-shim" for t in blk["topics"]),
                      "the drained win must appear in the published skill block")
        finally:
            for k in ("HARNESS_SHARED_HOME", "HARNESS_SHARE_ENABLED",
                      "HARNESS_SKILL_LEDGER", MARKER_ENV):
                os.environ.pop(k, None)

    # (c) FAIL-OPEN: shared_home points at a regular FILE → every publish step errors, but run()
    #     swallows them, still returns, and never raises (exit stays 0).
    with tempfile.TemporaryDirectory() as td:
        badfile = os.path.join(td, "not_a_dir")
        open(badfile, "w").write("x")
        os.environ["HARNESS_SHARED_HOME"] = badfile   # shared_home()/cfp mkdir will raise
        os.environ["HARNESS_SHARE_ENABLED"] = "1"
        os.environ["HARNESS_SKILL_LEDGER"] = os.path.join(td, "ledger.json")
        os.environ[MARKER_ENV] = os.path.join(td, "nope.skill_win")   # absent → 0
        try:
            st = run(TODAY)               # must NOT raise
            check("c.returned", st["status"] == "enabled", str(st))
            check("c.errors_swallowed",
                  str(st.get("cfp", "")).startswith("error")
                  and str(st.get("skill", "")).startswith("error"),
                  f"failing steps must be caught, not raised: {st}")
        except Exception as e:
            check("c.no_raise", False, f"run() must be fail-open, but raised: {e}")
        finally:
            for k in ("HARNESS_SHARED_HOME", "HARNESS_SHARE_ENABLED",
                      "HARNESS_SKILL_LEDGER", MARKER_ENV):
                os.environ.pop(k, None)

    if failures:
        print("FAIL share_close selftest:")
        for f in failures:
            print("  - " + f)
        return 1
    print("OK share_close selftest: all checks pass · opt-out no-op (zero shared touch) · "
          "opt-in publishes cfp+skill + drains win-marker · fail-open (errors swallowed, exit 0)")
    return 0


if __name__ == "__main__":
    if "--self-test" in sys.argv[1:]:
        sys.exit(_selftest())
    # As a Stop hook this must ALWAYS exit 0 — never block session close.
    try:
        run()
    except Exception:
        pass
    sys.exit(0)
