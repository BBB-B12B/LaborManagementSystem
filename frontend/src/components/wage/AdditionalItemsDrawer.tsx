/**
 * AdditionalItemsDrawer
 * Drawer จัดการรายได้/รายจ่ายเพิ่มเติม + แสดงใบแจ้งค่าแรงจำลอง
 *
 * Extracted from wage-calculation/[id].tsx (P1 refactor)
 * The AuditHistoryDrawer (side-by-side) is now a separate component.
 */

import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Close, History } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { wageService, type DCWageSummary } from '../../services/wageService';
import { reconciliationService } from '../../services/reconciliationService';
import { useToast } from '../../components/common/Toast';
import AuditHistoryDrawer from './AuditHistoryDrawer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdditionalItemsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Selected DC wage summary row */
  dc: DCWageSummary | null;
  /** The parent wage period object */
  period: any | null;
  /** Called after a successful add operation so the parent can refetch */
  onUpdate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdditionalItemsDrawer({
  open,
  onClose,
  dc,
  period,
  onUpdate,
}: AdditionalItemsDrawerProps) {
  const periodId = period?.id;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  const [activeTab, setActiveTab] = React.useState(0);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  // Form state for Add Item dialog — replaces blocking window.prompt()
  const [addForm, setAddForm] = React.useState<{
    open: boolean;
    type: 'income' | 'expense';
    desc: string;
    amount: string;
  }>({ open: false, type: 'income', desc: '', amount: '' });
  const [addFormError, setAddFormError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // -----------------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------------

  // เมื่อ Drawer แม่ปิดลง ให้ปิด Drawer ลูก (History Drawer) ตามไปด้วยแบบแม่ลูก
  React.useEffect(() => {
    if (!open) {
      setHistoryOpen(false);
    }
  }, [open]);

  // -----------------------------------------------------------------------
  // Data
  // -----------------------------------------------------------------------

  const { success: showSuccess, error: showError } = useToast();

  // Fetch reconciliation records for this employee within the period dates
  // to get daily report edit histories
  const { data: reconHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['reconciliationHistory', dc?.employeeId, period?.id],
    queryFn: async () => {
      if (!dc?.employeeId || !period) return [];
      const start =
        period.startDate instanceof Date
          ? period.startDate.toISOString().split('T')[0]
          : String(period.startDate).split('T')[0];
      const end =
        period.endDate instanceof Date
          ? period.endDate.toISOString().split('T')[0]
          : String(period.endDate).split('T')[0];
      const res = await reconciliationService.getRecords({
        employeeId: dc.employeeId,
        startDate: start,
        endDate: end,
        pageSize: 100,
      });
      return res.records || [];
    },
    enabled: open && !!dc?.employeeId && !!period,
  });

  // Filter records that have edit history
  const historyRecords = React.useMemo(() => {
    if (!reconHistory) return [];
    return reconHistory.filter(
      (rec: any) =>
        (rec.dailyReportHistory && rec.dailyReportHistory.length > 0) ||
        (rec.statusHistory && rec.statusHistory.length > 0)
    );
  }, [reconHistory]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleAdd = (type: 'income' | 'expense') => {
    setAddForm({ open: true, type, desc: '', amount: '' });
    setAddFormError('');
  };

  const handleAddSubmit = async () => {
    if (!addForm.desc.trim()) {
      setAddFormError('กรุณาระบุรายละเอียด');
      return;
    }
    const amountNum = Number(addForm.amount);
    if (!addForm.amount || isNaN(amountNum) || amountNum <= 0) {
      setAddFormError('กรุณาระบุจำนวนเงินที่ถูกต้อง (ต้องมากกว่า 0)');
      return;
    }
    setIsSubmitting(true);
    try {
      if (addForm.type === 'income') {
        await wageService.addAdditionalIncome(periodId, {
          dailyContractorId: dc!.dailyContractorId,
          wagePeriodId: periodId,
          incomeType: 'อื่นๆ',
          description: addForm.desc.trim(),
          amount: amountNum,
        });
      } else {
        await wageService.addAdditionalExpense(periodId, {
          dailyContractorId: dc!.dailyContractorId,
          wagePeriodId: periodId,
          expenseType: 'อื่นๆ',
          description: addForm.desc.trim(),
          amount: amountNum,
        });
      }
      showSuccess('เพิ่มรายการสำเร็จ กรุณากดคำนวณใหม่');
      setAddForm((prev) => ({ ...prev, open: false }));
      onUpdate();
    } catch (err: any) {
      showError('ไม่สามารถเพิ่มรายการได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Early exit
  // -----------------------------------------------------------------------

  if (!dc) return null;

  // Welfare cost breakdown (used in payroll slip display)
  const refrigerator = dc.refrigeratorCost || 0;
  const soundSystem = dc.soundSystemCost || 0;
  const tv = dc.tvCost || 0;
  const washingMachine = dc.washingMachineCost || 0;
  const portableAc = dc.portableAcCost || 0;
  const follower = dc.followerAccommodation || 0;
  const totalWelfare = refrigerator + soundSystem + tv + washingMachine + portableAc + follower;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <>
      {/* ================================================================
          Main Drawer — Payroll Slip + Additional Items Management
          ================================================================ */}
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 550 },
            boxSizing: 'border-box',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
        }}
      >
        {/* Drawer Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              รายละเอียดค่าแรงรายคน
            </Typography>
            <Typography variant="body2" color="text.secondary">
              รหัส DC: {dc.employeeId} | {dc.name}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <IconButton
              onClick={() => setHistoryOpen(!historyOpen)}
              sx={{
                color: 'primary.main',
                backgroundColor: historyOpen ? 'rgba(25, 118, 210, 0.15)' : 'rgba(0, 0, 0, 0.04)',
                border: '1px solid rgba(25, 118, 210, 0.25)',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.25)',
                },
                width: 40,
                height: 40,
                borderRadius: '8px',
                transition: 'all 0.2s',
              }}
              title="ประวัติการแก้ไข Daily Report"
            >
              <History sx={{ fontSize: 22 }} />
            </IconButton>
            <IconButton onClick={onClose} color="error" size="medium">
              <Close />
            </IconButton>
          </Stack>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Main Drawer Content (Scrollable) */}
        <Box sx={{ flex: 1, overflowY: 'auto', pr: 1, mb: 2 }}>
          {/* Mock Payroll Slip Section */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 3,
              borderColor: '#e0e0e0',
              borderRadius: '12px',
              background: '#fafafa',
            }}
          >
            <Typography
              variant="subtitle2"
              align="center"
              sx={{
                fontWeight: 'bold',
                letterSpacing: 1,
                color: 'text.secondary',
                mb: 2,
                textTransform: 'uppercase',
              }}
            >
              📋 ใบแจ้งรายละเอียดยอดค่าแรงจำลอง
            </Typography>

            <Grid container spacing={2}>
              {/* 1. Income columns (Green) */}
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: '#E8F5E9',
                    borderRadius: '8px',
                    height: '100%',
                    borderLeft: '4px solid #4CAF50',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 'bold', color: '#2E7D32', mb: 1.5 }}
                  >
                    ➕ รายรับทั้งหมด
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        ค่าแรงปกติ ({dc.regularDays.toFixed(2)} วัน):
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {dc.regularWages.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        ค่าแรงโอที ({dc.totalOtHours.toFixed(2)} ชม.):
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {dc.otWages.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        ค่าวิชาชีพ:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {dc.professionalFees.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        ค่าโทรศัพท์:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {dc.phoneAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                    {dc.additionalIncome > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          รายได้เสริมอื่น ๆ:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'success.main' }}>
                          +
                          {dc.additionalIncome.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ my: 1, borderColor: 'rgba(0,0,0,0.06)' }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1B5E20' }}>
                        รวมรายได้:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1B5E20' }}>
                        {dc.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>

              {/* 2. Deductions columns (Orange/Red) */}
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: '#FFF3E0',
                    borderRadius: '8px',
                    height: '100%',
                    borderLeft: '4px solid #FF9800',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 'bold', color: '#E65100', mb: 1.5 }}
                  >
                    ➖ รายจ่าย / รายการหัก
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        ค่าที่พัก:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {dc.accommodationCost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </Typography>
                    </Box>

                    {/* Itemized Welfare/Appliance Rentals */}
                    {totalWelfare > 0 && (
                      <Box sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 1, borderRadius: '4px' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 'bold', color: 'text.secondary' }}
                          >
                            หักเช่าอุปกรณ์/ผู้ติดตาม:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                            {totalWelfare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box sx={{ pl: 1, display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                          {refrigerator > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">
                                • ค่าตู้เย็น:
                              </Typography>
                              <Typography variant="caption">
                                {refrigerator.toLocaleString()} ฿
                              </Typography>
                            </Box>
                          )}
                          {portableAc > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">
                                • ค่าแอร์เคลื่อนที่:
                              </Typography>
                              <Typography variant="caption">
                                {portableAc.toLocaleString()} ฿
                              </Typography>
                            </Box>
                          )}
                          {tv > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">
                                • ค่าทีวี:
                              </Typography>
                              <Typography variant="caption">{tv.toLocaleString()} ฿</Typography>
                            </Box>
                          )}
                          {washingMachine > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">
                                • ค่าเครื่องซักผ้า:
                              </Typography>
                              <Typography variant="caption">
                                {washingMachine.toLocaleString()} ฿
                              </Typography>
                            </Box>
                          )}
                          {soundSystem > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">
                                • ค่าเครื่องเสียง:
                              </Typography>
                              <Typography variant="caption">
                                {soundSystem.toLocaleString()} ฿
                              </Typography>
                            </Box>
                          )}
                          {follower > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">
                                • ค่าผู้ติดตาม:
                              </Typography>
                              <Typography variant="caption">
                                {follower.toLocaleString()} ฿
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}

                    {dc.lateDeductions > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          หักมาสาย ({dc.penaltyMinutes} นาที):
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'error.main' }}>
                          -
                          {dc.lateDeductions.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        ประกันสังคม:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {dc.socialSecurityDeduction.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </Typography>
                    </Box>
                    {dc.additionalExpenses > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          รายจ่ายเพิ่มเติมอื่น ๆ:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'error.main' }}>
                          -
                          {dc.additionalExpenses.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ my: 1, borderColor: 'rgba(0,0,0,0.06)' }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#E65100' }}>
                        รวมรายจ่าย:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#E65100' }}>
                        {dc.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {/* 3. Highlighted Net Wages */}
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                bgcolor: dc.netWages >= 0 ? '#E1F5FE' : '#FFEBEE',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid',
                borderColor: dc.netWages >= 0 ? '#0288D1' : '#D32F2F',
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                💰 ค่าแรงสุทธิรับจริง
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 'bold',
                  color: dc.netWages >= 0 ? '#0288D1' : '#D32F2F',
                  mt: 0.5,
                }}
              >
                {dc.netWages.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                ฿
              </Typography>
            </Box>
          </Paper>

          <Divider sx={{ mb: 2 }} />

          {/* Management Tab for Additionals */}
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1.5 }}>
            ⚙️ จัดการรายการเพิ่มเติมย้อนหลัง
          </Typography>

          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label="รายได้เพิ่มเติม" />
            <Tab label="รายจ่ายเพิ่มเติม" />
          </Tabs>

          {activeTab === 0 && (
            <Box sx={{ p: 1 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleAdd('income')}
                sx={{
                  mb: 2,
                  backgroundColor: '#2E7D32',
                  '&:hover': { backgroundColor: '#1B5E20' },
                }}
              >
                เพิ่มรายได้
              </Button>
              <Typography variant="body2" color="text.secondary">
                จำนวนรายได้เสริม: {dc.additionalIncome > 0 ? `${dc.additionalIncome.toLocaleString()} ฿` : 'ยังไม่มีรายการ'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                * รายการรายได้เพิ่มเติมจะถูกคำนวณในการทำจ่ายยอดรวมเมื่องกด &quot;คำนวณใหม่&quot;
              </Typography>
            </Box>
          )}
          {activeTab === 1 && (
            <Box sx={{ p: 1 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleAdd('expense')}
                sx={{
                  mb: 2,
                  backgroundColor: '#D84315',
                  '&:hover': { backgroundColor: '#BF360C' },
                }}
              >
                เพิ่มรายจ่าย
              </Button>
              <Typography variant="body2" color="text.secondary">
                จำนวนรายจ่ายเพิ่มเติม: {dc.additionalExpenses > 0 ? `${dc.additionalExpenses.toLocaleString()} ฿` : 'ยังไม่มีรายการ'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                * รายการหักรายจ่ายเพิ่มเติมจะถูกคำนวณในการทำจ่ายยอดรวมเมื่องกด
                &quot;คำนวณใหม่&quot;
              </Typography>
            </Box>
          )}
        </Box>

        {/* Footer Close Button */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            pt: 2,
            borderTop: '1px solid #e0e0e0',
          }}
        >
          <Button
            onClick={onClose}
            variant="outlined"
            color="error"
            sx={{ borderRadius: '8px', px: 4 }}
          >
            ปิด
          </Button>
        </Box>
      </Drawer>

      {/* ================================================================
          Side-by-side History Drawer (extracted to AuditHistoryDrawer)
          ================================================================ */}
      <AuditHistoryDrawer
        open={historyOpen && open && !!dc}
        onClose={() => setHistoryOpen(false)}
        dc={dc}
        isLoading={isHistoryLoading}
        historyRecords={historyRecords}
      />

      {/* ================================================================
          Add Item Form Dialog — replaces blocking window.prompt()
          ================================================================ */}
      <Dialog
        open={addForm.open}
        onClose={() => !isSubmitting && setAddForm((prev) => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {addForm.type === 'income' ? '➕ เพิ่มรายได้เสริม' : '➖ เพิ่มรายจ่ายเพิ่มเติม'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={addForm.type === 'income' ? 'รายละเอียดรายได้' : 'รายละเอียดรายจ่าย'}
              value={addForm.desc}
              onChange={(e) => setAddForm((prev) => ({ ...prev, desc: e.target.value }))}
              fullWidth
              required
              autoFocus
              placeholder="เช่น โบนัสพิเศษ, ค่าน้ำมัน ฯลฯ"
            />
            <TextField
              label="จำนวนเงิน (บาท)"
              value={addForm.amount}
              onChange={(e) => setAddForm((prev) => ({ ...prev, amount: e.target.value }))}
              fullWidth
              required
              type="number"
              inputProps={{ min: 0.01, step: 0.01 }}
              placeholder="0.00"
            />
            {addFormError && (
              <Typography variant="caption" color="error">
                ⚠️ {addFormError}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setAddForm((prev) => ({ ...prev, open: false }))}
            variant="outlined"
            color="inherit"
            disabled={isSubmitting}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleAddSubmit}
            variant="contained"
            color={addForm.type === 'income' ? 'success' : 'error'}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} /> : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
