/**
 * Characterization tests for the segment-classification logic currently living
 * inside ReconciliationService (classifyBySegments / classifyByPunchCoverage).
 *
 * Purpose: lock in CURRENT behavior before extracting it into segmentEngine.ts,
 * so the extraction can be verified as a pure move (no behavior change). This
 * logic drives payroll hours — it must not drift silently during refactor.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as admin from 'firebase-admin';

beforeAll(() => {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'test-project' });
  }
});

// Imported after the app is guaranteed to exist, since the service class
// calls getFirestore() in a field initializer at construction time.
import { ReconciliationService } from './ReconciliationService';
import {
  buildSegmentsFromShiftTimes,
  matchSegmentsToPunches,
  buildDisplaySegments,
  buildSegmentSnapshots,
  classifyBySegments,
  mergeContiguousSegments,
} from './segmentEngine';

const svc = new ReconciliationService();

describe('classifyBySegments (characterization)', () => {
  it('MATCHED — normal day shift, all punches on time (no OT)', () => {
    const result = svc.classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00' },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('MATCHED');
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it('MATCHED — OT เที่ยง (otNoon) merges morning+afternoon into one segment', () => {
    const result = svc.classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00', otNoon: '12:00 - 13:00' },
      scanPunches: ['08:00', '17:00'],
      timesheetNormalHours: 8,
      timesheetOtNoon: 1,
    });
    expect(result.status).toBe('MATCHED');
  });

  it('MATCHED — otMorning connected to normal shift, boundary punch (08:00) shared between segments', () => {
    // otMorning 06:00-08:00 + normal 08:00-17:00 (no otNoon) => segments:
    // [otMorning 06:00-08:00] [morning 08:00-12:00] [afternoon 13:00-17:00]
    // Only 5 punches given — 08:00 must be reused as OUT of otMorning AND IN of morning.
    const result = svc.classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00', otMorning: '06:00 - 08:00' },
      scanPunches: ['06:00', '08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
      timesheetOtMorning: 2,
    });
    expect(result.status).toBe('MATCHED');
  });

  it('MISSING_SCAN — daily report exists but zero scans', () => {
    const result = svc.classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00' },
      scanPunches: [],
      dailyReportHours: 8,
    });
    expect(result.status).toBe('MISSING_SCAN');
  });

  it('CONFLICTED — only 1 scan punch (not enough to determine IN/OUT)', () => {
    const result = svc.classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00' },
      scanPunches: ['08:00'],
      dailyReportHours: 8,
    });
    expect(result.status).toBe('CONFLICTED');
  });

  it('CONFLICTED — a segment has no matching punch at all (regression: must not silently pass as MATCHED)', () => {
    // shiftTimes day 08:00-17:00 (no otNoon) => segments [morning 08:00-12:00] [afternoon 13:00-17:00]
    // Punches only cover the morning segment; afternoon has nothing within range.
    const result = svc.classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00' },
      scanPunches: ['08:00', '12:00'],
      dailyReportHours: 8,
    });
    expect(result.status).toBe('CONFLICTED');
  });

  it('MATCHED + auto-penalty — OT เช้า late by <=30 min deducts approvedOtMorning in 30-min steps', () => {
    const result = svc.classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00', otMorning: '06:00 - 08:00' },
      scanPunches: ['06:10', '08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
      timesheetOtMorning: 2,
    });
    expect(result.status).toBe('MATCHED');
    expect(result.approvedOtMorning).toBe(1.5); // 10 min late -> rounded up to 30 min penalty
  });

  it('hasOtNoon must come from shiftTimes.otNoon only, not from timesheetOtNoon (bug #3 regression)', () => {
    // No shiftTimes.otNoon given, but timesheetOtNoon (scan-derived) is > 0.
    // Segments must still split into morning/afternoon (2 segments), not merge into one.
    const result = svc.classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00' },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
      timesheetOtNoon: 1, // should be ignored for segment-building purposes
    });
    expect(result.status).toBe('MATCHED');
  });
});

describe('classifyBySegments — jobSegments (N งานย่อยต่อวัน, After-Sale 2026-07 format)', () => {
  it('MATCHED — 2 งานต่อเนื่องกันพอดี (งาน A จบ 10:00 งาน B เริ่ม 10:00) ไม่ต้องสแกนตรงจุดสลับงาน', () => {
    const result = classifyBySegments({
      jobSegments: {
        jobA: { shiftTimes: { day: '08:00 - 10:00' } },
        jobB: { shiftTimes: { day: '10:00 - 17:00' } },
      },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('MATCHED');
  });

  it('MATCHED — 2 งานต่อเนื่องกันคาบเกี่ยวช่วงบ่าย (งาน A 08:00-15:00, งาน B 15:00-17:00)', () => {
    const result = classifyBySegments({
      jobSegments: {
        jobA: { shiftTimes: { day: '08:00 - 15:00' } },
        jobB: { shiftTimes: { day: '15:00 - 17:00' } },
      },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('MATCHED');
  });

  it('MATCHED — งานเดียวทั้งวัน ผ่าน jobSegments ต้องได้ผลเหมือน shiftTimes เดิม (parity)', () => {
    const result = classifyBySegments({
      jobSegments: { jobA: { shiftTimes: { day: '08:00 - 17:00' } } },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('MATCHED');
  });

  it('CONFLICTED — ช่วงเวลาหายจริง (งาน A จบ 10:00 งาน B เริ่ม 13:00 ไม่มีงานคาบ 10:00-13:00)', () => {
    // ยังคง CONFLICTED เป็นค่า default ที่ปลอดภัยไว้ก่อน — การจะเปลี่ยนเป็นสถานะ
    // "ต้องตรวจสอบ" แบบไม่ block ชั่วโมง (ตามที่คุยไว้) เป็นดีซิชันเรื่อง payroll
    // ที่ต้องยืนยันกับผู้ใช้อีกรอบ ยังไม่ได้ implement ส่วนนั้น
    const result = classifyBySegments({
      jobSegments: {
        jobA: { shiftTimes: { day: '08:00 - 10:00' } },
        jobB: { shiftTimes: { day: '13:00 - 17:00' } },
      },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('CONFLICTED');
  });

  it('CONFLICTED — regression: ต้องยังจับกรณีขาดสแกนจริงตอนเข้างานได้ (ไม่ใช่ว่า jobSegments ทำให้ lenient ไปหมด)', () => {
    const result = classifyBySegments({
      jobSegments: { jobA: { shiftTimes: { day: '08:00 - 17:00' } } },
      scanPunches: ['12:00', '17:00'], // ไม่มีสแกนเข้าใกล้ 08:00 เลย
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('CONFLICTED');
  });

  it('MATCHED — production sample จริงจาก After-Sale (2026-07-29): 2 งาน เช้า+บ่าย คั่นด้วยพักเที่ยง', () => {
    // ข้อมูลจริงจาก DailyEmployeeTimesheets (employeeNumber 888888, date 2026-07-24):
    // งาน ARC-0001-004-0001 เช้า "08:00 - 12:00" + งาน ARC-0001-003-0001 บ่าย "13:00 - 17:00"
    // (มีเว้นวรรครอบ "-" ตามที่ After-Sale เขียนจริง ต้อง parse ได้เหมือนไม่มีเว้นวรรค)
    // ช่องว่าง 12:00-13:00 เป็นพักเที่ยงจริง ไม่ใช่รอยต่อสลับงาน จึงไม่ควรถูก merge —
    // ต้องยังคงมีสแกนคาดหวังที่ 12:00 (ออกพัก) และ 13:00 (เข้าบ่าย) เหมือน shiftTimes เดิม
    const result = classifyBySegments({
      jobSegments: {
        'ARC-0001-004-0001': { taskId: 'ARC-0001-004', subtaskId: 'ARC-0001-004-0001', shiftTimes: { day: '08:00 - 12:00' } },
        'ARC-0001-003-0001': { taskId: 'ARC-0001-003', subtaskId: 'ARC-0001-003-0001', shiftTimes: { day: '13:00 - 17:00' } },
      },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('MATCHED');
  });

  it('CONFLICTED — production sample เดียวกัน แต่ขาดสแกนตอนออก/เข้าพักเที่ยง (ช่องว่างจริงต้องยังถูกจับ)', () => {
    const result = classifyBySegments({
      jobSegments: {
        'ARC-0001-004-0001': { taskId: 'ARC-0001-004', subtaskId: 'ARC-0001-004-0001', shiftTimes: { day: '08:00 - 12:00' } },
        'ARC-0001-003-0001': { taskId: 'ARC-0001-003', subtaskId: 'ARC-0001-003-0001', shiftTimes: { day: '13:00 - 17:00' } },
      },
      scanPunches: ['08:00', '17:00'], // ขาดสแกน 12:00/13:00
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('CONFLICTED');
  });

  it('CONFLICTED — production sample จริงจาก After-Sale (employeeNumber 888888, 2026-07-27): ผู้ใช้ตั้งใจลง Daily Report ไม่ครบ (6 ชม.) เพื่อทดสอบ logic เอง สแกนจริงมีแค่ 08:00/12:00/13:00 (ไม่มี 15:00) — ต้อง CONFLICTED ทั้งเพราะขาดสแกน OUT และเพราะวันสั้นกว่ามาตรฐาน', () => {
    // แก้ไข 2026-07-30: fixture เดิมของเทสนี้ใส่สแกนผิด (มี '15:00' เกินมา ซึ่งไม่มีจริงใน
    // ฐานข้อมูล) ทำให้เข้าใจผิดว่าเป็น "production sample ที่ยืนยันว่าถูกต้องแล้วเป็น MATCHED"
    // — ผู้ใช้ตรวจสอบ Firestore จริงแล้วพบว่า scanPunches ของวันนี้มีแค่ 3 ค่า (ไม่มี 15:00)
    // และ status จริงในระบบคือ CONFLICTED มาตั้งแต่ต้น (note: "ไม่พบสแกน OUT สำหรับ
    // segment 13:00–15:00") — เป็นพฤติกรรมเดิมที่ถูกต้องอยู่แล้ว ไม่เกี่ยวกับกฎ short-day
    // เลย (segment บ่ายขาด OUT ไปตั้งแต่แรก) กฎ short-day แค่เพิ่ม note อีกท่อนเข้ามา
    // ไม่ได้เปลี่ยนสถานะ — แก้ fixture ให้ตรงกับข้อมูลจริงแทน
    const result = classifyBySegments({
      jobSegments: {
        'ARC-0001-005-0001': { taskId: 'ARC-0001-005', subtaskId: 'ARC-0001-005-0001', shiftTimes: { day: '08:00 - 10:00' } },
        'ARC-0001-004-0001': { taskId: 'ARC-0001-004', subtaskId: 'ARC-0001-004-0001', shiftTimes: { day: '10:00 - 15:00' } },
      },
      scanPunches: ['08:00', '12:00', '13:00'],
      timesheetNormalHours: 6,
    });
    expect(result.status).toBe('CONFLICTED');
    expect(result.note).toContain('ไม่พบสแกน OUT สำหรับ segment 13:00–15:00');
    expect(result.note).toContain('ไม่ครบวันทำงานมาตรฐาน');
  });

  it('CONFLICTED — production sample เดียวกัน แต่ขาดสแกนพักเที่ยงจริง (มีแค่เข้า-ออกทั้งวัน ไม่พอ)', () => {
    // ตรงข้ามกับสมมติฐานเดิมที่เคยเข้าใจผิดไว้ — merge ไม่ได้ทำให้ 08:00-15:00 กลายเป็น
    // "แค่ 2 สแกนพอ" เพราะช่วงนี้ยังคร่อมเที่ยงอยู่ ต้องมีสแกนพักเที่ยงยืนยันเหมือนเดิม
    const result = classifyBySegments({
      jobSegments: {
        'ARC-0001-005-0001': { taskId: 'ARC-0001-005', subtaskId: 'ARC-0001-005-0001', shiftTimes: { day: '08:00 - 10:00' } },
        'ARC-0001-004-0001': { taskId: 'ARC-0001-004', subtaskId: 'ARC-0001-004-0001', shiftTimes: { day: '10:00 - 15:00' } },
      },
      scanPunches: ['08:00', '15:00'], // ขาดสแกนพักเที่ยง (12:00/13:00)
      timesheetNormalHours: 6,
    });
    expect(result.status).toBe('CONFLICTED');
  });
});

describe('classifyBySegments — extraPunches (สแกนเหลือที่ไม่ตรง segment ไหนเลย ต้องบังคับ CONFLICTED)', () => {
  it('CONFLICTED — สแกนหลังเวลาที่ Daily Report บอกว่าเลิกงาน (17:00) ไกลเกิน tolerance ของ OUT (15:00) ต้องยัง CONFLICTED และ note ต้องบอกสแกนที่เหลือด้วย', () => {
    const result = classifyBySegments({
      shiftTimes: { day: '08:00 - 15:00' },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 6,
    });
    expect(result.status).toBe('CONFLICTED');
    expect(result.note).toContain('ไม่พบสแกน OUT');
    expect(result.note).toContain('17:00');
  });

  it('CONFLICTED — ทุก segment ที่ประกาศไว้ตรงครบ (ไม่งั้นจะเป็น MATCHED) แต่มีสแกนเหลือที่ไม่ตรงช่วงไหนเลย ต้องไม่ถูกมองข้ามเป็น MATCHED เงียบๆ', () => {
    const result = classifyBySegments({
      shiftTimes: { day: '08:00 - 15:00' },
      scanPunches: ['08:00', '12:00', '13:00', '15:00', '17:00'],
      timesheetNormalHours: 6,
    });
    expect(result.status).toBe('CONFLICTED');
    expect(result.note).toContain('17:00');
  });

  it('MATCHED — ไม่มีสแกนเหลือเลย ยัง MATCHED ตามปกติ (ไม่กระทบเคสที่ไม่มีความผิดปกติ)', () => {
    // ใช้วันเต็ม 08:00-17:00 (ไม่ใช่ 08:00-12:00 แบบเดิม) เพื่อแยกเทสนี้ออกจากกฎ
    // short-day ใหม่ด้านล่าง — เทสนี้เช็คเฉพาะว่า extraPunches ไม่กระทบเคสปกติ
    const result = classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00' },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('MATCHED');
    expect(result.note).toBeFalsy();
  });
});

describe('classifyBySegments — short-day (ลงเวลาสั้นกว่ามาตรฐาน 08:00-17:00 โดยไม่มีใบลา/วันหยุดรองรับ)', () => {
  it('CONFLICTED — ลงแค่ 08:00-12:00 (ครึ่งวันเช้า) สแกนตรงเป๊ะ แต่ไม่มีใบลา/วันหยุดรองรับช่วงบ่ายที่หายไป (เคสที่ผู้ใช้ยกมา 2026-07-30)', () => {
    const result = classifyBySegments({
      shiftTimes: { day: '08:00 - 12:00' },
      scanPunches: ['08:00', '12:00'],
      timesheetNormalHours: 4,
    });
    expect(result.status).toBe('CONFLICTED');
    expect(result.note).toContain('ไม่ครบวันทำงานมาตรฐาน');
  });

  it('MATCHED — ลาครึ่งวันบ่าย (isLeave=true) + ลงเช้าอย่างเดียว ไม่ต้อง flag short-day เพราะมีใบลารองรับ', () => {
    const result = classifyBySegments({
      shiftTimes: { day: '08:00 - 12:00' },
      scanPunches: ['08:00', '12:00'],
      timesheetNormalHours: 4,
      isLeave: true,
      leaveHours: 4,
    });
    expect(result.status).toBe('MATCHED');
  });

  it('HOLIDAY path ไม่ถูกกระทบ — isHoliday=true + ไม่มีชั่วโมงทำงาน + ไม่มีสแกน ยังเป็น HOLIDAY ตามปกติ (short-day ไม่เข้ามาเกี่ยว)', () => {
    const result = classifyBySegments({
      scanPunches: [],
      isHoliday: true,
    });
    expect(result.status).toBe('HOLIDAY');
  });

  it('MATCHED — วันเต็ม 08:00-17:00 ตรงมาตรฐานพอดี ไม่ถูก flag short-day', () => {
    const result = classifyBySegments({
      shiftTimes: { day: '08:00 - 17:00' },
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('MATCHED');
  });
});

describe('mergeContiguousSegments', () => {
  it('รวม segment ที่ end ของอันก่อน === start ของอันถัดไป เป็นก้อนเดียว', () => {
    const merged = mergeContiguousSegments([
      { start: 480, end: 600, type: 'morning' },
      { start: 600, end: 720, type: 'morning' },
      { start: 780, end: 1020, type: 'afternoon' },
    ]);
    expect(merged).toEqual([
      { start: 480, end: 720, type: 'morning' },
      { start: 780, end: 1020, type: 'afternoon' },
    ]);
  });

  it('ไม่รวม segment ที่มีช่องว่างจริงระหว่างกัน', () => {
    const merged = mergeContiguousSegments([
      { start: 480, end: 600, type: 'morning' },
      { start: 780, end: 1020, type: 'afternoon' },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe('matchSegmentsToPunches — per-segment detail (used by ReconciliationRecord.segments)', () => {
  it('returns one perSegment entry per segment, in order, with matched punch minutes', () => {
    const segments = buildSegmentsFromShiftTimes({ day: '08:00 - 17:00' })!;
    const outcome = matchSegmentsToPunches(segments, ['08:00', '12:00', '13:00', '17:00']);

    expect(outcome.perSegment).toHaveLength(2); // morning, afternoon
    expect(outcome.perSegment[0].segment.type).toBe('morning');
    expect(outcome.perSegment[0].matchedInMinutes).toBe(480); // 08:00
    expect(outcome.perSegment[0].matchedOutMinutes).toBe(720); // 12:00
    expect(outcome.perSegment[0].conflicted).toBe(false);
    expect(outcome.perSegment[1].segment.type).toBe('afternoon');
    expect(outcome.perSegment[1].matchedInMinutes).toBe(780); // 13:00
    expect(outcome.perSegment[1].matchedOutMinutes).toBe(1020); // 17:00
  });

  it('marks the specific segment missing a punch as conflicted, leaves the other segment alone', () => {
    const segments = buildSegmentsFromShiftTimes({ day: '08:00 - 17:00' })!;
    // Only covers the morning segment — afternoon has no punches at all.
    const outcome = matchSegmentsToPunches(segments, ['08:00', '12:00']);

    expect(outcome.isConflicted).toBe(true);
    expect(outcome.perSegment).toHaveLength(2);
    expect(outcome.perSegment[0].conflicted).toBe(false); // morning matched fine
    expect(outcome.perSegment[1].conflicted).toBe(true); // afternoon missing punches
    expect(outcome.perSegment[1].matchedInMinutes).toBeNull();
  });
});

describe('buildDisplaySegments — OT เที่ยง keeps 3 boxes for UI (product decision: keep existing look)', () => {
  it('splits into otMorning/morning/otNoon/afternoon/otEvening instead of merging into one "normal" block', () => {
    const segments = buildDisplaySegments({
      day: '08:00 - 17:00',
      otMorning: '06:00 - 08:00',
      otNoon: '12:00 - 13:00',
      otEvening: '17:00 - 20:00',
    });
    expect(segments.map((s) => s.type)).toEqual(['otMorning', 'morning', 'otNoon', 'afternoon', 'otEvening']);
  });

  it('hides the morning box when leave covers >=80% of it', () => {
    const segments = buildDisplaySegments({ day: '08:00 - 17:00' }, [{ timeRange: '08:00-12:00' }]);
    expect(segments.map((s) => s.type)).toEqual(['afternoon']);
  });
});

describe('buildSegmentSnapshots — persisted UI-ready result (replaces frontend re-matching)', () => {
  it('produces one snapshot per display segment with matched punches + correct photo indices', () => {
    const snapshots = buildSegmentSnapshots(
      { day: '08:00 - 17:00', otNoon: '12:00 - 13:00' },
      ['08:00', '17:00'],
      { regular: ['photo-morning-in', 'photo-morning-out', 'photo-afternoon-in', 'photo-afternoon-out'] }
    );
    expect(snapshots.map((s) => s.type)).toEqual(['morning', 'otNoon', 'afternoon']);
    const morning = snapshots.find((s) => s.type === 'morning')!;
    expect(morning.photoIn).toBe('photo-morning-in');
    expect(morning.photoOut).toBe('photo-morning-out');
    const afternoon = snapshots.find((s) => s.type === 'afternoon')!;
    expect(afternoon.photoIn).toBe('photo-afternoon-in');
    expect(afternoon.photoOut).toBe('photo-afternoon-out');
  });

  it('reads otMorning photos from the {in,out} shape and falls back to numeric-map shape', () => {
    const snapshots = buildSegmentSnapshots(
      { day: '08:00 - 17:00', otMorning: '06:00 - 08:00' },
      ['06:00', '08:00', '12:00', '13:00', '17:00'],
      { otMorning: { in: 'ot-in-url', out: 'ot-out-url' }, regular: { '0': 'r0', '1': 'r1', '2': 'r2', '3': 'r3' } }
    );
    const otMorning = snapshots.find((s) => s.type === 'otMorning')!;
    expect(otMorning.photoIn).toBe('ot-in-url');
    expect(otMorning.photoOut).toBe('ot-out-url');
    const afternoon = snapshots.find((s) => s.type === 'afternoon')!;
    expect(afternoon.photoIn).toBe('r2');
    expect(afternoon.photoOut).toBe('r3');
  });

  it('returns [] when there is no shiftTimes.day (nothing to display)', () => {
    expect(buildSegmentSnapshots(undefined, ['08:00', '17:00'])).toEqual([]);
  });
});

describe('classifyByPunchCoverage (characterization — legacy fallback path)', () => {
  it('MATCHED — scan first/last covers the reported punch range', () => {
    const result = svc.classifyByPunchCoverage({
      dailyReportPunches: ['08:00', '17:00'],
      scanPunches: ['08:00', '12:00', '13:00', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('MATCHED');
  });

  it('CONFLICTED — scan starts more than 30 minutes after reported start', () => {
    const result = svc.classifyByPunchCoverage({
      dailyReportPunches: ['08:00', '17:00'],
      scanPunches: ['08:45', '17:00'],
      timesheetNormalHours: 8,
    });
    expect(result.status).toBe('CONFLICTED');
  });
});
