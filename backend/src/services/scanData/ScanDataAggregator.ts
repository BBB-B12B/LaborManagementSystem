import { BulkImportRecord } from './ScanDataService';

export interface DailyAggregatedRow {
  employeeNumber: string;
  workDate: string; // YYYY-MM-DD
  time1: string | null;
  time2: string | null;
  time3: string | null;
  time4: string | null;
  time5: string | null;
  time6: string | null;
  punches: string[]; // HH:mm format
  firstIn: string | null;
  lastOut: string | null;
  timeScans: Date[]; // raw times for advanced calculations
  
  // Computed metrics
  normalStatus: 0 | 1;
  lunchStatus: 0 | 1;
  otMorningHours: number;
  otEveningHours: number;
  lateMinutes: number;
  
  // Raw rows that made up this day
  sourceRowNumbers: number[];
}

export class ScanDataAggregator {
  
  /**
   * Group raw scans into DailyAggregatedRow arrays.
   */
  public static aggregate(records: BulkImportRecord[]): DailyAggregatedRow[] {
    const grouped = new Map<string, Date[]>();
    const rowMap = new Map<string, number[]>();

    // 1. Group all scans by Employee + Date
    for (const record of records) {
      if (!record.employeeNumber || !record.scanDateTime) continue;

      const emp = record.employeeNumber;
      // Convert to local date string effectively (YYYY-MM-DD)
      const dateStr = this.formatDate(record.scanDateTime);
      const key = `${emp}_${dateStr}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
        rowMap.set(key, []);
      }
      grouped.get(key)!.push(record.scanDateTime);
      rowMap.get(key)!.push(record.rowNumber);
    }

    const results: DailyAggregatedRow[] = [];

    // 2. Process each group
    for (const [key, scans] of grouped.entries()) {
      const [employeeNumber, workDate] = key.split('_');
      
      // Sort times chronologically
      scans.sort((a, b) => a.getTime() - b.getTime());

      // Assign slots chronologically
      const times = {
        time1: scans.length > 0 ? this.formatTime(scans[0]) : null,
        time2: scans.length > 1 ? this.formatTime(scans[1]) : null,
        time3: scans.length > 2 ? this.formatTime(scans[2]) : null,
        time4: scans.length > 3 ? this.formatTime(scans[3]) : null,
        time5: scans.length > 4 ? this.formatTime(scans[4]) : null,
        time6: scans.length > 5 ? this.formatTime(scans[5]) : null,
      };

      // Convert times to fractional minutes from midnight for exact math
      const scanMins = scans.map(s => s.getHours() * 60 + s.getMinutes() + (s.getSeconds() / 60));

      let normalStatus: 0 | 1 = 0;
      let lunchStatus: 0 | 1 = 0;
      let otMorningHours = 0;
      let otEveningHours = 0;
      let lateMinutes = 0;

      // 1. Normal Status Calculation (ปกติ)
      // Conditions for Normal Status:
      // - Must have at least 2 scans (In and Out)
      // - First scan must be at or before 08:00 (480 mins)
      // - Last scan must be at or after 17:00 (1020 mins)
      const firstScan = scanMins.length > 0 ? scanMins[0] : null;
      const lastScan = scanMins.length > 0 ? scanMins[scanMins.length - 1] : null;

      if (scans.length >= 2 && firstScan !== null && lastScan !== null) {
        if (firstScan <= 480 && lastScan >= 1020) {
          normalStatus = 1;
        }
      }

      if (scans.length > 0) {
        const firstScan = scanMins[0];
        const lastScan = scanMins[scanMins.length - 1];

        // 2. Morning OT (Requires >= 2 scans before 08:00)
        // 08:00 = 480 mins
        const morningScans = scanMins.filter(m => m <= 480);
        if (morningScans.length >= 2) {
           const otIn = morningScans[0];
          const otOut = morningScans[morningScans.length - 1];
          otMorningHours = Math.floor((otOut - otIn) / 60);
        }

        // 3. Late Minutes (If first scan > 08:00)
        if (morningScans.length === 0) {
          if (firstScan !== null && firstScan > 480) { // Strictly > 08:00
            lateMinutes = Math.floor(firstScan - 480);
          }
        }

        // Proceed if normalStatus = 1 (at least an in and out)
        if (normalStatus === 1) {
          // 4. Lunch OT (Worked straight through)
          // Look for any scans between 11:30 and 13:30.
          let hasLunchScan = false;
          for (const m of scanMins) {
            if (m >= 11.5 * 60 && m <= 13.5 * 60) {
              hasLunchScan = true;
              break;
            }
          }
          
          // If they started before 12:00 and ended after 13:00 with no scans during lunch block = Lunch OT
          if (firstScan < 720 && lastScan > 780 && !hasLunchScan) {
            lunchStatus = 1; // 1 hour of lunch OT
          }

          // 5. Evening OT (After 17:00)
          // 17:00 = 1020 mins.
          if (lastScan > 1020) {
            let eveningOTStart = 1020; // Default to 17:00 if they worked straight through
            let hasRegularOut = false;
            let regularOutIndex = -1;
            let explicitOTIn = -1;

            // Look for explicit "Regular Out" scan around 17:00 (16:30 - 17:30)
            // If they scan out at 17:01, it's a regular out, not OT.
            for (let i = 0; i < scanMins.length; i++) {
              const m = scanMins[i];
              if (m >= 16.5 * 60 && m <= 17.5 * 60) { // 16:30 - 17:30
                hasRegularOut = true;
                regularOutIndex = i;
                // If there are multiple scans in this range, the first one is usually the regular out
                break; 
              }
            }

            // If there's a regular out, check for subsequent OT scans
            if (hasRegularOut) {
              // Any scans after the regular out?
              if (regularOutIndex < scanMins.length - 1) {
                // The next scan is the "OT In"
                explicitOTIn = scanMins[regularOutIndex + 1];
              } else {
                // If the last scan IS the regular out, then no OT.
                // We set start to lastScan to force OT to 0.
                eveningOTStart = lastScan + 1; 
              }
            }

            if (explicitOTIn !== -1) {
              eveningOTStart = explicitOTIn;
            }

             // Calculate OT in whole hours (round down)
            if (lastScan > eveningOTStart) {
              otEveningHours = Math.floor((lastScan - eveningOTStart) / 60);
            }
          }
        }
      }

      results.push({
        employeeNumber,
        workDate,
        time1: times.time1,
        time2: times.time2,
        time3: times.time3,
         time4: times.time4,
        time5: times.time5,
        time6: times.time6,
        punches: scans.map(s => {
          const hours = String(s.getHours()).padStart(2, '0');
          const mins = String(s.getMinutes()).padStart(2, '0');
          return `${hours}:${mins}`;
        }),
        firstIn: times.time1 ? times.time1.substring(0, 5) : null, // HH:mm from HH:mm:ss
        lastOut: scans.length > 0 ? this.formatTime(scans[scans.length - 1]).substring(0, 5) : null,
        timeScans: scans,
        normalStatus,
        lunchStatus,
        otMorningHours,
        otEveningHours,
        lateMinutes,
        sourceRowNumbers: rowMap.get(key) || []
      });
    }

    return results;
  }

  private static formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static formatTime(d: Date): string {
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${hour}:${min}:${sec}`;
  }

}
