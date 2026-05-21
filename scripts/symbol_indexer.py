import re
import json
from pathlib import Path

BASE = Path(__file__).parent.parent
INDEX = BASE / "knowledge/index_variables.json"
EXPORT_RE = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|type|interface|class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)"
)

def scan():
    hits = {}
    # Scan both backend/src and frontend/src
    for src_dir in [BASE / "backend/src", BASE / "frontend/src"]:
        if not src_dir.exists():
            continue
        for ext in ["*.ts", "*.tsx"]:
            for f in src_dir.rglob(ext):
                # Ignore node_modules, .next, dist, or macOS metadata files starting with ._
                if f.name.startswith("._") or any(part in f.parts for part in ["node_modules", ".next", "dist", "build"]):
                    continue
                try:
                    for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                        m = EXPORT_RE.match(line.strip())
                        if m:
                            hits[m.group(1)] = {"source": str(f.relative_to(BASE)).replace("\\", "/"), "line": i}
                except Exception as e:
                    print(f"Error reading {f}: {e}")
    return hits

def main():
    scanned = scan()
    data = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else {"variables": {}}
    
    # Merge scanned symbols
    for name, loc in scanned.items():
        data["variables"].setdefault(name, {}).update(loc)
        
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated {len(scanned)} symbols.")

if __name__ == "__main__":
    main()
