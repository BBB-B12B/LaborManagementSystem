import admin from 'firebase-admin';
import dotEnv from 'dotenv';
dotEnv.config();

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06',
  });
}

const db = admin.firestore();

const contractorsData = [
  {
    id: '200030',
    name: 'นางสุวรรณี สติภา',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '200036',
    name: 'นางสมใจ แก้วอ่อน',
    skillId: 'แม่บ้านแคมป์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '200038',
    name: 'นางสาวนัชริยา เหล็กอ่อน',
    skillId: 'Head Man สโตร์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '200047',
    name: 'นายบรรจง ดีด้วยมือ',
    skillId: 'คนขับรถบรรทุกติดเครน',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '200247',
    name: 'นายอรัญ เอี่ยมองค์คต',
    skillId: 'คนขับรถบรรทุกติดเครน',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '200612',
    name: 'นายวีรชัย บุญสา',
    skillId: 'พนักงานบริการงานทาวเวอร์เครน',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '200630',
    name: 'นายสมศักดิ์ ขันนามล',
    skillId: 'คนขับรถกระบะ',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '200808',
    name: 'นายชวลิต ศรีจันทร์',
    skillId: 'พนักงานรักษาความปลอดภัย(รปภ)',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '200948',
    name: 'นายมารวย สอิ้งทอง',
    skillId: 'พนักงานบริการงานทาวเวอร์เครน',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '200949',
    name: 'นางสาวบุพิน บุญลือ',
    skillId: 'พนักงานบริการงานทาวเวอร์เครน',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201232',
    name: 'นายวิชัย ญาติปราโมทย์',
    skillId: 'พนักงานรักษาความปลอดภัย(รปภ)',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201351',
    name: 'นายไพรัตน์ เจริญพร',
    skillId: 'พนักงานรักษาความปลอดภัย(รปภ)',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201400',
    name: 'นายนิรันดร์ ปลื้มกลาง',
    skillId: 'Head Man งานสถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '201426',
    name: 'นายชัยวัฒน์ อยู่เต็มสุข',
    skillId: 'คนขับรถบรรทุกติดเครน',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201494',
    name: 'นางสาวจันทร์เพ็ญ บัวบาล',
    skillId: 'Head Man สโตร์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201503',
    name: 'นายวันนี ปลื้มกลาง',
    skillId: 'พนักงานรักษาความปลอดภัย(รปภ)',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201572',
    name: 'นายภัทรชัย ปิยะพรหมสุข',
    skillId: 'คนขับรถกระบะ',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201595',
    name: 'นายเอกณรงค์ หวังผล',
    skillId: 'คนขับรถเทรนเลอร์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201607',
    name: 'นายอมรเทพ รอดพินิจ',
    skillId: 'พนักงานรักษาความปลอดภัย(รปภ)',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201608',
    name: 'นายธนพล เปียมวย',
    skillId: 'คนขับรถกระบะบรรทุก',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201611',
    name: 'นางสาวโชติกันต์ ทองสัน',
    skillId: 'สโตร์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201615',
    name: 'นายคิด ขอมีกลาง',
    skillId: 'คนขับรถกระบะ',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201622',
    name: 'นายสายันต์ จันทรัตน์',
    skillId: 'Head Man สโตร์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201636',
    name: 'นางสาวมะลิสา กลิ่นด่านกลาง',
    skillId: 'สโตร์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201685',
    name: 'นายคารม ภูรีศรี',
    skillId: 'พนักงานบริการงานทาวเวอร์เครน',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201700',
    name: 'นางสาวสุมาลี แจ่มจันทร์',
    skillId: 'สโตร์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '201710',
    name: 'นายสิทธิโชค ศรีจ่ำปา',
    skillId: 'พนักงานริกเกอร์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '300067',
    name: 'นายXAIPHONE KHAMCHALEUNE',
    skillId: 'พนักงานบังคับทาวเวอร์เครน',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '400060',
    name: 'นางYANY OEU',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '400061', name: 'นายVY BAI', skillId: 'Head Man บริการ', department: 'บริการลูกค้า' },
  { id: '400156', name: 'นางสาวSOPHY TAK', skillId: 'ช่างสี', department: 'บริการลูกค้า' },
  { id: '401639', name: 'นายKAAUN OEU', skillId: 'Head Man บริการ', department: 'บริการลูกค้า' },
  {
    id: '401678',
    name: 'นางKALYAN NANG',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '401679', name: 'นายVASNA YOR', skillId: 'Head Man บริการ', department: 'บริการลูกค้า' },
  {
    id: '402433',
    name: 'นายLY PICH',
    skillId: 'พนักงานควบคุมปั๊มคอนกรีต',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '402459',
    name: 'นายPHEAP PHAT',
    skillId: 'Head Man บริการ',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '403615',
    name: 'นายMIN AUNG NAING',
    skillId: 'Head Man งานสถาปัตย์',
    department: 'บริการลูกค้า',
  },
  { id: '403634', name: 'นายAUNG MYINT ZAW', skillId: 'ช่างกระเบื้อง', department: 'บริการลูกค้า' },
  { id: '403745', name: 'นายMAUNG PYAR', skillId: 'ช่างปูน', department: 'บริการลูกค้า' },
  {
    id: '404121',
    name: 'นายSAI NAING NINE',
    skillId: 'Head Man งานสถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '404237',
    name: 'นางCHOM KHAN',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '404767',
    name: 'นายSEIN TUN',
    skillId: 'Head Man งานสถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '404768',
    name: 'นางสาวNAN KU',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '404877',
    name: 'นายTOEUT TAING',
    skillId: 'ช่างเชื่อม',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '405069', name: 'นางMI SAPAL', skillId: 'แม่บ้านแคมป์', department: 'คลังสินค้าและบริการ' },
  {
    id: '405166',
    name: 'นายKHUN NGIN MAUNG',
    skillId: 'Head Man งานสถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '410130',
    name: 'นายSOPHEAK NHIEN',
    skillId: 'Head Man บริการ',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '410132',
    name: 'นางสาวPHALLA LENG',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '410137',
    name: 'นางRON SAM',
    skillId: 'พนักงานรักษาความปลอดภัย(รปภ)',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '410164', name: 'นายHLAING MYO OO', skillId: 'ช่างปูน', department: 'บริการลูกค้า' },
  {
    id: '410169',
    name: 'นางสาวKHAING KHIN OO',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '410170',
    name: 'นางสาวSAN AYE',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  { id: '410173', name: 'นายHAN WIN AUNG', skillId: 'ช่างปูน', department: 'บริการลูกค้า' },
  { id: '410175', name: 'นายKYAW TOE AUNG', skillId: 'ช่างกระเบื้อง', department: 'บริการลูกค้า' },
  { id: '410181', name: 'นายTAY ZAR AUNG', skillId: 'ช่างกระเบื้อง', department: 'บริการลูกค้า' },
  { id: '410259', name: 'นางสาวMACH OEURN', skillId: 'สโตร์', department: 'คลังสินค้าและบริการ' },
  {
    id: '410263',
    name: 'นายMACH ROEURN',
    skillId: 'ช่างซ่อมอุปกรณ์ก่อสร้าง',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '410433', name: 'นายCHIT WIN KO', skillId: 'ช่างกระเบื้อง', department: 'บริการลูกค้า' },
  {
    id: '410470',
    name: 'นางสาวZIN MAR OO',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '410481',
    name: 'นางสาวNAN KHAM PWAL',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '410559',
    name: 'นายSAI SAN NYUNT',
    skillId: 'ช่างเชื่อม',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '410831', name: 'นายMYINT AUNG', skillId: 'ช่างกระเบื้อง', department: 'บริการลูกค้า' },
  {
    id: '410835',
    name: 'นายHAK THENG',
    skillId: 'Head Man สโตร์',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '410836', name: 'นางPHEA SUM', skillId: 'แม่บ้านแคมป์', department: 'คลังสินค้าและบริการ' },
  { id: '410962', name: 'นายKYAW LWIN', skillId: 'ช่างเชื่อม', department: 'คลังสินค้าและบริการ' },
  {
    id: '411202',
    name: 'นายKYAW SAN WIN',
    skillId: 'ช่างเชื่อม',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '411203',
    name: 'นายAUNG SAN LIN',
    skillId: 'ช่างเชื่อม',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '411205',
    name: 'นายSAN HTET AUNG',
    skillId: 'พนักงานขับรถยก',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '411212', name: 'นายKO MYO', skillId: 'สโตร์', department: 'คลังสินค้าและบริการ' },
  {
    id: '411213',
    name: 'นายKYAW THU OO',
    skillId: 'พนักงานขับรถดูดฝื่น',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '411214',
    name: 'นายMYO MIN AUNG',
    skillId: 'พนักงานขับรถดูดฝื่น',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '411230', name: 'นายHLA HTAY', skillId: 'ช่างกระเบื้อง', department: 'บริการลูกค้า' },
  { id: '411234', name: 'นายKHUN THAN TUN', skillId: 'ช่างปูน', department: 'บริการลูกค้า' },
  { id: '411257', name: 'นายKHUN TAIN TAUNG', skillId: 'ช่างสี', department: 'บริการลูกค้า' },
  { id: '411263', name: 'นางNAN SEIN', skillId: 'ช่างสี', department: 'บริการลูกค้า' },
  {
    id: '411274',
    name: 'นายNAING LIN TUN',
    skillId: 'ช่างซ่อมเครื่องมือ เครื่องใช้ไฟฟ้า',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '411277',
    name: 'นายAUNG KYAW MIN',
    skillId: 'พนักงานควบคุมปั๊มคอนกรีต',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '411360', name: 'นายKUNG NYUNT', skillId: 'ช่างปูน', department: 'บริการลูกค้า' },
  {
    id: '411367',
    name: 'นางสาวNANG KHAN MU',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  { id: '411400', name: 'นายKYAW MOE', skillId: 'ช่างปูน', department: 'บริการลูกค้า' },
  {
    id: '411401',
    name: 'นางสาวNAN LAUNG KHAN',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '411427',
    name: 'นางสาวSAMLEY HOEURT',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '411435',
    name: 'นางสาวCHAY NE',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '411542', name: 'นายHAN PHUK', skillId: 'ช่างกระเบื้อง', department: 'บริการลูกค้า' },
  {
    id: '411590',
    name: 'นายMACH SUONG',
    skillId: 'ช่างซ่อมอุปกรณ์ก่อสร้าง',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '411627',
    name: 'นายOO MYINT ZAW',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '411628',
    name: 'นางMA THAE THAEKHING',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  { id: '411629', name: 'นายAUNG THANT ZIN', skillId: 'ช่างปูน', department: 'บริการลูกค้า' },
  { id: '411645', name: 'นายKIN SAVIT', skillId: 'ช่างกระเบื้อง', department: 'บริการลูกค้า' },
  { id: '411674', name: 'นายKHUN MAUNG SAN', skillId: 'ช่างสี', department: 'บริการลูกค้า' },
  {
    id: '411675',
    name: 'นางสาวNAN CHU',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '411678',
    name: 'นายCHHOUN SOKCHEA',
    skillId: 'ช่างเชื่อม',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '411679', name: 'นายKHOM SEYHA', skillId: 'ช่างเชื่อม', department: 'คลังสินค้าและบริการ' },
  {
    id: '411681',
    name: 'นางKUN SREYNICH',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '411684',
    name: 'นางSOEURNG SREYNY',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '411686',
    name: 'นางสาวKHAING HNIN WAI',
    skillId: 'แม่บ้านสำนักงาน',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '411687',
    name: 'นายWIN KO NAING',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '411688',
    name: 'นางHNIN NANDAR WAI',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '411692',
    name: 'นายKHN THAN HLA',
    skillId: 'ช่างเชื่อม',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '411747',
    name: 'นายNAING MIN HTET',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  { id: '411932', name: 'นายZAW MIN AUNG', skillId: 'สโตร์', department: 'คลังสินค้าและบริการ' },
  {
    id: '411938',
    name: 'นายKYAW THU YA NAING',
    skillId: 'สโตร์',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '411939', name: 'นายKYAW ZIN OO', skillId: 'สโตร์', department: 'คลังสินค้าและบริการ' },
  { id: '411941', name: 'นายKYAW YE AUNG', skillId: 'สโตร์', department: 'คลังสินค้าและบริการ' },
  {
    id: '411943',
    name: 'นายLEANG KHOEN',
    skillId: 'ช่างซ่อมอุปกรณ์ก่อสร้าง',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '411944', name: 'นางSREY SAM', skillId: 'สโตร์', department: 'คลังสินค้าและบริการ' },
  { id: '411947', name: 'นายKYAW THAN HTAY', skillId: 'ช่างสี', department: 'บริการลูกค้า' },
  {
    id: '411948',
    name: 'นางNANG KAW KHAM',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '411973',
    name: 'นางSAMOEUT CHHUO',
    skillId: 'พนักงานริกเกอร์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '412028',
    name: 'นายTUN TUN NAING',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'คลังสินค้าและบริการ',
  },
  { id: '412040', name: 'นายJOSEPH', skillId: 'ช่างปูน', department: 'บริการลูกค้า' },
  {
    id: '412043',
    name: 'นางZIN MAR PYAU',
    skillId: 'แม่บ้านแคมป์',
    department: 'คลังสินค้าและบริการ',
  },
  {
    id: '950932',
    name: 'นางสาวNAN DEE (น.ส.นาน ดี)',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '950933',
    name: 'นายTHET NAING AUNG (นาย ทิด นาย อ่อง)',
    skillId: 'ช่างสถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '950934',
    name: 'นายMG KYAW NI (นาย หม่อง จอ นิ)',
    skillId: 'ช่างสถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '950935',
    name: 'นายYE HTIKE (นายเย)',
    skillId: 'ช่างสถาปัตย์',
    department: 'บริการลูกค้า',
  },
  {
    id: '950936',
    name: 'นางสาวTIN MAR WIN (น.ส.ติน มา วิน)',
    skillId: 'กรรมกร / ทำความสะอาด สถาปัตย์',
    department: 'บริการลูกค้า',
  },
];

async function importContractors() {
  console.log('Starting authenticated import...');
  const now = new Date();

  // Use unique IDs to avoid duplicates in the array
  const idMap = new Map();
  contractorsData.forEach((c) => idMap.set(c.id, c));
  const finalData = Array.from(idMap.values());

  console.log(`Total unique records to import: ${finalData.length}`);

  for (let i = 0; i < finalData.length; i++) {
    const item = finalData[i];
    try {
      // Use the same data structure as existing documents
      await db
        .collection('dailyContractors')
        .doc(item.id)
        .set({
          employeeId: item.id,
          name: item.name,
          skillId: item.skillId,
          projectLocationIds: ['WH1'],
          isActive: true,
          startDate: new Date('2024-01-15T07:00:00.000Z'), // Match the format from user screenshot
          createdAt: now,
          updatedAt: now,
          updatedBy: 'import-script-v2',
          passwordHash: null,
          phoneNumber: null,
        });
      process.stdout.write(`.`);
      if ((i + 1) % 10 === 0) console.log(` ${i + 1}/${finalData.length}`);
    } catch (err) {
      console.error(`\nError importing ${item.id}:`, err);
    }
  }

  console.log(`\nVerifying write...`);
  const checkDoc = await db.collection('dailyContractors').doc('400060').get();
  if (checkDoc.exists) {
    console.log('Verification SUCCESS: Document 400060 exists!');
  } else {
    console.log('Verification FAILED: Document 400060 NOT found.');
  }

  console.log(`Successfully completed import process.`);
  process.exit(0);
}

importContractors().catch((err) => {
  console.error(err);
  process.exit(1);
});
