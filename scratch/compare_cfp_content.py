import re

src_file = r"C:\Users\101622\Downloads\Codeing_harness_killer-main\CODING_FAILURE_PATTERNS.md"
tgt_file = r"d:\LaborManagementSystem\CODING_FAILURE_PATTERNS.md"

def parse_cfps(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by ## CFP-
    parts = re.split(r"(## CFP-\d+)", content)
    cfps = {}
    header = parts[0]
    for i in range(1, len(parts), 2):
        cfp_id = parts[i]
        body = parts[i+1] if i+1 < len(parts) else ""
        cfps[cfp_id] = body
    return header, cfps

src_hdr, src_cfps = parse_cfps(src_file)
tgt_hdr, tgt_cfps = parse_cfps(tgt_file)

print(f"Source has {len(src_cfps)} CFPs, Target has {len(tgt_cfps)} CFPs")

for cid in sorted(src_cfps.keys()):
    if cid in tgt_cfps:
        src_len = len(src_cfps[cid])
        tgt_len = len(tgt_cfps[cid])
        if src_len != tgt_len:
            print(f"  {cid}: source len={src_len}, target len={tgt_len}")
