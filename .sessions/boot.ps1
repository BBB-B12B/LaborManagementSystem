$phase = ""
if (Test-Path .sessions/active_thread.md) {
    $content = Get-Content .sessions/active_thread.md
    foreach ($line in $content) {
        if ($line -match "^phase:\s*(.*)") {
            $phase = $Matches[1].Trim()
        }
    }
}
if ($phase -ne "in_progress") {
    if (-not (Test-Path .sessions)) { New-Item -ItemType Directory -Path .sessions -Force | Out-Null }
    Set-Content -Path .sessions/session_tokens.md -Value "SESSION_TOTAL: 0"
}
if (Test-Path .sessions/active_thread.md) {
    Get-Content .sessions/active_thread.md | Select-Object -Last 4
}
Write-Output "---"
if (Test-Path .sessions/session_tokens.md) {
    Get-Content .sessions/session_tokens.md
}
Write-Output "---"
if (Test-Path docs/master_roadmap.md) {
    Get-Content docs/master_roadmap.md | Select-String -Pattern "\[/\]" | Select-Object -First 3
}
