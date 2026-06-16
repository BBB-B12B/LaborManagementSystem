# Domain Pack — <DOMAIN_NAME>
> Swappable project layer. The CORE harness (CLAUDE.md / AGENTS.md / Implement/) stays
> project-agnostic and points here for anything domain-specific.
> Copy this file to `domain/<name>.md` and fill every slot WITH the user during setup
> (Implement/02_setup.md §Choose Domain Pack). A MEDIUM-tier model must be able to fill
> and follow this with NO chat history — keep all commands/paths/thresholds INLINE.

meta:
  name: <domain_name>            # e.g. coding · takeoff · legal
  active: <true|false>           # exactly one pack is active per project
  created: <YYYY-MM-DD>

## paths
# The folders/files this domain treats as "main work files" (core uses neutral wording
# "main work files" and resolves the real paths from here).
- work_root: <e.g. src/  ·  takeoff/  ·  docs/>
- protected: <paths that trigger the destructive gate — e.g. src/db/>
- code_exts: <file types this domain edits — e.g. .ts .tsx .py  ·  leave blank if non-code>

## domain_gates
# Domain-specific HARD STOPs layered on top of the core R14/R15 gate FRAMEWORK.
# Core keeps the gate mechanism; the trigger + payload live here. Write the full
# Behavior Contract (Pre / Contract / emit / Post / Enforce) INLINE — no pointers.
- <gate_name>:
    Pre:      <when it fires>
    Contract: <what must happen — emit [<signal>] + HALT until explicit confirm>
    Post:     <proceeds only after ...>
    Enforce:  <violation handling>

## critical_rules
# Non-negotiable domain facts the agent must never violate (one line each, with the why).
- <rule>: <what — never do X, always do Y> (<reason / ERR-id>)

## framework
# Framework/library/tooling notes specific to this domain (read-first hints, conventions).
- <note>: <e.g. Next.js — read node_modules/next/dist/docs/ first>

## skills
# Skills owned by THIS pack (loaded only when this domain is active). Core skills stay
# registered in .agents/skills/skill-manifest.json; list domain skills here.
- <skill_name>: <one-line purpose>

## tools
# Scripts/tools owned by THIS pack. Core tools stay in .agents/tools/tool-manifest.json.
- <tool_name>: <one-line purpose>

## co-config Q&A  (filled during Implement/02_setup.md — AI asks, user answers)
- Q: What kind of project is this? → <answer sets name>
- Q: Where do the main work files live? → <answer sets paths.work_root>
- Q: Any folder/action that must HALT for confirmation? → <answer sets domain_gates>
- Q: Any framework/library with non-obvious rules? → <answer sets framework + critical_rules>
- Q: Domain-specific skills/tools to register? → <answer sets skills + tools>
