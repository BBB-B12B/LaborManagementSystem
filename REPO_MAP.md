# REPO_MAP.md — Repository Structure & Protected Zones

---

## Directory Layout

```
backend/
├── src/
│   ├── api/               # Express routing and middleware
│   ├── config/            # Firebase and other configurations
│   ├── controllers/       # Route request handlers
│   ├── models/            # Schema declarations
│   ├── services/          # Business logic implementation
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Helper utilities
│
frontend/
├── src/
│   ├── components/        # React components (common, forms, layout, etc.)
│   ├── config/            # Client configurations
│   ├── context/           # React context providers
│   ├── hooks/             # Custom hooks
│   ├── i18n/              # Internationalization and locales
│   ├── pages/             # Next.js pages (daily-reports, workspace, etc.)
│   ├── services/          # Client API calls and firebase wrappers
│   ├── store/             # Zustand state store
│   ├── styles/            # App CSS styling
│   └── validation/        # Schema validation
│
firebase/                  # Firebase Emulator configuration, rules and indexes
knowledge/                 # Agent indexes — managed by agent + symbol_indexer.py
.agents/skills/            # Skill definitions
.sessions/                 # Session state
docs/                      # Roadmap and logs
scripts/                   # Automation scripts (symbol_indexer.py)
```

---

## Protected Zones

| Path | Rule |
|---|---|
| `knowledge/` | Never delete manually — managed by agent |
| `.sessions/` | Never delete manually — session state |
| `docs/master_roadmap.md` | Edit only via agent workflow (`[ ]` → `[/]` → `[X]`) |
| `firebase/firestore.rules` | Firebase security rules - I2 Hard Stop |
| `firebase/firestore.indexes.json` | Firebase indexes - I2 Hard Stop |

---

## Quick Lookup Commands

```bash
# Find file by name
find backend/src/ -name "*.ts" | grep "keyword"
find frontend/src/ -name "*.tsx" | grep "keyword"

# Find symbol definition
grep -rn "export.*FunctionName" backend/src/
grep -rn "export.*ComponentName" frontend/src/

# Check who imports a file
grep -A 6 '"backend/src/path/to/file"' knowledge/index_files.json
grep -A 6 '"frontend/src/path/to/file"' knowledge/index_files.json

# Find all usages of a symbol
grep -rl "SymbolName" backend/src/
grep -rl "SymbolName" frontend/src/
```
