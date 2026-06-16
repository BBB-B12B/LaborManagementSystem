import os
import re
import datetime

def main():
    # 1. Compute sys_fixed
    try:
        sys_fixed = int((os.path.getsize('CLAUDE.md') + os.path.getsize('AGENTS.md')) * 0.3) + 3500
    except Exception:
        sys_fixed = 11070

    # 2. Check compact restore
    compact_restore = False
    compact_state_path = '.sessions/compact_state.md'
    cs_data = ''
    if os.path.exists(compact_state_path):
        with open(compact_state_path, 'r', encoding='utf-8') as f:
            cs_data = f.read()
        m = re.search(r'^dt=(.*?)(?:\s|$)', cs_data, re.M)
        if m:
            dt_val = m.group(1).split()[0]
            today = datetime.date.today().strftime('%Y-%m-%d')
            if dt_val == today:
                compact_restore = True
                print('[compact-restore]')
                print(cs_data)
                print('---')

    # 3. Read phase
    phase = ''
    active_thread_path = '.sessions/active_thread.md'
    if os.path.exists(active_thread_path):
        with open(active_thread_path, 'r', encoding='utf-8') as f:
            at_data = f.read()
        m = re.search(r'^phase:\s*(\S+)', at_data, re.M)
        if m:
            phase = m.group(1)

    # 4. Handle session tokens
    session_tokens_path = '.sessions/session_tokens.md'
    if compact_restore:
        cs = 0
        m_cs = re.search(r'^compact_size=(\d+)', cs_data, re.M)
        if m_cs:
            cs = int(m_cs.group(1))
        ct = sys_fixed + cs
        
        reset_marker = ''
        m_rm = re.search(r'^session_reset=(\S+)', cs_data, re.M)
        if m_rm:
            reset_marker = m_rm.group(1)
            
        if reset_marker == 'armed':
            st_content = f'SESSION_TOTAL: 0\nCHAT_TOTAL: {ct}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n'
            with open(session_tokens_path, 'w', encoding='utf-8') as f:
                f.write(st_content)
            # Update session_reset to consumed
            new_cs_data = re.sub(r'^session_reset=armed', 'session_reset=consumed', cs_data, flags=re.M)
            with open(compact_state_path, 'w', encoding='utf-8') as f:
                f.write(new_cs_data)
            print('[reset-consumed] SESSION=0 - marker armed->consumed')
        else:
            st = 0
            if os.path.exists(session_tokens_path):
                with open(session_tokens_path, 'r', encoding='utf-8') as f:
                    st_data = f.read()
                m_st = re.search(r'^SESSION_TOTAL:\s*(\d+)', st_data, re.M)
                if m_st:
                    st = int(m_st.group(1))
            st_content = f'SESSION_TOTAL: {st}\nCHAT_TOTAL: {ct}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n'
            with open(session_tokens_path, 'w', encoding='utf-8') as f:
                f.write(st_content)
            print(f'[reset-skip] marker={reset_marker or "absent"} - SESSION preserved={st}')
    elif phase != 'in_progress':
        st_content = f'SESSION_TOTAL: 0\nCHAT_TOTAL: {sys_fixed}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n'
        with open(session_tokens_path, 'w', encoding='utf-8') as f:
            f.write(st_content)

    # 5. Normalize LOOP_WEIGHT
    if os.path.exists(session_tokens_path):
        with open(session_tokens_path, 'r', encoding='utf-8') as f:
            lines = f.read().splitlines()
        new_lines = []
        for line in lines:
            if line.startswith('LOOP_WEIGHT:'):
                new_lines.append('LOOP_WEIGHT: 0')
            else:
                new_lines.append(line)
        with open(session_tokens_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines) + '\n')

    # 6. Print last 4 lines of active_thread.md
    if os.path.exists(active_thread_path):
        with open(active_thread_path, 'r', encoding='utf-8') as f:
            at_lines = f.read().splitlines()
        for l in at_lines[-4:]:
            print(l)

    print('---')
    # 7. Print session_tokens.md
    if os.path.exists(session_tokens_path):
        with open(session_tokens_path, 'r', encoding='utf-8') as f:
            print(f.read().strip())
    print('---')

    # 8. Grep [/] in docs/master_roadmap.md
    roadmap_path = 'docs/master_roadmap.md'
    if os.path.exists(roadmap_path):
        with open(roadmap_path, 'r', encoding='utf-8') as f:
            rm_lines = f.read().splitlines()
        count = 0
        for idx, l in enumerate(rm_lines):
            if '[/]' in l:
                safe_line = l.encode('cp874', errors='replace').decode('cp874')
                print(f'{idx+1}:{safe_line}')
                count += 1
                if count >= 3:
                    break
    print('---')

    # 9. CFP count
    cfp_count = 0
    cfp_path = 'CODING_FAILURE_PATTERNS.md'
    if os.path.exists(cfp_path):
        with open(cfp_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('## CFP-'):
                    cfp_count += 1
    print(f'CFP_COUNT: {cfp_count}')

if __name__ == '__main__':
    main()
