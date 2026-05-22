# REPO_MAP.md — Repository Structure & Protected Zones

---

## Directory Layout

```
backend/
├── src/
│   ├── controllers/       # Transport layer controllers
│   ├── services/          # Business logic services
│   ├── models/            # Data models and schemas
│   ├── routes/            # Express router mappings
│   ├── api/               # External API endpoints
│   ├── utils/             # Helper functions
│   └── index.ts           # Bootstrapper entry point
├── package.json           # Express package config
└── tsconfig.json          # Backend TS compilation config

frontend/
├── src/
│   ├── components/        # Reusable Material UI components
│   ├── pages/             # Next.js pages
│   ├── store/             # Zustand state management
│   ├── services/          # Client API consumer services
│   ├── hooks/             # Custom React hooks
│   └── validation/        # Zod validation schemas
├── package.json           # Next.js package config
└── tsconfig.json          # Frontend TS compilation config

firebase/                  # Firebase Emulator configuration
docs/                      # Roadmap and product briefs
scripts/                   # Custom scripts (indexers, seeders)
knowledge/                 # Agent system indexes (index_files.json, index_variables.json)
.agents/skills/            # Agent custom routing skill definitions
.sessions/                 # Active sessions and thread states
```

---

## Protected Zones

| Path | Rule |
|---|---|
| `knowledge/` | Never delete manually — managed by agent |
| `.sessions/` | Never delete manually — session state |
| `docs/master_roadmap.md` | Edit only via agent workflow (`[ ]` → `[/]` → `[X]`) |
| `backend/src/` | Preserve core framework structure, use controller/service separation |
| `frontend/src/` | Maintain Zustand/Zod/Hook standards |

---

## Quick Lookup Commands

```bash
# Find backend TS file by name
find backend/src/ -name "*.ts" | grep "keyword"

# Find frontend TS/TSX file by name
find frontend/src/ -name "*.tsx" | grep "keyword"

# Find export declarations in backend
grep -rn "export.*FunctionName" backend/src/

# Find export declarations in frontend
grep -rn "export.*FunctionName" frontend/src/

# Check who imports a file in index
grep -A 6 '"backend/src/path/to/file"' knowledge/index_files.json
```
