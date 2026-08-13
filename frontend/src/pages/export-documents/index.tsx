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
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  PictureAsPdf as PictureAsPdfIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  type SavedDailyReport,
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
  const queryClient = useQueryClient();

  const projectCodes = useMemo(() => user?.projectLocationIds ?? [], [user]);
  const lockedProject = projectCodes.length === 1 ? projectCodes[0] : '';

  const [projectId, setProjectId] = useState<string>(lockedProject);
  const [date, setDate] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  // [T-060] The previously-saved record for this project+date (or null). Drives
  // the preselect (remember which photos were chosen) + the "download original".
  const { data: saved, isLoading: isSavedLoading } = useQuery<SavedDailyReport | null>({
    queryKey: ['daily-report-saved', projectId, dateKey],
    queryFn: () => exportDocumentService.getSaved(projectId, dateKey),
    enabled: canQuery,
  });

  // Flat list of every photo in the doc (grouping is kept for display below).
  const allPhotoIds = useMemo(() => {
    if (!doc) return [];
    return doc.groups.flatMap((g) => g.entries.flatMap((e) => e.photos.map((p) => p.id)));
  }, [doc]);

  // [T-060] Preselect: if this day was saved before, restore that selection
  // (dropping any photo ids that no longer exist in the doc); otherwise fall
  // back to selecting every photo. Wait for the saved record to settle first so
  // the checkboxes don't flash all-selected → saved-selection.
  useEffect(() => {
    if (isSavedLoading) return;
    if (allPhotoIds.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    if (saved && Array.isArray(saved.selectedPhotoIds)) {
      const available = new Set(allPhotoIds);
      setSelectedIds(new Set(saved.selectedPhotoIds.filter((id) => available.has(id))));
    } else {
      setSelectedIds(new Set(allPhotoIds));
    }
  }, [allPhotoIds, saved, isSavedLoading]);

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
      // Show the freshly generated PDF in a preview dialog instead of
      // downloading straight away — the user reviews it, then downloads from
      // there. Revoke any previous preview blob first to avoid a memory leak.
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
      showSuccess('สร้าง PDF สำเร็จ');
      // The generate call also persisted the record → refresh it so the
      // "ดาวน์โหลดไฟล์เดิม" button appears without needing a page reload.
      queryClient.invalidateQueries({ queryKey: ['daily-report-saved', projectId, dateKey] });
    } catch (err: any) {
      showError(err?.message || 'สร้าง PDF ไม่สำเร็จ');
    } finally {
      setIsGenerating(false);
    }
  };

  // Download the PDF shown in the preview dialog — reuses the already-generated
  // blob (no second server call, no re-generate).
  const handleDownloadFromPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `daily-report_${projectId}_${dateKey}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleClosePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewOpen(false);
  };

  // [T-060] Download the exact file saved earlier — no regeneration.
  const handleDownloadOriginal = async () => {
    if (!canQuery) return;
    setIsDownloading(true);
    try {
      const blob = await exportDocumentService.downloadOriginal(projectId, dateKey);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-report_${projectId}_${dateKey}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showSuccess('ดาวน์โหลดไฟล์เดิมสำเร็จ');
    } catch (err: any) {
      showError(err?.message || 'ไม่พบไฟล์เดิม');
    } finally {
      setIsDownloading(false);
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

          <Box sx={{ flex: '0 0 auto', display: 'flex', gap: 1.5 }}>
            {saved?.hasFile && (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                disabled={!canQuery || isDownloading}
                onClick={handleDownloadOriginal}
                sx={{ height: 42, px: 3, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
              >
                {isDownloading ? 'กำลังโหลด...' : 'ดาวน์โหลดไฟล์เดิม'}
              </Button>
            )}
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
                          position: 'relative',
                          cursor: 'pointer',
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: isSelected ? '3px solid #1976d2' : '3px solid transparent',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          opacity: isSelected ? 1 : 0.55,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && (
                          <CheckCircleIcon
                            sx={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              zIndex: 1,
                              fontSize: 24,
                              color: '#1976d2',
                              bgcolor: 'white',
                              borderRadius: '50%',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                            }}
                          />
                        )}
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
      {/* [S2] Preview the generated PDF before downloading */}
      <Dialog open={previewOpen} onClose={handleClosePreview} fullScreen>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            ตัวอย่างเอกสาร
          </Typography>
          <IconButton onClick={handleClosePreview} size="small" aria-label="ปิด">
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />
        <DialogContent sx={{ p: 0, flex: 1 }}>
          {previewUrl && (
            <iframe
              src={previewUrl}
              title="ตัวอย่าง PDF"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={handleClosePreview} sx={{ textTransform: 'none' }}>
            ปิด
          </Button>
          <Button
            onClick={handleDownloadFromPreview}
            variant="contained"
            startIcon={<DownloadIcon />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            ดาวน์โหลด
          </Button>
        </DialogActions>
      </Dialog>
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
