#!/usr/bin/env python3
"""plan_lint.py -- T-340 Phase-2-close tier linter + dormancy report.

WHY: T-328 made the plan's `Model:` field BINDING -- spawn_gate.py hard-blocks
marking a model_low/medium section [X] without a real spawn proof. But that
enforces only the SECOND half of the chain: it fires only IF a section is
already labeled cheap. Nothing forced honest cheap-labeling, the omit-default
was main/opus (expensive), and dormancy was invisible -- so across the two weeks
after T-328 delegation NEVER fired (0 proofs). plan_lint makes the LABELING
itself visible + checked at Phase-2 close, and reports realized-vs-planned tier
use at close.

SINGLE-SOURCE: reuses execution_schedule.parse_section_models / is_delegated
(the ONE section-block parser, T-321c) -- NO new regex for sections/tiers.

MODES:
  plan_lint.py <plan.md>              lint: every Phase-3 section must carry a
                                      Model:; each model_high needs a
                                      justification + a MAIN marker; prints the
                                      tier-distribution table. exit 1 if any
                                      section is missing Model: (hard flag);
                                      else 0 (warnings are advisory).
  plan_lint.py --dormancy <plan.md>   sections labeled model_low/medium with NO
                                      cycle_*.json proof -> [tier-dormant];
                                      else [tier-realized]. exit 0 (advisory).
  plan_lint.py --self-test            built-in fixtures.

FAIL-OPEN: any internal/parse error -> log to stderr, exit 0. A plan-time lint
that crashes must never brick planning. Never blocks; it flags.
"""
import glob
import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import execution_schedule as sched   # noqa: E402 -- the ONE section/tier parser (T-321c single-source)

SESSIONS_DIR = os.path.join(os.path.dirname(_HERE), ".sessions")

# a model_high line should carry EITHER a reason or a MAIN safety marker;
# "rest" = whatever follows the tier token on the Model: line.
_TIER_REST = re.compile(r"model_(?:low|medium|high)(.*)$", re.IGNORECASE | re.MULTILINE)


def _load(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def _model_line_rest(raw_line):
    """Text after the tier token on a section's Model: line ('' if none)."""
    m = _TIER_REST.search(raw_line or "")
    return (m.group(1).strip(" .-:·") if m else "")


def _field_val(raw, name):
    """Real value after '<name>:' in a section block, '' if absent or a <placeholder>.
    String-only (no regex import needed). A value may itself contain ':' (file:line)."""
    key = name.lower() + ":"
    for line in (raw or "").splitlines():
        if line.strip().lower().startswith(key):
            val = line.split(":", 1)[1].strip()
            return "" if (not val or val.lstrip().startswith("<")) else val
    return ""


def _section_blocks(text):
    """{sec_id: full block text} split on '### S<n>' headers (field-presence scan
    only — sched.parse_section_models stays the ONE tier parser; this does not read
    models/tiers, just locates each section's lines for Context-* field checks)."""
    blocks, cur, buf = {}, None, []
    for line in text.splitlines():
        m = re.match(r"^###\s+S(\d+)\b", line)
        if m:
            if cur:
                blocks[cur] = "\n".join(buf)
            cur, buf = "S" + m.group(1), [line]
        elif line.startswith("## ") and cur:      # next phase header ends the block
            blocks[cur] = "\n".join(buf); cur, buf = None, []
        elif cur is not None:
            buf.append(line)
    if cur:
        blocks[cur] = "\n".join(buf)
    return blocks


def context_prep_summary(text):
    """T-345 dormancy meter: how many HEAVY sections (those declaring Context-full)
    actually carry a prepared slice. Soft-visible only — never changes exit code.
    'heavy' = the planner declared Context-full (opted in at M5.5); such a section
    should carry Context-shrunk (prepared) OR whole-file-needed (skipped w/ reason)."""
    heavy = prepared = skipped = 0
    unprepared = []
    for sec, raw in sorted(_section_blocks(text).items(),
                           key=lambda kv: int(kv[0][1:]) if kv[0][1:].isdigit() else 0):
        if not _field_val(raw, "Context-full"):
            continue
        heavy += 1
        if _field_val(raw, "Context-shrunk"):
            prepared += 1
        elif _field_val(raw, "whole-file-needed"):
            skipped += 1
        else:
            unprepared.append(sec)
    if not heavy:
        return []
    out = ["[plan-lint] context-prep: heavy={} prepared={} skipped={}".format(heavy, prepared, skipped)]
    if unprepared:
        out.append("[plan-lint] CTX-UNPREPARED (heavy section, no Context-shrunk + no "
                   "whole-file-needed): " + ", ".join(unprepared))
    return out


def lint(text):
    """Return (exit_code, report_lines). exit 1 only on a MISSING-MODEL (hard)."""
    models, raw_lines = sched.parse_section_models(text)
    report = []
    if not models:
        return 0, ["[plan-lint] no Phase-3 sections found -- nothing to lint"]

    missing, high_no_justify, high_no_main = [], [], []
    n_low = n_med = n_high = n_none = 0
    delegated = 0

    for sec in sorted(models, key=lambda s: int(s[1:]) if s[1:].isdigit() else 0):
        tier = (models.get(sec) or "").lower()
        raw = raw_lines.get(sec, "")
        if not tier:
            missing.append(sec)
            n_none += 1
            continue
        if tier == "model_low":
            n_low += 1
        elif tier == "model_medium":
            n_med += 1
        elif tier == "model_high":
            n_high += 1
            if not _model_line_rest(raw):
                high_no_justify.append(sec)
            if not any(mk in raw.lower() for mk in sched.MAIN_MARKERS):
                high_no_main.append(sec)
        if sched.is_delegated(sec, models, raw_lines):
            delegated += 1

    total = len(models)
    report.append("[plan-lint] tier distribution ({} sections):".format(total))
    report.append("  low:{}  medium:{}  high:{}  (no-Model:{})  -> delegated(spawn):{}".format(
        n_low, n_med, n_high, n_none, delegated))

    if missing:
        report.append("[plan-lint] MISSING-MODEL (hard -- never silent-opus): " + ", ".join(missing))
    if high_no_justify:
        report.append("[plan-lint] HIGH-NO-JUSTIFY (add a 1-line reason): " + ", ".join(high_no_justify))
    if high_no_main:
        report.append("[plan-lint] HIGH-NO-MAIN (model_high w/o a MAIN safety marker -- "
                      "justify or downgrade to medium): " + ", ".join(high_no_main))
    if n_high and delegated == 0 and total >= 3:
        report.append("[plan-lint] HIGH-OVERUSE warn: {}/{} high, 0 delegated -- "
                      "is every section really judgment/sensitive?".format(n_high, total))
    if not (missing or high_no_justify or high_no_main):
        report.append("[plan-lint] labeling clean")

    report += context_prep_summary(text)   # T-345 · soft, never changes exit code
    return (1 if missing else 0), report


def _proof_for(section_id):
    """True if any .sessions/cycle_*.json attests this section (filename or content)."""
    for p in glob.glob(os.path.join(SESSIONS_DIR, "cycle_*.json")):
        base = os.path.basename(p)
        if base.endswith("_{}.json".format(section_id)):
            return True
        try:
            with open(p, encoding="utf-8") as fh:
                if json.load(fh).get("section") == section_id:
                    return True
        except Exception:
            continue
    return False


def dormancy(text):
    """Realized-vs-planned tier use. Advisory (exit 0)."""
    models, raw_lines = sched.parse_section_models(text)
    planned = [s for s in models if sched.is_delegated(s, models, raw_lines)]
    if not planned:
        return 0, ["[tier-none] no section was planned for delegation (all main) -- nothing to realize"]
    dormant = [s for s in planned if not _proof_for(s)]
    realized = [s for s in planned if s not in dormant]
    out = ["[tier] planned-delegate:{} realized:{} dormant:{}".format(
        len(planned), len(realized), len(dormant))]
    if dormant:
        out.append("[tier-dormant] planned cheap but NO spawn proof: " + ", ".join(sorted(dormant))
                    + " -- ran on main/opus, or the section never spawned")
    else:
        out.append("[tier-realized] every planned-delegate section left a spawn proof")
    return 0, out


def _self_test():
    ok = True
    # 1 -- missing Model: -> hard exit 1
    p1 = ("## Phase 3\n### S1 title [Cycle 1]\nModel: model_low\n- [ ] S1\n"
          "### S2 title [Cycle 1]\nFile: x\n- [ ] S2\n")
    c, r = lint(p1)
    if not (c == 1 and any("MISSING-MODEL" in x and "S2" in x for x in r)):
        print("FAIL t1 missing-model", r); ok = False
    # 2 -- model_high with no justify + no MAIN marker -> warn, exit 0
    p2 = ("## Phase 3\n### S1 t [Cycle 1]\nModel: model_high\n- [ ] S1\n")
    c, r = lint(p2)
    if not (c == 0 and any("HIGH-NO-JUSTIFY" in x for x in r) and any("HIGH-NO-MAIN" in x for x in r)):
        print("FAIL t2 high-warn", r); ok = False
    # 3 -- model_high WITH reason + MAIN marker -> clean
    p3 = ("## Phase 3\n### S1 t [Cycle 1]\nModel: model_high * MAIN context (core routing judgment)\n- [ ] S1\n")
    c, r = lint(p3)
    if not (c == 0 and any("labeling clean" in x for x in r)):
        print("FAIL t3 clean", r); ok = False
    # 4 -- dormancy: a delegated section with no proof -> dormant
    p4 = ("## Phase 3\n### S9 t [Cycle 1]\nModel: model_low\n- [ ] S9\n")
    c, r = dormancy(p4)
    if not (c == 0 and any("tier-dormant" in x and "S9" in x for x in r)):
        print("FAIL t4 dormant", r); ok = False
    # 5 -- dormancy: no delegated sections -> tier-none
    p5 = ("## Phase 3\n### S1 t [Cycle 1]\nModel: model_high * MAIN context (x)\n- [ ] S1\n")
    c, r = dormancy(p5)
    if not (c == 0 and any("tier-none" in x for x in r)):
        print("FAIL t5 none", r); ok = False
    # 6 -- T-345 context-prep: heavy section w/o slice + w/o escape -> CTX-UNPREPARED, exit still 0
    p6 = ("## Phase 3\n### S1 t [Cycle 1]\nModel: model_high * MAIN context (x)\n"
          "Context-full: scripts/x.py:1-200\n- [ ] S1\n")
    c, r = lint(p6)
    if not (c == 0 and any("context-prep: heavy=1 prepared=0 skipped=0" in x for x in r)
            and any("CTX-UNPREPARED" in x and "S1" in x for x in r)):
        print("FAIL t6 ctx-unprepared", r); ok = False
    # 7 -- context-prep: heavy section WITH a prepared slice -> counted prepared, no flag
    p7 = ("## Phase 3\n### S1 t [Cycle 1]\nModel: model_high * MAIN context (x)\n"
          "Context-full: scripts/x.py:1-200\nContext-shrunk: .sessions/plan_ctx/T/S1.md\n- [ ] S1\n")
    c, r = lint(p7)
    if not (c == 0 and any("context-prep: heavy=1 prepared=1 skipped=0" in x for x in r)
            and not any("CTX-UNPREPARED" in x for x in r)):
        print("FAIL t7 ctx-prepared", r); ok = False
    # 8 -- heavy section marked whole-file-needed -> counted skipped, no flag
    p8 = ("## Phase 3\n### S1 t [Cycle 1]\nModel: model_high * MAIN context (x)\n"
          "Context-full: scripts/x.py:1-200\nwhole-file-needed: needs full file\n- [ ] S1\n")
    c, r = lint(p8)
    if not (c == 0 and any("context-prep: heavy=1 prepared=0 skipped=1" in x for x in r)
            and not any("CTX-UNPREPARED" in x for x in r)):
        print("FAIL t8 ctx-skipped", r); ok = False
    print("plan_lint self-test: {}".format("ALL PASS" if ok else "FAILURES ABOVE"))
    return 0 if ok else 1


def _hook_mode():
    """PostToolUse: if the just-edited file is mece_plan.md, run lint + surface
    flags. exit 2 on MISSING-MODEL (forces agent attention); else advisory 0.
    Silent on a clean plan (only speaks when there is something to flag).
    FAIL-OPEN on any error -- a hook that crashes must never break editing."""
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return 0
        fp = ((json.loads(raw).get("tool_input") or {}).get("file_path") or "")
        if os.path.basename(fp) != "mece_plan.md" or not os.path.exists(fp):
            return 0
        code, report = lint(_load(fp))
        noisy = code == 1 or any(("HIGH" in r or "OVERUSE" in r) for r in report)
        if noisy:
            print("\n".join(report), file=sys.stderr)
        return 2 if code == 1 else 0
    except Exception as e:
        print("[plan-lint] hook fail-open: {}".format(e), file=sys.stderr)
        return 0


def main(argv):
    try:
        if "--self-test" in argv:
            return _self_test()
        if "--hook" in argv:
            return _hook_mode()
        if "--dormancy" in argv:
            rest = [a for a in argv if a != "--dormancy"]
            if not rest:
                print("usage: plan_lint.py --dormancy <plan.md>", file=sys.stderr)
                return 0
            code, report = dormancy(_load(rest[0]))
        else:
            if not argv:
                print("usage: plan_lint.py <plan.md> | --dormancy <plan.md> | --self-test", file=sys.stderr)
                return 0
            code, report = lint(_load(argv[0]))
        print("\n".join(report))
        return code
    except Exception as e:  # FAIL-OPEN -- never brick planning
        print("[plan-lint] fail-open (internal error, not blocking): {}".format(e), file=sys.stderr)
        return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
