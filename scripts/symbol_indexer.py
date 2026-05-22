import re, json
from pathlib import Path

BASE = Path(__file__).parent.parent
INDEX = BASE / "knowledge/index_variables.json"
EXPORT_RE = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|type|interface|class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)"
)

def scan():
    hits = {}
    
    # Define directories to scan under base
    dirs_to_scan = [
        BASE / "backend/src",
        BASE / "frontend/src"
    ]
    
    for scan_dir in dirs_to_scan:
        if not scan_dir.exists():
            continue
        # Scan for TS files
        for f in scan_dir.rglob("*.ts"):
            try:
                for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                    m = EXPORT_RE.match(line.strip())
                    if m:
                        hits[m.group(1)] = {"source": str(f.relative_to(BASE)).replace("\\", "/"), "line": i}
            except Exception as e:
                print(f"Error scanning {f}: {e}")
                
        # Scan for TSX files
        for f in scan_dir.rglob("*.tsx"):
            try:
                for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                    m = EXPORT_RE.match(line.strip())
                    if m:
                        hits[m.group(1)] = {"source": str(f.relative_to(BASE)).replace("\\", "/"), "line": i}
            except Exception as e:
                print(f"Error scanning {f}: {e}")
                
    return hits

def main():
    scanned_hits = scan()
    data = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else {"variables": {}}
    if "variables" not in data:
        data["variables"] = {}
        
    for name, loc in scanned_hits.items():
        data["variables"].setdefault(name, {}).update(loc)
        
    INDEX.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated {len(scanned_hits)} symbols.")

if __name__ == "__main__":
    main()
