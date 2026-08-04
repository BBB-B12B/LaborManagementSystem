#!/usr/bin/env python3
"""execution_schedule.py — visible cycle/spawn/model preview (T-321 S2).

WHY: the MECE loop can now spawn a whole cycle's sections in parallel
(orchestrator "two-level cycle loop"). Before that runs, the user should
SEE what is about to happen: which sections group into which cycle,
whether the cycle runs serial or parallel, how many agents that implies,
which model each section is assigned, and whether each section is
expected to be delegated to a sub-agent (spawn) or run inline in the
main context. This script renders that preview from the plan file
alone — it is READ-ONLY and never edits the plan.

Usage:
    python3 scripts/execution_schedule.py [path/to/mece_plan.md]

Default plan path: .sessions/mece_plan.md
"""

import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import cycle_plan   # noqa: E402 — the ONE shared Cycle-grouping parser (T-321c)

DEFAULT_PLAN_PATH = ".sessions/mece_plan.md"

# A section counts as "delegated" (spawn) when its Model line is
# model_low OR model_medium (T-328: model_medium spawns to the sonnet
# tier — it must NOT silently collapse to main/opus, which was the whole
# "sonnet never fires" bug), OR the section header / model comment carries
# an explicit spawn marker ("spawn-delegated"). Everything else — model_high,
# OR ANY tier carrying an explicit MAIN marker (sensitive / core-file /
# judgment) — runs in the main context. The MAIN marker ALWAYS wins over the
# tier value (safety-list override · is_delegated checks it first).
# NOTE: the marker must be unambiguous — a bare "delegate" would match
# the NEGATED phrases "not delegated" / "delegate-forbidden" as a
# substring and wrongly flag a main-context section as spawn (this bit
# S5 in the reference plan). Only "spawn-delegated" is used as the
# positive marker for that reason.
DELEGATE_MODEL_VALUES = {"model_low", "model_medium"}
DELEGATE_MARKERS = ("spawn-delegated",)
MAIN_MARKERS = ("main context",)


def parse_cycle_grouping(text):
    """Extract the '### Cycle grouping' block and parse each cycle line.

    Thin projection over cycle_plan.parse_cycle_grouping — the SINGLE source of
    how a Cycle-grouping line is parsed (T-321c item c). Returns (cycles,
    annotations) in the shape this module's renderer expects:
      cycles      — list of {number, mode, sections (list of str)}
      annotations — {section_id: its inline "(...)" note}
    Returns ([], {}) when the block is missing/empty (never raises)."""
    parsed = cycle_plan.parse_cycle_grouping(text)
    cycles = [{"number": c["number"], "mode": c["mode"], "sections": c["sections"]}
              for c in parsed["cycles"]]
    return cycles, parsed["annotations"]


def parse_section_models(text):
    """Extract each '### S<N> ...' section header block: its Model: field
    plus the header line itself (which often carries a
    "[Cycle N · mode · SPAWN-delegated|MAIN context ...]" tag — the
    clearest signal of spawn vs main intent).

    Returns (models, raw_lines):
      models:    {"S2": "model_medium", ...}
      raw_lines: {"S2": "<header line> <Model: line>", ...} — combined
                 text used for delegate/main marker detection.
    """
    models = {}
    raw_lines = {}

    header_re = re.compile(r"^###\s+(S\d+)\b.*$", re.MULTILINE)
    headers = list(header_re.finditer(text))
    for i, hm in enumerate(headers):
        sec_id = hm.group(1)
        header_line = hm.group(0)
        start = hm.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        section_block = text[start:end]

        model_m = re.search(r"^Model:\s*(\S+)(.*)$", section_block, re.MULTILINE)
        if model_m:
            models[sec_id] = model_m.group(1).strip()
            model_line = (model_m.group(0) or "").strip()
        else:
            models[sec_id] = None
            model_line = ""

        raw_lines[sec_id] = f"{header_line}\n{model_line}"

    return models, raw_lines


def is_delegated(section_id, models, raw_lines):
    """Decide spawn (delegate) vs main, per the spec's rule of thumb.

    Priority: an explicit MAIN marker (e.g. "MAIN context") always wins
    over a bare model_low/model_medium value, since S3 in the reference
    plan is deliberately "MAIN context opus" (settings.json is sensitive
    and delegate-forbidden even though opus is not itself a spawn
    trigger). After that: an explicit delegate marker (e.g.
    "SPAWN-delegated"), then the Model: value itself.
    """
    model = (models.get(section_id) or "").lower()
    raw = (raw_lines.get(section_id) or "").lower()

    if any(marker in raw for marker in MAIN_MARKERS):
        return False
    if any(marker in raw for marker in DELEGATE_MARKERS):
        return True
    if model in DELEGATE_MODEL_VALUES:
        return True
    return False


def render_table(cycles, models, raw_lines):
    """Build the printable preview table + summary line."""
    lines = []
    header = "{:<7} {:<18} {:<10} {:<9} {:<16} {:<8}".format(
        "Cycle", "Sections", "mode", "parallel", "model", "spawn"
    )
    lines.append(header)
    lines.append("-" * len(header))

    max_parallel = 1
    spawn_count = 0

    for cyc in cycles:
        num = cyc["number"]
        mode = cyc["mode"]
        sections = cyc["sections"]

        if mode == "parallel":
            parallel_count = len(sections) if sections else 1
        else:
            parallel_count = 1
        max_parallel = max(max_parallel, parallel_count)

        if not sections:
            lines.append(
                "{:<7} {:<18} {:<10} {:<9} {:<16} {:<8}".format(
                    f"Cycle {num}", "(none)", mode, str(parallel_count), "-", "-"
                )
            )
            continue

        for idx, sec in enumerate(sections):
            model = models.get(sec) or "unknown"
            delegated = is_delegated(sec, models, raw_lines)
            if delegated:
                spawn_count += 1
            spawn_label = "spawn" if delegated else "main"

            cyc_label = f"Cycle {num}" if idx == 0 else ""
            mode_label = mode if idx == 0 else ""
            parallel_label = str(parallel_count) if idx == 0 else ""

            lines.append(
                "{:<7} {:<18} {:<10} {:<9} {:<16} {:<8}".format(
                    cyc_label, sec, mode_label, parallel_label, model, spawn_label
                )
            )

    summary = "[schedule] cycles:{} · max-parallel:{} · spawns:{}".format(
        len(cycles), max_parallel, spawn_count
    )
    return "\n".join(lines), summary


def main(argv):
    plan_path = argv[1] if len(argv) > 1 else DEFAULT_PLAN_PATH

    try:
        with open(plan_path, "r", encoding="utf-8") as f:
            text = f.read()
    except OSError as exc:
        print(f"[schedule] could not read plan file: {plan_path} ({exc})")
        return 0

    cycles, cycle_annotations = parse_cycle_grouping(text)
    models, raw_lines = parse_section_models(text)
    # Fold each section's Cycle-grouping annotation into the text that
    # is_delegated inspects (spawn/main markers can live there, not only
    # in the section's own header block).
    for sec, ann in cycle_annotations.items():
        raw_lines[sec] = (raw_lines.get(sec, "") + "\n" + ann)

    if not cycles:
        print(
            "[schedule] no '### Cycle grouping' block found (or it has no "
            "cycle lines) in {} — nothing to preview.".format(plan_path)
        )
        return 0

    # Tolerate the single-non-parallel-cycle case explicitly, per spec. The
    # mode word after the delimiter may be "serial", "sequential", or "all"
    # (as in "Cycle 1 — all sequential") — all mean one-agent serial. The old
    # check only matched "serial", so an "all sequential" plan fell through to
    # the table (T-321c item b · all-seq special-case never fired).
    if len(cycles) == 1 and cycles[0]["mode"] in ("serial", "sequential", "all"):
        print("Cycle 1 — all sequential · 1 agent")
        return 0

    table, summary = render_table(cycles, models, raw_lines)
    print(table)
    print()
    print(summary)
    return 0


def _self_test():
    """T-321c S2: verify the render paths from a real subprocess call —
    all-sequential + single-serial → the one-line summary; a parallel plan →
    the table with correct max-parallel + spawn counts."""
    import os as _os
    import subprocess
    import tempfile

    fails = []

    def _run(plan_text):
        d = tempfile.mkdtemp()
        p = _os.path.join(d, "plan.md")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(plan_text)
        return subprocess.run(
            [sys.executable, _os.path.abspath(__file__), p],
            capture_output=True, text=True,
        ).stdout

    # A: an "all sequential" line renders the one-line summary (the item-b bug).
    a = _run("### Cycle grouping\nCycle 1 — all sequential\n### x\n")
    if "all sequential" not in a:
        fails.append(f"A all-seq render: {a!r}")

    # B: a single plain-"serial" cycle takes the same one-line path.
    b = _run("### Cycle grouping\nCycle 1 — serial → S1 (x)\n### x\n")
    if "all sequential" not in b:
        fails.append(f"B serial render: {b!r}")

    # C: a parallel plan renders the table with the right counts + spawn flag
    #    (S2 model_low → spawn · S3 "main context" marker → main).
    c = _run(
        "### Cycle grouping\n"
        "Cycle 1 — serial → S1 (x)\n"
        "Cycle 2 — parallel → S2 (spawn-delegated), S3 (main context)\n"
        "### S2 title\nModel: model_low\n"
        "### S3 title\nModel: model_high\n"
    )
    if "max-parallel:2" not in c or "spawns:1" not in c:
        fails.append(f"C parallel table: {c!r}")

    if fails:
        print("[schedule self-test] FAIL:", "; ".join(fails))
        return 1
    print("[schedule self-test] PASS (all-seq · serial-single · parallel-table)")
    return 0


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        sys.exit(_self_test())
    sys.exit(main(sys.argv))
