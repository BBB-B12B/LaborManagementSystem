#!/usr/bin/env python3
"""tag_gate_test.py — T-320 S5 · full block/allow matrix for the label/topic hard-gate.

Hermetic: builds a sandbox topic_registry.json + index_files.json in a tempdir and
points BOTH tag_gate and index_reconcile at it, so the real repo files are never
touched. Every case sets its own env explicitly, so the suite passes regardless of
whether enforcement defaults ON or OFF.

Matrix:
  1 block-untagged   · untagged knowledge doc + enforce ON            -> blocked
  2 allow-exempt     · .sessions/ · scripts/ · topic_registry.json    -> clean
  3 T-252 non-regress· tagged-but-modified knowledge doc              -> clean
  4 escape-hatch     · HARNESS_SKIP_TAG_GATE=1                         -> clean
  5 headless-autotag · resolve('knowledge base') reuses existing id   -> reuse (no block)
  6 false-merge-guard· resolve('prompt caching') NOT merged to kb     -> distinct id
  7 delete-prune     · orphan label removed · used label kept         -> correct

Run: python3 scripts/tag_gate_test.py   (exit 0 = all green)
"""
from __future__ import annotations

import json
import os
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import tag_gate  # noqa: E402
import index_reconcile as ir  # noqa: E402


def _sandbox():
    tmp = tempfile.mkdtemp(prefix="taggate-")
    reg_p = os.path.join(tmp, "topic_registry.json")
    idx_p = os.path.join(tmp, "index_files.json")
    reg = {
        "topics": ["knowledge_base", "prompt_caching", "per_turn_routing"],
        "descriptions": {
            "knowledge_base": "knowledge/ directory files, reference + design docs",
            "prompt_caching": "prompt cache usage, hit rates, cost via caching",
            "per_turn_routing": "C0/C1/C2/C3 routing gates, topic-switch detection",
        },
        "labels_by_topic": {"knowledge_base": ["used label X", "orphan label Y"]},
    }
    idx = {
        "knowledge/tagged.md": {
            "topics": {"major": ["knowledge_base"], "minor": []},
            "backfill_pending": False,
            "topic_map": [{"topic": "knowledge_base", "label": "used label X"}],
        },
    }
    json.dump(reg, open(reg_p, "w"))
    json.dump(idx, open(idx_p, "w"))
    # redirect BOTH modules at the sandbox
    tag_gate._REGISTRY, tag_gate._INDEX = reg_p, idx_p
    ir.REGISTRY, ir.INDEX = reg_p, idx_p
    return reg_p, idx_p


def _clear_env():
    os.environ.pop("HARNESS_SKIP_TAG_GATE", None)
    os.environ.pop("HARNESS_TAG_GATE_ENFORCE", None)


def run():
    _sandbox()
    results = []

    def check(name, passed):
        results.append((name, bool(passed)))

    # 1 block-untagged (enforce ON)
    _clear_env()
    os.environ["HARNESS_TAG_GATE_ENFORCE"] = "1"
    blk = ir.tag_gate_check({"knowledge/untagged.md": "new"})
    check("1 block-untagged (enforce ON) -> blocked", len(blk) == 1)

    # 2 allow-exempt
    exempt = ir.tag_gate_check({
        ".sessions/x.md": "new",
        "scripts/y.py": "new",
        "knowledge/topic_registry.json": "modified",
        "tests/t.py": "modified",
    })
    check("2 exempt paths -> clean", exempt == [])

    # 3 T-252 non-regress (tagged + modified)
    t252 = ir.tag_gate_check({"knowledge/tagged.md": "modified"})
    check("3 T-252 tagged-but-modified -> clean", t252 == [])

    # 4 escape hatch
    os.environ["HARNESS_SKIP_TAG_GATE"] = "1"
    esc = ir.tag_gate_check({"knowledge/untagged.md": "new"})
    check("4 escape hatch -> clean", esc == [])
    os.environ.pop("HARNESS_SKIP_TAG_GATE", None)

    # 5 headless auto-tag: reuse-first resolve returns an existing id (no human needed)
    r = tag_gate.resolve("knowledge base")
    check("5 headless auto-tag reuse -> knowledge_base",
          r["verdict"] == "reuse" and r["matched_id"] == "knowledge_base")

    # 6 false-merge guard
    r = tag_gate.resolve("prompt caching")
    check("6 false-merge guard -> not merged into knowledge_base",
          r["matched_id"] != "knowledge_base")

    # 7 delete-prune: orphan Y removed, used X kept, backup made
    _pruned, _rep = ir.prune_orphan_labels(dry_run=False)
    after = json.load(open(ir.REGISTRY))["labels_by_topic"].get("knowledge_base", [])
    check("7 delete-prune orphan gone + used kept",
          "orphan label Y" not in after and "used label X" in after)

    _clear_env()
    ok = all(p for _, p in results)
    for name, passed in results:
        print(f"  [{'PASS' if passed else 'FAIL'}] {name}")
    n = sum(1 for _, p in results if p)
    print(f"tag_gate matrix: {'ALL PASS' if ok else 'FAILURES'} ({n}/{len(results)})")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(run())
