#!/usr/bin/env python3
"""gen_native_skills.py — Generate native Claude Code plugin skills from the harness single source.

The harness authors skills under `.agents/skills/<bucket>/<name>/SKILL.md` and routes
them via `.agents/skills/skill-manifest.json` (its OWN auto-router). Claude Code's NATIVE
plugin-skill loader only discovers `<plugin-root>/skills/<name>/SKILL.md`, so those skills
never appeared in the native Skill list and `Skill(<name>)` failed with "Unknown skill".

This script BRIDGES them: for every human-invocable harness skill it (re)generates a
native `skills/<name>/SKILL.md` whose BODY is copied verbatim from the authored source,
with a fresh native frontmatter on top.

Single-source / no-seam guarantees:
  - `.agents/skills/` stays the ONLY authored source. `skills/` is a BUILD ARTIFACT
    (like compiled output) — never hand-edited; regenerated + drift-checked at release.
  - generated skills carry `disable-model-invocation: true` → they are user-invocable +
    discoverable, but the harness manifest stays the SOLE auto-router (two auto-routers
    would conflict). `user-invocable: true` keeps them in the `/` menu.
  - the 5 pure-automatic / always-on / headless skills are never bridged (NEVER_BRIDGE).

CLI:
  gen_native_skills.py            # (re)generate skills/ from source
  gen_native_skills.py --check    # verify skills/ matches source; exit 2 on drift
  gen_native_skills.py --self-test
"""
import sys, os, re, json, argparse, subprocess, shutil, tempfile

# Pure-automatic / always-on / headless — nothing a human invokes → never bridge.
NEVER_BRIDGE = {"token_tracker", "identity", "token_auditor", "loop_engineer", "agent"}

BANNER = ("<!-- GENERATED from {src} by scripts/gen_native_skills.py — DO NOT EDIT. "
          "Edit the source under .agents/skills/ then run scripts/release.py. -->")


def _root():
    """Project root: git toplevel → $CLAUDE_PROJECT_DIR → cwd. NEVER dirname(__file__)
    (in a plugin-only install this script lives in the plugin cache)."""
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=5)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except Exception:
        pass
    return os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def _manifest_path(root):
    return os.path.join(root, ".agents", "skills", "skill-manifest.json")


def load_skills(root):
    """Return {name: card} for real skill entries (a card is a dict carrying 'path')."""
    with open(_manifest_path(root)) as f:
        m = json.load(f)
    src = m.get("skills") if isinstance(m, dict) and isinstance(m.get("skills"), dict) else m
    skills = {}
    if isinstance(src, dict):
        for k, v in src.items():
            if isinstance(v, dict) and "path" in v:
                skills[k] = v
    return skills


def _targets(root):
    """Bridgeable skills = all real skills minus NEVER_BRIDGE."""
    return {n: c for n, c in load_skills(root).items() if n not in NEVER_BRIDGE}


def _split_frontmatter(text):
    """Return (fm_text, body). Strip a leading --- ... --- block if present."""
    if text.startswith("---"):
        m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", text, re.DOTALL)
        if m:
            return m.group(1), text[m.end():]
    return "", text


def _fm_description(fm_text):
    """Single-line description from source frontmatter YAML — handles a plain
    'description: text' and folded '>' / literal '|' block scalars. Best-effort."""
    lines = fm_text.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"^description:\s*(.*)$", line)
        if not m:
            continue
        val = m.group(1).strip()
        if val in (">", "|", ">-", "|-", ">+", "|+"):
            block, base = [], None
            for nxt in lines[i + 1:]:
                if not nxt.strip():
                    continue
                indent = len(nxt) - len(nxt.lstrip())
                if base is None:
                    base = indent
                if indent < base:
                    break
                block.append(nxt.strip())
            return " ".join(block).strip()
        if val:
            return val.strip('"').strip("'").strip()
    return ""


def _first_body_line(body):
    for line in body.splitlines():
        s = line.strip().lstrip("#").strip()
        if s and not s.startswith("<!--"):
            return s
    return ""


def _yaml_quote(s):
    """Safe double-quoted one-line YAML scalar (collapse whitespace, escape, cap len)."""
    s = " ".join(s.split())
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    if len(s) > 1000:
        s = s[:997] + "..."
    return '"' + s + '"'


def render(name, card, root):
    """Return (rel_dest_path, content) for one skill, or None if the source is missing."""
    src_rel = card["path"]
    src_abs = src_rel if os.path.isabs(src_rel) else os.path.join(root, src_rel)
    if not os.path.isfile(src_abs):
        return None
    with open(src_abs, "r", errors="replace") as f:
        text = f.read()
    fm_text, body = _split_frontmatter(text)
    desc = _fm_description(fm_text) or (card.get("description") or "") or _first_body_line(body)
    content = (
        "---\n"
        f"name: {name}\n"
        f"description: {_yaml_quote(desc)}\n"
        "user-invocable: true\n"
        "disable-model-invocation: true\n"
        "---\n"
        f"{BANNER.format(src=src_rel)}\n"
        f"{body.lstrip(chr(10))}"
    )
    if not content.endswith("\n"):
        content += "\n"
    return os.path.join("skills", name, "SKILL.md"), content


def generate(root=None):
    """(Re)write skills/<name>/SKILL.md for every bridgeable skill. Returns (built, skipped)."""
    root = root or _root()
    built, skipped = [], []
    for name, card in sorted(_targets(root).items()):
        r = render(name, card, root)
        if r is None:
            skipped.append(name)
            continue
        dest_rel, content = r
        dest_abs = os.path.join(root, dest_rel)
        os.makedirs(os.path.dirname(dest_abs), exist_ok=True)
        with open(dest_abs, "w") as f:
            f.write(content)
        built.append(name)
    return built, skipped


def check(root=None):
    """Compare on-disk skills/ vs freshly rendered source. Returns (drift_list, n_ok)."""
    root = root or _root()
    drift, ok = [], 0
    targets = _targets(root)
    for name, card in sorted(targets.items()):
        r = render(name, card, root)
        if r is None:
            drift.append(f"{name} (source missing)")
            continue
        dest_abs = os.path.join(root, r[0])
        if not os.path.isfile(dest_abs):
            drift.append(f"{name} (not generated)")
            continue
        with open(dest_abs, "r", errors="replace") as f:
            if f.read() != r[1]:
                drift.append(f"{name} (out of date)")
            else:
                ok += 1
    # extra skill dirs on disk that are no longer bridged (e.g. a renamed/removed skill)
    skills_dir = os.path.join(root, "skills")
    if os.path.isdir(skills_dir):
        for d in sorted(os.listdir(skills_dir)):
            if d not in targets and os.path.isfile(os.path.join(skills_dir, d, "SKILL.md")):
                drift.append(f"{d} (extra — not a bridged skill)")
    return drift, ok


def _self_test():
    tmp = tempfile.mkdtemp(prefix="gen_native_test_")
    try:
        base = os.path.join(tmp, ".agents", "skills")
        os.makedirs(os.path.join(base, "harness", "foo"))
        os.makedirs(os.path.join(base, "user", "identity"))
        with open(os.path.join(base, "harness", "foo", "SKILL.md"), "w") as f:
            f.write("---\nname: Foo\ndescription: >\n  Line one\n  line two.\n---\n# Foo\nBody here.\n")
        with open(os.path.join(base, "user", "identity", "SKILL.md"), "w") as f:
            f.write("---\nname: identity\ndescription: persona\n---\nbody\n")
        with open(os.path.join(base, "skill-manifest.json"), "w") as f:
            json.dump({
                "foo": {"path": ".agents/skills/harness/foo/SKILL.md"},
                "identity": {"path": ".agents/skills/user/identity/SKILL.md"},  # NEVER_BRIDGE
                "notaskill": {"keywords": ["x"]},                               # no path → ignored
            }, f)

        results = []
        built, skipped = generate(tmp)
        gen = os.path.join(tmp, "skills", "foo", "SKILL.md")
        txt = open(gen).read() if os.path.isfile(gen) else ""
        results += [
            ("foo built", "foo" in built),
            ("identity excluded (NEVER_BRIDGE)", "identity" not in built),
            ("no identity dir", not os.path.isdir(os.path.join(tmp, "skills", "identity"))),
            ("no phantom notaskill", "notaskill" not in built),
            ("name uses manifest key", "name: foo" in txt),
            ("folded desc → one line", 'description: "Line one line two."' in txt),
            ("user-invocable set", "user-invocable: true" in txt),
            ("disable-model-invocation set", "disable-model-invocation: true" in txt),
            ("banner present", "GENERATED from .agents/skills/harness/foo/SKILL.md" in txt),
            ("body copied", "Body here." in txt),
        ]
        drift, okn = check(tmp)
        results.append(("check clean after generate", drift == [] and okn == 1))
        with open(gen, "a") as f:
            f.write("tampered\n")
        results.append(("check detects out-of-date", any(d.startswith("foo") for d in check(tmp)[0])))
        generate(tmp)  # restore
        os.makedirs(os.path.join(tmp, "skills", "ghost"))
        open(os.path.join(tmp, "skills", "ghost", "SKILL.md"), "w").write("x")
        results.append(("check detects extra dir", any("ghost" in d for d in check(tmp)[0])))

        passed = sum(1 for _, p in results if p)
        for n, p in results:
            print(f"  {'PASS' if p else 'FAIL'} · {n}")
        total = len(results)
        print(f"[native-skills] self-test: {'PASS' if passed == total else 'FAIL'} ({passed}/{total})")
        return 0 if passed == total else 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description="Generate native plugin skills from the harness source")
    ap.add_argument("--check", action="store_true", help="verify skills/ matches source; exit 2 on drift")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        return _self_test()

    if args.check:
        drift, ok = check()
        for d in drift:
            print(f"[native-skills-drift] {d}")
        if drift:
            print(f"[native-skills] DRIFT: {len(drift)} · in-sync: {ok}")
            return 2
        print(f"[native-skills] in-sync: {ok}")
        return 0

    built, skipped = generate()
    print(f"[native-skills] generated: {len(built)} → skills/<name>/SKILL.md")
    if skipped:
        print(f"[native-skills] skipped (source missing): {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
