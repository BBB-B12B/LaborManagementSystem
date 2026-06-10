#!/usr/bin/env python3
"""
verify_runner.py — Run Verify-N lines from mece_plan.md and report PASS/FAIL.

Usage:
  python3 scripts/verify_runner.py --section S1 [--file .sessions/mece_plan.md]
  python3 scripts/verify_runner.py --all [--file .sessions/mece_plan.md]
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DEFAULT_PLAN = ROOT / ".sessions" / "mece_plan.md"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run Verify-N lines from mece_plan.md and report PASS/FAIL."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--section", metavar="SN", help="Run Verify-N lines under ### SN block")
    group.add_argument("--all", action="store_true", help="Run all Verify-N lines in the file")
    parser.add_argument(
        "--file",
        default=str(DEFAULT_PLAN),
        help="Path to mece_plan.md (default: .sessions/mece_plan.md)",
    )
    return parser.parse_args()


def load_plan(path: str) -> str:
    p = Path(path)
    if not p.exists():
        print(f"[verify] ERROR: file not found: {path}", file=sys.stderr)
        sys.exit(1)
    return p.read_text(encoding="utf-8")


def extract_section_lines(content: str, section: str) -> tuple[bool, list[tuple[str, str]]]:
    """Return (found, list of (section_label, full_line)) for Verify-N lines in the given section."""
    lines = content.splitlines()
    in_section = False
    found = False
    results = []
    section_header = f"### {section}"

    for line in lines:
        if line.strip().startswith("### "):
            if line.strip().startswith(section_header):
                in_section = True
                found = True
            else:
                in_section = False
            continue
        if line.strip().startswith("## "):
            in_section = False
            continue
        if in_section:
            m = re.search(r'Verify-\d+:\s*`([^`]+)`\s*→\s*(.+)', line)
            if m:
                results.append((section, line.strip()))
    return (found, results)


def extract_all_sections(content: str) -> list[tuple[str, str]]:
    """Return list of (section_label, full_line) for all Verify-N lines."""
    lines = content.splitlines()
    current_section = "unknown"
    results = []

    for line in lines:
        if line.strip().startswith("### "):
            m = re.match(r'###\s+(S\d+)', line.strip())
            current_section = m.group(1) if m else line.strip().lstrip("# ").split()[0]
            continue
        m = re.search(r'Verify-\d+:\s*`([^`]+)`\s*→\s*(.+)', line)
        if m:
            results.append((current_section, line.strip()))
    return results


def run_verify(section: str, line: str) -> tuple[bool, str]:
    """Parse and run one Verify line. Returns (passed, detail_msg)."""
    m = re.search(r'(Verify-\d+):\s*`([^`]+)`\s*→\s*(.+)', line)
    if not m:
        return False, f"parse error: could not extract command/condition from: {line}"

    label = m.group(1)
    cmd = m.group(2).strip()
    condition = m.group(3).strip()

    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=ROOT)
    stdout = result.stdout.strip()

    passed, detail = evaluate(stdout, condition)
    tag = f"{section} {label}"
    if passed:
        return True, f"[verify] {tag}: PASS"
    else:
        return False, f"[verify] {tag}: FAIL → {detail}"


def evaluate(stdout: str, condition: str) -> tuple[bool, str]:
    """Evaluate stdout against condition string. Returns (passed, failure_detail)."""
    condition = condition.strip()

    # Numeric comparisons
    num_match = re.match(r'^(>=|<=|>|<)\s*(\d+)$', condition)
    if num_match:
        op, val = num_match.group(1), int(num_match.group(2))
        try:
            actual = int(stdout.split()[0]) if stdout else None
        except (ValueError, IndexError):
            return False, f"expected numeric output, got: {repr(stdout)}"
        if actual is None:
            return False, f"empty output, expected {op} {val}"
        ops = {
            ">=": actual >= val,
            "<=": actual <= val,
            ">": actual > val,
            "<": actual < val,
        }
        if ops[op]:
            return True, ""
        return False, f"expected {op}{val}, got {actual}"

    # Equals numeric
    eq_match = re.match(r'^=\s*(\d+)$', condition)
    if eq_match:
        val = int(eq_match.group(1))
        try:
            actual = int(stdout.split()[0]) if stdout else None
        except (ValueError, IndexError):
            return False, f"expected numeric output, got: {repr(stdout)}"
        if actual == val:
            return True, ""
        return False, f"expected ={val}, got {actual}"

    # String / non-numeric conditions
    if not stdout:
        return False, f"empty output, expected: {condition}"
    if condition.lower() == "exists":
        return True, ""
    if condition.lower() in stdout.lower():
        return True, ""
    return False, f"expected output containing {repr(condition)}, got: {repr(stdout[:120])}"


def main():
    args = parse_args()
    content = load_plan(args.file)

    if args.all:
        entries = extract_all_sections(content)
        if not entries:
            print(f"[verify] No Verify-N lines found for all sections")
            sys.exit(0)
    else:
        found, entries = extract_section_lines(content, args.section)
        if not found:
            print(f"[verify] ERROR: section '{args.section}' not found in {args.file}", file=sys.stderr)
            sys.exit(1)
        if not entries:
            print(f"[verify] WARNING: section '{args.section}' has no Verify-N lines")
            sys.exit(0)

    passed_count = 0
    failed_count = 0

    for section, line in entries:
        ok, msg = run_verify(section, line)
        print(msg)
        if ok:
            passed_count += 1
        else:
            failed_count += 1

    print(f"[verify] SUMMARY: {passed_count} PASS · {failed_count} FAIL")
    sys.exit(0 if failed_count == 0 else 1)


if __name__ == "__main__":
    main()
