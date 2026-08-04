# Template: `## hand-off` block — Skill chaining contract (T-216 · D5)
# Written by: a producer skill's SKILL.md (the UPSTREAM skill that owns the artifact)
# Read by:    the harness when a skill finishes — decides whether to flow to a downstream skill
#             skill-manifest.json "hand_off" cross-links mirror these blocks (machine-readable)
#
# PURPOSE
#   Let one skill explicitly hand a finished ARTIFACT to a downstream skill that transforms it,
#   gated by a prerequisites-present check (reuse T-214 refuse-without-required-inputs).
#   Models 9arm's post-mortem -> management-talk pattern: producer owns the source-of-truth,
#   downstream is a read-only reframe.
#
# THREE RELATIONSHIP KINDS — only #3 uses this block (do NOT conflate · see gather_complete.md):
#   1. ROUTING / DECLINE  ("not my job -> go to X")        — NOT a hand-off
#   2. ESCALATION         (conditional "repeated Nx -> X")  — NOT a hand-off
#   3. ARTIFACT HAND-OFF  (upstream owns artifact -> downstream transforms) — THIS block
#
# SINGLE-SOURCE RULE (T-202 doc_builder cross-role pattern):
#   exactly ONE skill owns each artifact. The downstream skill is a read-only transform —
#   it never edits or re-owns the upstream artifact.
# ---

## hand-off
downstream: <skill_name>            # the skill that receives the artifact
artifact: <what is passed>          # e.g. HTML manual + screenshots · root-cause record · mece_plan.md
format: <concrete form/path>        # e.g. manual.html + screenshots/*.png · .sessions/mece_plan.md
role: primary | supplementary       # supplementary = downstream still has its own primary source; this is extra input
required-inputs:                    # the prerequisites-present GATE (the 1-2-3 the downstream needs)
  - <input 1 — e.g. manual.html exists>
  - <input 2 — e.g. screenshots/ non-empty>
# on-missing depends on role — pick the line matching `role:` above:
on-missing (primary):       HALT · emit [handoff-blocked] · list the missing inputs · ask the user · NO partial flow
on-missing (supplementary): skip the offer silently · NO [handoff-blocked] · NO HALT (downstream proceeds from its own primary source)
on-present: offer to flow to <downstream> (the agent PROPOSES the next step — skills are read-instructions, nothing auto-invokes)
owner-note: this skill remains the SOLE owner of <artifact>; <downstream> only reads + reframes it

---

# WORKED EXAMPLE — doc_builder -> project_presenter (the T-216 showcase chain)

## hand-off
downstream: project_presenter
artifact: HTML system manual + screenshot set
format: <project>/manual.html + screenshots/*.png
role: primary
required-inputs:
  - manual.html exists and is non-empty
  - screenshots/ contains at least one image
on-missing: HALT · emit [handoff-blocked] · list the missing inputs (e.g. "screenshots/ empty") · ask the user · NO partial flow
on-present: offer to flow to project_presenter — propose reframing the manual into an audience/leadership presentation
owner-note: doc_builder remains the SOLE owner of the manual artifact; project_presenter only reads + reframes it

---

# INDEX hand-off variant — for file-changing skills (T-216 S6)
# A standard reusable block. Makes the existing R8 Index Sync duty explicit + uniform.
# MUST reference R8 + the Stop-hook index_reconcile.py — does NOT re-own index ownership.

## hand-off (index)
downstream: index_manager (mode:file | mode:symbol) | repo_map sync
trigger:
  - file create/delete  -> index_manager (mode:file)    (owns knowledge/index_files.json)
  - symbol change       -> index_manager (mode:symbol)  (owns knowledge/index_variables.json)
  - folder move/rename  -> repo_map sync                (REPO_MAP.md)
enforced-by: R8 Index Sync Invariant (AGENTS.md) + Stop-hook scripts/index_reconcile.py (idempotent safety net)
owner-note: index_manager (both modes) stays the SOLE owner. This block only makes the duty visible
            at the point of change — it does NOT duplicate or re-own the index.
