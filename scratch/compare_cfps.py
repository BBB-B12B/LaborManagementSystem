import re

src_file = r"C:\Users\101622\Downloads\Codeing_harness_killer-main\CODING_FAILURE_PATTERNS.md"
tgt_file = r"d:\LaborManagementSystem\CODING_FAILURE_PATTERNS.md"

def get_cfps(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    pattern = r"## (CFP-\d+)"
    return set(re.findall(pattern, content))

src_cfps = get_cfps(src_file)
tgt_cfps = get_cfps(tgt_file)

print(f"Source CFPs: {sorted(list(src_cfps))}")
print(f"Target CFPs: {sorted(list(tgt_cfps))}")
print(f"CFPs in source but missing in target: {src_cfps - tgt_cfps}")
print(f"CFPs in target but missing in source: {tgt_cfps - src_cfps}")
