#!/usr/bin/env python3
"""gen_doc_labels.py — T-351: build a Topic/Label navigation map from a long harness
doc's ##/### headings so scripts/lookup.py can jump-read the exact slice (not full-read).

Per configured long doc: (1) strip any existing DOC-MAP block, then re-insert an idempotent
mini-TOC between `<!-- DOC-MAP:START ... -->` and `<!-- DOC-MAP:END -->` (after the H1 title
if there is one, else at the top — fragment docs have no H1); (2) compute each heading's
[start, end] on the FINAL file (the TOC insert shifts every heading by a fixed amount —
predicted, then re-scanned and asserted, so a range can never silently drift · F1);
(3) upsert that file's labels_by_topic["doc_navigation"] in knowledge/index_files.json.

Writes ONLY labels_by_topic (the lookup index), never topic_map — so index_reconcile's
check_labels() stays silent: no orphan vocab, no topic_registry.json write (F4). Fail-safe:
temp-write + assert the stripped body is byte-identical to the input, then atomic swap.
Never touches CLAUDE.md / AGENTS.md.

CLI:  <file> | --all | <file> --check | --check (dry-run over --all) | --self-test
"""
import json
import os
import re
import sys
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(REPO, "knowledge", "index_files.json")
START = "<!-- DOC-MAP:START (auto · gen_doc_labels.py) -->"
END = "<!-- DOC-MAP:END -->"
HINT = '<!-- topic: doc_navigation · jump: python3 scripts/lookup.py "<label>" -->'
TOPIC = "doc_navigation"
EXCLUDE = {"CLAUDE.md", "AGENTS.md"}
HEADING_RE = re.compile(r"^(#{2,3})\s+(.*\S)\s*$")
H1_RE = re.compile(r"^#\s+\S")


def _configured_docs():
    """Implement/*.md + docs/session_templates/*.md over 250 lines (excludes hot files)."""
    out = []
    for sub in ("Implement", os.path.join("docs", "session_templates")):
        d = os.path.join(REPO, sub)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            if not name.endswith(".md") or name in EXCLUDE or name.startswith("."):
                continue  # skip hidden + macOS AppleDouble (._foo.md) binary sidecar files
            full = os.path.join(d, name)
            with open(full, encoding="utf-8", errors="surrogateescape") as fh:
                if sum(1 for _ in fh) > 250:
                    out.append(os.path.relpath(full, REPO))
    return out


def _strip_block(lines):
    """Remove an existing DOC-MAP block + the one trailing blank we own. Exact inverse of the
    insert in build(), so _strip_block(build(x)) == x → content-safety + idempotency."""
    out, i, n = [], 0, len(lines)
    while i < n:
        if lines[i].strip() == START:
            j = i
            while j < n and lines[j].strip() != END:
                j += 1
            j += 1  # step past END
            if j < n and lines[j].strip() == "":
                j += 1  # drop the trailing blank we inserted
            i = j
            continue
        out.append(lines[i])
        i += 1
    return out


def _headings(lines):
    """(level, text, 1-indexed line) for ## / ### headings outside ``` code fences."""
    out, fence = [], False
    for idx, ln in enumerate(lines):
        if ln.lstrip().startswith("```"):
            fence = not fence
            continue
        if not fence:
            m = HEADING_RE.match(ln)
            if m:
                out.append((len(m.group(1)), m.group(2).strip(), idx + 1))
    return out


def _h1_index(lines):
    for idx, ln in enumerate(lines):
        if H1_RE.match(ln):
            return idx
    return -1


def build(text):
    """Return (new_text, labels) with labels = [{label, lines:[start,end]}] on the FINAL file.
    Idempotent: build(build(text)[0])[0] == build(text)[0]. Handles docs with no H1 title."""
    lines = _strip_block(text.split("\n"))
    heads = _headings(lines)
    h1 = _h1_index(lines)
    first_head = heads[0][2] - 1 if heads else len(lines)
    insert_at = h1 + 1 if 0 <= h1 < first_head else 0  # after a real title, else prepend
    shift = (2 + len(heads) + 1) + 1  # block (START+HINT+N+END) + trailing blank
    toc, predicted = [START, HINT], []
    for lvl, txt, ln in heads:
        predicted.append(ln + shift)  # every heading sits at/after insert_at → same shift
        toc.append("- L%d · %s %s" % (ln + shift, "#" * lvl, txt))
    toc.append(END)
    new_lines = lines[:insert_at] + toc + [""] + lines[insert_at:]
    scanned = _headings(new_lines)  # authoritative: re-scan, then assert vs prediction (F1)
    if len(scanned) != len(heads):
        raise ValueError("heading count changed after insert (fail-safe)")
    labels = []
    for i, (lvl, txt, fstart) in enumerate(scanned):
        if fstart != predicted[i]:
            raise ValueError("line-range drift at %r: scan=%d predicted=%d"
                             % (txt, fstart, predicted[i]))
        end = scanned[i + 1][2] - 1 if i + 1 < len(scanned) else len(new_lines)
        labels.append({"label": txt, "lines": [fstart, end]})
    return "\n".join(new_lines), labels


def _files_view(data):
    """index_files.json is flat {path: meta}; tolerate a {"files": {...}} wrapper too."""
    return data["files"] if isinstance(data, dict) and "files" in data else data


def process(rel, check=False):
    """Map one doc: insert TOC (temp-swap) + upsert its index labels. Nothing written in check."""
    path = os.path.join(REPO, rel)
    with open(path, encoding="utf-8", errors="surrogateescape") as fh:
        original = fh.read()
    new_text, labels = build(original)
    if not check and new_text != original:
        # content-safety: the body (with any DOC-MAP block stripped) must be byte-identical
        # before and after. Strip BOTH sides — `original` may already carry a block on a re-run.
        if _strip_block(new_text.split("\n")) != _strip_block(original.split("\n")):
            raise ValueError("body changed outside the DOC-MAP block — refusing swap")
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".docmap")
        try:
            with os.fdopen(fd, "w", encoding="utf-8", errors="surrogateescape") as fh:
                fh.write(new_text)
            os.replace(tmp, path)
        except BaseException:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise
    with open(INDEX, encoding="utf-8") as fh:
        data = json.load(fh)
    files = _files_view(data)
    meta = files.get(rel)
    if not isinstance(meta, dict):
        meta = files[rel] = {}
    meta.setdefault("labels_by_topic", {})[TOPIC] = labels
    if not check:
        with open(INDEX, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
    return new_text != original, labels, new_text


def _run(targets, check):
    rc = 0
    for rel in targets:
        try:
            changed, labels, preview = process(rel, check=check)
        except (OSError, ValueError) as exc:
            print("[doc-map-skip] %s — %s" % (rel, exc))
            rc = 1
            continue
        tag = "would-map" if check else ("mapped" if changed else "unchanged")
        print("[doc-map] %s · %s · %d labels" % (rel, tag, len(labels)))
        if check:
            for lbl in labels:
                print("    L%d-%d · %s" % (lbl["lines"][0], lbl["lines"][1], lbl["label"]))
    return rc


def self_test():
    import shutil
    sample = "# T\n\nlead\n\n## Alpha\na\n\n### Beta\nb\n\n## Gamma\ng\n"
    t1, l1 = build(sample)
    assert build(t1)[0] == t1, "(a) idempotency"
    assert "\n".join(_strip_block(t1.split("\n"))) == sample, "(c) content-safety"
    shift = (2 + len(_headings(sample.split("\n"))) + 1) + 1  # (b) post-insert line shift
    alpha = next(x for x in l1 if x["label"] == "Alpha")
    assert alpha["lines"][0] == sample.split("\n").index("## Alpha") + 1 + shift, "(b) shift"
    assert alpha["lines"][1] >= alpha["lines"][0], "(b) end >= start"
    frag = "## 14. Proto\nbody\n\n### 14a. Sub\nmore\n"  # (e) no-H1 fragment (the 06_orch case)
    ft, fl = build(frag)
    assert ft.startswith(START), "(e) TOC prepended when no H1"
    assert "\n".join(_strip_block(ft.split("\n"))) == frag, "(e) fragment content-safe"
    fshift = (2 + 2 + 1) + 1
    assert next(x for x in fl if x["label"] == "14. Proto")["lines"][0] == 1 + fshift, "(e) frag shift"
    global REPO, INDEX  # (d) check writes nothing; a real run writes doc + upserts index
    save, td = (REPO, INDEX), tempfile.mkdtemp()
    try:
        REPO, INDEX = td, os.path.join(td, "index.json")
        os.mkdir(os.path.join(td, "Implement"))  # (f) discovery skips ._ AppleDouble + hidden
        big = "# H\n" + "\n".join("## S%d\nx" % i for i in range(200))
        open(os.path.join(td, "Implement", "real.md"), "w", encoding="utf-8").write(big)
        with open(os.path.join(td, "Implement", "._real.md"), "wb") as fh:
            fh.write(b"\x00\xb0 mac resource fork, not utf-8 " * 20)
        assert _configured_docs() == ["Implement/real.md"], "(f) skip dotfile/AppleDouble sidecar"
        doc = os.path.join(td, "d.md")
        open(doc, "w", encoding="utf-8").write(sample)
        open(INDEX, "w", encoding="utf-8").write("{}")
        before, idx_before = open(doc, "rb").read(), open(INDEX).read()
        process("d.md", check=True)
        assert open(doc, "rb").read() == before, "(d) check leaves doc untouched"
        assert open(INDEX).read() == idx_before, "(d) check leaves index untouched"
        process("d.md", check=False)
        assert open(doc, "rb").read() != before, "(d) real run writes the doc"
        assert json.load(open(INDEX))["d.md"]["labels_by_topic"][TOPIC], "(d) index upserted"
        # (g) re-run after a body edit: a DOC-MAP block already exists AND headings shifted →
        #     must UPDATE the block, not refuse (strip-both-sides content-safety fix)
        edited = open(doc, encoding="utf-8").read().replace("lead\n", "lead\nEXTRA BODY\n", 1)
        open(doc, "w", encoding="utf-8").write(edited)
        process("d.md", check=False)  # must not raise
        assert _strip_block(open(doc, encoding="utf-8").read().split("\n")) == \
            _strip_block(edited.split("\n")), "(g) re-run preserves the edited body"
    finally:
        REPO, INDEX = save
        shutil.rmtree(td, ignore_errors=True)
    print("[gen_doc_labels] self-test PASS (a idempotent · b shift · c content-safe · "
          "d check-no-write · e no-H1 fragment · f skip-sidecar · g re-run-update)")
    return 0


def main(argv):
    args = argv[1:]
    if "--self-test" in args:
        try:
            return self_test()
        except AssertionError as exc:
            print("[gen_doc_labels] self-test FAIL: %s" % exc)
            return 1
    check = "--check" in args
    targets = [a for a in args if not a.startswith("--")]
    if "--all" in args or (not targets and check):
        targets = _configured_docs()
    elif not targets:
        print(__doc__)
        return 2
    return _run(targets, check)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
