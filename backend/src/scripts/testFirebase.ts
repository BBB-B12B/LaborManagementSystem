
import * as admin from 'firebase-admin';
import * as path from 'path';


const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
console.log('Key Path:', serviceAccountPath);

// Force REST to avoid gRPC hangs
process.env.GOOGLE_CLOUD_DISABLE_GRPC = 'true';

try {
    const serviceAccount = require(serviceAccountPath);
    console.log('Key loaded successfully. Project ID:', serviceAccount.project_id);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();
    console.log('Firestore initialized. Attempting read...');

    db.listCollections().then(async collections => {
        console.log('Connected! Collections found:', collections.map(c => c.id).join(', '));

        console.log('Attempting Write...');
        await db.collection('test_connection').add({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
        console.log('Write Successful!');

        process.exit(0);
    }).catch(err => {
        console.error('Connection Failed:', err);
        process.exit(1);
    });

} catch (error) {
    console.error('Error loading key:', error);
}
