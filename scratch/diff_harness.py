import os
import hashlib

src_dir = r"C:\Users\101622\Downloads\Codeing_harness_killer-main"
tgt_dir = r"d:\LaborManagementSystem"

target_subdirs = [".agents/skills", "scripts", "Implement", "knowledge", ".claude"]

def get_file_hash(path):
    try:
        with open(path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    except Exception as e:
        return None

diffs = []
missing = []
identical = []

for sub in target_subdirs:
    src_sub = os.path.join(src_dir, sub.replace('/', os.sep))
    if not os.path.exists(src_sub):
        continue
    for root, dirs, files in os.walk(src_sub):
        for file in files:
            src_path = os.path.join(root, file)
            rel_path = os.path.relpath(src_path, src_dir)
            tgt_path = os.path.join(tgt_dir, rel_path)
            
            if not os.path.exists(tgt_path):
                missing.append(rel_path)
            else:
                src_hash = get_file_hash(src_path)
                tgt_hash = get_file_hash(tgt_path)
                if src_hash != tgt_hash:
                    diffs.append((rel_path, os.path.getsize(src_path), os.path.getsize(tgt_path)))
                else:
                    identical.append(rel_path)

print(f"Total compared files: {len(diffs) + len(missing) + len(identical)}")
print(f"Missing in target: {len(missing)}")
print(f"Different content: {len(diffs)}")
print(f"Identical: {len(identical)}")

print("\n--- DIFFERENT FILE CONTENT ---")
for f, sz_src, sz_tgt in sorted(diffs):
    print(f"  {f} (src: {sz_src}, tgt: {sz_tgt})")

print("\n--- MISSING IN TARGET ---")
for f in sorted(missing):
    print(f"  {f}")
