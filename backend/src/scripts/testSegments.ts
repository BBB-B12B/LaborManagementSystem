// Scratchpad for classifying segments
export {};

function punchToMinutes(punch: string): number {
  const [h, m] = punch.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function parseShiftTime(timeStr?: string): { start: number; end: number } | null {
  if (!timeStr) return null;
  const parts = timeStr.split('-').map((s) => s.trim());
  if (parts.length !== 2) return null;
  return { start: punchToMinutes(parts[0]), end: punchToMinutes(parts[1]) };
}

function testSegments(shiftTimes: any, otNoonHours: number) {
  const segments: { start: number; end: number; type: string }[] = [];

  const dayShift = parseShiftTime(shiftTimes?.day);
  const otMorning = parseShiftTime(shiftTimes?.otMorning);
  const otNoon = parseShiftTime(shiftTimes?.otNoon);
  const otEvening = parseShiftTime(shiftTimes?.otEvening);

  if (otMorning) segments.push({ start: otMorning.start, end: otMorning.end, type: 'otMorning' });

  const hasOtNoon = !!otNoon || otNoonHours > 0;
  const hasOtEveningConnected = otEvening && dayShift && otEvening.start === dayShift.end;

  if (dayShift) {
    if (hasOtNoon) {
      segments.push({ start: dayShift.start, end: dayShift.end, type: 'normal' });
    } else {
      if (dayShift.end <= 12 * 60) {
        segments.push({ start: dayShift.start, end: dayShift.end, type: 'morning' });
      } else if (dayShift.start >= 13 * 60) {
        if (hasOtEveningConnected) {
          segments.push({
            start: dayShift.start,
            end: otEvening!.end,
            type: 'combined_afternoon_evening',
          });
        } else {
          segments.push({ start: dayShift.start, end: dayShift.end, type: 'afternoon' });
        }
      } else {
        segments.push({ start: dayShift.start, end: 12 * 60, type: 'morning' });
        if (hasOtEveningConnected) {
          segments.push({
            start: 13 * 60,
            end: otEvening!.end,
            type: 'combined_afternoon_evening',
          });
        } else {
          segments.push({ start: 13 * 60, end: dayShift.end, type: 'afternoon' });
        }
      }
    }
  }

  if (otEvening) {
    if (!(hasOtEveningConnected && !hasOtNoon && dayShift)) {
      segments.push({ start: otEvening.start, end: otEvening.end, type: 'otEvening' });
    }
  }

  return segments;
}

console.log('Normal:', testSegments({ day: '08:00 - 17:00' }, 0));
console.log('OT Noon:', testSegments({ day: '08:00 - 17:00', otNoon: '12:00 - 13:00' }, 1));
console.log(
  'OT Morning+Evening Connected:',
  testSegments({ day: '08:00 - 17:00', otMorning: '06:00 - 08:00', otEvening: '17:00 - 20:00' }, 0)
);
console.log(
  'OT Evening Disconnected:',
  testSegments({ day: '08:00 - 17:00', otEvening: '18:00 - 21:00' }, 0)
);
