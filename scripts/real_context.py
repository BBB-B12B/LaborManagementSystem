#!/usr/bin/env python3
"""real_context.py (T-287 · L2) -- print the REAL context-window fill for the
current Claude Code session, read from its transcript's last `usage` record.

Why: the homemade char-estimate under-counts ~4x (it only sees tool I/O). The
transcript jsonl logs the true `usage` every turn -- the same numbers the client
meter shows. This reader returns window-fill = input_tokens + cache_read +
cache_creation from the LATEST usage record (cached tokens still occupy the
window; cache only changes price). Used as the SINGLE source of CHAT_TOTAL.

Contract (a HOOK calls this -- it must never break a turn):
  * ALWAYS exit 0.
  * Print one integer on success; print NOTHING on any failure so the caller
    falls back to the estimate.
  * Pure stdlib, no network.

KNOWN LIMITATION: with no --transcript arg we locate the session file by picking
the most-recently-modified *.jsonl under the project's transcript dir. If several
sessions for the same project are open at once, mtime can point at the wrong one.
That is an accepted heuristic, not a guarantee -- the caller tags the source so a
wrong pick is visible, never silent.

Usage:
  real_context.py                 # auto-locate via CLAUDE_PROJECT_DIR / cwd
  real_context.py --transcript P  # read a specific transcript (for tests)
"""
import json
import os
import sys
import glob


def _project_transcript_dir():
    """Map the project path to ~/.claude/projects/<escaped>/ the way Claude Code
    does: every non-alphanumeric char in the absolute path becomes '-'."""
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    root = os.path.abspath(root)
    escaped = "".join(c if c.isalnum() else "-" for c in root)
    return os.path.join(os.path.expanduser("~"), ".claude", "projects", escaped)


def _latest_transcript():
    d = _project_transcript_dir()
    files = glob.glob(os.path.join(d, "*.jsonl"))
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def _usage_from(obj):
    """Return a usage dict from a transcript line, or None. usage lives at
    message.usage for assistant events; tolerate a top-level usage too."""
    if not isinstance(obj, dict):
        return None
    msg = obj.get("message")
    if isinstance(msg, dict) and isinstance(msg.get("usage"), dict):
        return msg["usage"]
    if isinstance(obj.get("usage"), dict):
        return obj["usage"]
    return None


def _iter_lines_reversed(path, chunk_size=65536):
    """Yield complete lines from the END of the file backward, without reading
    the whole file into memory. Memory stays ~ one chunk + one line, so cost does
    not scale with session length (T-357). A single line longer than chunk_size is
    reassembled across chunks via `tail`."""
    with open(path, "rb") as fh:
        fh.seek(0, os.SEEK_END)
        pos = fh.tell()
        tail = b""
        while pos > 0:
            read = min(chunk_size, pos)
            pos -= read
            fh.seek(pos)
            data = fh.read(read) + tail
            parts = data.split(b"\n")
            tail = parts.pop(0)  # first fragment may continue into an earlier chunk
            for ln in reversed(parts):
                yield ln
        if tail:
            yield tail


def _window_fill(path):
    """Window fill from the LAST usage record in the transcript. None on miss.
    Reads from the END (T-357) — scanning backward and returning at the first
    usage found is equivalent to a forward scan keeping the last, but cost no
    longer scales with the growing transcript."""
    for raw in _iter_lines_reversed(path):
        line = raw.strip()
        if not line:
            continue
        try:
            u = _usage_from(json.loads(line.decode("utf-8")))
        except (ValueError, TypeError, UnicodeDecodeError):
            continue
        if u and "input_tokens" in u:
            return int(
                u.get("input_tokens", 0)
                + u.get("cache_read_input_tokens", 0)
                + u.get("cache_creation_input_tokens", 0)
            )
    return None


def main():
    path = None
    argv = sys.argv[1:]
    if "--transcript" in argv:
        i = argv.index("--transcript")
        if i + 1 < len(argv):
            path = argv[i + 1]
    if path is None:
        path = _latest_transcript()
    if not path or not os.path.isfile(path):
        return  # silent -> caller keeps the estimate
    val = _window_fill(path)
    if val and val > 0:
        print(val)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # never crash a hook
    sys.exit(0)
