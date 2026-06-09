import os
import re
import sys
from datetime import datetime

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

compact_state_path = ".sessions/compact_state.md"
active_thread_path = ".sessions/active_thread.md"
session_tokens_path = ".sessions/session_tokens.md"
master_roadmap_path = "docs/master_roadmap.md"
cfp_path = "CODING_FAILURE_PATTERNS.md"

today = datetime.now().strftime("%Y-%m-%d")
compact_restore = False
compact_state_content = ""

if os.path.exists(compact_state_path):
    with open(compact_state_path, "r", encoding="utf-8") as f:
        compact_state_content = f.read()
    
    dt_match = re.search(r"^dt=(.*)$", compact_state_content, re.MULTILINE)
    if dt_match:
        cs_dt = dt_match.group(1).strip().split()[0]
        if cs_dt == today:
            compact_restore = True
            print("[compact-restore]")
            print(compact_state_content.strip())
            print("---")

phase = "unknown"
if os.path.exists(active_thread_path):
    with open(active_thread_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("phase:"):
                phase = line.split(":", 1)[1].strip()
                break

sys_fixed = 11070
try:
    claud_sz = os.path.getsize("CLAUDE.md") if os.path.exists("CLAUDE.md") else 0
    agents_sz = os.path.getsize("AGENTS.md") if os.path.exists("AGENTS.md") else 0
    sys_fixed = int((claud_sz + agents_sz) * 0.3) + 3500
except Exception:
    pass

if compact_restore:
    cs_match = re.search(r"^compact_size=(.*)$", compact_state_content, re.MULTILINE)
    cs = int(cs_match.group(1).strip()) if cs_match else 0
    ct = sys_fixed + cs
    
    reset_match = re.search(r"^session_reset=(.*)$", compact_state_content, re.MULTILINE)
    reset_marker = reset_match.group(1).strip() if reset_match else "absent"
    
    if reset_marker == "armed":
        with open(session_tokens_path, "w", encoding="utf-8") as f:
            f.write(f"SESSION_TOTAL: 0\nCHAT_TOTAL: {ct}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n")
        new_content = re.sub(r"^session_reset=armed", "session_reset=consumed", compact_state_content, flags=re.MULTILINE)
        with open(compact_state_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("[reset-consumed] SESSION=0 · marker armed→consumed")
    else:
        st = 0
        if os.path.exists(session_tokens_path):
            with open(session_tokens_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("SESSION_TOTAL:"):
                        try:
                            st = int(line.split(":", 1)[1].strip())
                        except ValueError:
                            pass
                        break
        with open(session_tokens_path, "w", encoding="utf-8") as f:
            f.write(f"SESSION_TOTAL: {st}\nCHAT_TOTAL: {ct}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n")
        print(f"[reset-skip] marker={reset_marker} · SESSION preserved={st}")
elif phase != "in_progress":
    with open(session_tokens_path, "w", encoding="utf-8") as f:
        f.write(f"SESSION_TOTAL: 0\nCHAT_TOTAL: {sys_fixed}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n")

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

if os.path.exists(active_thread_path):
    with open(active_thread_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for line in lines[-4:]:
        print(line.strip())
print("---")

if os.path.exists(session_tokens_path):
    with open(session_tokens_path, "r", encoding="utf-8") as f:
        print(f.read().strip())
print("---")

roadmap_count = 0
if os.path.exists(master_roadmap_path):
    with open(master_roadmap_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            if "[/]" in line:
                print(f"{idx}:{line.strip()}")
                roadmap_count += 1
                if roadmap_count >= 3:
                    break
print("---")

cfp_count = 0
if os.path.exists(cfp_path):
    with open(cfp_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("## CFP-"):
                cfp_count += 1
print(f"CFP_COUNT: {cfp_count}")
