import re

src_file = r"C:\Users\101622\Downloads\Codeing_harness_killer-main\CODING_FAILURE_PATTERNS.md"
tgt_file = r"d:\LaborManagementSystem\CODING_FAILURE_PATTERNS.md"

def parse_cfps(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
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

print(f"Source header len: {len(src_hdr)}")
print(f"Target header len: {len(tgt_hdr)}")

total_src_body = sum(len(b) for b in src_cfps.values())
total_tgt_body = sum(len(b) for b in tgt_cfps.values())
print(f"Source total body len: {total_src_body}")
print(f"Target total body len: {total_tgt_body}")

# Let's print the actual lengths of all cfps in both
for cid in sorted(src_cfps.keys()):
    src_len = len(src_cfps[cid])
    tgt_len = len(tgt_cfps.get(cid, ""))
    print(f"{cid}: src={src_len}, tgt={tgt_len}")
