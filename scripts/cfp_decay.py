#!/usr/bin/env python3
"""cfp_decay.py — compute last_seen, window_count, stale for each CFP entry.

Usage:
  python3 scripts/cfp_decay.py --dry-run   # print diff only
  python3 scripts/cfp_decay.py --update    # write to index_cfp_fix.json
"""
import json
import sys
from datetime import date, timedelta

INDEX_PATH = "knowledge/index_cfp_fix.json"
WINDOW_DAYS = 90


def compute_decay_fields(entry: dict, today: date) -> dict:
    recurrences = entry.get("recurrences", [])
    dates = []
    for r in recurrences:
        if isinstance(r, str):
            # bare date string "YYYY-MM-DD"
            raw = r[:10]
        else:
            raw = r.get("date", "")
        if raw:
            try:
                dates.append(date.fromisoformat(raw))
            except ValueError:
                pass

    last_seen = max(dates).isoformat() if dates else None
    cutoff = today - timedelta(days=WINDOW_DAYS)
    window_count = sum(1 for d in dates if d >= cutoff)
    stale = last_seen is None or (today - date.fromisoformat(last_seen)).days > WINDOW_DAYS

    return {"last_seen": last_seen, "window_count": window_count, "stale": stale}


def main():
    mode = "--dry-run"
    if len(sys.argv) > 1:
        mode = sys.argv[1]

    if mode not in ("--dry-run", "--update"):
        print(f"Usage: cfp_decay.py [--dry-run|--update]", file=sys.stderr)
        sys.exit(1)

    with open(INDEX_PATH) as f:
        data = json.load(f)

    today = date.today()
    changed = 0

    for cfp_id, entry in data.items():
        new_fields = compute_decay_fields(entry, today)

        old_last_seen = entry.get("last_seen", "__missing__")
        old_window = entry.get("window_count", "__missing__")
        old_stale = entry.get("stale", "__missing__")

        needs_update = (
            old_last_seen != new_fields["last_seen"]
            or old_window != new_fields["window_count"]
            or old_stale != new_fields["stale"]
        )

        if needs_update:
            changed += 1
            print(
                f"{cfp_id}: last_seen={new_fields['last_seen']} "
                f"window_count={new_fields['window_count']} "
                f"stale={new_fields['stale']}"
            )
            if mode == "--update":
                entry["last_seen"] = new_fields["last_seen"]
                entry["window_count"] = new_fields["window_count"]
                entry["stale"] = new_fields["stale"]

    print(f"\nTotal entries: {len(data)} · Changed: {changed}")

    if mode == "--update":
        with open(INDEX_PATH, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"[✓ written] {INDEX_PATH}")
    else:
        print("[dry-run] No file written.")


if __name__ == "__main__":
    main()
