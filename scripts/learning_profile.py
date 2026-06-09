#!/usr/bin/env python3
"""learning_profile.py — usage engine for the user-coach closed learning loop.

Reads/writes knowledge/user_learning_profile.json. The whole point of this
script is that the profile is USED, not just stored:
  - `analyze` runs every turn (UserPromptSubmit hook) so glossing depth adapts
    automatically to what the user is weak/strong at.
  - `record` runs after each post-task quiz so the data reflects real
    comprehension and feeds back into the next turn's glossing.

Subcommands:
  record  --topic T --correct N --total M [--note "..."]
          Log a quiz result: bump the topic's stats, recompute mastery + status,
          refresh global weak/strong areas + glossing_depth, append to history.
  analyze [--topic T]
          Print the current learning state. No --topic: a one-line
          [learning-state] summary (consumed by the hook). With --topic: detail.
"""
import argparse
import datetime
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROFILE = os.path.join(ROOT, "knowledge", "user_learning_profile.json")

# mastery thresholds (correct / attempts)
WEAK = 0.5    # below this = weak, needs reinforcement
STRONG = 0.8  # at/above this = strong


def today():
    return datetime.date.today().isoformat()


def load():
    """Load the profile; return a safe default if missing/corrupt (never crash)."""
    try:
        with open(PROFILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "schema_version": 1, "user": "unknown", "updated": today(),
            "global": {"english_comfort": "low", "glossing_depth": "high",
                       "strong_areas": [], "weak_areas": []},
            "topics": [], "history": [],
        }


def save(data):
    data["updated"] = today()
    with open(PROFILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def find_topic(data, name):
    for t in data["topics"]:
        if t["topic"] == name:
            return t
    return None


def status_for(topic):
    """Bucket a topic by mastery + whether it has been quizzed."""
    if topic["quiz_attempts"] == 0:
        return "new"
    m = topic["mastery"]
    if m < WEAK:
        return "learning"
    if m < STRONG:
        return "proficient"
    return "mastered"


def recompute_global(data):
    """Derive weak/strong lists + glossing depth from per-topic mastery.

    Glossing biases toward MORE help: any weak or never-quizzed topic -> high.
    Never drops to 'low' while english_comfort is low (respects the profile)."""
    g = data["global"]
    weak = [t["topic"] for t in data["topics"]
            if t["quiz_attempts"] > 0 and t["mastery"] < WEAK]
    strong = [t["topic"] for t in data["topics"]
              if t["quiz_attempts"] > 0 and t["mastery"] >= STRONG]
    g["weak_areas"] = weak
    g["strong_areas"] = strong
    has_new = any(t["quiz_attempts"] == 0 for t in data["topics"])
    mastered = [t for t in data["topics"] if status_for(t) == "mastered"]
    if not data["topics"] or weak or has_new:
        g["glossing_depth"] = "high"
    elif g.get("english_comfort") == "low":
        # Respect the user's explicit always-gloss preference: relax only with
        # broad evidence of mastery (>=3 mastered topics, none weak or new).
        g["glossing_depth"] = "medium" if len(mastered) >= 3 else "high"
    elif all(status_for(t) == "mastered" for t in data["topics"]):
        g["glossing_depth"] = "low"
    else:
        g["glossing_depth"] = "medium"


def cmd_record(args):
    if args.total <= 0:
        print("error: --total must be > 0")
        sys.exit(1)
    data = load()
    t = find_topic(data, args.topic)
    if t is None:
        t = {"topic": args.topic, "exposures": 0, "quiz_attempts": 0,
             "quiz_correct": 0, "mastery": 0.0, "status": "new",
             "last_seen": today(), "notes": ""}
        data["topics"].append(t)
    t["exposures"] += 1
    t["quiz_attempts"] += args.total
    t["quiz_correct"] += args.correct
    t["mastery"] = round(t["quiz_correct"] / t["quiz_attempts"], 3)
    t["status"] = status_for(t)
    t["last_seen"] = today()
    if args.note:
        t["notes"] = args.note
    data["history"].append({"date": today(), "topic": args.topic,
                            "score": round(args.correct / args.total, 3),
                            "note": args.note or ""})
    recompute_global(data)
    save(data)
    print(f"recorded: {args.topic} {args.correct}/{args.total} "
          f"(mastery {t['mastery']}, {t['status']}) -> "
          f"glossing {data['global']['glossing_depth']}")


def cmd_analyze(args):
    data = load()
    g = data["global"]
    if args.topic:
        t = find_topic(data, args.topic)
        if t is None:
            print(f"[learning-state] topic '{args.topic}' not tracked yet "
                  f"· glossing: {g['glossing_depth']}")
            return
        print(f"[learning-state] topic: {t['topic']} · mastery: {t['mastery']} "
              f"· status: {t['status']} · attempts: {t['quiz_attempts']} "
              f"· glossing: {g['glossing_depth']}")
        return
    weak = ", ".join(g["weak_areas"]) or "-"
    strong = ", ".join(g["strong_areas"]) or "-"
    print(f"[learning-state] glossing: {g['glossing_depth']} · weak: [{weak}] "
          f"· strong: [{strong}] · topics: {len(data['topics'])}")


def main():
    p = argparse.ArgumentParser(description="user-coach learning profile engine")
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("record", help="log a quiz result")
    r.add_argument("--topic", required=True)
    r.add_argument("--correct", type=int, required=True)
    r.add_argument("--total", type=int, required=True)
    r.add_argument("--note", default="")
    r.set_defaults(func=cmd_record)

    a = sub.add_parser("analyze", help="print current learning state")
    a.add_argument("--topic", default="")
    a.set_defaults(func=cmd_analyze)

    args = p.parse_args()
    try:
        args.func(args)
    except Exception as e:  # never break the hook / turn
        print(f"[learning-state] (unavailable: {e})")
        sys.exit(0)


if __name__ == "__main__":
    main()
