import os
import shutil

src_dir = r"C:\Users\101622\Downloads\Codeing_harness_killer-main"
tgt_dir = r"d:\LaborManagementSystem"

# 1. Overwrite files in scripts/ (python and shell scripts)
print("Updating scripts/ folder...")
src_scripts = os.path.join(src_dir, "scripts")
tgt_scripts = os.path.join(tgt_dir, "scripts")
for item in os.listdir(src_scripts):
    s_path = os.path.join(src_scripts, item)
    t_path = os.path.join(tgt_scripts, item)
    if os.path.isfile(s_path) and item.endswith((".py", ".sh")):
        shutil.copy2(s_path, t_path)

# 2. Overwrite skill-manifest.json and registry.md
print("Updating skill manifests...")
shutil.copy2(
    os.path.join(src_dir, ".agents", "skills", "skill-manifest.json"),
    os.path.join(tgt_dir, ".agents", "skills", "skill-manifest.json")
)
shutil.copy2(
    os.path.join(src_dir, ".agents", "skills", "registry.md"),
    os.path.join(tgt_dir, ".agents", "skills", "registry.md")
)

# 3. Overwrite Implement/ guides recursively
print("Updating Implement/ folder...")
src_implement = os.path.join(src_dir, "Implement")
tgt_implement = os.path.join(tgt_dir, "Implement")
if os.path.exists(tgt_implement):
    shutil.rmtree(tgt_implement)
shutil.copytree(src_implement, tgt_implement)

# 4. Copy knowledge directory updates
print("Updating knowledge directory...")
shutil.copy2(
    os.path.join(src_dir, "knowledge", "cfp_topics.md"),
    os.path.join(tgt_dir, "knowledge", "cfp_topics.md")
)
shutil.copy2(
    os.path.join(src_dir, "knowledge", "topic_registry.json"),
    os.path.join(tgt_dir, "knowledge", "topic_registry.json")
)

# Create knowledge/research/.gitkeep
research_dir = os.path.join(tgt_dir, "knowledge", "research")
os.makedirs(research_dir, exist_ok=True)
with open(os.path.join(research_dir, ".gitkeep"), "w") as f:
    pass

print("Harness tools, manifest, guides, and knowledge profiles successfully updated!")
