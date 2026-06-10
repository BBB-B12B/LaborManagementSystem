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
  time7: string | null;
  time8: string | null;
  time9: string | null;
  time10: string | null;

  punches: string[]; // HH:mm format
  firstIn: string | null;
  lastOut: string | null;
  timeScans: Date[]; // raw times for advanced calculations
  allScans: string[];

  // Computed metrics
  normalStatus: 0 | 1;
  regularHours: number; // usually 8.00 if normalStatus = 1
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

      // Sort and deduplicate times (keep the latest scan within a 5-minute window)
      scans.sort((a, b) => a.getTime() - b.getTime());
      const deduplicatedScans = this.deduplicateScans(scans);

      // Use deduplicated scans for slots
      const displayScans = deduplicatedScans;

      // Assign slots chronologically
      const times = {
        time1: displayScans.length > 0 ? this.formatTime(displayScans[0]) : null,
        time2: displayScans.length > 1 ? this.formatTime(displayScans[1]) : null,
        time3: displayScans.length > 2 ? this.formatTime(displayScans[2]) : null,
        time4: displayScans.length > 3 ? this.formatTime(displayScans[3]) : null,
        time5: displayScans.length > 4 ? this.formatTime(displayScans[4]) : null,
        time6: displayScans.length > 5 ? this.formatTime(displayScans[5]) : null,
        time7: displayScans.length > 6 ? this.formatTime(displayScans[6]) : null,
        time8: displayScans.length > 7 ? this.formatTime(displayScans[7]) : null,
        time9: displayScans.length > 8 ? this.formatTime(displayScans[8]) : null,
        time10: displayScans.length > 9 ? this.formatTime(displayScans[9]) : null,
      };

      // Convert times to fractional minutes from midnight for exact math
      const scanMins = displayScans.map(
        (s) => s.getHours() * 60 + s.getMinutes() + s.getSeconds() / 60
      );

      let normalStatus: 0 | 1 = 0;
      let regularHours = 0;
      let lunchStatus: 0 | 1 = 0;
      let otMorningHours = 0;
      let otEveningHours = 0;
      let lateMinutes = 0;

      // 1. Normal Status Calculation (ปกติ)
      // Conditions for Normal Status:
      // - Must have at least 2 scans (In and Out)
      // - First scan duration covers core business hours roughly (e.g. before 12:00 and after 13:00)
      const firstScan = scanMins.length > 0 ? scanMins[0] : null;
      const lastScan = scanMins.length > 0 ? scanMins[scanMins.length - 1] : null;

      if (scans.length >= 2 && firstScan !== null && lastScan !== null) {
        // If they scanned in before noon and out after noon, they are "Normal"
        // even if they are late (e.g. 08:30) as long as they scanned in and out.
        if (firstScan < 720 && lastScan >= 1020) {
          normalStatus = 1;
        }

        // Calculate actual working hours from scan times
        // Use the effective start (cap at 08:00 for early arrivals within regular window)
        const effectiveStart = Math.max(firstScan, 480); // Don't count before 08:00 as regular
        const effectiveEnd = Math.min(lastScan, 1020); // Don't count after 17:00 as regular

        if (effectiveEnd > effectiveStart) {
          let workMins = effectiveEnd - effectiveStart;

          // Subtract 1 hour lunch break (12:00-13:00) if work spans across lunch
          if (effectiveStart < 720 && effectiveEnd > 780) {
            workMins -= 60; // Subtract lunch hour
          }

          // Round down to 0.5 hour increments
          regularHours = Math.floor(workMins / 30) * 0.5;
          if (isNaN(regularHours)) regularHours = 0;
        }
      }

      if (scans.length > 0 && firstScan !== null && lastScan !== null) {
        // 2. OT Morning (03:00 - 08:00)
        // Calculate OT in 30-min blocks (round down)
        const morningScans = scanMins.filter((m) => m <= 480);
        if (morningScans.length >= 2) {
          const otIn = morningScans[0];
          const otOut = morningScans[morningScans.length - 1];
          const durationMins = otOut - otIn;
          otMorningHours = Math.floor(durationMins / 30) * 0.5;
          if (isNaN(otMorningHours)) otMorningHours = 0;
        }

        // 3. Late Minutes (If first scan > 08:00)
        // Only count as late if first scan is after 08:00 and before noon
        if (firstScan !== null && firstScan > 480 && firstScan < 720) {
          lateMinutes = Math.floor(firstScan - 480);
          if (isNaN(lateMinutes)) lateMinutes = 0;
        }

        // 4. OT Noon (Worked through lunch 12:00 - 13:00)
        // Look for any scans between 11:30 and 13:30.
        let hasLunchScan = false;
        for (const m of scanMins) {
          if (m >= 11.5 * 60 && m <= 13.5 * 60) {
            hasLunchScan = true;
            break;
          }
        }

        // If they started before 12:00 and ended after 13:00 with no scans during lunch block = Lunch OT
        if (
          firstScan !== null &&
          lastScan !== null &&
          firstScan < 720 &&
          lastScan > 780 &&
          !hasLunchScan
        ) {
          lunchStatus = 1; // 1.0 hour for missing lunch
        }
        // 5. OT Evening (After 18:00)
        // 17:00 - 18:00 is treated as a break/regular finish window.
        // OT starts from 18:00 onwards.
        if (lastScan !== null && lastScan >= 1110) {
          // Must stay at least until 18:30 to get 0.5 OT
          const eveningOTStart = 1080; // 18:00

          // Calculate OT in 30-min blocks (round down)
          if (lastScan >= eveningOTStart + 30) {
            const otDuration = lastScan - eveningOTStart;
            otEveningHours = Math.floor(otDuration / 30) * 0.5;
            if (isNaN(otEveningHours)) otEveningHours = 0;
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
        time7: times.time7,
        time8: times.time8,
        time9: times.time9,
        time10: times.time10,

        punches: displayScans.map((s) => {
          if (isNaN(s.getTime())) return '??:??';
          const hours = String(s.getHours()).padStart(2, '0');
          const mins = String(s.getMinutes()).padStart(2, '0');
          return `${hours}:${mins}`;
        }),
        firstIn: times.time1 ? times.time1.substring(0, 5) : null, // HH:mm from HH:mm:ss
        lastOut:
          displayScans.length > 0
            ? this.formatTime(displayScans[displayScans.length - 1]).substring(0, 5)
            : null,
        timeScans: displayScans,
        allScans: displayScans.map((s) => this.formatTime(s)),

        normalStatus,
        regularHours,
        lunchStatus,
        otMorningHours,
        otEveningHours,
        lateMinutes,
        sourceRowNumbers: rowMap.get(key) || [],
      });
    }

    return results;
  }

  private static formatDate(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  private static formatTime(d: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  }

  /**
   * Filter out scans that are within windowSeconds of each other.
   * Keeps the scan that gives the maximum benefit to the employee:
   * - IN actions (Morning, Afternoon return): Keeps EARLIEST scan
   * - OUT actions (Lunch out, Evening out): Keeps LATEST scan
   */
  private static deduplicateScans(scans: Date[], windowSeconds: number = 119): Date[] {
    if (scans.length <= 1) return scans;

    const windowMs = windowSeconds * 1000;
    // Sort scans by time
    const sorted = [...scans].sort((a, b) => a.getTime() - b.getTime());

    // Group into clusters (scans within window of each other)
    const clusters: Date[][] = [];
    let currentCluster: Date[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const nextScan = sorted[i];
      const prevScanInCluster = currentCluster[currentCluster.length - 1];
      const diff = nextScan.getTime() - prevScanInCluster.getTime();

      if (diff <= windowMs) {
        currentCluster.push(nextScan);
      } else {
        clusters.push(currentCluster);
        currentCluster = [nextScan];
      }
    }
    clusters.push(currentCluster);

    const result: Date[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const avgHour = cluster[0].getHours();

      // IN: ก่อน 12:00 หรือช่วง 13:00 (กลับจากพักเที่ยง) -> ผลประโยชน์สูงสุดคือ "เริ่มเร็ว" (EARLIEST)
      // OUT: เวลา 12:00 (พักเที่ยง) หรือหลัง 14:00 เป็นต้นไป -> ผลประโยชน์สูงสุดคือ "เลิกช้า" (LATEST)
      let isOutAction = false;
      if (avgHour === 12)
        isOutAction = true; // Lunch out
      else if (avgHour >= 14) isOutAction = true; // Regular out / OT out

      // Override for the very last cluster of the day
      if (i === clusters.length - 1 && clusters.length > 1) {
        isOutAction = true;
      }
      // Override for the very first cluster of the day
      if (i === 0) {
        isOutAction = false;
      }

      if (isOutAction) {
        // For OUT actions, pick the LATEST time to maximize work duration
        result.push(cluster[cluster.length - 1]);
      } else {
        // For IN actions, pick the EARLIEST time to maximize work duration
        result.push(cluster[0]);
      }
    }

    return result;
  }
}
