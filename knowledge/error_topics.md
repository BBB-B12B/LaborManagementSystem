# Error Topics — Code Bug Domain Registry
# Source of truth for error_index.md topic classification
# Every ERR-XXX entry must belong to exactly 1 topic.
# date_created: 2026-06-02

---

## topic: database-d1
name: Database / Miniflare D1 — Query & Insert Failures
keywords: [d1, miniflare, sqlite, insert, conflict, onconflict, multi-row, silent-fail, schema, migration]
severity: critical
description: Bugs caused by D1/Miniflare limitations — no multi-row INSERT, no onConflictDoNothing(), silent failures on duplicate key, schema drift between local and prod.
invariant_ref: ERR-007 · INVARIANTS.md §I2
cfp_ids: []

---

## topic: edge-runtime
name: Edge Runtime — Node.js API Incompatibility
keywords: [edge, runtime, node, crypto, buffer, fs, path, webcrypto, process, env, next-server]
severity: high
description: Bugs from using Node.js-only APIs in Edge Runtime context (Next.js middleware, Cloudflare Workers). WebCrypto must be used instead of Node.js crypto. No fs, path, or process.env access.
invariant_ref: INVARIANTS.md §I3
cfp_ids: []

---

## topic: csv-parsing
name: CSV Parsing — Manual Split vs PapaParse
keywords: [csv, papaParse, split, comma, parse, import, upload, row, column, delimiter, encoding]
severity: medium
description: Bugs from manual CSV splitting (split(",")) instead of PapaParse. Causes failures on quoted fields, multiline values, Unicode, and BOM headers. Rule: always PapaParse.
invariant_ref: INVARIANTS.md §I4 (if exists)
cfp_ids: []

---

## topic: auth-token
name: Auth / Token — Session & JWT Validation Failures
keywords: [auth, token, jwt, session, cookie, expiry, refresh, validate, middleware, unauthorized, 401, 403]
severity: high
description: Bugs in authentication flow — expired tokens not refreshed, missing middleware validation, wrong cookie scope, JWT secret mismatch between environments.
invariant_ref: none
cfp_ids: []

---

## topic: api-external
name: External API — Integration & Response Handling Failures
keywords: [api, fetch, external, webhook, timeout, retry, rate-limit, status, json, parse, cors, header]
severity: medium
description: Bugs from calling external APIs — uncaught non-200 responses, missing retry on 429, JSON parse on HTML error pages, CORS misconfiguration, missing timeout handling.
invariant_ref: none
cfp_ids: []

---

## topic: type-safety
name: TypeScript / Type Safety — Runtime Type Mismatch
keywords: [typescript, type, cast, any, unknown, inference, zod, schema, validation, coerce, null, undefined]
severity: medium
description: Bugs from bypassing TypeScript safety — over-use of `any`, missing null checks, Zod schema not matching actual DB columns, incorrect type coercion at API boundaries.
invariant_ref: none
cfp_ids: []
