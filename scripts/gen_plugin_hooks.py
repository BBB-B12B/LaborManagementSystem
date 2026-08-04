#!/usr/bin/env python3
"""Generate .claude-plugin/hooks.json from .claude/settings.json (T-312 S2).

Single-source-of-truth port: settings.json stays the authoritative hook list;
this script re-expresses every hook command so engine scripts resolve via the
plugin install dir (${CLAUDE_PLUGIN_ROOT}) instead of the project dir.

Transform (uniform, one line per command):
    prepend  export HARNESS_ENGINE_ROOT="${CLAUDE_PLUGIN_ROOT}";
Every command already invokes engine scripts through ${HARNESS_ENGINE_ROOT:-<fallback>}
(and the inline gate reads os.environ['HARNESS_ENGINE_ROOT']), so setting that var to
the plugin dir makes all commands resolve there when installed as a plugin. When
CLAUDE_PLUGIN_ROOT is unset (self-hosted repo), the var is empty -> bash ':-' and
python 'or' both fall back to the project/git root = today's behavior. Fully additive.

Grouping and matchers are preserved 1:1 so the blocker wiring (danger_gate matcher,
git_guard event, phase-gate/skill_gate on PreToolUse) is identical to the source.

Re-run this whenever .claude/settings.json hook commands change.
Usage: python3 scripts/gen_plugin_hooks.py [SETTINGS_JSON] [OUT_HOOKS_JSON]
"""
import json
import sys
import os

PREFIX = 'export HARNESS_ENGINE_ROOT="${CLAUDE_PLUGIN_ROOT}"; '

# The phase-gate hook is defined INLINE in settings.json. In the plugin it is
# replaced by a reference to the extracted, guarded scripts/phase_gate.py (T-312
# S3) so the plugin's copy carries the non-harness-project no-op guard.
PHASE_GATE_CMD = (
    'export HARNESS_ENGINE_ROOT="${CLAUDE_PLUGIN_ROOT}"; '
    'python3 "${HARNESS_ENGINE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}/scripts/phase_gate.py"'
)


def _is_inline_phase_gate(cmd) -> bool:
    return isinstance(cmd, str) and 'PROHIBITED = [' in cmd and 'gather_complete.md' in cmd


# T-312 S4: plugin-only SessionStart detector/router. NOT present in the
# project's settings.json (the repo does not need to onboard itself); added to
# the plugin's hooks.json only, so it fires when the plugin is installed
# elsewhere. Detect + recommend only (never mutates) -> headless-safe.
ONBOARD_CMD = (
    'export HARNESS_ENGINE_ROOT="${CLAUDE_PLUGIN_ROOT}"; '
    'python3 "${HARNESS_ENGINE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}/scripts/harness_onboard.py" 2>/dev/null || true'
)


def transform(cmd: str) -> str:
    if not isinstance(cmd, str):
        return cmd
    if _is_inline_phase_gate(cmd):
        return PHASE_GATE_CMD  # extracted to scripts/phase_gate.py (guarded)
    if cmd.startswith('export HARNESS_ENGINE_ROOT='):
        return cmd  # idempotent
    return PREFIX + cmd


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '.claude', 'settings.json')
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, '.claude-plugin', 'hooks.json')

    settings = json.load(open(src))
    hooks = settings.get('hooks', {})

    count = 0
    for event, groups in hooks.items():
        for group in groups:
            for hk in group.get('hooks', []):
                if hk.get('type') == 'command' and 'command' in hk:
                    hk['command'] = transform(hk['command'])
                    count += 1

    # T-312 S4: inject the plugin-only SessionStart onboard hook (idempotent).
    ss = hooks.setdefault('SessionStart', [])
    onboard = 0
    if not any('harness_onboard.py' in hk.get('command', '')
               for g in ss for hk in g.get('hooks', [])):
        ss.append({'hooks': [{'type': 'command', 'command': ONBOARD_CMD}]})
        onboard = 1

    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w') as f:
        json.dump({'hooks': hooks}, f, indent=2)
        f.write('\n')

    print(f'gen_plugin_hooks: wrote {dst} · {count} ported + {onboard} onboard hook')
    return 0


if __name__ == '__main__':
    sys.exit(main())
