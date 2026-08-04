#!/usr/bin/env python3
"""cycle_plan.py — the ONE shared parser for a plan's '### Cycle grouping' block.

WHY (T-321c item c · ROOT): spawn_gate.py and execution_schedule.py each parsed
the SAME '### Cycle grouping' block with their OWN regex, and the two regexes
DISAGREED — spawn_gate normalized `->`/`=>`→`→` and accepted an en-dash `–`
delimiter; execution_schedule did NEITHER, but DID strip `[...]`/`(...)` glosses
and capture per-section inline annotations. A block one script read correctly the
other could read wrong (phantom sections, a silently-disabled hard-block, a
truncated preview). This module is the SINGLE SOURCE for "how a Cycle grouping
line is parsed". It is a strict SUPERSET of both former parsers:

  * arrow normalization      (from spawn_gate)   `->` / `=>` → `→`
  * en-dash delimiter        (from spawn_gate)   `[—\\-–]+`
  * strip bracket/paren gloss (from execution_schedule) so a prose re-mention of
    an ID cannot create a phantom duplicate section / inflated parallel count
  * `\\bS\\d+\\b(?!\\s*=)`      (from execution_schedule) so an `S4 = ...` gloss
    is not mistaken for a real section id
  * per-section inline `(...)` annotation capture (from execution_schedule)

Both consumers now import this and drop their own regex, so they can NEVER
disagree again.

RETURN SHAPE (one canonical structure both consumers project from):
    {
      "cycles": [ {"number": int, "mode": str, "parallel": bool,
                   "sections": ["S1", ...]} ],           # sorted by number
      "section_map": { "S1": {"cycle": int, "parallel": bool}, ... },
      "annotations": { "S1": "inline (...) note", ... },
    }
  `mode` is the raw word after the delimiter, lower-cased ("serial" · "parallel"
  · "all" for an "all sequential" line). `parallel` = mode.startswith("parallel")
  — the single truth for serial-vs-parallel, so a consumer never re-derives it.

USAGE:
    import cycle_plan
    parsed = cycle_plan.parse_cycle_grouping(plan_text)
  (test)  python3 scripts/cycle_plan.py --self-test
"""
import re
import sys

# ASCII / fat arrows → the canonical unicode arrow, BEFORE any parsing. A plan
# authored (or auto-normalized) with "->" / "=>" would otherwise leave the tail
# empty for a `→`-only regex → zero sections mapped. Match every spelling.
_ARROW_RE = re.compile(r"-+>|=+>")
# `Cycle <n> <delim> <mode>` — delimiter accepts em-dash, hyphen, en-dash.
_CYCLE_RE = re.compile(r"\s*Cycle\s+(\d+)\s*[—\-–]+\s*(\w+)")
# per-section inline annotation: `S2 (some note)`
_ANNOT_RE = re.compile(r"S(\d+)\s*\(([^)]*)\)")
# real section id, but NOT an `S4 = ...` gloss (negative-lookahead)
_SECTION_RE = re.compile(r"\bS\d+\b(?!\s*=)")


def normalize_arrows(text):
    """`->` / `=>` (any run length) → `→`. Idempotent."""
    return _ARROW_RE.sub("→", text)


def _cycle_block_lines(plan_text):
    """The lines strictly INSIDE the '### Cycle grouping' block (block ends at
    the next '###' heading or EOF). Empty list if the block is absent."""
    lines = []
    in_block = False
    for line in plan_text.splitlines():
        if line.startswith("### Cycle grouping"):
            in_block = True
            continue
        if in_block and line.startswith("###"):
            break
        if in_block:
            lines.append(line)
    return lines


def parse_cycle_grouping(plan_text):
    """Parse the Cycle grouping block into the canonical structure (see module
    docstring). Never raises for a missing/empty block — returns empty parts."""
    cycles = []
    section_map = {}
    annotations = {}

    for raw_line in _cycle_block_lines(plan_text):
        line = normalize_arrows(raw_line)
        m = _CYCLE_RE.match(line)
        if not m:
            continue
        number = int(m.group(1))
        mode = m.group(2).strip().lower()
        parallel = mode.startswith("parallel")

        arrow = line.split("→", 1)
        tail = arrow[1] if len(arrow) > 1 else ""

        # 1) capture each section's inline "(...)" annotation FIRST (spawn/main
        #    markers often live here, not in the section's own header).
        for am in _ANNOT_RE.finditer(tail):
            annotations[f"S{am.group(1)}"] = am.group(2)

        # 2) strip bracket/paren glosses BEFORE scanning ids, so a prose gloss
        #    that re-mentions an id can't create a phantom duplicate / inflate
        #    the parallel count.
        cleaned = re.sub(r"\[[^\]]*\]", "", tail)   # [ ... ] notes
        cleaned = re.sub(r"\([^)]*\)", "", cleaned)  # ( ... ) glosses
        sections = _SECTION_RE.findall(cleaned)

        cycles.append({"number": number, "mode": mode,
                       "parallel": parallel, "sections": sections})
        for sid in sections:
            section_map[sid] = {"cycle": number, "parallel": parallel}

    cycles.sort(key=lambda c: c["number"])
    return {"cycles": cycles, "section_map": section_map,
            "annotations": annotations}


# --- self-test (pure in-memory · covers every superset guard) -------------------
def _self_test():
    fails = []

    # A: ASCII + fat arrows normalize; en-dash delimiter parses.
    a = parse_cycle_grouping(
        "### Cycle grouping\n"
        "Cycle 1 – serial -> S1 (foo)\n"          # en-dash delim + ASCII arrow
        "Cycle 2 — parallel => S2 (bar), S3 (baz)\n"  # em-dash + fat arrow
        "### next\n"
    )
    if set(a["section_map"]) != {"S1", "S2", "S3"}:
        fails.append(f"A ids={sorted(a['section_map'])}")
    if not a["section_map"].get("S2", {}).get("parallel"):
        fails.append("A S2 should be parallel")
    if a["section_map"].get("S1", {}).get("parallel"):
        fails.append("A S1 should be serial")

    # B: phantom-dup guard — a bracket note + an `S9 = ...` gloss must NOT
    #    become real sections; only S2, S3 are real.
    b = parse_cycle_grouping(
        "### Cycle grouping\n"
        "Cycle 1 — parallel → S2, S3  [ note: \"parallel\" = S9 spawned while S8 runs ] (S4 = x)\n"
        "### x\n"
    )
    if sorted(b["cycles"][0]["sections"]) != ["S2", "S3"]:
        fails.append(f"B sections={b['cycles'][0]['sections']}")

    # C: annotation capture.
    c = parse_cycle_grouping(
        "### Cycle grouping\n"
        "Cycle 1 — parallel → S2 (spawn-delegated), S3 (main context)\n"
        "### x\n"
    )
    if c["annotations"].get("S2") != "spawn-delegated":
        fails.append(f"C annot={c['annotations']}")

    # D: 'all sequential' line — mode captured as 'all', parallel False.
    d = parse_cycle_grouping(
        "### Cycle grouping\n"
        "Cycle 1 — all sequential\n"
        "### x\n"
    )
    if not d["cycles"] or d["cycles"][0]["parallel"] or d["cycles"][0]["mode"] != "all":
        fails.append(f"D cycles={d['cycles']}")

    # E: missing block → empty, no raise.
    e = parse_cycle_grouping("# no grouping here\n")
    if e["cycles"] or e["section_map"] or e["annotations"]:
        fails.append("E non-empty on missing block")

    if fails:
        print("[cycle-plan self-test] FAIL:", "; ".join(fails))
        return 1
    print("[cycle-plan self-test] PASS "
          "(arrow-normalize · en-dash · phantom-dup guard · annotations · "
          "all-sequential · missing-block)")
    return 0


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        sys.exit(_self_test())
    # default: preview-parse the real plan (handy for eyeballing)
    import json as _json
    path = sys.argv[1] if len(sys.argv) > 1 else ".sessions/mece_plan.md"
    try:
        with open(path, encoding="utf-8") as _fh:
            print(_json.dumps(parse_cycle_grouping(_fh.read()), indent=2))
    except OSError as exc:
        print(f"[cycle-plan] could not read {path}: {exc}")
