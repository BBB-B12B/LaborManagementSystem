import difflib
import sys

sys.stdout.reconfigure(encoding='utf-8')

src_file = r"C:\Users\101622\Downloads\Codeing_harness_killer-main\AGENTS.md"
tgt_file = r"d:\LaborManagementSystem\AGENTS.md"

with open(src_file, 'r', encoding='utf-8') as f:
    src_lines = f.readlines()

with open(tgt_file, 'r', encoding='utf-8') as f:
    tgt_lines = f.readlines()

diff = difflib.unified_diff(tgt_lines, src_lines, fromfile='target', tofile='source')
for line in diff:
    print(line, end='')
