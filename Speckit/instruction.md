# Project Instructions: Labor Daily Report & Wage Calculation

## Core Objective
Develop a high-performance Daily Report system that tracks worker hours (Regular and OT) and integrates with a Wage Calculation module by comparing data with teammate-provided ScanData.

## Technical Decisions
- **Hours-only Logic [COMPLETED]:** We do NOT store time ranges (e.g., 08:00-17:00). We store raw numbers (e.g., 8 hours). This aligns with teammate's ScanData format.
- **Sub-collection Storage [COMPLETED]:** Worker entries are stored in `dailyReports/{id}/workerEntries/{workerId}` to ensure scalability and granular audit logging.
## Integration Logic [IMPLEMENTED]
- **Comparison:** `scanData.regularHours` vs `dailyReport.workerEntries.regularHours`.
- **Wage Calculation:** Ready to be implemented in Phase 2 using aligned `dailyReport` hours.
- **ScanData Alignment [COMPLETED]:** Fields now match ScanData's hours naming (`regularHours`, `otMorningHours`, `otNoonHours`, `otEveningHours`).
