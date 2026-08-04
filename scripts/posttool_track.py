#!/usr/bin/env python3
"""PostToolUse tracker (CFP-028 fix · T-177).

Fires after every tool call. Does two things atomically in session_tokens.md:
  1. LOOP_WEIGHT += tool weight   (unchanged from the prior inline hook)
  2. SESSION_TOTAL / CHAT_TOTAL += a char-based ESTIMATE of this tool call's
     token cost, so the counters stop being frozen at boot values.

Why an estimate: no hook can see the model's real API token counts. We only
see the tool's input + output text on stdin, so the number is a LOWER BOUND
(captures tool I/O, misses most of the model's own prose). Better than 0.

Fail-safe contract: on ANY bad/empty input the script exits 0 and leaves
session_tokens.md byte-for-byte unchanged. A tracker must never break a tool
call. Mirrors the atomic mkstemp+os.replace write of the prior hook.
"""
import os
import sys
import json
import subprocess
import tempfile

# --- read PostToolUse stdin JSON (tool_name / tool_input / tool_response) ---
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}

root = os.environ.get('CLAUDE_PROJECT_DIR')
if not root:
    try:
        root = subprocess.check_output(
            ['git', 'rev-parse', '--show-toplevel'],
            stderr=subprocess.DEVNULL, cwd=os.getcwd()).decode().strip()
    except Exception:
        root = os.getcwd()

# tool name: prefer stdin (reliable), fall back to legacy env var
tool = data.get('tool_name') or os.environ.get('TOOL_NAME', '')

# --- subagent-context guard (CFP-041 ROOT fix · T-235) ---
# A subagent's internal tool calls ALSO fire this hook, with the SAME session_id
# and identical env as the main context (env can NOT distinguish them). But the
# PostToolUse stdin carries `agent_id`/`agent_type` ONLY for subagent calls. Their
# I/O lives in the subagent's own context window, not the main one, so accumulating
# it into the main session_tokens.md is the false-ceiling bug. Skip it entirely.
# The Agent *wrapper* call runs in the main context (no agent_id) and is still
# counted — that is correct, since its summarized result does enter main context.
if data.get('agent_id'):
    raise SystemExit(0)

# --- T-230b: auto-capture scope baseline when Phase 1 closes ---
# When gather_complete.md is (re)written, snapshot the working tree so the
# Close-time [scope-creep] gate has a task-start baseline to diff against.
# Phase 1 is read-only, so this snapshot == the true task-start tree; it
# overwrites each task (Phase 1 runs once per task) so it is never stale and
# needs no separate clear step. Fail-safe: must never break the tool call.
try:
    _fp = ((data.get('tool_input') or {}).get('file_path') or '').replace(os.sep, '/')
    if tool in ('Write', 'Edit') and _fp.endswith('.sessions/gather_complete.md'):
        _porc = subprocess.check_output(
            ['git', 'status', '--porcelain'],
            stderr=subprocess.DEVNULL, cwd=root).decode()
        with open(os.path.join(root, '.sessions', '.scope_baseline'), 'w') as _f:
            _f.write('\n'.join(sorted(_porc.splitlines())) + '\n')
except Exception:
    pass

# --- T-263 S1: skill-activation marker (.active_skill today-set log) ---
# Make skill activation a real FILE artifact so the PreToolUse skill_gate can
# enforce "right skill is loaded" (hooks cannot see the agent's [skill-active]
# text emit). On a Read of any .agents/skills/**/SKILL.md, derive the skill name
# from the directory holding SKILL.md and APPEND `name|date|turn` to
# .sessions/.active_skill. It is a today-set LOG, not a single slot (FINDING C):
# a slot would be overwritten when a secondary skill (e.g. skeptical_reviewer) is
# read while harness_editor still owns the task. "active today" = any line whose
# date == today. Reading scrutinize/skeptical_reviewer also clears .review_intent
# (the demanded review actually happened). Fail-safe: never throw — the tracker
# must keep working even if the marker write fails.
try:
    _rp = (((data.get('tool_input') or {}).get('file_path') or '')
           .replace(os.sep, '/'))
    _skill = ''
    if tool == 'Read' and '.agents/skills/' in _rp and _rp.endswith('SKILL.md'):
        _parts = _rp.rstrip('/').split('/')
        _skill = _parts[-2] if len(_parts) >= 2 else ''
    elif tool == 'Bash':
        # T-325: since T-314 the SANCTIONED load path is `read_skill.py <bucket>/<skill>`
        # — a Bash call, invisible to the Read branch above (that was the false-block bug).
        # Match ONLY a real read_skill.py invocation and REQUIRE its argument to be
        # <bucket>/<skill> shaped (word/word) — so a command that merely mentions
        # "read_skill.py" (grep/echo/comment) followed by an arbitrary token does NOT
        # false-mark a skill active (that would silently weaken the gate). Skill name =
        # the last path segment of the <bucket>/<skill> arg.
        _cmd = ((data.get('tool_input') or {}).get('command') or '')
        _m = __import__('re').search(
            r'read_skill\.py["\']?\s+([A-Za-z0-9_-]+/[A-Za-z0-9_-]+)', _cmd)
        if _m:
            _skill = _m.group(1).split('/')[-1]
    if _skill:
        _today = __import__('datetime').date.today().isoformat()
        # turn number: best-effort from session_tokens.md TURN_COUNT (else 0)
        _turn = '0'
        try:
            _stf = os.path.join(root, '.sessions', 'session_tokens.md')
            for _l in open(_stf):
                if _l.startswith('TURN_COUNT:'):
                    _turn = _l.split(':', 1)[1].strip() or '0'
                    break
        except Exception:
            _turn = '0'
        with open(os.path.join(root, '.sessions', '.active_skill'), 'a') as _af:
            _af.write('%s|%s|%s\n' % (_skill, _today, _turn))
        if _skill in ('scrutinize', 'skeptical_reviewer'):
            try:
                os.remove(os.path.join(root, '.sessions', '.review_intent'))
            except OSError:
                pass
except Exception:
    pass

# --- T-265 Gap 5: mark when a CFP STATUS field is touched (.cfp_touched) ---
# Self-improvement-loop stage 5 (Record-the-solution) was "remembered, not
# enforced": an agent could flip a CFP's status (resolve / reopen / fix-required)
# in CODING_FAILURE_PATTERNS.md or index_cfp_fix.json WITHOUT also recording the
# solution in self_improve_log.md. This writes a .sessions/.cfp_touched tripwire
# ONLY when such a status-bearing edit happens (NOT on any edit) — the close-gate
# (PreToolUse, settings.json) later refuses phase:done while the tripwire is set
# but the log wasn't updated today. Cleared at boot (boot_init.sh). Fail-safe.
try:
    _cfp_fp = (((data.get('tool_input') or {}).get('file_path') or '')
               .replace(os.sep, '/'))
    if (tool in ('Write', 'Edit')
            and (_cfp_fp.endswith('CODING_FAILURE_PATTERNS.md')
                 or _cfp_fp.endswith('knowledge/index_cfp_fix.json'))):
        _ti = data.get('tool_input') or {}
        _payload = (_ti.get('new_string') or _ti.get('content') or '')
        _status_tokens = ('"status"', 'status:', 'resolved', 'reopened',
                          'fix-required', 'fix-escalated')
        if any(_t in _payload for _t in _status_tokens):
            with open(os.path.join(root, '.sessions', '.cfp_touched'), 'w') as _cf:
                _cf.write('%s|%s\n' % (
                    os.path.basename(_cfp_fp),
                    __import__('datetime').date.today().isoformat()))
except Exception:
    pass

# --- LOOP_WEIGHT increment (same weights as the prior inline hook) ---
weights = {'Agent': 3, 'Workflow': 3, 'WebFetch': 3, 'WebSearch': 3,
           'Write': 2, 'NotebookEdit': 2}
w = next((v for k, v in weights.items() if k in tool), 1)
if 'mcp__' in tool:
    w = 2

# --- token estimate from tool I/O char count (lower bound) ---
try:
    ti = data.get('tool_input')
    tr = data.get('tool_response')
    chars = 0
    resp_chars = 0
    if ti is not None:
        chars += len(ti if isinstance(ti, str) else json.dumps(ti))
    if tr is not None:
        resp_chars = len(tr if isinstance(tr, str) else json.dumps(tr))
        chars += resp_chars
except Exception:
    chars = 0
    resp_chars = 0
# provider-aware tool multiplier (reuse token_estimator — single source of truth · T-178).
# import failure or unknown provider -> generic safety floor (0.35); never breaks the hook.
# T-357: read detected.md ONCE here and reuse it for BOTH the provider formula and the
# usage_source check below (was two opens per tool call).
tool_mult = 0.35
_det_content = ''
try:
    with open(os.path.join(root, '.agents', 'platform', 'detected.md'), encoding='utf-8') as _f:
        _det_content = _f.read()
except Exception:
    _det_content = ''
try:
    sys.path.insert(0, os.path.join(root, 'scripts'))
    import token_estimator as _te
    # content=None (read failed) -> _load_provider_formula falls back to its own read (fail-open)
    _prov = _te._load_provider_formula(content=_det_content or None)
    tool_mult = _te.PROVIDER_MULTS.get(_prov, _te.PROVIDER_MULTS['generic'])['tool']
except Exception:
    tool_mult = 0.35
# T-261: mutations (Edit/Write/NotebookEdit) return an echo that scales with file SIZE,
# not real context — count tool_input only, drop the echoed response (false-ceiling drift fix).
if tool in ('Edit', 'Write', 'NotebookEdit'):
    chars -= resp_chars
    resp_chars = 0
session_delta = round(chars * tool_mult)   # provider tool-mult · lower bound (tool I/O only)
session_delta = min(session_delta, 12800)  # T-261/T-286: sanity cap on a LOWER-BOUND advisory (~0.1 x token_budget 128k) -- NOT a window/ceiling; the client meter (real %) is the real gauge
chat_delta = session_delta                 # x1.5 dropped (T-178); true API context ~1.5-2x -> see docs note
# T-287 (single owner): when a real transcript source is live (detected.md
# usage_source: transcript), real_context.py is the SOLE writer of CHAT_TOTAL.
# posttool stops touching CHAT here -> chat_delta=0. SESSION_TOTAL (per-task
# estimate) is unaffected. Flag absent (other providers) -> estimate fallback.
# T-357: reuse the single detected.md read from above (no second open)
if 'usage_source: transcript' in _det_content:
    chat_delta = 0

# --- counter deltas: FILES_READ (per Read tool) · LONG_OUTPUTS (output >8000 chars) (T-221 S1) ---
files_read_delta = 1 if tool == 'Read' else 0
long_outputs_delta = 1 if resp_chars > 8000 else 0

path = os.path.join(root, '.sessions', 'session_tokens.md')
if not os.path.exists(path):
    raise SystemExit(0)
try:
    content = open(path).read()
except Exception:
    raise SystemExit(0)
lines = content.splitlines()
if not content.strip() or not any(l.startswith('LOOP_WEIGHT:') for l in lines):
    raise SystemExit(0)


def _bump(line, prefix, delta):
    try:
        cur = int(line.split(':', 1)[1].strip() or 0)
    except ValueError:
        return None
    return prefix + ' ' + str(cur + delta)


def _bump_ledger(root, delta):
    """T-297: feed the daily/weekly token odometer that
    loop_engineer_preflight.budget_tripped() reads. Load-or-create the ledger,
    apply date/week rollover reset, bump both counters, write atomically.
    NEVER raises — the ledger is advisory and must not break the primary
    session_tokens.md write above it."""
    ltmp = None
    try:
        import datetime
        import json
        lp = os.path.join(root, '.sessions', 'loop_token_ledger.json')
        today = datetime.date.today()
        iso = today.isocalendar()
        cur_date = today.isoformat()
        cur_week = str(iso[0]) + '-W' + str(iso[1]).zfill(2)
        try:
            with open(lp, encoding='utf-8') as lf:
                led = json.load(lf)
        except Exception:
            led = {'daily_spent': 0, 'weekly_spent': 0}
        # rollover: new day resets daily, new ISO week resets weekly
        if led.get('date') != cur_date:
            led['daily_spent'] = 0
            led['date'] = cur_date
        if led.get('week') != cur_week:
            led['weekly_spent'] = 0
            led['week'] = cur_week
        led['daily_spent'] = int(led.get('daily_spent', 0)) + delta
        led['weekly_spent'] = int(led.get('weekly_spent', 0)) + delta
        led.setdefault('daily_cap', 10000000)
        led.setdefault('weekly_cap', 100000000)
        led['last_updated'] = cur_date
        lfd, ltmp = tempfile.mkstemp(dir=os.path.dirname(lp), prefix='.led_', suffix='.tmp')
        lf = os.fdopen(lfd, 'w')
        json.dump(led, lf, indent=2)
        lf.close()
        os.replace(ltmp, lp)
    except Exception:
        if ltmp:
            try:
                os.unlink(ltmp)
            except Exception:
                pass


seen_files_read = False
seen_long_outputs = False
out = []
for line in lines:
    if line.startswith('LOOP_WEIGHT:'):
        nl = _bump(line, 'LOOP_WEIGHT:', w)
        if nl is None:
            raise SystemExit(0)
        out.append(nl)
    elif line.startswith('SESSION_TOTAL:'):
        nl = _bump(line, 'SESSION_TOTAL:', session_delta)
        out.append(nl if nl is not None else line)
    elif line.startswith('CHAT_TOTAL:'):
        nl = _bump(line, 'CHAT_TOTAL:', chat_delta)
        out.append(nl if nl is not None else line)
    elif line.startswith('FILES_READ:'):
        seen_files_read = True
        nl = _bump(line, 'FILES_READ:', files_read_delta)
        out.append(nl if nl is not None else line)
    elif line.startswith('LONG_OUTPUTS:'):
        seen_long_outputs = True
        nl = _bump(line, 'LONG_OUTPUTS:', long_outputs_delta)
        out.append(nl if nl is not None else line)
    else:
        out.append(line)
# never silently drop the counters (CFP-031): append if the block predates T-221
if not seen_files_read:
    out.append('FILES_READ: ' + str(files_read_delta))
if not seen_long_outputs:
    out.append('LONG_OUTPUTS: ' + str(long_outputs_delta))

data_out = chr(10).join(out) + chr(10)
folder = os.path.dirname(path)
fd, tmp = tempfile.mkstemp(dir=folder, prefix='.st_', suffix='.tmp')
try:
    f = os.fdopen(fd, 'w')
    f.write(data_out)
    f.close()
    os.replace(tmp, path)
    _bump_ledger(root, session_delta)  # T-297: feed the daily/weekly odometer (never raises)
except Exception:
    try:
        os.unlink(tmp)
    except Exception:
        pass
    raise SystemExit(0)
