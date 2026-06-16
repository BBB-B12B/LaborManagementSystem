import difflib
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

src_file = r"C:\Users\101622\Downloads\Codeing_harness_killer-main\CODING_FAILURE_PATTERNS.md"
tgt_file = r"d:\LaborManagementSystem\CODING_FAILURE_PATTERNS.md"

def parse_cfps(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    parts = re.split(r"(## CFP-\d+)", content)
    cfps = {}
    for i in range(1, len(parts), 2):
        cfps[parts[i]] = parts[i+1] if i+1 < len(parts) else ""
    return cfps

src_cfps = parse_cfps(src_file)
tgt_cfps = parse_cfps(tgt_file)

for cid in ["## CFP-028", "## CFP-037", "## CFP-039", "## CFP-040"]:
    print(f"\n================ DIFF FOR {cid} ================")
    src_lines = src_cfps[cid].splitlines(keepends=True)
    tgt_lines = tgt_cfps[cid].splitlines(keepends=True)
    diff = difflib.unified_diff(tgt_lines, src_lines, fromfile='target', tofile='source')
    for line in diff:
        print(line, end='')
