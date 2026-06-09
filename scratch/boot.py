import os
import re
from datetime import datetime

cs_dt = None
compact_restore = False
cs_size = 0
reset_marker = None

if os.path.exists('.sessions/compact_state.md'):
    with open('.sessions/compact_state.md', 'r', encoding='utf-8') as f:
        content = f.read()
        m_dt = re.search(r'^dt=(.*)', content, re.MULTILINE)
        if m_dt:
            cs_dt = m_dt.group(1).split()[0]
        m_size = re.search(r'^compact_size=(.*)', content, re.MULTILINE)
        if m_size:
            try: cs_size = int(m_size.group(1).strip())
            except: pass
        m_reset = re.search(r'^session_reset=(.*)', content, re.MULTILINE)
        if m_reset:
            reset_marker = m_reset.group(1).strip()

today = datetime.now().strftime('%Y-%m-%d')
if cs_dt == today:
    compact_restore = True
    print('[compact-restore]')
    with open('.sessions/compact_state.md', 'r', encoding='utf-8') as f:
        print(f.read().encode('ascii', 'ignore').decode('ascii'))
    print('---')

phase = ''
if os.path.exists('.sessions/active_thread.md'):
    with open('.sessions/active_thread.md', 'r', encoding='utf-8') as f:
        content = f.read()
        m_phase = re.search(r'^phase:\s*(.*)', content, re.MULTILINE)
        if m_phase:
            phase = m_phase.group(1).strip()

sys_fixed = int((os.path.getsize('CLAUDE.md') + os.path.getsize('AGENTS.md')) * 0.3) + 3500

if compact_restore:
    ct = sys_fixed + cs_size
    if reset_marker == 'armed':
        st = 0
        with open('.sessions/compact_state.md', 'r', encoding='utf-8') as f:
            c = f.read()
        c = re.sub(r'^session_reset=armed', 'session_reset=consumed', c, flags=re.MULTILINE)
        with open('.sessions/compact_state.md', 'w', encoding='utf-8') as f:
            f.write(c)
        print('[reset-consumed] SESSION=0 · marker armed->consumed')
    else:
        st = 0
        if os.path.exists('.sessions/session_tokens.md'):
            with open('.sessions/session_tokens.md', 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('SESSION_TOTAL:'):
                        try: st = int(line.split()[1])
                        except: pass
        print(f'[reset-skip] marker={reset_marker} · SESSION preserved={st}')
    with open('.sessions/session_tokens.md', 'w', encoding='utf-8') as f:
        f.write(f'SESSION_TOTAL: {st}\nCHAT_TOTAL: {ct}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n')
elif phase != 'in_progress':
    with open('.sessions/session_tokens.md', 'w', encoding='utf-8') as f:
        f.write(f'SESSION_TOTAL: 0\nCHAT_TOTAL: {sys_fixed}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n')

if os.path.exists('.sessions/session_tokens.md'):
    with open('.sessions/session_tokens.md', 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()
    normalized = []
    for line in lines:
        if line.startswith('LOOP_WEIGHT:'):
            normalized.append('LOOP_WEIGHT: 0')
        else:
            normalized.append(line)
    with open('.sessions/session_tokens.md', 'w', encoding='utf-8') as f:
        f.write('\n'.join(normalized) + '\n')

if os.path.exists('.sessions/active_thread.md'):
    with open('.sessions/active_thread.md', 'r', encoding='utf-8') as f:
        print(''.join(f.readlines()[-4:]).encode('ascii', 'ignore').decode('ascii'))
print('---')
if os.path.exists('.sessions/session_tokens.md'):
    with open('.sessions/session_tokens.md', 'r', encoding='utf-8') as f:
        print(f.read().encode('ascii', 'ignore').decode('ascii'))
print('---')
if os.path.exists('docs/master_roadmap.md'):
    with open('docs/master_roadmap.md', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    count = 0
    for idx, line in enumerate(lines):
        if '[/]' in line:
            print(f'{idx+1}:{line.strip().encode("ascii", "ignore").decode("ascii")}')
            count += 1
            if count >= 3:
                break
print('---')
cfp_count = 0
if os.path.exists('CODING_FAILURE_PATTERNS.md'):
    with open('CODING_FAILURE_PATTERNS.md', 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('## CFP-'):
                cfp_count += 1
print(f'CFP_COUNT: {cfp_count}')
