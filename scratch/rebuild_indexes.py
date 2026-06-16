import subprocess
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding='utf-8')

commands = [
    [sys.executable, "-X", "utf8", "scripts/backlink_analyzer.py"],
    [sys.executable, "-X", "utf8", "scripts/symbol_indexer.py"],
    [sys.executable, "-X", "utf8", "scripts/code_graph.py", "--write"],
    [sys.executable, "-X", "utf8", "scripts/rule_indexer.py"],
    [sys.executable, "-X", "utf8", "scripts/repo_map_check.py", "--sync"]
]

for cmd in commands:
    cmd_str = " ".join(cmd)
    print(f"\nRunning: {cmd_str}")
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        if res.returncode == 0:
            print("SUCCESS")
            # Print only key output lines to avoid token bloat
            lines = res.stdout.splitlines()
            for l in lines[-10:]:
                print(f"  {l}")
        else:
            print(f"FAILED with exit code {res.returncode}")
            print(res.stderr)
    except Exception as e:
        print(f"ERROR executing command: {e}")
