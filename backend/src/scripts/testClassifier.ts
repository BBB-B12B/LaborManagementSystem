export {};

function punchToMinutes(punch: string): number {
  const [h, m] = punch.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(mins: number) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

const shiftTimes = {
  day: "08:00 - 17:00",
  otEvening: "18:00 - 21:00",
  otMorning: undefined as string | undefined
};

const scanPunches = [
  "06:14",
  "08:03",
  "12:02",
  "13:12",
  "17:00",
  "18:00",
  "21:00"
];


function runTest() {
  const parseTime = (timeStr?: string): { start: number; end: number } | null => {
    if (!timeStr) return null;
    const parts = timeStr.split('-').map(s => s.trim());
    if (parts.length !== 2) return null;
    return { start: punchToMinutes(parts[0]), end: punchToMinutes(parts[1]) };
  };

  const segments: { start: number; end: number; type: string }[] = [];
  const dayShift = parseTime(shiftTimes.day);
  const otMorning = parseTime(shiftTimes.otMorning);
  const otNoon = parseTime(undefined);
  const otEvening = parseTime(shiftTimes.otEvening);

  if (!dayShift) {
    console.log("No dayShift!");
    return;
  }

  if (otMorning) {
    segments.push({ start: otMorning.start, end: otMorning.end, type: 'otMorning' });
  }

  const hasOtNoon = !!otNoon;
  const hasOtEveningConnected = otEvening && otEvening.start === dayShift.end;

  if (hasOtNoon) {
    segments.push({ start: dayShift.start, end: dayShift.end, type: 'normal' });
  } else {
    if (dayShift.end <= 12 * 60) {
      segments.push({ start: dayShift.start, end: dayShift.end, type: 'morning' });
    } else if (dayShift.start >= 13 * 60) {
      if (hasOtEveningConnected) {
        segments.push({ start: dayShift.start, end: otEvening.end, type: 'combined_afternoon_evening' });
      } else {
        segments.push({ start: dayShift.start, end: dayShift.end, type: 'afternoon' });
      }
    } else {
      segments.push({ start: dayShift.start, end: 12 * 60, type: 'morning' });
      if (hasOtEveningConnected) {
        segments.push({ start: 13 * 60, end: otEvening.end, type: 'combined_afternoon_evening' });
      } else {
        segments.push({ start: 13 * 60, end: dayShift.end, type: 'afternoon' });
      }
    }
  }

  if (otEvening) {
    if (!(hasOtEveningConnected && !hasOtNoon)) {
      segments.push({ start: otEvening.start, end: otEvening.end, type: 'otEvening' });
    }
  }

  console.log("Segments:", JSON.stringify(segments, null, 2));

  const sortedScans = scanPunches.map(p => punchToMinutes(p)).sort((a, b) => a - b);
  console.log("Sorted Scans:", sortedScans.map(t => `${formatTime(t)} (${t})`));

  const usedPunches = new Set<number>();
  const conflictNotes: string[] = [];

  for (const seg of segments) {
    const segIndex = segments.indexOf(seg);
    const nextSeg = segments[segIndex + 1];
    const available = sortedScans.filter(t => !usedPunches.has(t));

    console.log(`\n--- Segment: ${seg.type} (${formatTime(seg.start)} - ${formatTime(seg.end)}) ---`);
    console.log(`Available punches:`, available.map(t => formatTime(t)));
    console.log(`usedPunches Set:`, Array.from(usedPunches).map(t => formatTime(t)));

    let closestIn = -1;
    let minInDiff = Infinity;
    for (const t of available) {
      if (t > seg.end) continue;
      const diff = Math.abs(t - seg.start);
      if (diff < minInDiff) { minInDiff = diff; closestIn = t; }
      else if (diff === minInDiff && t < closestIn) { closestIn = t; }
    }

    let closestOut = -1;
    let minOutDiff = Infinity;
    for (const t of available) {
      if (t <= closestIn) continue;
      const diff = Math.abs(t - seg.end);
      if (diff < minOutDiff) { minOutDiff = diff; closestOut = t; }
      else if (diff === minOutDiff && t > closestOut) { closestOut = t; }
    }

    console.log(`closestIn: ${closestIn !== -1 ? formatTime(closestIn) : 'none'} (diff: ${minInDiff})`);
    console.log(`closestOut: ${closestOut !== -1 ? formatTime(closestOut) : 'none'} (diff: ${minOutDiff})`);

    if (closestIn !== -1) usedPunches.add(closestIn);
    if (closestOut !== -1) {
      const isBoundaryShared = nextSeg && seg.end === nextSeg.start;
      console.log(`closestOut isBoundaryShared: ${isBoundaryShared} (seg.end=${formatTime(seg.end)} nextSeg.start=${nextSeg ? formatTime(nextSeg.start) : 'none'})`);
      if (!isBoundaryShared) {
        usedPunches.add(closestOut);
      }
    }

    const isMorningTransition = seg.start === 480 && otMorning;

    if (closestIn === -1 || minInDiff > 90) {
      const prevHasIn = isMorningTransition && sortedScans.some((t) => t <= 480 + 90 && t >= otMorning.start - 90);
      console.log(`Bypass check: isMorningTransition=${!!isMorningTransition} prevHasIn=${prevHasIn}`);
      if (!isMorningTransition || !prevHasIn) {
        conflictNotes.push(`ไม่พบสแกน IN สำหรับ segment ${formatTime(seg.start)}–${formatTime(seg.end)}`);
      }
    }
  }

  console.log("\nConflict Notes Result:", conflictNotes);
}

runTest();
