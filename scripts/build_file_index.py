import re
import json
from pathlib import Path

BASE = Path(__file__).parent.parent
INDEX_FILE = BASE / "knowledge/index_files.json"

def resolve_import(current_file: Path, import_path: str) -> str:
    if not import_path.startswith("."):
        # Absolute or package import, skip
        return None
    
    # Resolve against current file directory
    resolved = (current_file.parent / import_path).resolve()
    
    # Try direct file extension matches
    for ext in [".ts", ".tsx", ".js", ".jsx"]:
        p = resolved.with_suffix(ext)
        if p.exists() and p.is_file():
            try:
                return str(p.relative_to(BASE)).replace("\\", "/")
            except ValueError:
                pass
            
    # Try directory index file matches
    for ext in [".ts", ".tsx", ".js", ".jsx"]:
        p = resolved / f"index{ext}"
        if p.exists() and p.is_file():
            try:
                return str(p.relative_to(BASE)).replace("\\", "/")
            except ValueError:
                pass
            
    return None

def build_index():
    files_data = {}
    
    # List of directories to scan
    dirs = [BASE / "backend/src", BASE / "frontend/src"]
    all_files = []
    for d in dirs:
        if d.exists():
            for ext in ["*.ts", "*.tsx", "*.js", "*.jsx"]:
                all_files.extend(d.rglob(ext))
                
    # Filter out node_modules, macOS metadata starting with ._, etc.
    all_files = [f for f in all_files if not f.name.startswith("._") and not any(p in f.parts for p in ["node_modules", ".next", "dist", "build"])]
    
    # First pass: initialize dictionary
    for f in all_files:
        try:
            rel_path = str(f.relative_to(BASE)).replace("\\", "/")
        except ValueError:
            continue
        
        # Read description (first JSDoc block or comment)
        content = ""
        try:
            content = f.read_text(encoding="utf-8")
        except Exception:
            try:
                content = f.read_text(encoding="ansi")
            except Exception:
                pass
                
        description = f"Module: {f.name}"
        # Simple JSDoc or line comment extractor
        jsdoc_match = re.search(r"/\*\*(.*?)\*/", content, re.DOTALL)
        if jsdoc_match:
            lines = [l.strip().lstrip("*").strip() for l in jsdoc_match.group(1).split("\n")]
            non_empty = [l for l in lines if l]
            if non_empty:
                description = non_empty[0]
        else:
            line_match = re.match(r"^\s*//\s*(.*)", content)
            if line_match:
                description = line_match.group(1).strip()
                
        files_data[rel_path] = {
            "description": description,
            "associated_tasks": [],
            "backlinks": []
        }
        
    # Second pass: extract imports and set backlinks
    IMPORT_RE = re.compile(r"import\s+.*?\s+from\s+['\"](.*?)['\"]")
    REQUIRE_RE = re.compile(r"(?:const|let|var)\s+.*?\s+=\s+require\s*\(\s*['\"](.*?)['\"]\s*\)")
    
    for f in all_files:
        try:
            rel_path = str(f.relative_to(BASE)).replace("\\", "/")
        except ValueError:
            continue
            
        content = ""
        try:
            content = f.read_text(encoding="utf-8")
        except Exception:
            continue
            
        imports = IMPORT_RE.findall(content) + REQUIRE_RE.findall(content)
        for imp in imports:
            resolved = resolve_import(f, imp)
            if resolved and resolved in files_data:
                # Add this file to resolved file's backlinks
                if rel_path not in files_data[resolved]["backlinks"]:
                    files_data[resolved]["backlinks"].append(rel_path)
                    
    # Write files index
    output_data = {"files": files_data}
    INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    INDEX_FILE.write_text(json.dumps(output_data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Indexed {len(files_data)} files under knowledge/index_files.json")

if __name__ == "__main__":
    build_index()
