/**
 * Inspection-topic settings (T-076 · S4).
 *
 * Per-project editor for the 3-level inspection tree ported from the
 * qc-report-new app: หมวดหลัก → หมวดย่อย → หัวข้อการตรวจ.
 *
 * Fields live on the SUB-CATEGORY only, matching the source app: they are asked once
 * when a sub-category is picked, before any topic is checked, and identify what is
 * being inspected (AdminConfig.tsx:611 renders that editor on the sub-category row
 * alone; Camera.tsx:119 reads selectedSubCat.dynamicFields only). A topic is just a
 * checklist row. An earlier draft of this component wrongly offered a fields editor
 * per topic as well — that came from the source's dead `Topic.dynamicFields` type
 * field, which nothing in that app writes or reads.
 *
 * Rendered inside /export-documents → Inspect tab → "ตั้งค่าหัวข้อการตรวจ".
 *
 * Editing model: the whole tree is edited locally, then saved in ONE PUT on an
 * explicit Save (no autosave) — matching the backend, which replaces the tree
 * wholesale. Ids are generated client-side so a node can be edited before it has
 * ever been persisted.
 *
 * Project scoping mirrors DocSettingsTab: a user in exactly one project gets it
 * locked; otherwise the shared ProjectSelect (which scopes itself) is used.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';

import { ProjectSelect } from '@/components/forms/ProjectSelect';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';
import { exportDocumentService } from '@/services/exportDocumentService';
import type {
  InspectionFieldConfig,
  InspectionMainCategory,
  InspectionSubCategory,
  InspectionTopic,
  InspectionTopicConfig,
} from '@/services/exportDocumentService';

/** Client-side id. crypto.randomUUID is not available on every browser/context. */
function newId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// ── Extra-fields editor (used at sub-category AND topic level) ───────────────

interface FieldsEditorProps {
  fields: InspectionFieldConfig[];
  onChange: (fields: InspectionFieldConfig[]) => void;
}

function FieldsEditor({ fields, onChange }: FieldsEditorProps) {
  const patch = (index: number, next: Partial<InspectionFieldConfig>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...next } : f)));

  const remove = (index: number) => onChange(fields.filter((_, i) => i !== index));

  const add = () => onChange([...fields, { label: '', type: 'text' }]);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
        ข้อมูลที่ต้องกรอกตอนตรวจ
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
        ถามครั้งเดียวตอนเลือกหมวดย่อยนี้ ก่อนเริ่มตรวจ — เช่น เสาเบอร์ · ชั้น · โซน
      </Typography>

      {fields.length === 0 && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1 }}>
          ยังไม่มี — หมวดย่อยนี้ไม่ต้องกรอกอะไรก่อนตรวจ
        </Typography>
      )}

      <Stack spacing={1} sx={{ mt: 1 }}>
        {fields.map((f, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
            <TextField
              size="small"
              label="ชื่อช่อง"
              value={f.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              sx={{ flex: 1, minWidth: 120 }}
            />
            <TextField
              select
              size="small"
              label="ชนิด"
              value={f.type ?? 'text'}
              onChange={(e) =>
                patch(i, {
                  type: e.target.value as InspectionFieldConfig['type'],
                  // dropping the dropdown type makes its options meaningless
                  options: e.target.value === 'dropdown' ? (f.options ?? []) : undefined,
                })
              }
              sx={{ width: 130 }}
            >
              <MenuItem value="text">พิมพ์เอง</MenuItem>
              <MenuItem value="dropdown">เลือกจากรายการ</MenuItem>
            </TextField>
            {f.type === 'dropdown' && (
              <TextField
                size="small"
                label="ตัวเลือก (คั่นด้วย ,)"
                value={(f.options ?? []).join(', ')}
                onChange={(e) =>
                  patch(i, {
                    options: e.target.value
                      .split(',')
                      .map((o) => o.trim())
                      .filter(Boolean),
                  })
                }
                sx={{ flex: 1, minWidth: 160 }}
              />
            )}
            <Tooltip title="ลบช่องนี้">
              <IconButton size="small" onClick={() => remove(i)} sx={{ mt: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ))}
      </Stack>

      <Button size="small" startIcon={<AddIcon />} onClick={add} sx={{ mt: 1 }}>
        เพิ่มช่องกรอก
      </Button>
    </Box>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function InspectionTopicSettings() {
  const { user } = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();

  const projectCodes = useMemo(() => user?.projectLocationIds ?? [], [user]);
  const lockedProject = projectCodes.length === 1 ? projectCodes[0] : '';
  const [projectId, setProjectId] = useState<string>(lockedProject);

  useEffect(() => {
    if (lockedProject && !projectId) setProjectId(lockedProject);
  }, [lockedProject, projectId]);

  const [tree, setTree] = useState<InspectionMainCategory[]>([]);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  const {
    data: config,
    isLoading,
    refetch,
  } = useQuery<InspectionTopicConfig>({
    queryKey: ['inspection-topic-config', projectId],
    queryFn: () => exportDocumentService.getInspectionTopicConfig(projectId),
    enabled: Boolean(projectId),
  });

  // Reload the local tree whenever a fresh config arrives (project switch / refetch).
  useEffect(() => {
    if (config) {
      setTree(config.mainCategories ?? []);
      setDirty(false);
    }
  }, [config]);

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  /** Every mutation funnels through here so `dirty` can never drift from the tree. */
  const mutate = (next: (prev: InspectionMainCategory[]) => InspectionMainCategory[]) => {
    setTree(next);
    setDirty(true);
  };

  // Switching project would silently discard local edits — ask first.
  const handleProjectChange = (value: string) => {
    if (dirty && !window.confirm('ยังไม่ได้บันทึกการแก้ไข — เปลี่ยนโครงการแล้วการแก้ไขจะหายไป ยืนยันหรือไม่?')) {
      return;
    }
    setProjectId(value);
  };

  // ── level 1: หมวดหลัก ──
  const addMain = () => {
    const id = newId();
    mutate((prev) => [...prev, { id, name: '', subCategories: [] }]);
    setExpanded((prev) => ({ ...prev, [id]: true }));
  };

  const patchMain = (mainId: string, next: Partial<InspectionMainCategory>) =>
    mutate((prev) => prev.map((m) => (m.id === mainId ? { ...m, ...next } : m)));

  const removeMain = (main: InspectionMainCategory) => {
    const label = main.name.trim() || 'หมวดหลักนี้';
    if (!window.confirm(`ลบ "${label}" พร้อมหมวดย่อยและหัวข้อทั้งหมดข้างใน?`)) return;
    mutate((prev) => prev.filter((m) => m.id !== main.id));
  };

  // ── level 2: หมวดย่อย ──
  const addSub = (mainId: string) => {
    const id = newId();
    mutate((prev) =>
      prev.map((m) =>
        m.id !== mainId
          ? m
          : { ...m, subCategories: [...m.subCategories, { id, name: '', fields: [], topics: [] }] }
      )
    );
    setExpanded((prev) => ({ ...prev, [id]: true }));
  };

  const patchSub = (mainId: string, subId: string, next: Partial<InspectionSubCategory>) =>
    mutate((prev) =>
      prev.map((m) =>
        m.id !== mainId
          ? m
          : {
              ...m,
              subCategories: m.subCategories.map((s) => (s.id === subId ? { ...s, ...next } : s)),
            }
      )
    );

  const removeSub = (mainId: string, sub: InspectionSubCategory) => {
    const label = sub.name.trim() || 'หมวดย่อยนี้';
    if (!window.confirm(`ลบ "${label}" พร้อมหัวข้อทั้งหมดข้างใน?`)) return;
    mutate((prev) =>
      prev.map((m) =>
        m.id !== mainId
          ? m
          : { ...m, subCategories: m.subCategories.filter((s) => s.id !== sub.id) }
      )
    );
  };

  // ── level 3: หัวข้อการตรวจ ──
  const addTopic = (mainId: string, subId: string) => {
    const id = newId();
    mutate((prev) =>
      prev.map((m) =>
        m.id !== mainId
          ? m
          : {
              ...m,
              subCategories: m.subCategories.map((s) =>
                s.id !== subId ? s : { ...s, topics: [...s.topics, { id, name: '' }] }
              ),
            }
      )
    );
  };

  const patchTopic = (
    mainId: string,
    subId: string,
    topicId: string,
    next: Partial<InspectionTopic>
  ) =>
    mutate((prev) =>
      prev.map((m) =>
        m.id !== mainId
          ? m
          : {
              ...m,
              subCategories: m.subCategories.map((s) =>
                s.id !== subId
                  ? s
                  : {
                      ...s,
                      topics: s.topics.map((t) => (t.id === topicId ? { ...t, ...next } : t)),
                    }
              ),
            }
      )
    );

  const removeTopic = (mainId: string, subId: string, topic: InspectionTopic) => {
    const label = topic.name.trim() || 'หัวข้อนี้';
    if (!window.confirm(`ลบ "${label}"?`)) return;
    mutate((prev) =>
      prev.map((m) =>
        m.id !== mainId
          ? m
          : {
              ...m,
              subCategories: m.subCategories.map((s) =>
                s.id !== subId ? s : { ...s, topics: s.topics.filter((t) => t.id !== topic.id) }
              ),
            }
      )
    );
  };

  // ── save ──
  const handleSave = async () => {
    if (!projectId) return;

    // A blank name persists as an unlabelled row and would show up blank on the
    // inspection document later, so block it here rather than letting it save quietly.
    const hasBlankName = tree.some(
      (m) =>
        !m.name.trim() ||
        m.subCategories.some((s) => !s.name.trim() || s.topics.some((t) => !t.name.trim()))
    );
    if (hasBlankName) {
      showError('กรอกชื่อให้ครบทุกหมวดและทุกหัวข้อก่อนบันทึก');
      return;
    }

    setIsSaving(true);
    try {
      await exportDocumentService.saveInspectionTopicConfig(projectId, tree);
      showSuccess('บันทึกหัวข้อการตรวจแล้ว');
      setDirty(false);
      refetch();
    } catch {
      showError('บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  const topicCount = tree.reduce(
    (sum, m) => sum + m.subCategories.reduce((s2, s) => s2 + s.topics.length, 0),
    0
  );

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        ตั้งค่าหัวข้อการตรวจ
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        กำหนดหัวข้อที่ใช้ตรวจงานของแต่ละโครงการ แบ่งเป็น 3 ชั้น: หมวดหลัก → หมวดย่อย → หัวข้อการตรวจ
        และเพิ่มช่องกรอกพิเศษได้ตามต้องการ — แก้ให้ครบแล้วกดบันทึกครั้งเดียว
      </Typography>

      <Box sx={{ maxWidth: 420, mb: 3 }}>
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
            onChange={(v) =>
              handleProjectChange(Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))
            }
            fullWidth
          />
        )}
      </Box>

      {!projectId ? (
        <Alert severity="info">เลือกโครงการเพื่อตั้งค่าหัวข้อการตรวจ</Alert>
      ) : isLoading ? (
        <LoadingSpinner />
      ) : (
        <Box>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}
          >
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addMain}>
              เพิ่มหมวดหลัก
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!dirty || isSaving}
            >
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
            <Box sx={{ flex: 1 }} />
            <Chip
              size="small"
              variant="outlined"
              label={`${tree.length} หมวดหลัก · ${topicCount} หัวข้อ`}
            />
            {dirty && <Chip size="small" color="warning" label="ยังไม่บันทึก" />}
          </Stack>

          {tree.length === 0 ? (
            <Alert severity="info">
              ยังไม่มีหมวดหลัก — กด &quot;เพิ่มหมวดหลัก&quot; เพื่อเริ่มสร้างหัวข้อการตรวจ
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {tree.map((main) => (
                <Box
                  key={main.id}
                  sx={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 2, p: 1.5 }}
                >
                  {/* level 1 row */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton size="small" onClick={() => toggle(main.id)}>
                      {expanded[main.id] ? (
                        <ExpandLessIcon fontSize="small" />
                      ) : (
                        <ExpandMoreIcon fontSize="small" />
                      )}
                    </IconButton>
                    <TextField
                      size="small"
                      label="ชื่อหมวดหลัก"
                      value={main.name}
                      onChange={(e) => patchMain(main.id, { name: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                    <Tooltip title="เพิ่มหมวดย่อย">
                      <IconButton size="small" onClick={() => addSub(main.id)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบหมวดหลัก">
                      <IconButton size="small" onClick={() => removeMain(main)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Collapse in={Boolean(expanded[main.id])} unmountOnExit>
                    <Box sx={{ pl: 4, pt: 1.5 }}>
                      {main.subCategories.length === 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ยังไม่มีหมวดย่อย
                        </Typography>
                      )}

                      <Stack spacing={1.5}>
                        {main.subCategories.map((sub) => (
                          <Box
                            key={sub.id}
                            sx={{
                              border: '1px dashed rgba(0,0,0,0.15)',
                              borderRadius: 2,
                              p: 1.5,
                            }}
                          >
                            {/* level 2 row */}
                            <Stack direction="row" spacing={1} alignItems="center">
                              <IconButton size="small" onClick={() => toggle(sub.id)}>
                                {expanded[sub.id] ? (
                                  <ExpandLessIcon fontSize="small" />
                                ) : (
                                  <ExpandMoreIcon fontSize="small" />
                                )}
                              </IconButton>
                              <TextField
                                size="small"
                                label="ชื่อหมวดย่อย"
                                value={sub.name}
                                onChange={(e) =>
                                  patchSub(main.id, sub.id, { name: e.target.value })
                                }
                                sx={{ flex: 1 }}
                              />
                              <Tooltip title="เพิ่มหัวข้อการตรวจ">
                                <IconButton size="small" onClick={() => addTopic(main.id, sub.id)}>
                                  <AddIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="ลบหมวดย่อย">
                                <IconButton size="small" onClick={() => removeSub(main.id, sub)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>

                            <Collapse in={Boolean(expanded[sub.id])} unmountOnExit>
                              <Box sx={{ pl: 4, pt: 1 }}>
                                <FieldsEditor
                                  fields={sub.fields}
                                  onChange={(fields) => patchSub(main.id, sub.id, { fields })}
                                />

                                <Divider sx={{ my: 1.5 }} />

                                {sub.topics.length === 0 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    ยังไม่มีหัวข้อการตรวจ
                                  </Typography>
                                )}

                                <Stack spacing={1}>
                                  {sub.topics.map((topic) => (
                                    <Stack
                                      key={topic.id}
                                      direction="row"
                                      spacing={1}
                                      alignItems="center"
                                    >
                                      <TextField
                                        size="small"
                                        label="ชื่อหัวข้อการตรวจ"
                                        value={topic.name}
                                        onChange={(e) =>
                                          patchTopic(main.id, sub.id, topic.id, {
                                            name: e.target.value,
                                          })
                                        }
                                        sx={{ flex: 1 }}
                                      />
                                      <Tooltip title="ลบหัวข้อ">
                                        <IconButton
                                          size="small"
                                          onClick={() => removeTopic(main.id, sub.id, topic)}
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </Stack>
                                  ))}
                                </Stack>
                              </Box>
                            </Collapse>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </Collapse>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );
}

export default InspectionTopicSettings;
