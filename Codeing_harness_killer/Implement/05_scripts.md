## 6. `scripts/symbol_indexer.py` Spec

If the script does not exist, implement it with this behavior:

```
Input:  Scans all .ts / .tsx files under src/
        Detects lines matching: export (async)? (function|const|let|var|type|interface|class|enum) <Name>
Output: Updates knowledge/index_variables.json
        For each matched symbol: sets "source" and "line" fields
        Does NOT overwrite "type", "fields", or "used_in" — merge only
```

Minimal Python implementation pattern:

```python
import re, json
from pathlib import Path

BASE = Path(__file__).parent.parent
INDEX = BASE / "knowledge/index_variables.json"
EXPORT_RE = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|type|interface|class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)"
)

def scan():
    hits = {}
    for f in (BASE / "src").rglob("*.ts"):
        for i, line in enumerate(f.read_text().splitlines(), 1):
            m = EXPORT_RE.match(line.strip())
            if m:
                hits[m.group(1)] = {"source": str(f.relative_to(BASE)), "line": i}
    for f in (BASE / "src").rglob("*.tsx"):
        for i, line in enumerate(f.read_text().splitlines(), 1):
            m = EXPORT_RE.match(line.strip())
            if m:
                hits[m.group(1)] = {"source": str(f.relative_to(BASE)), "line": i}
    return hits

data = json.loads(INDEX.read_text()) if INDEX.exists() else {"variables": {}}
for name, loc in scan().items():
    data["variables"].setdefault(name, {}).update(loc)
INDEX.write_text(json.dumps(data, indent=2, ensure_ascii=False))
print(f"Updated {len(scan())} symbols.")
```

---
