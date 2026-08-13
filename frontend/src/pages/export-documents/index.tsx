/**
 * Export Documents Page (T-058)
 * หน้า "ออกเอกสาร" — AM/LD ออกรายงานประจำวัน (PDF) จากรูป+ความคืบหน้าที่บันทึกไว้
 *
 * Flow: เลือกโครงการ (ล็อกให้ถ้ามีโครงการเดียว) -> เลือกวันที่ย้อนหลัง ->
 *       เลือกรูปที่จะใส่ (จัดกลุ่มตามหมวดงาน) -> สร้าง PDF -> ดาวน์โหลด
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import { PictureAsPdf as PictureAsPdfIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

import { Layout, ProtectedRoute } from '@/components/layout';
import { ProjectSelect } from '@/components/forms/ProjectSelect';
import { DatePicker } from '@/components/forms/DatePicker';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';
import {
  exportDocumentService,
  type ExportDailyReportDoc,
  type ExportPhoto,
} from '@/services/exportDocumentService';

const BANGKOK_TZ = 'Asia/Bangkok';

/** DatePicker stores UTC; convert back to the Bangkok calendar day the user picked. */
function toDateKey(d: Date | null): string {
  if (!d) return '';
  return format(toZonedTime(d, BANGKOK_TZ), 'yyyy-MM-dd');
}

function ExportDocumentsContent() {
  const { user } = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();

  const projectCodes = useMemo(() => user?.projectLocationIds ?? [], [user]);
  const lockedProject = projectCodes.length === 1 ? projectCodes[0] : '';

  const [projectId, setProjectId] = useState<string>(lockedProject);
  const [date, setDate] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  // Keep the locked project applied once the user record resolves.
  useEffect(() => {
    if (lockedProject && !projectId) setProjectId(lockedProject);
  }, [lockedProject, projectId]);

  const dateKey = toDateKey(date);
  const canQuery = Boolean(projectId && dateKey);

  const {
    data: doc,
    isLoading,
    isError,
  } = useQuery<ExportDailyReportDoc>({
    queryKey: ['daily-report-doc', projectId, dateKey],
    queryFn: () => exportDocumentService.getDailyReportDoc(projectId, dateKey),
    enabled: canQuery,
  });

  // Flat list of every photo in the doc (grouping is kept for display below).
  const allPhotoIds = useMemo(() => {
    if (!doc) return [];
    return doc.groups.flatMap((g) => g.entries.flatMap((e) => e.photos.map((p) => p.id)));
  }, [doc]);

  // Default: select every photo when a new day loads.
  useEffect(() => {
    setSelectedIds(new Set(allPhotoIds));
  }, [allPhotoIds]);

  const togglePhoto = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allPhotoIds));
  const clearAll = () => setSelectedIds(new Set());

  const handleGenerate = async () => {
    if (!canQuery) return;
    setIsGenerating(true);
    try {
      const blob = await exportDocumentService.generatePdf(
        projectId,
        dateKey,
        Array.from(selectedIds)
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-report_${projectId}_${dateKey}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showSuccess('สร้าง PDF สำเร็จ');
    } catch (err: any) {
      showError(err?.message || 'สร้าง PDF ไม่สำเร็จ');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasPhotos = allPhotoIds.length > 0;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: '#1a333c', mb: 0.5 }}>
          ออกเอกสาร
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          สร้างรายงานประจำวัน (PDF) จากรูปและความคืบหน้าที่บันทึกไว้ในวันที่เลือก
        </Typography>
      </Box>

      {/* Controls */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1, minWidth: { xs: '100%', md: 260 } }}>
            {lockedProject ? (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  โครงการ
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {lockedProject}
                </Typography>
              </Box>
            ) : (
              <ProjectSelect
                label="เลือกโครงการ"
                value={projectId}
                onChange={(v) => setProjectId(Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))}
                fullWidth
              />
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: { xs: '100%', md: 220 } }}>
            <DatePicker label="เลือกวันที่ (ย้อนหลัง)" value={date} onChange={setDate} disableFuture />
          </Box>

          <Box sx={{ flex: '0 0 auto' }}>
            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              disabled={!canQuery || isGenerating || isLoading}
              onClick={handleGenerate}
              sx={{ height: 42, px: 3, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              {isGenerating ? 'กำลังสร้าง...' : 'สร้าง PDF'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Photo selection */}
      {!canQuery && (
        <Alert severity="info">เลือกโครงการและวันที่เพื่อดูรูปที่บันทึกไว้</Alert>
      )}

      {canQuery && isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <LoadingSpinner size="large" />
        </Box>
      )}

      {canQuery && isError && (
        <Alert severity="error">โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง</Alert>
      )}

      {canQuery && !isLoading && !isError && doc && !hasPhotos && (
        <Alert severity="warning">ไม่พบรูปในรายงานของวันที่เลือก (ยังสร้าง PDF ตารางงานได้)</Alert>
      )}

      {canQuery && !isLoading && !isError && doc && hasPhotos && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              เลือกรูปที่จะใส่ในเอกสาร ({selectedIds.size}/{allPhotoIds.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={selectAll}>เลือกทั้งหมด</Button>
              <Button size="small" color="inherit" onClick={clearAll}>ล้างที่เลือก</Button>
            </Box>
          </Box>

          {doc.groups.map((group) => {
            const photos: ExportPhoto[] = group.entries.flatMap((e) => e.photos);
            if (photos.length === 0) return null;
            return (
              <Box key={group.categoryId || group.categoryName} sx={{ mb: 3 }}>
                <Divider sx={{ mb: 1.5 }}>
                  <Chip label={`หมวดงาน: ${group.categoryName}`} size="small" color="primary" />
                </Divider>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(4,1fr)' },
                    gap: 2,
                  }}
                >
                  {photos.map((p) => {
                    const isSelected = selectedIds.has(p.id);
                    return (
                      <Box
                        key={p.id}
                        onClick={() => togglePhoto(p.id)}
                        sx={{
                          cursor: 'pointer',
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: isSelected ? '3px solid #FF7F32' : '3px solid transparent',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          opacity: isSelected ? 1 : 0.55,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: 120,
                            backgroundImage: `url(${p.url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            bgcolor: '#f0f0f0',
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            p: 0.75,
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={p.caption}
                        >
                          {p.caption}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Paper>
      )}
    </Container>
  );
}

export default function ExportDocumentsPage() {
  return (
    <ProtectedRoute requiredRoles={['AM', 'LD']}>
      <Layout>
        <ExportDocumentsContent />
      </Layout>
    </ProtectedRoute>
  );
}
