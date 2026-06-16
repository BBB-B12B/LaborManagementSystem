import os
import shutil

src_dir = r"C:\Users\101622\Downloads\Codeing_harness_killer-main"
tgt_dir = r"d:\LaborManagementSystem"

# 1. Overwrite CLAUDE.md
print("Copying CLAUDE.md...")
shutil.copy2(os.path.join(src_dir, "CLAUDE.md"), os.path.join(tgt_dir, "CLAUDE.md"))

# 2. Overwrite AGENTS.md
print("Copying AGENTS.md...")
shutil.copy2(os.path.join(src_dir, "AGENTS.md"), os.path.join(tgt_dir, "AGENTS.md"))

# 3. Overwrite CODING_FAILURE_PATTERNS.md (ensuring UTF-8 encoding)
print("Copying CODING_FAILURE_PATTERNS.md...")
with open(os.path.join(src_dir, "CODING_FAILURE_PATTERNS.md"), "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()
with open(os.path.join(tgt_dir, "CODING_FAILURE_PATTERNS.md"), "w", encoding="utf-8") as f:
    f.write(text)

# 4. Copy domain/ directory recursively
print("Copying domain/ folder...")
src_domain = os.path.join(src_dir, "domain")
tgt_domain = os.path.join(tgt_dir, "domain")
if os.path.exists(tgt_domain):
    shutil.rmtree(tgt_domain)
shutil.copytree(src_domain, tgt_domain)

# 5. Copy VERSION file
print("Copying VERSION file...")
shutil.copy2(os.path.join(src_dir, "VERSION"), os.path.join(tgt_dir, "VERSION"))

print("Core files successfully copied!")
