#!/usr/bin/env python3
"""plan_ctx.py — Plan-time context pre-compression (T-345).

Prepare a SHRUNK slice of a HEAVY source region that a MECE plan section needs,
stored PER-PROJECT under .sessions/plan_ctx/<task>/, and check its freshness
against the live source (staleness guard). The plan references BOTH the slice
(`Context-shrunk:`) and the full source by file:line (`Context-full:` = source
of truth), so nothing is lost.

Reuses (single-source — never reimplements the compressor):
  - view_compress.detect_content_type / compress_table  (tabular compression)
  - lookup.py read_hint  (optional --topic → line range)
The full source is the file on disk (Context-full), so there is no separate raw
blob to park — the slice IS the working copy, the file stays the lossless source.

PROACTIVE — distinct from T-344's REACTIVE [headroom] nudge (which fires after a
big tool output). This prepares the slice ONCE at plan time (after M5 confirm).

Fail-safe: never crashes a plan. Errors print a one-line message + non-zero exit;
no traceback leaks into the agent's context.

CLI:
  plan_ctx.py prepare --task T-345 --section S2 --source F --lines 40-120 [--topic T] [--compress]
  plan_ctx.py check <slice-file>
  plan_ctx.py --self-test
"""
import sys, os, re, hashlib, argparse, subprocess, tempfile, shutil

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

try:                                                    # single-source reuse
    from view_compress import detect_content_type, compress_table
except Exception:                                       # fail-safe: prep still works
    detect_content_type = None
    compress_table = None

HEADER_TAG = "plan_ctx:v1"


def _root():
    """Project root — the PER-PROJECT dir slices must live under (req 6).
    git toplevel (from cwd) → $CLAUDE_PROJECT_DIR → cwd. NEVER dirname(_HERE):
    in a plugin-only install this script lives in the plugin cache, so falling
    back to its own dir would write slices into the plugin, not the project."""
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=5)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except Exception:
        pass
    return os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def _read_lines(path):
    with open(path, "r", errors="replace") as f:
        return f.readlines()


def _region(lines, start, end):
    """1-indexed inclusive line range, clamped to the file."""
    n = len(lines)
    start = max(1, start)
    end = min(n, end) if end else n
    if end < start:
        end = start
    return lines[start - 1:end], start, end


def _sha1(text):
    return hashlib.sha1(text.encode("utf-8", "replace")).hexdigest()


def _slug(s):
    return re.sub(r"[^A-Za-z0-9_.-]", "_", str(s))[:40] or "sec"


def _topic_to_range(source, topic):
    """Best-effort: shell lookup.py, parse 'read_hint: offset=N limit=M'."""
    try:
        out = subprocess.run(["python3", os.path.join(_HERE, "lookup.py"), topic],
                             capture_output=True, text=True, timeout=15).stdout
        for line in out.splitlines():
            m = re.search(r"offset=(\d+)\s+limit=(\d+)", line)
            if m and (source is None or source in out):
                off, lim = int(m.group(1)), int(m.group(2))
                return off, off + lim - 1
    except Exception:
        pass
    return None


def prepare(task, section, source, start, end, compress=False):
    root = _root()
    src_abs = source if os.path.isabs(source) else os.path.join(root, source)
    if not os.path.isfile(src_abs):
        return {"status": "error", "msg": f"source not found: {source}"}
    lines = _read_lines(src_abs)
    if end and end < start:
        return {"status": "error", "msg": f"reversed range {start}-{end} (start must be <= end)"}
    if start > len(lines):
        return {"status": "error",
                "msg": f"start line {start} is beyond end of {source} ({len(lines)} lines)"}
    region, start, end = _region(lines, start, end)
    if not region:                                      # bug#1 guard — never a silent empty slice
        return {"status": "error",
                "msg": f"empty region for lines {start}-{end} in {source} ({len(lines)} lines)"}
    region_text = "".join(region)
    body = region
    note = ""
    if compress and compress_table and detect_content_type:
        if detect_content_type([l.rstrip("\n") for l in region]) == "table":
            body = [l + "\n" for l in compress_table([l.rstrip("\n") for l in region])]
            note = " · table-compressed"
    sha = _sha1(region_text)                            # hash of the ORIGINAL region (guard)
    out_dir = os.path.join(root, ".sessions", "plan_ctx", _slug(task))
    os.makedirs(out_dir, exist_ok=True)
    slice_path = os.path.join(out_dir, _slug(section) + ".md")
    header = (f"<!-- {HEADER_TAG}\n"
              f"task: {task}\n"
              f"section: {section}\n"
              f"source: {source}\n"
              f"lines: {start}-{end}\n"
              f"sha1: {sha}\n"
              f"-->\n")
    with open(slice_path, "w") as f:
        f.write(header)
        f.write(f"<!-- full source of truth: {source}:{start}-{end} -->\n")
        f.writelines(body)
    rel = os.path.relpath(slice_path, root)
    full_n, slice_n, saved = len(lines), len(body), len(lines) - len(body)
    return {"status": "ok", "slice": rel, "source": source,
            "full_lines": full_n, "region_lines": len(region),
            "slice_lines": slice_n, "saved": saved,
            "context_full": f"{source}:{start}-{end}", "note": note}


def _parse_header(slice_path):
    meta = {}
    with open(slice_path, "r", errors="replace") as f:
        for line in f:
            if line.strip() == "-->":
                break
            m = re.match(r"(source|lines|sha1|task|section):\s*(.+)", line.strip())
            if m:
                meta[m.group(1)] = m.group(2).strip()
    return meta


def check(slice_path):
    root = _root()
    sp = slice_path if os.path.isabs(slice_path) else os.path.join(root, slice_path)
    if not os.path.isfile(sp):
        return {"status": "missing", "msg": f"slice not found: {slice_path}"}
    meta = _parse_header(sp)
    src, rng, want = meta.get("source"), meta.get("lines"), meta.get("sha1")
    if not (src and rng and want):
        return {"status": "error", "msg": "slice header incomplete"}
    m = re.match(r"(\d+)-(\d+)", rng)
    if not m:
        return {"status": "error", "msg": f"bad lines header: {rng}"}
    start, end = int(m.group(1)), int(m.group(2))
    src_abs = src if os.path.isabs(src) else os.path.join(root, src)
    if not os.path.isfile(src_abs):
        return {"status": "stale", "reason": "source deleted", "source": src}
    region, _, _ = _region(_read_lines(src_abs), start, end)
    now = _sha1("".join(region))
    if now == want:
        return {"status": "ok", "source": src, "range": rng}
    return {"status": "stale", "reason": "source region changed",
            "source": src, "range": rng}


def _self_test():
    tmp = tempfile.mkdtemp(prefix="plan_ctx_test_")
    try:
        # not a git repo here → _root falls back; force our tmp as root via cwd trick
        src = os.path.join(tmp, "big.txt")
        with open(src, "w") as f:
            f.writelines([f"line {i}\n" for i in range(1, 201)])   # 200 lines
        # prepare a 40-line slice of an absolute source, task dir under tmp/.sessions
        os.makedirs(os.path.join(tmp, ".sessions"), exist_ok=True)
        os.environ["GIT_DIR_OVERRIDE"] = ""  # no-op; rely on abs paths below
        results = []

        # 1. prepare (abs source) — monkeypatch _root to tmp
        global _root
        real_root = _root
        _root = lambda: tmp
        r = prepare("T-TEST", "S1", src, 50, 89, compress=False)
        results.append(("prepare ok", r.get("status") == "ok"))
        results.append(("slice smaller", r.get("slice_lines") == 40 and r.get("saved") == 160))

        slice_abs = os.path.join(tmp, r["slice"])
        # 2. check fresh → ok
        c1 = check(r["slice"])
        results.append(("check fresh=ok", c1.get("status") == "ok"))

        # 3. mutate source region → stale
        lines = _read_lines(src)
        lines[60] = "MUTATED\n"
        with open(src, "w") as f:
            f.writelines(lines)
        c2 = check(r["slice"])
        results.append(("check drift=stale", c2.get("status") == "stale"))

        # 4. mutate OUTSIDE region → still ok
        lines[10] = "outside change\n"
        # restore region line 61 first (index 60)
        lines[60] = "line 61\n"
        with open(src, "w") as f:
            f.writelines(lines)
        c3 = check(r["slice"])
        results.append(("outside-change=ok", c3.get("status") == "ok"))

        # 5. missing source
        c4 = check("nope/does_not_exist.md")
        results.append(("missing slice", c4.get("status") == "missing"))

        # 6. missing source file for prepare
        r2 = prepare("T-TEST", "S2", os.path.join(tmp, "nope.txt"), 1, 5)
        results.append(("prepare missing src", r2.get("status") == "error"))

        # 7. reversed range -> error (not a silent 1-line slice)
        r3 = prepare("T-TEST", "S3", src, 100, 50)
        results.append(("reversed range err", r3.get("status") == "error"))

        # 8. start beyond EOF -> error (not a silent empty slice · bug#1)
        r4 = prepare("T-TEST", "S4", src, 9000, 9999)
        results.append(("start-beyond-eof err", r4.get("status") == "error"))

        # 9. valid full range still ok (regression guard)
        r5 = prepare("T-TEST", "S5", src, 1, 200)
        results.append(("full-range ok", r5.get("status") == "ok" and r5.get("slice_lines") == 200))

        _root = real_root
        ok = all(p for _, p in results)
        for name, p in results:
            print(f"  {'PASS' if p else 'FAIL'} · {name}")
        print(f"self-test: {'ALL PASS' if ok else 'FAIL'} ({sum(p for _,p in results)}/{len(results)})")
        return 0 if ok else 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description="Plan-time context pre-compression (T-345)")
    ap.add_argument("--self-test", action="store_true")
    sub = ap.add_subparsers(dest="cmd")

    p = sub.add_parser("prepare")
    p.add_argument("--task", required=True)
    p.add_argument("--section", required=True)
    p.add_argument("--source", required=True)
    p.add_argument("--lines", help="START-END (1-indexed inclusive)")
    p.add_argument("--topic", help="fallback: locate range via lookup.py read_hint")
    p.add_argument("--compress", action="store_true")

    c = sub.add_parser("check")
    c.add_argument("slice")

    args = ap.parse_args()
    if args.self_test:
        return _self_test()

    if args.cmd == "prepare":
        start = end = None
        if args.lines:
            m = re.match(r"(\d+)-(\d+)", args.lines)
            if m:
                start, end = int(m.group(1)), int(m.group(2))
        if start is None and args.topic:
            rng = _topic_to_range(args.source, args.topic)
            if rng:
                start, end = rng
        if start is None:
            print("[plan_ctx] error: give --lines START-END (or a --topic lookup.py can resolve)")
            return 1
        r = prepare(args.task, args.section, args.source, start, end, args.compress)
        if r.get("status") != "ok":
            print(f"[plan_ctx] error: {r.get('msg')}")
            return 1
        print(f"[ctx-prepared] section:{args.section} · full:{r['context_full']} "
              f"({r['full_lines']}L) → slice:{r['slice']} ({r['slice_lines']}L) "
              f"· saved ~{r['saved']}L{r['note']}")
        return 0

    if args.cmd == "check":
        r = check(args.slice)
        st = r.get("status")
        if st == "ok":
            print(f"[ctx-loaded] slice:{args.slice} · full-source:{r['source']}:{r['range']} · hash:ok")
            return 0
        if st == "stale":
            print(f"[ctx-stale] slice:{args.slice} · {r.get('reason')} "
                  f"· re-prepare or read Context-full source")
            return 2
        print(f"[plan_ctx] {st}: {r.get('msg','')}")
        return 1

    ap.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
