/**
 * AuditHistoryDrawer
 * ประวัติการแก้ไข Daily Report Drawer
 *
 * Extracted from wage-calculation/[id].tsx (P1 refactor)
 * Renders side-by-side with AdditionalItemsDrawer (zIndex 1400, no backdrop)
 */

import React from 'react';
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { DCWageSummary } from '../../services/wageService';

// ---------------------------------------------------------------------------
// Module-level helpers — defined once, never recreated per render/iteration
// ---------------------------------------------------------------------------

type StatusStyle = {
  text: string;
  color: string;
  bgColor: string;
  borderColor: string;
};

const STATUS_STYLE_MAP: Record<string, StatusStyle> = {
  MISSING_SCAN: {
    text: 'ขาดสแกนนิ้ว ❌',
    color: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
  DISCREPANCY: {
    text: 'ชั่วโมงไม่ตรงกัน ⚠️',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fef3c7',
  },
  MATCHED: {
    text: 'ข้อมูลตรงกัน ✅',
    color: '#10b981',
    bgColor: '#ecfdf5',
    borderColor: '#d1fae5',
  },
  ABSENT: {
    text: 'ขาดงาน ❌',
    color: '#6b7280',
    bgColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  NO_DAILY_REPORT: {
    text: 'ไม่มีรายงานประจำวัน ⚠️',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fef3c7',
  },
};

const DEFAULT_STATUS_STYLE: StatusStyle = {
  text: '',
  color: '#6b7280',
  bgColor: '#f3f4f6',
  borderColor: '#e5e7eb',
};

function getStatusLabel(status: string): StatusStyle {
  return STATUS_STYLE_MAP[status] ?? { ...DEFAULT_STATUS_STYLE, text: status };
}

function getAuditDetails(currentEntry: any, prevEntry: any, record: any) {
  const currentStatus = currentEntry.status;
  const prevStatus = prevEntry ? prevEntry.status : null;
  const reason = currentEntry.reason || '';
  const note = currentEntry.note || '';

  let beforeTitle = 'ไม่พบข้อมูลสถานะก่อนหน้า';
  let beforeDesc = 'รายการประมวลผลเริ่มต้นโดยระบบ';
  let afterTitle = 'ประมวลผลสำเร็จ';
  let afterDesc = 'ระบบทำการประเมินสถานะความถูกต้อง';

  if (!prevEntry) {
    beforeTitle = 'ข้อมูลก่อนการตรวจสอบ';
    if (currentStatus === 'MISSING_SCAN') {
      beforeDesc =
        'ตรวจพบพนักงานมีชั่วโมงใน Daily Report แต่ไม่มีเวลาสแกนนิ้วรูดบัตร (ขาดสแกนนิ้ว)';
    } else if (currentStatus === 'DISCREPANCY') {
      beforeDesc = `ตรวจพบชั่วโมงการทำงานขัดแย้งกันระหว่าง Daily Report (${record?.dailyReportHours || 0} ชม.) และสแกนนิ้ว (${record?.scanDataHours || 0} ชม.)`;
    } else if (currentStatus === 'NO_DAILY_REPORT') {
      beforeDesc = `ตรวจพบข้อมูลการสแกนนิ้ว (${record?.scanDataHours || 0} ชม.) แต่โฟร์แมนไม่ได้ลงบันทึกใน Daily Report`;
    } else if (currentStatus === 'ABSENT') {
      beforeDesc = 'ไม่มีทั้งข้อมูลการสแกนนิ้วและ Daily Report ในระบบ';
    } else {
      beforeDesc = 'ระบบเริ่มต้นประมวลผลตรวจสอบความถูกต้องข้อมูลการลงเวลา';
    }

    afterTitle = 'สถานะเริ่มต้นระบบ';
    afterDesc = `ตั้งค่าสถานะอัตโนมัติเป็น [${getStatusLabel(currentStatus).text}] เพื่อรอการตรวจสอบและจัดการ`;
    return { beforeTitle, beforeDesc, afterTitle, afterDesc };
  }

  if (reason.includes('Admin ยืนยันตาม Daily Report')) {
    beforeTitle = 'ก่อนแก้ไข: ขาดเวลารูดบัตร';
    beforeDesc =
      'พนักงานไม่ได้สแกนนิ้ว/ลืมสแกน แต่มีหลักฐานยืนยันการปฏิบัติงานจริงในใบลงเวลา (Daily Report)';
    afterTitle = 'หลังแก้ไข: เติมสแกนนิ้วและอนุมัติ';
    afterDesc = `อนุมัติชั่วโมงทำงานตามข้อมูล Daily Report (${record?.dailyReportHours || 0} ชม.) และจำลอง/เติมเวลาสแกนนิ้วให้อัตโนมัติในประวัติเพื่อใช้ในการคิดเงิน`;
  } else if (reason.includes('Admin แก้ไขชั่วโมงด้วยตนเอง')) {
    beforeTitle = 'ก่อนแก้ไข: ชั่วโมงทำงานไม่สอดคล้องกัน';
    beforeDesc = `ข้อมูลชั่วโมงสแกนนิ้วจริงและรายงานของโฟร์แมนไม่ตรงกัน (Daily: ${record?.dailyReportHours || 0} ชม. vs Scan: ${record?.scanDataHours || 0} ชม.)`;
    afterTitle = 'หลังแก้ไข: ปรับชั่วโมงอนุมัติจริง';
    const totalApp = record?.totalApprovedHours || 0;
    const norm = record?.approvedNormalHours || 0;
    const otM = record?.approvedOtMorning || 0;
    const otN = record?.approvedOtNoon || 0;
    const otE = record?.approvedOtEvening || 0;
    const otTotal = otM + otN + otE;
    afterDesc = `แอดมินพิจารณาปรับยอดชั่วโมงอนุมัติจริงทั้งหมดเป็น ${totalApp} ชม. (ปกติ: ${norm} ชม., OT: ${otTotal} ชม.)`;
  } else if (reason.includes('Admin ลบ Ghost Scan')) {
    beforeTitle = 'ก่อนแก้ไข: มีข้อมูลรูดบัตรต้องสงสัย';
    beforeDesc = `มีข้อมูลรูดบัตร (${record?.scanDataHours || 0} ชม.) แต่ตรวจพบว่าไม่ได้มาปฏิบัติงานจริงในพื้นที่โครงการ (Ghost Scan)`;
    afterTitle = 'หลังแก้ไข: ลบสแกนนิ้วและลงขาดงาน';
    afterDesc =
      'ระบบทำการลบประวัติการสแกนนิ้วที่ผิดพลาดออกทั้งหมดตามคำสั่งแอดมิน และทำรายการบันทึกเป็นขาดงาน (ABSENT) ❌';
  } else if (currentEntry.changedBy === 'system') {
    beforeTitle = `ก่อนแก้ไข: สถานะเดิม [${getStatusLabel(prevStatus).text}]`;
    beforeDesc = 'ระบบจัดเก็บสถานะรอความถูกต้องของข้อมูลจากแหล่งต้นทาง';
    afterTitle = 'หลังแก้ไข: ประมวลผลสถานะใหม่';
    afterDesc = `ระบบอัปเดตและจำแนกสถานะเป็น [${getStatusLabel(currentStatus).text}] อัตโนมัติจากการนำเข้าข้อมูลใหม่`;
  } else {
    beforeTitle = `ก่อนแก้ไข: [${getStatusLabel(prevStatus).text}]`;
    beforeDesc = 'มีประวัติความขัดแย้ง/สถานะเก่าอยู่ในระบบ';
    afterTitle = `หลังแก้ไข: [${getStatusLabel(currentStatus).text}]`;
    afterDesc = `ได้รับการแก้ไขปรับปรุงสถานะเรียบร้อยแล้ว (${reason || note || 'ยืนยันความถูกต้อง'})`;
  }

  return { beforeTitle, beforeDesc, afterTitle, afterDesc };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AuditHistoryDrawerProps {
  /** Whether this drawer is visible (controls historyOpen && open) */
  open: boolean;
  onClose: () => void;
  dc: DCWageSummary | null;
  isLoading: boolean;
  historyRecords: any[];
}

export default function AuditHistoryDrawer({
  open,
  onClose,
  dc,
  isLoading,
  historyRecords,
}: AuditHistoryDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      hideBackdrop={true}
      variant="temporary"
      sx={{
        zIndex: 1400,
        pointerEvents: 'none',
      }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 480 },
          borderRadius: '16px 0 0 16px',
          boxShadow: '-10px 0 40px -10px rgba(0, 0, 0, 0.15)',
          borderLeft: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#fff',
          right: { xs: 0, sm: 550 }, // Position it side-by-side with the main drawer
          height: '100%',
          pointerEvents: 'auto',
        },
      }}
      ModalProps={{
        disableEnforceFocus: true,
        disableAutoFocus: true,
        disableScrollLock: true,
      }}
    >
      {/* Drawer Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          p: 3,
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={900}>
            🕒 ประวัติการแก้ไข Daily Report
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            รหัส: {dc?.employeeId} — {dc?.name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Drawer Content */}
      <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <LoadingSpinner />
          </Box>
        ) : historyRecords && historyRecords.length > 0 ? (
          <Stack spacing={4}>
            {historyRecords.map((rec: any, recIdx: number) => {
              const formattedWorkDate = new Date(rec.workDate).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });
              return (
                <Box
                  key={recIdx}
                  sx={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    p: 2,
                    bgcolor: '#f8fafc',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800,
                      color: 'primary.main',
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    📅 วันทำงาน: {formattedWorkDate}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={3}>
                    {buildEventTimeline(rec, dc)}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Typography
            variant="body2"
            sx={{ color: '#64748b', py: 2, fontStyle: 'italic', fontWeight: 600 }}
          >
            ยังไม่มีการบันทึกประวัติการแก้ไขข้อมูล Daily Report ย้อนหลังจากระบบ Aftersale
            สำหรับพนักงานคนนี้ในงวดเวลานี้
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Timeline builder — extracted from inline IIFE to a named function
// ---------------------------------------------------------------------------

function buildEventTimeline(rec: any, dc: DCWageSummary | null) {
  const events: any[] = [];

  // 1. Foreman edits
  if (rec.dailyReportHistory) {
    rec.dailyReportHistory.forEach((hist: any) => {
      events.push({
        type: 'foreman_edit',
        timestamp: new Date(hist.editedAt),
        by: hist.editedBy,
        data: hist,
      });
    });
  }

  // 2. Admin / system status updates
  if (rec.statusHistory) {
    rec.statusHistory.forEach((hist: any) => {
      events.push({
        type: 'admin_status',
        timestamp: new Date(hist.changedAt),
        by: hist.changedBy,
        data: hist,
      });
    });
  }

  // Sort chronologically (newest first)
  const sortedEvents = events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (sortedEvents.length === 0) return null;

  return sortedEvents.map((event: any, index: number) => {
    const formattedDate = event.timestamp.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (event.type === 'foreman_edit') {
      return <ForemanEditEvent key={index} event={event} formattedDate={formattedDate} dc={dc} />;
    } else {
      return (
        <AdminStatusEvent
          key={index}
          event={event}
          formattedDate={formattedDate}
          rec={rec}
        />
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Sub-components for timeline events
// ---------------------------------------------------------------------------

function ForemanEditEvent({
  event,
  formattedDate,
  dc,
}: {
  event: any;
  formattedDate: string;
  dc: DCWageSummary | null;
}) {
  const hist = event.data;
  const filteredLabor = (hist.snapshot?.labor || []).filter(
    (lab: any) =>
      lab.employeeId === dc?.employeeId ||
      lab.workerId === `DC-${dc?.employeeId}` ||
      lab.workerId === dc?.employeeId
  );

  return (
    <Box
      sx={{
        borderLeft: '2px solid #0288d1',
        pl: 2.5,
        pb: 0.5,
        position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: -6,
          top: 4,
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: '#0288d1',
        }}
      />
      <Typography
        variant="body2"
        fontWeight={800}
        sx={{ color: '#1e293b', mb: 0.5, fontSize: '0.8rem' }}
      >
        [{formattedDate}] แก้ไขโดย Foreman รหัส: {event.by}
      </Typography>

      <Box
        sx={{
          bgcolor: '#fff',
          p: 1.5,
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          mt: 1,
        }}
      >
        <Typography
          variant="caption"
          fontWeight={750}
          color="text.secondary"
          sx={{ display: 'block', mb: 1 }}
        >
          ชั่วโมงทำงานดิบในอดีต (Snapshot ก่อนแก้ไข):
        </Typography>
        <Box sx={{ pl: 1 }}>
          {filteredLabor.length > 0 ? (
            filteredLabor.map((lab: any, lIdx: number) => {
              const showNormal = lab.shifts?.normal
                ? `ปกติ (${lab.shiftTimes?.day || '08:00 - 17:00'})`
                : null;
              const showOtMorning = lab.shifts?.otMorning
                ? `OT เช้า (${lab.shiftTimes?.otMorning || '05:00 - 08:00'})`
                : null;
              const showOtNoon = lab.shifts?.otNoon
                ? `OT กลางวัน (${lab.shiftTimes?.otNoon || '12:00 - 13:00'})`
                : null;
              const showOtEvening = lab.shifts?.otEvening
                ? `OT เย็น (${lab.shiftTimes?.otEvening || '18:00 - 21:00'})`
                : null;
              const shiftDetails = [showNormal, showOtMorning, showOtNoon, showOtEvening]
                .filter(Boolean)
                .join(', ');
              return (
                <Typography
                  key={lIdx}
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontWeight: 650,
                    color: '#334155',
                    fontSize: '0.75rem',
                    mb: 0.5,
                  }}
                >
                  • {lab.workerName || lab.employeeId}:{' '}
                  {shiftDetails || 'ไม่มีการลงเวลากะทำงาน'}
                </Typography>
              );
            })
          ) : (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontStyle: 'italic',
                color: '#64748b',
                fontWeight: 600,
              }}
            >
              {hist.snapshot?.labor && hist.snapshot.labor.length > 0
                ? '• พนักงานท่านนี้ยังไม่มีชื่อในระบบก่อนการแก้ไข (เพิ่งถูกเพิ่มชื่อเข้าทำงานใหม่)'
                : '• ไม่มีข้อมูล Snapshot ของพนักงาน'}
            </Typography>
          )}

          {hist.snapshot?.leave &&
            hist.snapshot.leave.length > 0 &&
            hist.snapshot.leave
              .filter(
                (lv: any) =>
                  lv.employeeId === dc?.employeeId ||
                  lv.workerId === `DC-${dc?.employeeId}` ||
                  lv.workerId === dc?.employeeId
              )
              .map((lv: any, lvIdx: number) => (
                <Typography
                  key={lvIdx}
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontWeight: 650,
                    color: '#b45309',
                    fontSize: '0.75rem',
                  }}
                >
                  • แจ้งลา ({lv.leaveType || 'ลางาน'}):{' '}
                  {lv.leaveTimes?.custom || '08:00 - 17:00'}{' '}
                  {lv.medCertFileUrl ? '(แนบใบรับรองแพทย์ 📄)' : ''}
                </Typography>
              ))}
        </Box>
      </Box>
    </Box>
  );
}

function AdminStatusEvent({
  event,
  formattedDate,
  rec,
}: {
  event: any;
  formattedDate: string;
  rec: any;
}) {
  const hist = event.data;
  const isSystem = event.by === 'system';
  const histIndex = rec?.statusHistory ? rec.statusHistory.indexOf(hist) : -1;
  const prevEntry = histIndex > 0 ? rec.statusHistory[histIndex - 1] : null;
  const prevStatus = prevEntry ? prevEntry.status : null;
  const currentStatus = hist.status;
  const audit = getAuditDetails(hist, prevEntry, rec);

  const statusLabelBefore = prevStatus ? getStatusLabel(prevStatus) : null;
  const statusLabelAfter = getStatusLabel(currentStatus);

  return (
    <Box
      sx={{
        borderLeft: `2px solid ${isSystem ? '#64748b' : '#2e7d32'}`,
        pl: 2.5,
        pb: 0.5,
        position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: -6,
          top: 4,
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: isSystem ? '#64748b' : '#2e7d32',
        }}
      />
      <Typography
        variant="body2"
        fontWeight={800}
        sx={{
          color: isSystem ? '#64748b' : '#2e7d32',
          mb: 0.5,
          fontSize: '0.8rem',
        }}
      >
        [{formattedDate}]{' '}
        {isSystem
          ? 'ประมวลผลโดย ระบบ (System)'
          : `ยืนยัน/แก้ไขสถานะโดย Admin รหัส: ${event.by}`}
      </Typography>

      <Box
        sx={{
          bgcolor: isSystem ? '#f8fafc' : '#f4fbf7',
          p: 2,
          borderRadius: '12px',
          border: `1px solid ${isSystem ? '#e2e8f0' : '#e8f5e9'}`,
          mt: 1,
        }}
      >
        <Typography
          variant="caption"
          fontWeight={750}
          color={isSystem ? 'text.secondary' : '#1b5e20'}
          sx={{ display: 'block', mb: 1, fontSize: '0.8rem' }}
        >
          ⚙️ การบันทึกและประเมินผลการทำ Audit:
        </Typography>

        {/* Status Transition Badge Flow */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            my: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="caption" fontWeight={750} color="text.secondary">
            เส้นทางสถานะ:
          </Typography>
          {statusLabelBefore ? (
            <StatusBadge style={statusLabelBefore} />
          ) : (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1,
                py: 0.25,
                borderRadius: '4px',
                bgcolor: '#f3f4f6',
                color: '#6b7280',
                border: '1px solid #e5e7eb',
                fontSize: '0.7rem',
                fontWeight: 800,
              }}
            >
              เริ่มต้น
            </Box>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900 }}>
            ➔
          </Typography>
          <StatusBadge style={statusLabelAfter} />
        </Box>

        {/* Side-by-Side Audit Card Diff */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            mt: 1.5,
          }}
        >
          <AuditCard
            title={`⏪ ${audit.beforeTitle}`}
            description={audit.beforeDesc}
            titleColor="#b45309"
            descColor="#78350f"
            borderColor="#fef3c7"
            bgColor="#fffbeb"
            accentColor="#d97706"
          />
          <AuditCard
            title={`⏩ ${audit.afterTitle}`}
            description={audit.afterDesc}
            titleColor="#047857"
            descColor="#065f46"
            borderColor="#d1fae5"
            bgColor="#ecfdf5"
            accentColor="#059669"
          />
        </Box>

        {/* Additional System Notes */}
        {(hist.note || hist.reason) && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
            {hist.reason && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontStyle: 'italic',
                  color: '#64748b',
                  fontSize: '0.7rem',
                }}
              >
                เหตุผลประกอบ: {hist.reason}
              </Typography>
            )}
            {hist.note && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontStyle: 'italic',
                  color: '#475569',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  mt: 0.5,
                }}
              >
                บันทึกเพิ่มเติม: {hist.note}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function StatusBadge({ style }: { style: StatusStyle }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: '4px',
        bgcolor: style.bgColor,
        color: style.color,
        border: `1px solid ${style.borderColor}`,
        fontSize: '0.7rem',
        fontWeight: 800,
      }}
    >
      {style.text}
    </Box>
  );
}

function AuditCard({
  title,
  description,
  titleColor,
  descColor,
  borderColor,
  bgColor,
  accentColor,
}: {
  title: string;
  description: string;
  titleColor: string;
  descColor: string;
  borderColor: string;
  bgColor: string;
  accentColor: string;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        background: bgColor,
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      <Typography
        variant="caption"
        fontWeight={850}
        color={titleColor}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mb: 0.5,
          fontSize: '0.72rem',
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="caption"
        color={descColor}
        sx={{
          display: 'block',
          fontWeight: 650,
          fontSize: '0.75rem',
          lineHeight: 1.4,
        }}
      >
        {description}
      </Typography>
    </Box>
  );
}
