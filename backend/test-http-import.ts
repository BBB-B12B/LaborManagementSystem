import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

async function main() {
  try {
    const payload = Buffer.from(JSON.stringify({ uid: 'dev-admin' })).toString('base64');
    const fakeToken = `header.${payload}.signature`;

    const form = new FormData();
    // Use an actual data file if we have one, or write a quick raw text
    const textData = `200022 2025-08-25 12:00:00 12:50:00`;
    const buffer = Buffer.from(textData, 'utf-8');
    
    // Using string source simulating text
    form.append('file', buffer, { filename: 'pasted_data.txt', contentType: 'text/plain' });
    form.append('projectLocationId', 'test-project-123');
    
    console.log('Sending request to /import?dryRun=false&bypassAuth=true...');
    const res = await axios.post('http://localhost:4000/api/scan-data/import?dryRun=false&bypassAuth=true', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${fakeToken}`
      },
      validateStatus: () => true
    });

    console.log('Status:', res.status);
    console.log('Data:', JSON.stringify(res.data, null, 2));

  } catch (err: any) {
    console.error('Request Error:', err.message);
  }
}

main();
