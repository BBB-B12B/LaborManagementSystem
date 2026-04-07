$path = "c:\Users\100654\New folder (2)\stock-shopee-app\backend\src\services\scanData\ScanDataService.ts"
$content = Get-Content $path -Raw
# Remove the last part starting from "// Singleton instance"
$pattern = '(?s)\s*// Singleton instance.*'
$match = [regex]::Match($content, $pattern)
if ($match.Success) {
    $mainContent = $content.Substring(0, $match.Index)
    $singletonPart = $match.Value
    
    # Remove the last closing brace of the class
    $lastBraceIndex = $mainContent.LastIndexOf('}')
    if ($lastBraceIndex -ge 0) {
        $beforeBrace = $mainContent.Substring(0, $lastBraceIndex)
        
        $newMethod = @"

  /**
   * Get aggregated scan data for export with comparisons to Daily Reports
   */
  async getAggregatedDataForExport(params: {
    projectLocationId?: string;
    startDate?: Date;
    endDate?: Date;
    batchId?: string;
  }): Promise<any[]> {
    let scans: ScanData[] = [];

    if (params.batchId) {
      scans = await this.getByBatchId(params.batchId);
    } else if (params.projectLocationId && params.startDate && params.endDate) {
      scans = await this.getByProjectAndDate(params.projectLocationId, params.startDate, params.endDate);
    }

    if (scans.length === 0) return [];

    // Map ScanData to BulkImportRecord for Aggregator
    const records: BulkImportRecord[] = scans.map((s, idx) => ({
      rowNumber: idx + 1,
      employeeNumber: s.employeeNumber || s.employeeId,
      scanDateTime: s.scanDateTime instanceof Date ? s.scanDateTime : (s.scanDateTime as any).toDate(),
      status: 'success'
    }));

    const aggregated: DailyAggregatedRow[] = ScanDataAggregator.aggregate(records);
    const results: any[] = [];

    for (const group of aggregated) {
      const contractor = await dailyContractorService.findByEmployeeIdOrHistory(group.employeeNumber);
      
      let reportMorningOT = 0;
      let reportEveningOT = 0;
      let reportLunchOT = 0;
      let reportNormalStatus = 0;
      let projectDepartmentName = '#N/A';
      let hasReport = false;

      if (contractor) {
        const d = new Date(group.workDate);
        try {
          const reports = await dailyReportService.getByContractorAndDate(contractor.id, d, d);
          if (reports && reports.length > 0) {
            hasReport = true;
            for (const rep of reports) {
              if (rep.workType === 'regular') reportNormalStatus = 1;
              else if (rep.workType === 'ot_morning') reportMorningOT += rep.netHours;
              else if (rep.workType === 'ot_noon') reportLunchOT += rep.netHours;
              else if (rep.workType === 'ot_evening') reportEveningOT += rep.netHours;
            }
          }

          // Also get project info for department
          if (scans.length > 0 && scans[0].projectLocationId) {
            const loc = await projectLocationService.getById(scans[0].projectLocationId);
            if (loc?.department) projectDepartmentName = loc.department;
          }
        } catch (e) {
          console.warn(e);
        }
      }

      const diffLunch = !hasReport ? 'N/A' : (group.lunchStatus - reportLunchOT);
      const diffMorning = !hasReport ? 'N/A' : (group.otMorningHours - reportMorningOT);
      const diffEvening = !hasReport ? 'N/A' : (group.otEveningHours - reportEveningOT);

      results.push({
        EmployeeNumber: group.employeeNumber,
        Date: group.workDate,
        Time1: group.time1 || '',
        Time2: group.time2 || '',
        Time3: group.time3 || '',
        Time4: group.time4 || '',
        Time5: group.time5 || '',
        Time6: group.time6 || '',
        NormalStatus: group.normalStatus,
        RegularHours: group.regularHours,
        LunchStatus: group.lunchStatus,
        MorningOT: group.otMorningHours,
        EveningOT: group.otEveningHours,
        LateMinutes: group.lateMinutes,
        ReportNormalStatus: reportNormalStatus,
        ReportMorningOT: reportMorningOT,
        ReportLunchOT: reportLunchOT,
        ReportEveningOT: reportEveningOT,
        DiffLunch: diffLunch,
        DiffMorning: diffMorning,
        DiffEvening: diffEvening,
        Department: projectDepartmentName
      });
    }

    return results;
  }
}
"@
        $finalContent = $beforeBrace + $newMethod + $singletonPart
        $finalContent | Set-Content $path -Encoding UTF8 -NoNewline
        Write-Host "Successfully updated ScanDataService.ts"
    } else {
        Write-Error "Could not find class closing brace"
    }
} else {
    Write-Error "Could not find singleton part"
}
