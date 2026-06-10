import { db } from '../config/firebase';
import { ReconciliationService } from '../services/reconciliation/ReconciliationService';

async function test() {
  const rs = new ReconciliationService();
  const empId = '200030';
  const date = '2026-05-04';
  const project = 'WH1';

  const record = await rs.generateForEmployee(empId, date, project);
  console.log('Record status:', record.status);
  console.log('Scan Data Hours:', record.scanDataHours);

  const scanQuery = await db.collection('scanData').where('employeeId', '==', empId).get();
  console.log(
    'All scan records for employee:',
    scanQuery.docs.map((d) => ({
      id: d.id,
      workDate: d.data().workDate.toDate(),
      isDeleted: d.data().isDeleted,
    }))
  );
}

test().catch(console.error);
