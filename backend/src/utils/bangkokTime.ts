/**
 * Helpers for the recurring "server runs UTC, business day is Asia/Bangkok" bug class.
 *
 * Two different conventions for date-only fields coexist in this codebase:
 *  - "label" fields (e.g. dailyReports.reportDate, built by parsing a bare
 *    "YYYY-MM-DD" string) are stored as UTC-midnight-of-that-label — a JS
 *    date-only string is UTC by spec, so this is what parsing it naturally
 *    produces. Boundaries for these fields must also be UTC-midnight-of-label.
 *  - "instant" fields (e.g. overtime_records.reportDate, built from a real
 *    Date-picker value serialized via toISOString()) represent a genuine
 *    Bangkok-midnight instant. Boundaries for these fields must be real
 *    +07:00 instants.
 *
 * Both helpers below first resolve "which Bangkok calendar day does this
 * input represent", so they work whether the input is a bare date string or
 * a full ISO instant.
 */

const BANGKOK_TZ = 'Asia/Bangkok';

function bangkokDateLabel(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat('en-CA', { timeZone: BANGKOK_TZ }).format(d);
}

/** Day bounds for "label" fields — UTC-midnight-of-the-Bangkok-day. */
function bangkokLabelDayBounds(input: string | Date): { start: Date; end: Date } {
  const label = bangkokDateLabel(input);
  return {
    start: new Date(`${label}T00:00:00.000Z`),
    end: new Date(`${label}T23:59:59.999Z`),
  };
}

/** Day bounds for "instant" fields — real Bangkok-midnight / end-of-day instants. */
function bangkokInstantDayBounds(input: string | Date): { start: Date; end: Date } {
  const label = bangkokDateLabel(input);
  return {
    start: new Date(`${label}T00:00:00.000+07:00`),
    end: new Date(`${label}T23:59:59.999+07:00`),
  };
}

/** Today's Bangkok calendar day, expressed as a UTC-midnight "label" Date. */
function bangkokTodayAsLabel(): Date {
  return bangkokLabelDayBounds(new Date()).start;
}

export { bangkokDateLabel, bangkokLabelDayBounds, bangkokInstantDayBounds, bangkokTodayAsLabel };
