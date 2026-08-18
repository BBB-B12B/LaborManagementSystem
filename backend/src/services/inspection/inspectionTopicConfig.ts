/**
 * Per-project inspection-topic config store (T-076).
 *
 * Ports the qc-report-new inspection-report app's 3-level topic tree
 * (หมวดหลัก → หมวดย่อย → หัวข้อการตรวจ) into the LMS. One Firestore doc per
 * project (doc id = projectId), decoupled from the Project record itself —
 * same single-doc-per-project merge-upsert shape as
 * backend/src/services/pdf/documentHeaderConfig.ts.
 *
 * Storage layout (LMS Firebase Firestore, Admin SDK — emulator in dev, real
 * infra in prod, same as documentHeaderConfig.ts):
 *   - the topic tree -> Firestore collection `inspectionTopicConfigs`, doc id = projectId
 *
 * Everything is additive + reversible: an empty config makes the inspection
 * UI degrade gracefully (no categories, an empty tree to build from scratch).
 */

import { db } from '../../config/firebase';

const COLLECTION = 'inspectionTopicConfigs';

/**
 * A single dynamic field, attached to a SUB-CATEGORY only.
 *
 * In the source app these are asked ONCE when the inspector picks a sub-category,
 * before any topic is checked, and their answers identify what is being inspected
 * (Camera.tsx:685 raises the step, Camera.tsx:817 folds the answers into the job
 * label; the real example in that code is 'เสาเบอร์'). So a sub-category behaves like
 * a form header and its fields are the header's blanks; topics are the checklist
 * rows underneath, which do NOT carry their own fields.
 *
 * The source's `Topic.dynamicFields` is deliberately NOT ported: it exists in that
 * app's type but nothing writes it (handleEditFields takes a SubCategory only,
 * AdminConfig.tsx:265/611) and nothing reads it (Camera.tsx:119 reads
 * selectedSubCat.dynamicFields only) — it is a dead legacy field.
 */
export interface InspectionFieldConfig {
  label: string;
  type?: 'text' | 'dropdown'; // 'autocomplete' from the source app is dropped (needs a data source)
  options?: string[]; // only meaningful when type === 'dropdown'
}

/** หัวข้อการตรวจ — the leaf inspection topic (a checklist row; no fields of its own). */
export interface InspectionTopic {
  id: string;
  name: string;
}

/** หมวดย่อย — a sub-category: holds the shared fields plus one or more topics. */
export interface InspectionSubCategory {
  id: string;
  name: string;
  fields: InspectionFieldConfig[];
  topics: InspectionTopic[];
}

/** หมวดหลัก — the top-level category holding one or more sub-categories. */
export interface InspectionMainCategory {
  id: string;
  name: string;
  subCategories: InspectionSubCategory[];
}

/** The full per-project inspection-topic config document. */
export interface InspectionTopicConfig {
  projectId: string;
  mainCategories: InspectionMainCategory[];
  updatedAt?: string; // ISO
  updatedBy?: string | null;
}

/** A blank, shape-complete config so a project with no saved tree still renders. */
function emptyConfig(projectId: string): InspectionTopicConfig {
  return {
    projectId,
    mainCategories: [],
  };
}

/** Read a project's inspection-topic config, or a blank default when none is saved yet. */
export async function getInspectionTopicConfig(
  projectId: string
): Promise<InspectionTopicConfig> {
  const snap = await db.collection(COLLECTION).doc(projectId).get();
  if (!snap.exists) return emptyConfig(projectId);
  const d = snap.data() || {};
  return {
    projectId,
    mainCategories: d.mainCategories ?? [],
    updatedAt: d.updatedAt,
    updatedBy: d.updatedBy ?? null,
  };
}

/**
 * Merge-upsert a project's inspection-topic config. The whole tree is
 * replaced on save (the UI edits it as a whole), while merge:true keeps this
 * consistent with the rest of the config-doc family. Returns the freshly-read
 * config.
 */
export async function saveInspectionTopicConfig(
  projectId: string,
  mainCategories: InspectionMainCategory[],
  updatedBy?: string | null
): Promise<InspectionTopicConfig> {
  await db.collection(COLLECTION).doc(projectId).set(
    {
      projectId,
      mainCategories,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy ?? null,
    },
    { merge: true }
  );
  return getInspectionTopicConfig(projectId);
}

export { COLLECTION as INSPECTION_TOPIC_CONFIG_COLLECTION };
