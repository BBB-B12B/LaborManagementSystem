
const dotenv = require('dotenv');
const result = dotenv.config();

if (result.error) {
    console.error('Error loading .env file:', result.error);
}

const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
console.log('--- FIREBASE_SERVICE_ACCOUNT_KEY ---');
console.log('Type:', typeof key);
console.log('Value starts with:', key?.substring(0, 20));
console.log('Value ends with:', key?.substring(key.length - 20));

try {
    const parsed = JSON.parse(key);
    console.log('✅ Successfully parsed JSON');
    console.log('Project ID:', parsed.project_id);
    console.log('Private Key length:', parsed.private_key?.length);
} catch (e) {
    console.log('❌ Failed to parse JSON:', e.message);
}
