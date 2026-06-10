#!/usr/bin/env bash
# Write a compact context snapshot to .sessions/session_context_cache.md
# Called by Stop hook — overwrites every time Claude stops
set -euo pipefail

SESSIONS=".sessions"
OUT="$SESSIONS/session_context_cache.md"

task=$(grep "^task:" "$SESSIONS/active_thread.md" 2>/dev/null | cut -d: -f2- | xargs || echo "unknown")
phase=$(grep "^phase:" "$SESSIONS/active_thread.md" 2>/dev/null | awk '{print $2}' || echo "unknown")
next=$(grep "^next:" "$SESSIONS/active_thread.md" 2>/dev/null | cut -d: -f2- | xargs || echo "none")

session_total=$(grep "^SESSION_TOTAL:" "$SESSIONS/session_tokens.md" 2>/dev/null | awk '{print $2}' || echo "0")
chat_total=$(grep "^CHAT_TOTAL:" "$SESSIONS/session_tokens.md" 2>/dev/null | awk '{print $2}' || echo "0")
cache_read=$(grep "^CACHE_READ:" "$SESSIONS/session_tokens.md" 2>/dev/null | awk '{print $2}' || echo "0")
cache_write=$(grep "^CACHE_WRITE:" "$SESSIONS/session_tokens.md" 2>/dev/null | awk '{print $2}' || echo "0")

pending=$(grep "^\- \[ \]\|^\- \[/\]" "$SESSIONS/mece_plan.md" 2>/dev/null | head -3 | sed 's/^/  /' || echo "  none")

ts=$(date "+%Y-%m-%d %H:%M")
ts_iso=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

cat > "$OUT" << EOF
# Context Cache — $ts
task: $task
phase: $phase
next: $next
session_total: ~${session_total}
chat_total: ~${chat_total}
cache_read: ${cache_read}
cache_write: ${cache_write}
pending_sections:
$pending
EOF

# Append one JSON line to token_log.jsonl (T-053 telemetry)
LOG="$SESSIONS/token_log.jsonl"
printf '{"ts":"%s","task":"%s","phase":"%s","session_total":%s,"chat_total":%s,"cache_read":%s,"cache_write":%s}\n' \
  "$ts_iso" "$task" "$phase" "${session_total:-0}" "${chat_total:-0}" "${cache_read:-0}" "${cache_write:-0}" \
  >> "$LOG"
