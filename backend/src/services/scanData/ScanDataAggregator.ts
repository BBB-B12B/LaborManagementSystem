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

      // Assign to slots
      const times = {
        time1: null as string | null,
        time2: null as string | null,
        time3: null as string | null,
        time4: null as string | null,
        time5: null as string | null,
        time6: null as string | null,
      };

      for (const scan of scans) {
        const hhmm = this.formatTime(scan);
        const hour = scan.getHours();
        
        // Strict assignment based on real time
        if (hour >= 3 && hour <= 10) {
          if (!times.time1) times.time1 = hhmm; // Keep earliest if multiple
        } else if (hour === 11 || hour === 12) {
          times.time2 = hhmm; // Keep latest if multiple? Or just first inside the window
        } else if (hour === 13 || hour === 14) {
          if (!times.time3) times.time3 = hhmm; 
        } else if (hour >= 15 && hour <= 17) {
          times.time4 = hhmm; // Keep latest
        } else if (hour === 18 || hour === 19) {
          if (!times.time5) times.time5 = hhmm; // Keep earliest
        } else if (hour >= 20) {
          times.time6 = hhmm; // Keep latest
        }
      }

      // Compute Logic
      // Normal Status: at least 2 total scans
      const normalStatus = scans.length >= 2 ? 1 : 0;

      // Lunch Status (ผ่าเที่ยง): Scanned in the morning, next scan is evening/night (skipping lunch)
      let lunchStatus: 0 | 1 = 0;
      if (times.time1 && !times.time2 && !times.time3 && !times.time4 && (times.time5 || times.time6)) {
        lunchStatus = 1;
      }

      // Late Minutes (From Time1 > 08:00)
      let lateMinutes = 0;
      if (times.time1) {
        const [h, m] = times.time1.split(':').map(Number);
        const minutesFromMidnight = h * 60 + m;
        const startThreshold = 8 * 60; // 08:00
        if (minutesFromMidnight > startThreshold) {
          lateMinutes = minutesFromMidnight - startThreshold;
        }
      }

      // OT Calculation (Assuming Time5 -> Time6 is evening OT)
      // Usually done via exact tracking, but for preview we can approximate:
      let otEveningHours = 0;
      if (times.time5 && times.time6) {
        otEveningHours = this.diffHours(times.time5, times.time6);
      }
      
      let otMorningHours = 0;
      // If time1 is really early, e.g., 04:00, standard start is 08:00
      if (times.time1) {
        const [h, m] = times.time1.split(':').map(Number);
        if (h < 7 || (h === 7 && m < 30)) {
           // Basic early OT approximation
           // Just a placeholder calculation
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

  private static diffHours(startHm: string, endHm: string): number {
    const [h1, m1] = startHm.split(':').map(Number);
    const [h2, m2] = endHm.split(':').map(Number);
    const diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    return diffMins > 0 ? Number((diffMins / 60).toFixed(2)) : 0;
  }
}
