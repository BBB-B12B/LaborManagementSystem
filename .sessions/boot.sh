cs_dt=$(grep "^dt=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2 | cut -d' ' -f1)
today=$(date +%Y-%m-%d)
compact_restore=false
if [ "$cs_dt" = "$today" ]; then
    compact_restore=true
    echo "[compact-restore]"
    cat .sessions/compact_state.md
    echo "---"
fi
phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}')
sys_fixed=$(python3 -c "import os; print(int((os.path.getsize('CLAUDE.md') + os.path.getsize('AGENTS.md'))*0.3) + 3500)" 2>/dev/null || echo 11070)
if [ "$compact_restore" = "true" ]; then
    cs=$(grep "^compact_size=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2 || echo "0")
    ct=$((sys_fixed + ${cs:-0}))
    reset_marker=$(grep "^session_reset=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2)
    if [ "$reset_marker" = "armed" ]; then
        printf "SESSION_TOTAL: 0\nCHAT_TOTAL: $ct\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md
        sed -i '' 's/^session_reset=armed/session_reset=consumed/' .sessions/compact_state.md 2>/dev/null || sed -i 's/^session_reset=armed/session_reset=consumed/' .sessions/compact_state.md 2>/dev/null
        echo "[reset-consumed] SESSION=0 · marker armed→consumed"
    else
        st=$(grep "^SESSION_TOTAL:" .sessions/session_tokens.md 2>/dev/null | awk '{print $2}')
        st=${st:-0}
        printf "SESSION_TOTAL: $st\nCHAT_TOTAL: $ct\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md
        echo "[reset-skip] marker=${reset_marker:-absent} · SESSION preserved=$st"
    fi
elif [ "$phase" != "in_progress" ]; then
    printf "SESSION_TOTAL: 0\nCHAT_TOTAL: $sys_fixed\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md
fi

if [ -f .sessions/session_tokens.md ]; then
    python3 -c "p='.sessions/session_tokens.md';L=[('LOOP_WEIGHT: 0' if x.startswith('LOOP_WEIGHT:') else x) for x in open(p).read().splitlines()];open(p,'w').write(chr(10).join(L)+chr(10))" 2>/dev/null
fi

cat .sessions/active_thread.md 2>/dev/null | tail -4
echo "---"
cat .sessions/session_tokens.md 2>/dev/null
echo "---"
grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3
echo "---"
echo "CFP_COUNT: $(grep -c '^## CFP-' CODING_FAILURE_PATTERNS.md 2>/dev/null || echo 0)"
