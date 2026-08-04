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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_paths

ROOT = str(harness_paths.project_root())

# USER-tier profile home (T-309 S3b). The learner profile describes the PERSON,
# not the project, so its canonical home is machine-wide under ~/.claude/ and it
# follows the user into every project (no per-project re-learning). If the shared
# home is unavailable (fresh machine before install, or a sandbox), fall back to
# the in-project copy so the harness still runs. LP_PROFILE still overrides all.
# T-319: the shared-home ROOT is now owned by harness_paths.shared_home() (ONE
# definition · single-source) — this line references it, no longer a 2nd hardcode.
_SHARED_HOME    = str(harness_paths.shared_home())
_SHARED_PROFILE = os.path.join(_SHARED_HOME, "user_learning_profile.json")
_LOCAL_PROFILE  = os.path.join(ROOT, "knowledge", "user_learning_profile.json")


def _default_profile():
    """USER-tier home: the shared ~/.claude/ store when it exists (or its dir is
    present, so new writes land there), else the in-project fallback copy."""
    if os.path.exists(_SHARED_PROFILE) or os.path.isdir(_SHARED_HOME):
        return _SHARED_PROFILE
    return _LOCAL_PROFILE


PROFILE = _default_profile()


def _profile_path():
    """Honor LP_PROFILE env override so tests can target a temp copy and never
    touch the live canonical store (T-289 R2). Defaults to the USER-tier home."""
    return os.environ.get("LP_PROFILE", PROFILE)

# mastery thresholds (correct / attempts)
WEAK = 0.5    # below this = weak, needs reinforcement
STRONG = 0.8  # at/above this = strong

# Spaced-repetition review intervals in days (T-290). A passing quiz steps a term
# UP this ladder (gaps widen as it sticks); a miss resets to the first rung.
REVIEW_LADDER = [1, 3, 7, 14, 30]


def today():
    return datetime.date.today().isoformat()


def _ensure_schema(data):
    """Additive back-compat: fill v2 keys for older profiles, never drop data.

    A v1 file (topic mastery only) gains the empty person-model + traits list so
    the rest of the engine can assume they exist. Bumps schema_version to 2."""
    person = data.setdefault("person", {})
    person.setdefault("strengths", [])
    person.setdefault("weaknesses", [])
    person.setdefault("dev_path", "")
    person.setdefault("answer_style", "")
    data.setdefault("traits", [])
    data.setdefault("vocab", [])  # word-level vocabulary bank (T-289) — additive, no version bump
    data["schema_version"] = 2
    return data


def load():
    """Load the profile; return a safe default if missing/corrupt (never crash)."""
    try:
        with open(_profile_path(), encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = {
            "schema_version": 2, "user": "unknown", "updated": today(),
            "global": {"english_comfort": "low", "glossing_depth": "high",
                       "strong_areas": [], "weak_areas": []},
            "topics": [], "history": [],
        }
    return _ensure_schema(data)


def save(data):
    data["updated"] = today()
    os.makedirs(os.path.dirname(_profile_path()), exist_ok=True)
    with open(_profile_path(), "w", encoding="utf-8") as f:
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
    derive_person(data)


def readiness(data, topic):
    """Lightweight level-up gate (NO statistical BKT — single-user data is too
    sparse for that). Ready only on MEASURED performance: strong mastery from real
    attempts AND a delayed recheck (the topic was seen on >=2 distinct dates).
    Self-report is deliberately NOT a signal."""
    if topic["quiz_attempts"] < 2 or topic["mastery"] < STRONG:
        return "not-yet"
    dates = {h["date"] for h in data.get("history", [])
             if h["topic"] == topic["topic"]}
    return "ready" if len(dates) >= 2 else "building"


def verbosity_for(data):
    """Situational-Leadership dial: lead with more help when mastery is low, step
    back as it rises. direct (spell it out) -> coach (guide) -> delegate (terse).

    Decided on QUIZZED topics ONLY: an un-quizzed topic carries no measured signal,
    so it must never permanently pin the dial to 'direct' (T-253 S6). Beginner-safe
    default: too little measured evidence (<2 quizzed) -> stay 'direct'."""
    quizzed = [t for t in data["topics"] if t["quiz_attempts"] > 0]
    if len(quizzed) < 2:
        return "direct"
    weak = [t for t in quizzed if t["mastery"] < WEAK]
    mastered = [t for t in quizzed if status_for(t) == "mastered"]
    if weak:
        return "direct"
    if len(mastered) >= max(1, len(quizzed) // 2):
        return "delegate"
    return "coach"


def derive_person(data):
    """Reframe topic mastery + confirmed traits into a person-level coach view:
    strengths, weaknesses, and the single next dev-path focus (Strengths-Based)."""
    p = data.setdefault("person", {})
    topic_strong = [t["topic"] for t in data["topics"]
                    if status_for(t) == "mastered"]
    # Conflict rule: most-reinforced wins. Sort confirmed traits by tally desc
    # (repeated sightings outrank a one-off) then most-recent — so strengths[0]
    # surfaces the strongest signal first, not an arbitrary insertion order.
    trait_strong = [t["label"] for t in sorted(
        (x for x in data.get("traits", []) if x.get("status") == "confirmed"),
        key=lambda x: (x.get("tally", 0), x.get("last_seen", "")), reverse=True)]
    weak = [t["topic"] for t in data["topics"]
            if t["quiz_attempts"] > 0 and t["mastery"] < WEAK]
    p["strengths"] = topic_strong + trait_strong
    p["weaknesses"] = weak
    if weak:
        p["dev_path"] = f"reinforce: {weak[0]}"
    else:
        building = [t["topic"] for t in data["topics"]
                    if WEAK <= t["mastery"] < STRONG]
        p["dev_path"] = f"advance: {building[0]}" if building else "stretch: new challenge"
    return p


def north_star(data):
    """The user's long-horizon goal (self-reported) as a SHORT one-line tag.

    Kept separate from dev_path: dev_path is the near-term quiz focus that shifts
    every session, north_star is the fixed destination it ladders toward (T-253 S6).
    Truncated hard so the per-turn line stays lean (no always-loaded token weight)."""
    sr = data.get("person", {}).get("self_reported") or {}
    # Prefer a hand-authored short tag: blind truncation can drop the most salient
    # half of a goal (e.g. cutting "+ AI harness engineering"). Fall back to a
    # word-boundary truncation only when no tag was written (T-253 S6/F1).
    tag = (sr.get("goal_tag") or "").strip()
    if tag:
        return tag
    goal = sr.get("goal", "")
    if not goal:
        return "-"
    head = goal.split(" — ")[0].split(";")[0].strip()
    if len(head) <= 48:
        return head
    cut = head[:48].rsplit(" ", 1)[0]  # don't slice mid-word
    return cut + "…"


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


def _next_interval(prev):
    """Spaced-repetition step-up: the next ladder interval above `prev` (capped at
    the top rung). prev<=0 (never scheduled) -> the first rung (T-290)."""
    for step in REVIEW_LADDER:
        if step > prev:
            return step
    return REVIEW_LADDER[-1]


def find_vocab_term(data, term):
    """Locate a word-level vocabulary entry by exact term (None if not seen)."""
    return next((v for v in data.get("vocab", []) if v["term"] == term), None)


def gloss_for(data, term):
    """Per-term gloss controller (T-291, spec §4). The global glossing_depth is the
    DEFAULT; a graduated term OVERRIDES it to 'off' -- once measured-mastered the word
    is used directly, no parenthetical gloss (spec §3 rule 5). An unseen or still-
    learning term inherits the global depth (beginner-safe: default to glossing)."""
    v = find_vocab_term(data, term)
    if v and v.get("graduated"):
        return "off"
    return data["global"]["glossing_depth"]


def _is_due(v):
    """A term is due for spaced re-asking when it is NOT graduated, has been
    quizzed, and its scheduled review date has arrived. ISO dates compare
    lexically; a missing/empty next_review (legacy entry) sorts before today,
    so legacy terms surface as due-now without crashing (T-290 back-compat)."""
    if v.get("graduated") or v.get("attempts", 0) <= 0:
        return False
    return (v.get("next_review") or "") <= today()


def cmd_record_term(args):
    """Record a QUIZ result for a single technical term (word-level vocab bank).

    Mirrors cmd_record but at term granularity. Graduation = measured mastery
    only (>= STRONG over >= 2 attempts); a graduated term stops being glossed.
    Self-report never writes here (quiz path only). Does NOT call recompute_global
    -- vocab is a refinement layer, it must not move topic-level glossing (T-289 R3)."""
    if args.total <= 0:
        print("error: --total must be > 0")
        sys.exit(1)
    data = load()
    v = find_vocab_term(data, args.term)
    if v is None:
        v = {"term": args.term, "times_seen": 0, "attempts": 0,
             "times_correct": 0, "mastery": 0.0, "graduated": False,
             "status": "learning", "last_seen": today(),
             "interval_days": 0, "next_review": ""}
        data["vocab"].append(v)
    v["times_seen"] += 1
    v["attempts"] += args.total
    v["times_correct"] += args.correct
    v["mastery"] = round(v["times_correct"] / v["attempts"], 3)
    v["graduated"] = v["mastery"] >= STRONG and v["attempts"] >= 2
    v["status"] = "graduated" if v["graduated"] else "learning"
    v["last_seen"] = today()
    # Spaced repetition (T-290): a passing round (score >= WEAK) widens the gap to
    # the next review; a miss resets to the shortest interval. Graduated terms keep
    # a schedule too but are filtered out of the due list (no need to re-ask).
    score = args.correct / args.total
    v["interval_days"] = (_next_interval(v.get("interval_days", 0))
                          if score >= WEAK else REVIEW_LADDER[0])
    v["next_review"] = (datetime.date.today()
                        + datetime.timedelta(days=v["interval_days"])).isoformat()
    save(data)
    print(f"recorded-term: {args.term} {args.correct}/{args.total} "
          f"(mastery {v['mastery']}, {v['status']}, next-review {v['next_review']})")


def cmd_due_terms(args):
    """Print vocab terms due for spaced re-asking, one per line (T-290) -- a clean
    hook for the close-quiz flow to pull exactly what to re-quiz this session."""
    data = load()
    for v in data.get("vocab", []):
        if _is_due(v):
            print(v["term"])


def cmd_gloss_for(args):
    """Answer 'should I gloss this term right now?' for one word (T-291). 'off' = the
    term graduated, use it directly; otherwise the global depth = still gloss it."""
    data = load()
    depth = gloss_for(data, args.term)
    if depth == "off":
        print(f"gloss-for: {args.term} -> off · use directly (graduated)")
    else:
        seen = "learning" if find_vocab_term(data, args.term) else "unseen"
        print(f"gloss-for: {args.term} -> {depth} · gloss it ({seen})")


def cmd_observe(args):
    """Record an observed behavior trait. Meaning-match by canonical key:
    a repeat sighting bumps the tally (reinforcement, not a duplicate line) and
    promotes provisional -> confirmed at tally >= 2 (anti over-flag)."""
    data = load()
    tr = next((x for x in data["traits"] if x["key"] == args.key), None)
    if tr is None:
        tr = {"key": args.key, "label": args.label, "tally": 1,
              "status": "provisional", "last_seen": today(),
              "examples": [args.example] if args.example else []}
        data["traits"].append(tr)
    else:
        tr["tally"] += 1
        if args.label:
            tr["label"] = args.label
        if args.example:
            tr["examples"].append(args.example)
            tr["examples"] = tr["examples"][-3:]  # keep last 3 sightings only
        tr["last_seen"] = today()
    tr["status"] = "confirmed" if tr["tally"] >= 2 else "provisional"
    save(data)
    print(f"observed: {tr['key']} (tally {tr['tally']}, {tr['status']})")


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
    derive_person(data)  # live-refresh strengths/weaknesses/dev-path for display
    verb = verbosity_for(data)
    ready = [t["topic"] for t in data["topics"] if readiness(data, t) == "ready"]
    dev_path = data["person"].get("dev_path") or "-"
    # Surface the person-model essentials in the same one line (no new per-turn
    # file Read): confirmed behaviour traits + the single top strength to lead with.
    traits = ", ".join(t["label"] for t in data.get("traits", [])
                       if t.get("status") == "confirmed") or "-"
    top = (data["person"].get("strengths") or ["-"])[0]
    # Word-level vocab hints (T-289): terms still being learned (gloss them) vs
    # graduated terms. gloss-off (T-291) = the per-term controller's directive: these
    # words are mastered, use them DIRECTLY (no parenthetical gloss). due = ungraduated
    # + quizzed, top5.
    vocab = data.get("vocab", [])
    due_terms = [v["term"] for v in vocab if _is_due(v)][:5]
    due = ", ".join(due_terms) or "-"
    gloss_off = ", ".join(v["term"] for v in vocab if v.get("graduated")) or "-"
    print(f"[learning-state] glossing: {g['glossing_depth']} · verbosity: {verb} "
          f"· weak: [{weak}] · strong: [{strong}] "
          f"· readiness: [{', '.join(ready) or '-'}] · dev-path: {dev_path} "
          f"· goal: {north_star(data)} "
          f"· traits: [{traits}] · top: {top} · topics: {len(data['topics'])} "
          f"· vocab-due: [{due}] · gloss-off: [{gloss_off}]")


def cmd_selftest(args):
    """Back-compat guard (T-253 S6): a v1 profile (topic mastery only, no person/
    traits block) must migrate to v2 — gaining the new keys WITHOUT losing topics."""
    v1 = {"schema_version": 1, "user": "x",
          "global": {"glossing_depth": "high"},
          "topics": [{"topic": "t1", "quiz_attempts": 2, "quiz_correct": 2,
                      "mastery": 1.0, "status": "mastered"}],
          "history": []}
    out = _ensure_schema(v1)
    assert out["schema_version"] == 2, "schema_version not bumped to 2"
    assert "person" in out and "traits" in out, "person/traits block not filled"
    assert all(k in out["person"] for k in
               ("strengths", "weaknesses", "dev_path", "answer_style")), \
        "person keys missing"
    assert len(out["topics"]) == 1 and out["topics"][0]["topic"] == "t1", \
        "topics lost during migration"
    assert out["topics"][0]["mastery"] == 1.0, "topic data mutated"
    print("[selftest] back-compat v1->v2: OK (keys filled, topics preserved)")


def main():
    p = argparse.ArgumentParser(description="user-coach learning profile engine")
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("record", help="log a quiz result")
    r.add_argument("--topic", required=True)
    r.add_argument("--correct", type=int, required=True)
    r.add_argument("--total", type=int, required=True)
    r.add_argument("--note", default="")
    r.set_defaults(func=cmd_record)

    rt = sub.add_parser("record-term", help="log a quiz result for one vocab term")
    rt.add_argument("--term", required=True)
    rt.add_argument("--correct", type=int, required=True)
    rt.add_argument("--total", type=int, required=True)
    rt.set_defaults(func=cmd_record_term)

    dt = sub.add_parser("due-terms", help="list vocab terms due for spaced re-asking")
    dt.set_defaults(func=cmd_due_terms)

    gf = sub.add_parser("gloss-for", help="should this vocab term be glossed now?")
    gf.add_argument("--term", required=True)
    gf.set_defaults(func=cmd_gloss_for)

    o = sub.add_parser("observe", help="record an observed behavior trait")
    o.add_argument("--key", required=True)
    o.add_argument("--label", default="")
    o.add_argument("--example", default="")
    o.set_defaults(func=cmd_observe)

    a = sub.add_parser("analyze", help="print current learning state")
    a.add_argument("--topic", default="")
    a.set_defaults(func=cmd_analyze)

    st = sub.add_parser("selftest", help="run back-compat self-test (T-253 S6)")
    st.set_defaults(func=cmd_selftest)

    args = p.parse_args()
    try:
        args.func(args)
    except Exception as e:  # never break the hook / turn
        print(f"[learning-state] (unavailable: {e})")
        sys.exit(0)


if __name__ == "__main__":
    main()
