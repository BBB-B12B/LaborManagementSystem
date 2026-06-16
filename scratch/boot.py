import os
import sys
import datetime
import re

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

compact_state_path = ".sessions/compact_state.md"
active_thread_path = ".sessions/active_thread.md"
session_tokens_path = ".sessions/session_tokens.md"
claude_md_path = "CLAUDE.md"
agents_md_path = "AGENTS.md"

compact_restore = False
cs_dt = ""
compact_size = 0
reset_marker = ""

if os.path.exists(compact_state_path):
    with open(compact_state_path, "r", encoding="utf-8") as f:
        content = f.read()
        m_dt = re.search(r"^dt=(.*)$", content, re.MULTILINE)
        if m_dt:
            cs_dt = m_dt.group(1).split()[0]
        m_cs = re.search(r"^compact_size=(.*)$", content, re.MULTILINE)
        if m_cs:
            try:
                compact_size = int(m_cs.group(1).strip())
            except:
                pass
        m_rm = re.search(r"^session_reset=(.*)$", content, re.MULTILINE)
        if m_rm:
            reset_marker = m_rm.group(1).strip()

today = datetime.date.today().strftime("%Y-%m-%d")
if cs_dt == today:
    compact_restore = True
    print("[compact-restore]")
    if os.path.exists(compact_state_path):
        with open(compact_state_path, "r", encoding="utf-8") as f:
            print(f.read())
    print("---")

phase = ""
if os.path.exists(active_thread_path):
    with open(active_thread_path, "r", encoding="utf-8") as f:
        content = f.read()
        m_ph = re.search(r"^phase:\s*(\S+)", content, re.MULTILINE)
        if m_ph:
            phase = m_ph.group(1).strip()

sys_fixed = 11070
if os.path.exists(claude_md_path) and os.path.exists(agents_md_path):
    sz = os.path.getsize(claude_md_path) + os.path.getsize(agents_md_path)
    sys_fixed = int(sz * 0.3) + 3500

if compact_restore:
    ct = sys_fixed + compact_size
    if reset_marker == "armed":
        st_content = f"SESSION_TOTAL: 0\nCHAT_TOTAL: {ct}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n"
        with open(session_tokens_path, "w", encoding="utf-8") as f:
            f.write(st_content)
        # Update compact_state.md
        with open(compact_state_path, "r", encoding="utf-8") as f:
            cs_content = f.read()
        cs_content = re.sub(r"^session_reset=armed", "session_reset=consumed", cs_content, flags=re.MULTILINE)
        with open(compact_state_path, "w", encoding="utf-8") as f:
            f.write(cs_content)
        print("[reset-consumed] SESSION=0 · marker armed→consumed")
    else:
        st_total = 0
        if os.path.exists(session_tokens_path):
            with open(session_tokens_path, "r", encoding="utf-8") as f:
                st_match = re.search(r"^SESSION_TOTAL:\s*(\d+)", f.read(), re.MULTILINE)
                if st_match:
                    st_total = int(st_match.group(1))
        st_content = f"SESSION_TOTAL: {st_total}\nCHAT_TOTAL: {ct}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n"
        with open(session_tokens_path, "w", encoding="utf-8") as f:
            f.write(st_content)
        print(f"[reset-skip] marker={reset_marker or 'absent'} · SESSION preserved={st_total}")
elif phase != "in_progress":
    st_content = f"SESSION_TOTAL: 0\nCHAT_TOTAL: {sys_fixed}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n"
    with open(session_tokens_path, "w", encoding="utf-8") as f:
        f.write(st_content)

# Normalize LOOP_WEIGHT to 0 in session_tokens.md if it exists
if os.path.exists(session_tokens_path):
    with open(session_tokens_path, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
    new_lines = []
    for line in lines:
        if line.startswith("LOOP_WEIGHT:"):
            new_lines.append("LOOP_WEIGHT: 0")
        else:
            new_lines.append(line)
    with open(session_tokens_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines) + "\n")

# Output last 4 lines of active_thread.md
if os.path.exists(active_thread_path):
    with open(active_thread_path, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
        print("\n".join(lines[-4:]))
print("---")

# Output session_tokens.md
if os.path.exists(session_tokens_path):
    with open(session_tokens_path, "r", encoding="utf-8") as f:
        print(f.read().strip())
print("---")

# Grep docs/master_roadmap.md for [/] (in progress tasks)
roadmap_path = "docs/master_roadmap.md"
if os.path.exists(roadmap_path):
    with open(roadmap_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        count = 0
        for i, line in enumerate(lines):
            if "[/]" in line:
                print(f"{i+1}:{line.strip()}")
                count += 1
                if count >= 3:
                    break
print("---")

# CFP count
cfp_path = "CODING_FAILURE_PATTERNS.md"
cfp_count = 0
if os.path.exists(cfp_path):
    with open(cfp_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("## CFP-"):
                cfp_count += 1
print(f"CFP_COUNT: {cfp_count}")
