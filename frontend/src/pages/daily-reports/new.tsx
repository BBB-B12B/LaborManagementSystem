/**
 * Work Record Composer Page
 * หน้าบันทึกการทำงานรายวัน (รองรับงานปกติและ OT ภายในการ์ดเดียว)
 *
 * Users can add multiple work cards, each designated as either regular hours or OT.
 */

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  MenuItem,
  Divider,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { Layout, ProtectedRoute } from '@/components/layout';
import { BackButton } from '@/components/common/BackButton';
import { DailyReportForm } from './components/DailyReportForm';
import { OvertimeForm } from '@/pages/overtime/components/OvertimeForm';
import { dailyReportService } from '@/services/dailyReportService';
import { overtimeService } from '@/services/overtimeService';
import { type DailyReportFormData } from '@/validation/dailyReportSchema';
import { type OvertimeFormData } from '@/validation/overtimeSchema';

type CardType = 'regular' | 'ot';

interface WorkCardConfig {
  id: string;
  type: CardType;
}

interface WorkCardProps {
  card: WorkCardConfig;
  index: number;
  onTypeChange: (cardId: string, type: CardType) => void;
  onRemove: (cardId: string) => void;
  onSuccess: (cardId: string, type: CardType) => void;
}

const createCardId = () => `card-${Math.random().toString(16).slice(2, 10)}-${Date.now()}`;

const RegularWorkCard: React.FC<{
  cardId: string;
  onRemove: () => void;
  onSuccess: () => void;
}> = ({ cardId, onRemove, onSuccess }) => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: DailyReportFormData) => dailyReportService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-records'] });
      queryClient.invalidateQueries({ queryKey: ['dailyReports'] });
      onSuccess();
    },
  });

  const handleSubmit = async (data: DailyReportFormData) => {
    await createMutation.mutateAsync(data);
  };

  return (
    <DailyReportForm
      key={`${cardId}-regular`}
      mode="create"
      onSubmit={handleSubmit}
      onCancel={onRemove}
      isLoading={createMutation.isPending}
      defaultValues={{ workType: 'regular' }}
    />
  );
};

const OvertimeWorkCard: React.FC<{
  cardId: string;
  onRemove: () => void;
  onSuccess: () => void;
}> = ({ cardId, onRemove, onSuccess }) => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: OvertimeFormData) => overtimeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-records'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeRecords'] });
      onSuccess();
    },
  });

  const handleSubmit = async (data: OvertimeFormData) => {
    await createMutation.mutateAsync(data);
  };

  return (
    <OvertimeForm
      key={`${cardId}-ot`}
      mode="create"
      onSubmit={handleSubmit}
      onCancel={onRemove}
      isLoading={createMutation.isPending}
      initialPeriod="morning"
    />
  );
};

const WorkCard: React.FC<WorkCardProps> = ({ card, index, onTypeChange, onRemove, onSuccess }) => {
  const typeLabel = card.type === 'regular' ? 'เวลาปกติ' : 'OT';
  const cardTitle = `งานที่ ${index + 1} • ${typeLabel}`;

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="h6">{cardTitle}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            size="small"
            label="ประเภทการ์ด"
            value={card.type}
            onChange={(event) => onTypeChange(card.id, event.target.value as CardType)}
          >
            <MenuItem value="regular">เวลาปกติ</MenuItem>
            <MenuItem value="ot">OT</MenuItem>
          </TextField>
          <IconButton aria-label="remove-card" onClick={() => onRemove(card.id)}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {card.type === 'regular' ? (
        <RegularWorkCard
          cardId={card.id}
          onRemove={() => onRemove(card.id)}
          onSuccess={() => onSuccess(card.id, 'regular')}
        />
      ) : (
        <OvertimeWorkCard
          cardId={card.id}
          onRemove={() => onRemove(card.id)}
          onSuccess={() => onSuccess(card.id, 'ot')}
        />
      )}
    </Paper>
  );
};

export default function WorkRecordComposerPage() {
  const router = useRouter();

  const [cards, setCards] = useState<WorkCardConfig[]>([
    { id: createCardId(), type: 'regular' },
  ]);

  const addCard = () => {
    setCards((prev) => [...prev, { id: createCardId(), type: 'regular' }]);
  };

  const removeCard = (cardId: string) => {
    setCards((prev) => prev.filter((card) => card.id !== cardId));
  };

  const changeCardType = (cardId: string, type: CardType) => {
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, type } : card))
    );
  };

  const handleCardSuccess = (cardId: string, _type: CardType) => {
    removeCard(cardId);
  };

  const canAddCard = useMemo(() => cards.length < 10, [cards.length]);

  const handleBack = () => {
    router.push('/daily-reports');
  };

  return (
    <ProtectedRoute requiredRoles={['SE', 'OE', 'PE', 'PM', 'PD', 'AM']}>
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <BackButton href="/daily-reports" />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', md: 'center' },
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              mb: 3,
            }}
          >
            <Typography variant="h4">บันทึกการทำงานรายวัน</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={handleBack}>
                กลับหน้ารายการ
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={addCard}
                disabled={!canAddCard}
              >
                เพิ่มการ์ดงาน
              </Button>
            </Stack>
          </Box>

          {cards.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom>
                ยังไม่มีการ์ดงาน
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                กดปุ่ม “เพิ่มการ์ดงาน” เพื่อเริ่มบันทึกการทำงาน สามารถเลือกได้ว่าการ์ดนั้นเป็นเวลาปกติหรือ OT
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={addCard}>
                เพิ่มการ์ดงาน
              </Button>
            </Paper>
          ) : (
            cards.map((card, index) => (
              <WorkCard
                key={card.id}
                index={index}
                card={card}
                onTypeChange={changeCardType}
                onRemove={removeCard}
                onSuccess={handleCardSuccess}
              />
            ))
          )}
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
