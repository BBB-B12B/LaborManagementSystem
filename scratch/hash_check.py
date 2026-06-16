import hashlib
import os

def sha1_8(path):
    with open(path, 'rb') as f:
        data = f.read()
    return hashlib.sha1(data).hexdigest()[:8]

skill_path = r"d:\LaborManagementSystem\.agents\skills\harness_editor\SKILL.md"
mece_path = r"d:\LaborManagementSystem\.sessions\mece_plan.md"

sk_h = sha1_8(skill_path)
mece_h = sha1_8(mece_path)

print(f"sk_h: {sk_h}")
print(f"mece_h: {mece_h}")

state_content = f"""dt=2026-06-15
s=7k
task=T-033: ผสานอัปเดตระบบ Harness เพิ่มเติมจากโฟลเดอร์ดาวน์โหลดล่าสุด (มิถุนายน 2026)
cfp=35
sk=harness_editor
sk_h={sk_h}
mece_h={mece_h}
p1=done
p2=done
p3=S2
section=S2
step=update-scripts
resume_at=S3:step:index-rebuild
compact_size=7491
session_reset=armed
"""

with open(r"d:\LaborManagementSystem\.sessions\compact_state.md", "w", encoding="utf-8") as f:
    f.write(state_content)

print(".sessions/compact_state.md written!")
