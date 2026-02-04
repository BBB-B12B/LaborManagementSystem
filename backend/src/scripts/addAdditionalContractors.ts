import admin from 'firebase-admin';
import dotEnv from 'dotenv';
dotEnv.config();

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

if (!admin.apps.length) {
    admin.initializeApp({
        credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06',
    });
}

const db = admin.firestore();

const additionalData = [
    { id: "950937", name: "นางสาวNAN IS (น.ส.นาน อิท)", skillId: "กรรมกร / ทำความสะอาด สถาปัตย์", department: "บริการลูกค้า" },
    { id: "950938", name: "นายMAUNG SOE (นายม่อง โซ)", skillId: "ช่างสถาปัตย์", department: "บริการลูกค้า" },
    { id: "950939", name: "นายSAI AEIK NYINE (นายไข เอก เนีย)", skillId: "ช่างสถาปัตย์", department: "บริการลูกค้า" },
    { id: "950940", name: "นางสาวHTWE KYI (น.ส.ติว ได)", skillId: "ช่างสถาปัตย์", department: "บริการลูกค้า" },
    { id: "950941", name: "นางNAN SUN (นาง แนน สาม)", skillId: "กรรมกร / ทำความสะอาด สถาปัตย์", department: "บริการลูกค้า" },
    { id: "950942", name: "นางสาวMYINT MYINT WIT (น.ส.มยิน มยิน วิน)", skillId: "กรรมกร / ทำความสะอาด สถาปัตย์", department: "บริการลูกค้า" },
    { id: "950943", name: "นายKHUN MG LOI (นายคุน หม่อง ลุย)", skillId: "ช่างสถาปัตย์", department: "บริการลูกค้า" },
    { id: "950944", name: "นายMAUNG SOE (นายม่อง โซ)", skillId: "ช่างสถาปัตย์", department: "บริการลูกค้า" },
    { id: "950945", name: "นางNAN NU (นาง นาน นุ)", skillId: "ช่างสถาปัตย์", department: "บริการลูกค้า" },
    { id: "950946", name: "นายSAI AIK SEA (นาย ไช ไอ ซี)", skillId: "ช่างสถาปัตย์", department: "บริการลูกค้า" },
    { id: "950947", name: "นายZIN KO (นายซิน โก)", skillId: "ช่างสถาปัตย์", department: "บริการลูกค้า" },
    { id: "950948", name: "นายZIN KO KO HTET (นาย ซิน โก โก เท)", skillId: "ช่างสถาปัตย์", department: "บริการลูกค้า" },
    { id: "950972", name: "MRSPANY VONGPHET", skillId: "พนักงานริกเกอร์", department: "คลังสินค้าและบริการ" },
];

async function addContractors() {
    console.log("Adding additional contractors...");
    const now = new Date();

    for (const item of additionalData) {
        try {
            await db.collection('dailyContractors').doc(item.id).set({
                employeeId: item.id,
                name: item.name,
                skillId: item.skillId,
                projectLocationIds: ["WH1"],
                isActive: true,
                startDate: new Date("2024-01-15T07:00:00.000Z"),
                createdAt: now,
                updatedAt: now,
                updatedBy: "import-script-additional",
                passwordHash: null,
                phoneNumber: null
            });
            console.log(`Added: ${item.id} - ${item.name}`);
        } catch (err) {
            console.error(`Error adding ${item.id}:`, err);
        }
    }

    console.log("Finished adding additional contractors.");
    process.exit(0);
}

addContractors().catch(err => {
    console.error(err);
    process.exit(1);
});
