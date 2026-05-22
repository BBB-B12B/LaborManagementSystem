import re, json, os
from pathlib import Path

BASE = Path(__file__).parent.parent
FILES_INDEX_PATH = BASE / "knowledge/index_files.json"

IMPORT_RE = re.compile(r"from\s+['\"]([^'\"]+)['\"]|import\s+['\"]([^'\"]+)['\"]|require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")

def extract_description(content, file_path):
    # Try JSDoc or simple block comments
    jsdoc = re.search(r"/\*\*(.*?)\*/", content, re.DOTALL)
    if jsdoc:
        doc = jsdoc.group(1).strip()
        lines = [line.strip().lstrip("*").strip() for line in doc.splitlines() if line.strip()]
        if lines:
            return lines[0]
            
    # Try double-slash comments at the top of the file
    lines = content.splitlines()
    comments = []
    for line in lines[:10]:
        line_strip = line.strip()
        if line_strip.startswith("//"):
            comment = line_strip.lstrip("/").strip()
            if comment:
                comments.append(comment)
        elif line_strip and not line_strip.startswith("import") and not line_strip.startswith("/*"):
            break
    if comments:
        return " ".join(comments)
        
    # Default fallback description
    return f"Source file for {file_path.name}"

def resolve_import(import_path, file_dir, base_dir):
    # If relative import
    if import_path.startswith("."):
        try:
            resolved_path = (file_dir / import_path).resolve()
            # Try matching with extensions
            for ext in [".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"]:
                candidate = Path(str(resolved_path) + ext)
                if candidate.exists() and candidate.is_file():
                    return str(candidate.relative_to(base_dir)).replace("\\", "/")
        except Exception:
            pass
            
    # Next.js/Frontend TS path alias resolve (e.g. "@/components/..." -> "frontend/src/components/...")
    if import_path.startswith("@/"):
        # Alias is usually frontend/src/
        frontend_src = base_dir / "frontend/src"
        rest = import_path[2:]
        try:
            resolved_path = (frontend_src / rest).resolve()
            for ext in [".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"]:
                candidate = Path(str(resolved_path) + ext)
                if candidate.exists() and candidate.is_file():
                    return str(candidate.relative_to(base_dir)).replace("\\", "/")
        except Exception:
            pass
            
    return None

def main():
    files_data = {"files": {}}
    
    # 1. Discover all source files
    src_files = []
    dirs_to_scan = [
        BASE / "backend/src",
        BASE / "frontend/src"
    ]
    
    for scan_dir in dirs_to_scan:
        if not scan_dir.exists():
            continue
        for root, _, files in os.walk(scan_dir):
            for file in files:
                if file.endswith((".ts", ".tsx")):
                    src_files.append(Path(root) / file)
                    
    # Initialize entries
    for file_path in src_files:
        rel_path = str(file_path.relative_to(BASE)).replace("\\", "/")
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            content = ""
        desc = extract_description(content, file_path)
        files_data["files"][rel_path] = {
            "description": desc,
            "associated_tasks": [],
            "backlinks": []
        }
        
    # 2. Extract imports and build backlinks map
    for file_path in src_files:
        rel_path = str(file_path.relative_to(BASE)).replace("\\", "/")
        file_dir = file_path.parent
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            content = ""
            
        matches = IMPORT_RE.findall(content)
        for m in matches:
            # findall returns tuple of groups, get the non-empty one
            imported = next((path for path in m if path), None)
            if imported:
                resolved = resolve_import(imported, file_dir, BASE)
                if resolved and resolved in files_data["files"]:
                    # Add rel_path as a backlink to the resolved file
                    if rel_path not in files_data["files"][resolved]["backlinks"]:
                        files_data["files"][resolved]["backlinks"].append(rel_path)
                        
    # 3. Write indices
    FILES_INDEX_PATH.write_text(json.dumps(files_data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Generated index_files.json with {len(files_data['files'])} files indexed.")

if __name__ == "__main__":
    main()
