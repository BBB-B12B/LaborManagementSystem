"use strict";
// ============================================================================
//  dailyContractorSync — DEPLOY THIS IN THE **LABOR** PROJECT (not After Sale)
// ============================================================================
//  ONE-WAY sync: Labor `dailyContractors` (warehouse workers) -> After Sale
//  `dailyContractors`.
//
//  WHY it lives in the Labor project:
//    A Firestore trigger can only watch the database of the project it is
//    deployed in. Workers are created/edited in Labor, so the trigger must
//    run in Labor and write OUT to After Sale. (Same pattern as projectSync.)
//
//  WHAT gets synced (the WH filter):
//    After Sale only cares about WAREHOUSE workers. Labor tags them with
//    `department === "WH"`. This trigger syncs ONLY those docs. If a doc is
//    not WH (or STOPS being WH after an edit), it is removed from After Sale.
//
//  PAYLOAD: only the 5 fields After Sale consumes — id, employeeId, name,
//    skillId, department, isActive. Wage / attendance data stay in Labor.
//    { merge: true } preserves any After Sale-owned fields.
//
//  SETUP (in the Labor functions codebase):
//    1. Reuse the After Sale service account key already used by projectSync
//       (cloud-functions/after-sale-key.json — gitignored).
//    2. Export `dailyContractorSync` from the Labor index.ts:
//         export { dailyContractorSync } from './labor-dailyContractorSync';
//    3. Deploy from the Labor project:
//         firebase deploy --only functions:dailyContractorSync
//
//  Region note: Labor DB = Singapore (asia-southeast1). The trigger runs there.
// ============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyContractorSync = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
// Default app = Labor project (this function's own project).
if (!admin.apps.length) {
    admin.initializeApp();
}
// After Sale app — cross-project write target (shared with projectSync via the
// find-existing guard, so re-initializing the same-named app is safe).
const AFTER_SALE_APP_NAME = 'afterSaleApp';
const getAfterSaleDb = () => {
    const existing = admin.apps.find((a) => a && a.name === AFTER_SALE_APP_NAME);
    if (existing)
        return existing.firestore();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const afterSaleSA = require(path.resolve(__dirname, '../after-sale-key.json'));
    const app = admin.initializeApp({ credential: admin.credential.cert(afterSaleSA) }, AFTER_SALE_APP_NAME);
    return app.firestore();
};
const WAREHOUSE_DEPT = 'WH';
exports.dailyContractorSync = functions
    .region('asia-southeast1') // Labor DB region
    .firestore.document('dailyContractors/{contractorId}')
    .onWrite(async (change, context) => {
    const contractorId = context.params.contractorId;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const afterSaleDb = getAfterSaleDb();
    const targetRef = afterSaleDb.collection('dailyContractors').doc(contractorId);
    // --- DELETE propagate: Labor delete -> After Sale delete --------------
    if (!after) {
        // Only delete downstream if this worker had been synced (was WH).
        if (before && before.department === WAREHOUSE_DEPT) {
            try {
                await targetRef.delete();
                console.log(`[dailyContractorSync] ✅ Deleted worker ${contractorId} in After Sale (Labor delete).`);
            }
            catch (err) {
                console.error(`[dailyContractorSync] ❌ Delete failed for ${contractorId}:`, err);
            }
        }
        return;
    }
    // --- NOT a warehouse worker: skip, and clean up if it used to be one ---
    if (after.department !== WAREHOUSE_DEPT) {
        if (before && before.department === WAREHOUSE_DEPT) {
            try {
                await targetRef.delete();
                console.log(`[dailyContractorSync] ✅ Removed ${contractorId} from After Sale (department changed ${before.department} -> ${after.department}).`);
            }
            catch (err) {
                console.error(`[dailyContractorSync] ❌ Cleanup delete failed for ${contractorId}:`, err);
            }
        }
        return;
    }
    // --- CREATE / UPDATE: WH worker -> After Sale -------------------------
    // Only the fields After Sale consumes. merge:true preserves any fields
    // After Sale owns on its own copy.
    const payload = {
        id: contractorId,
        employeeId: after.employeeId || '',
        name: after.name || '',
        skillId: after.skillId || '',
        department: after.department,
        isActive: after.isActive !== false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    try {
        await targetRef.set(payload, { merge: true });
        console.log(`[dailyContractorSync] ✅ Synced worker ${contractorId} (${payload.name}) Labor -> After Sale.`);
    }
    catch (err) {
        console.error(`[dailyContractorSync] ❌ Sync failed for ${contractorId}:`, err);
    }
});
//# sourceMappingURL=labor-dailyContractorSync.js.map