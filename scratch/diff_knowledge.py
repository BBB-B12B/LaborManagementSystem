import os
import hashlib
import sys

sys.stdout.reconfigure(encoding='utf-8')

src_dir = r"C:\Users\101622\Downloads\Codeing_harness_killer-main\knowledge"
tgt_dir = r"d:\LaborManagementSystem\knowledge"

for root, dirs, files in os.walk(src_dir):
    for file in files:
        src_path = os.path.join(root, file)
        rel_path = os.path.relpath(src_path, src_dir)
        tgt_path = os.path.join(tgt_dir, rel_path)
        
        if not os.path.exists(tgt_path):
            print(f"Missing in target: knowledge/{rel_path}")
            continue
            
        with open(src_path, 'r', encoding='utf-8', errors='ignore') as f:
            src_text = f.read().strip().replace('\r\n', '\n')
        with open(tgt_path, 'r', encoding='utf-8', errors='ignore') as f:
            tgt_text = f.read().strip().replace('\r\n', '\n')
            
        if src_text != tgt_text:
            print(f"Content mismatch: knowledge/{rel_path} (src: {len(src_text)} chars, tgt: {len(tgt_text)} chars)")
