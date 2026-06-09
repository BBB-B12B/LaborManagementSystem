import os
import sys
import datetime

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding="utf-8")

# 1. Read compact_state.md
compact_state_path = ".sessions/compact_state.md"
compact_state = {}
if os.path.exists(compact_state_path):
    with open(compact_state_path, "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                compact_state[k] = v

today = datetime.date.today().strftime("%Y-%m-%d")
compact_restore = False
if compact_state.get("dt") == today:
    compact_restore = True
    print("[compact-restore]")
    if os.path.exists(compact_state_path):
        with open(compact_state_path, "r", encoding="utf-8") as f:
            print(f.read().strip())
    print("---")

# 2. Read active_thread.md phase
active_thread_path = ".sessions/active_thread.md"
phase = "none"
if os.path.exists(active_thread_path):
    with open(active_thread_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("phase:"):
                phase = line.split(":", 1)[1].strip()

# 3. Calculate sys_fixed
claude_size = os.path.getsize("CLAUDE.md") if os.path.exists("CLAUDE.md") else 0
agents_size = os.path.getsize("AGENTS.md") if os.path.exists("AGENTS.md") else 0
sys_fixed = int((claude_size + agents_size) * 0.3) + 3500

session_tokens_path = ".sessions/session_tokens.md"

# 4. Handle compact_restore & session_tokens.md
if compact_restore:
    cs = int(compact_state.get("compact_size", "0"))
    ct = sys_fixed + cs
    reset_marker = compact_state.get("session_reset", "")
    
    if reset_marker == "armed":
        with open(session_tokens_path, "w", encoding="utf-8") as f:
            f.write(f"SESSION_TOTAL: 0\nCHAT_TOTAL: {ct}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n")
        
        # update compact_state.md
        if os.path.exists(compact_state_path):
            with open(compact_state_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            with open(compact_state_path, "w", encoding="utf-8") as f:
                for line in lines:
                    if line.startswith("session_reset="):
                        f.write("session_reset=consumed\n")
                    else:
                        f.write(line)
        print("[reset-consumed] SESSION=0 · marker armed→consumed")
    else:
        st = 0
        if os.path.exists(session_tokens_path):
            with open(session_tokens_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("SESSION_TOTAL:"):
                        st = int(line.split(":", 1)[1].strip())
        with open(session_tokens_path, "w", encoding="utf-8") as f:
            f.write(f"SESSION_TOTAL: {st}\nCHAT_TOTAL: {ct}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n")
        print(f"[reset-skip] marker={reset_marker if reset_marker else 'absent'} · SESSION preserved={st}")
elif phase != "in_progress":
    with open(session_tokens_path, "w", encoding="utf-8") as f:
        f.write(f"SESSION_TOTAL: 0\nCHAT_TOTAL: {sys_fixed}\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n")

# 5. Normalize LOOP_WEIGHT to 0
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

# 6. Print tail of active_thread.md
if os.path.exists(active_thread_path):
    with open(active_thread_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        for line in lines[-4:]:
            print(line.strip())
print("---")

# 7. Print session_tokens.md
if os.path.exists(session_tokens_path):
    with open(session_tokens_path, "r", encoding="utf-8") as f:
        print(f.read().strip())
print("---")

# 8. Print docs/master_roadmap.md pending tasks
roadmap_path = "docs/master_roadmap.md"
if os.path.exists(roadmap_path):
    count = 0
    with open(roadmap_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            if "[/]" in line:
                print(f"{idx}:{line.strip()}")
                count += 1
                if count >= 3:
                    break
print("---")

# 9. Print CFP Count
cfp_path = "CODING_FAILURE_PATTERNS.md"
cfp_count = 0
if os.path.exists(cfp_path):
    with open(cfp_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("## CFP-"):
                cfp_count += 1
print(f"CFP_COUNT: {cfp_count}")
