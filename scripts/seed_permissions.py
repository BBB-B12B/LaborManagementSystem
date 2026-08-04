#!/usr/bin/env python3
"""seed_permissions.py — T-338 · single source of the machine-wide command-access baseline.

The harness ships GATES (hooks) to every project, but Claude Code plugins cannot ship a
`permissions` block. So the allow/deny command-access baseline is propagated by having the
INSTALLERS seed it into a target settings.json. This module is the ONE place the baseline
list lives (single-source-of-truth); machine_install.sh and project_init.py both call it.

Guarantees (mirror machine_install.sh's "never touch the user's own config" spirit):
  - ADDITIVE ONLY: entries are added, never removed, never reordered, never weakened.
  - IDEMPOTENT: an entry already present is left as-is (dedup on exact string match) — a
    second run adds nothing.
  - PRESERVES every other key in the file (enabledPlugins, marketplaces, hooks, ...).
  - Creates the file (and parent dir) if absent; tolerates an empty/whitespace file.
  - Fail-soft for callers: merge() raises only on a genuinely unreadable target; the
    installers wrap the call so a failure never breaks install/init.

Usage:
    python3 seed_permissions.py <target-settings.json> [--dry-run]
    python3 seed_permissions.py --self-test
"""
from __future__ import annotations

import json
import os
import sys
import tempfile

# ── THE BASELINE (single source) ──────────────────────────────────────────────
# Read-only + safe-tool allows: no permission prompt for these in any project.
BASELINE_ALLOW = [
    "Read", "Grep", "Glob",
    "Bash(grep:*)", "Bash(rg:*)", "Bash(ls:*)", "Bash(cat:*)", "Bash(cd:*)",
    "Bash(head:*)", "Bash(tail:*)", "Bash(wc:*)", "Bash(find:*)", "Bash(echo:*)",
    "Bash(sort:*)", "Bash(uniq:*)", "Bash(diff:*)", "Bash(sha1sum:*)", "Bash(sed:*)",
    "Bash(python3:*)",
    "Bash(git status:*)", "Bash(git log:*)", "Bash(git diff:*)", "Bash(git show:*)",
    "Bash(git branch:*)",
]
# Destructive / irreversible commands the AGENT must never run on its own.
BASELINE_DENY = [
    "Bash(rm:*)", "Bash(rmdir:*)", "Bash(git push:*)", "Bash(git reset:*)",
    "Bash(git clean:*)",
]


def _load(target: str) -> dict:
    """Load JSON from target, or {} if it is absent or empty. Raises on malformed JSON."""
    if not os.path.exists(target):
        return {}
    with open(target, encoding="utf-8") as fh:
        text = fh.read()
    if not text.strip():
        return {}
    return json.loads(text)


def _add_missing(existing: list, baseline: list) -> list:
    """Return baseline entries not already in existing (order-stable, exact-match dedup)."""
    have = set(existing)
    return [e for e in baseline if e not in have]


def merge(target: str, dry_run: bool = False) -> dict:
    """Additively seed BASELINE_ALLOW/DENY into target settings.json.

    Returns {'added_allow': [...], 'added_deny': [...], 'wrote': bool}. Never removes
    or reorders existing entries; preserves every other key.
    """
    data = _load(target)
    perms = data.get("permissions")
    if not isinstance(perms, dict):
        perms = {}
    allow = perms.get("allow")
    allow = list(allow) if isinstance(allow, list) else []
    deny = perms.get("deny")
    deny = list(deny) if isinstance(deny, list) else []

    add_allow = _add_missing(allow, BASELINE_ALLOW)
    add_deny = _add_missing(deny, BASELINE_DENY)

    allow.extend(add_allow)
    deny.extend(add_deny)
    perms["allow"] = allow
    perms["deny"] = deny
    data["permissions"] = perms

    wrote = False
    if (add_allow or add_deny) and not dry_run:
        parent = os.path.dirname(os.path.abspath(target))
        os.makedirs(parent, exist_ok=True)
        with open(target, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        wrote = True

    return {"added_allow": add_allow, "added_deny": add_deny, "wrote": wrote}


def _report(target: str, result: dict, dry_run: bool) -> None:
    aa, ad = result["added_allow"], result["added_deny"]
    if not aa and not ad:
        print(f"[seed-permissions] {target}: already up to date (0 added)")
        return
    tag = "would add" if dry_run else "added"
    print(f"[seed-permissions] {target}: {tag} {len(ad)} deny + {len(aa)} allow")
    for e in ad:
        print(f"    + deny  {e}")
    for e in aa:
        print(f"    + allow {e}")
    if dry_run:
        print("[seed-permissions] dry-run — no file written")


def self_test() -> int:
    """Exercise: empty→seeded · re-run→no dup · user entries preserved · other keys kept."""
    failures = []
    d = tempfile.mkdtemp()
    tgt = os.path.join(d, "settings.json")

    # 1. absent file → full baseline seeded
    r1 = merge(tgt)
    if not (len(r1["added_deny"]) == len(BASELINE_DENY)
            and len(r1["added_allow"]) == len(BASELINE_ALLOW) and r1["wrote"]):
        failures.append(f"seed-from-absent: {r1}")

    # 2. idempotent: second run adds nothing, writes nothing
    r2 = merge(tgt)
    if r2["added_deny"] or r2["added_allow"] or r2["wrote"]:
        failures.append(f"idempotent: {r2}")

    # 3. dry-run on a seeded file → 0 additions, no write
    r3 = merge(tgt, dry_run=True)
    if r3["added_deny"] or r3["added_allow"] or r3["wrote"]:
        failures.append(f"dry-run-seeded: {r3}")

    # 4. user's own entries + other keys preserved; only missing baseline added
    tgt2 = os.path.join(d, "user.json")
    with open(tgt2, "w", encoding="utf-8") as fh:
        json.dump({
            "permissions": {"allow": ["Bash(npm:*)"], "deny": ["Bash(rm:*)"]},
            "enabledPlugins": {"x@y": True},
            "tui": "fullscreen",
        }, fh)
    merge(tgt2)
    got = json.load(open(tgt2, encoding="utf-8"))
    if got.get("enabledPlugins") != {"x@y": True} or got.get("tui") != "fullscreen":
        failures.append("other-keys-not-preserved")
    if "Bash(npm:*)" not in got["permissions"]["allow"]:
        failures.append("user-allow-dropped")
    if got["permissions"]["deny"].count("Bash(rm:*)") != 1:
        failures.append("deny-duplicated")
    if "Bash(git push:*)" not in got["permissions"]["deny"]:
        failures.append("baseline-deny-not-added")

    if failures:
        print("SELF-TEST FAIL:")
        for f in failures:
            print("  -", f)
        return 1
    print("SELF-TEST PASS: seed-from-absent · idempotent · dry-run · preserve user+keys")
    return 0


def main(argv: list) -> int:
    args = [a for a in argv if a != "--dry-run"]
    dry_run = "--dry-run" in argv
    if "--self-test" in argv:
        return self_test()
    if len(args) != 1:
        print("usage: seed_permissions.py <target-settings.json> [--dry-run]", file=sys.stderr)
        print("       seed_permissions.py --self-test", file=sys.stderr)
        return 2
    target = os.path.expanduser(args[0])
    try:
        result = merge(target, dry_run=dry_run)
    except json.JSONDecodeError as e:
        print(f"[seed-permissions] ERROR: {target} is not valid JSON ({e}) — left untouched",
              file=sys.stderr)
        return 1
    _report(target, result, dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
