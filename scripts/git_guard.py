#!/usr/bin/env python3
"""T-227 git-guardrails: PreToolUse(Bash) hard guard.

Blocks 4 known-dangerous git patterns BEFORE they run, exiting 2 (a real
block in Claude Code — stderr is fed back to the agent), not an advisory.

Design (scrutinized — T-227):
  - Tokenize with shlex, then match `git` + subcommand + flags as REAL tokens.
    Never raw substring: `git commit -m "drop push --force flag"` must PASS
    (the pattern lives inside a quoted message token, not as live args).
  - Skip git's leading GLOBAL options before reading the subcommand. Options
    like `-C <path>` / `-c <k=v>` take a separate value token, so the real
    subcommand sits AFTER that value (`git -C /repo push --force` is a
    force-push and must be caught — T-227 follow-up fix).
  - Scan the whole (possibly compound) command: `cd x && git push --force`
    is caught because `&&` survives as its own token and we walk every `git`.
  - Fail-OPEN on any parse error (unbalanced quotes, bad JSON): never break a
    legitimate workflow over a quirk — a guard that locks the agent out is worse.
  - Explicit override: prefix `GIT_GUARD_OK=1` to opt in per-command after the
    user confirms. Stateless — no sentinel file to go stale.

Blocked patterns:
  1. git push --force / -f / --force-with-lease   (rewrites remote history)
  2. git reset --hard                              (discards uncommitted work)
  3. git clean -f (incl. -fd / -xfd)               (deletes untracked files)
  4. git branch -D / --delete --force              (force-deletes a branch)
"""
import json
import os
import shlex
import sys

SHELL_SEPARATORS = {";", "&&", "||", "|", "&", "(", ")", "{", "}"}

# git global options that consume the NEXT token as their value. The real
# subcommand sits after that value, so we must skip the option AND its value
# (e.g. `git -C /repo push` → subcommand is `push`, not `/repo`). Forms that
# carry the value inline with `=` (`--git-dir=/x`) need no extra skip.
GIT_VALUE_OPTS = {
    "-C", "-c", "--git-dir", "--work-tree", "--namespace",
    "--super-prefix", "--exec-path",
}


def _after_global_opts(rest):
    """Drop git's leading global options (and their separate value tokens) so
    the first remaining token is the true subcommand."""
    j = 0
    while j < len(rest):
        t = rest[j]
        if not t.startswith("-"):
            return rest[j:]
        if t in GIT_VALUE_OPTS and "=" not in t:
            j += 2  # skip the option AND its separate value token
        else:
            j += 1
    return []


def scan(tokens):
    """Return a human reason string if a dangerous git command is present, else None."""
    for i, tok in enumerate(tokens):
        if os.path.basename(tok) != "git":
            continue
        # count git only in COMMAND position — at the start, or right after a
        # shell separator / env-assignment. Otherwise it is an argument to
        # another program (e.g. `echo git push --force` merely prints text).
        if i > 0:
            prev = tokens[i - 1]
            is_env = "=" in prev and prev.split("=", 1)[0].isidentifier()
            if prev not in SHELL_SEPARATORS and not is_env:
                continue
        # collect args of THIS git invocation up to the next shell separator
        rest = []
        for t2 in tokens[i + 1:]:
            if t2 in SHELL_SEPARATORS:
                break
            rest.append(t2)
        # skip git's global options (and their values) before the subcommand
        args = _after_global_opts(rest)
        sub = args[0] if args else None
        flags = set(args)

        if sub == "push" and (
            "--force" in flags
            or "-f" in flags
            or any(x == "--force-with-lease" or x.startswith("--force-with-lease=") for x in args)
        ):
            return "git push --force (force-push rewrites remote history)"

        if sub == "reset" and "--hard" in flags:
            return "git reset --hard (discards all uncommitted work — unrecoverable)"

        if sub == "clean":
            short_f = any(
                f.startswith("-") and not f.startswith("--") and "f" in f for f in args
            )
            if short_f or "--force" in flags:
                return "git clean -f (permanently deletes untracked files)"

        if sub == "branch" and (
            "-D" in flags or ("--delete" in flags and "--force" in flags)
        ):
            return "git branch -D (force-deletes a branch, including main)"
    return None


def has_override(tokens):
    """True if the user explicitly opted in to run a guarded command.

    The hook only receives the command STRING — never the shell env that a
    `GIT_GUARD_OK=1 <cmd>` prefix would set on the git subprocess — so the
    prefix must be detected as a leading TOKEN, not read from os.environ.
    We also still honor a genuinely exported env var (global opt-in).
    """
    if os.environ.get("GIT_GUARD_OK") == "1":
        return True
    for t in tokens:
        if t == "GIT_GUARD_OK=1":
            return True
        if os.path.basename(t) == "git":
            break  # the opt-in prefix must lead the git invocation
    return False


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # fail-open: unparseable hook input
    if data.get("tool_name") != "Bash":
        sys.exit(0)
    cmd = data.get("tool_input", {}).get("command", "") or ""
    if not cmd.strip():
        sys.exit(0)
    try:
        tokens = shlex.split(cmd)
    except Exception:
        sys.exit(0)  # fail-open: unbalanced quotes etc.

    if has_override(tokens):
        sys.exit(0)
    reason = scan(tokens)
    if reason:
        sys.stderr.write(
            "[git-gate] BLOCKED: " + reason + "\n"
            "This action rewrites/destroys history or files and cannot be undone.\n"
            "If you are certain, re-run with the explicit override:\n"
            "    GIT_GUARD_OK=1 <your git command>\n"
        )
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
