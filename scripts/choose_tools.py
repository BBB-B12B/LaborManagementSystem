#!/usr/bin/env python3
"""
choose_tools.py — keyword search across skill-manifest + tool-manifest
Returns top-N skills/tools matching the given keywords.

Usage:
  python scripts/choose_tools.py --keywords "create,new file,สร้าง" [--top 3] [--json]
  python scripts/choose_tools.py --keywords "fix,bug" --skills-only
  python scripts/choose_tools.py --keywords "bash,run" --tools-only

Module:
  from scripts.choose_tools import choose_tools
  results = choose_tools(["create", "new file"], top=3)
"""

import json
import argparse
import os
import re
from pathlib import Path

BASE = Path(__file__).parent.parent
SKILL_MANIFEST = BASE / ".agents" / "skills" / "skill-manifest.json"
TOOL_MANIFEST = BASE / ".agents" / "tools" / "tool-manifest.json"


def _score_skill(skill_id: str, entry: dict, keywords: list[str]) -> int:
    score = 0
    kw_lower = [k.lower() for k in keywords]
    skill_keywords = [k.lower() for k in entry.get("keywords", [])]
    trigger = entry.get("trigger", "").lower()
    desc = entry.get("short", entry.get("trigger", "")).lower()

    for kw in kw_lower:
        if kw in skill_keywords:
            score += 3            # exact keyword match
        elif any(kw in sk for sk in skill_keywords):
            score += 2            # partial keyword match
        if kw in trigger:
            score += 1            # trigger description match
        if kw in skill_id.lower():
            score += 2            # id match
        if kw in desc:
            score += 1
    return score


def _score_tool(tool_id: str, entry: dict, keywords: list[str]) -> int:
    score = 0
    kw_lower = [k.lower() for k in keywords]
    tags = [t.lower() for t in entry.get("tags", [])]
    short = entry.get("short", "").lower()

    for kw in kw_lower:
        if kw in tags:
            score += 3
        elif any(kw in t for t in tags):
            score += 2
        if kw in short:
            score += 1
        if kw in tool_id.lower():
            score += 2
    return score


def choose_tools(keywords: list[str], top: int = 3, skills_only=False, tools_only=False) -> dict:
    results = {"skills": [], "tools": []}

    if not skills_only:
        if TOOL_MANIFEST.exists():
            with open(TOOL_MANIFEST) as f:
                tm = json.load(f)
            for tool_id, entry in tm.get("tools", {}).items():
                score = _score_tool(tool_id, entry, keywords)
                if score > 0:
                    results["tools"].append({
                        "type": "tool",
                        "id": tool_id,
                        "score": score,
                        "spawn_script": entry.get("spawn_script"),
                        "short": entry.get("short", ""),
                        "when": entry.get("when", "")
                    })
            results["tools"].sort(key=lambda x: x["score"], reverse=True)
            results["tools"] = results["tools"][:top]

    if not tools_only:
        if SKILL_MANIFEST.exists():
            with open(SKILL_MANIFEST) as f:
                sm = json.load(f)
            for skill_id, entry in sm.get("skills", {}).items():
                score = _score_skill(skill_id, entry, keywords)
                if score > 0:
                    results["skills"].append({
                        "type": "skill",
                        "id": skill_id,
                        "score": score,
                        "path": entry.get("path", ""),
                        "on_demand_files": [
                            f["path"] for f in entry.get("on_demand_files", [])
                        ],
                        "description": entry.get("trigger", "")
                    })
            results["skills"].sort(key=lambda x: x["score"], reverse=True)
            results["skills"] = results["skills"][:top]

    return results


def _fmt_human(results: dict) -> str:
    lines = []
    if results["skills"]:
        lines.append("Skills:")
        for s in results["skills"]:
            lines.append(f"  [{s['score']}] {s['id']:20s} — {s['description'][:70]}")
            if s["on_demand_files"]:
                lines.append(f"         context_files: {', '.join(s['on_demand_files'][:2])}")
    if results["tools"]:
        lines.append("Tools:")
        for t in results["tools"]:
            cmd = f"  cmd: {t['spawn_script']}" if t.get("spawn_script") else "  (builtin)"
            lines.append(f"  [{t['score']}] {t['id']:20s} — {t['short'][:70]}")
            lines.append(f"       when: {t['when'][:70]}")
    if not results["skills"] and not results["tools"]:
        lines.append("No matches found.")
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Keyword-based skill/tool discovery")
    parser.add_argument("--keywords", required=True, help="Comma-separated keywords")
    parser.add_argument("--top", type=int, default=3, help="Number of results (default 3)")
    parser.add_argument("--json", action="store_true", dest="json_out", help="Output raw JSON")
    parser.add_argument("--skills-only", action="store_true")
    parser.add_argument("--tools-only", action="store_true")
    args = parser.parse_args()

    kws = [k.strip() for k in args.keywords.split(",") if k.strip()]
    results = choose_tools(kws, top=args.top, skills_only=args.skills_only, tools_only=args.tools_only)

    if args.json_out:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print(_fmt_human(results))
