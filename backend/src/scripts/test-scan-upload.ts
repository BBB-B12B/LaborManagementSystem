import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const API_URL = 'http://localhost:4002/api';
// Using the mocked admin1 from auth middleware
const AUTH_HEADER = { Authorization: 'Bearer mock-token' };

async function runTest() {
  try {
    console.log('1. Fetching Projects to find "Ho"...');
    const projectsRes = await axios.get(`${API_URL}/projects`, { headers: AUTH_HEADER });

    // Log all just in case
    // console.log(projectsRes.data.data.map((p: any) => `${p.projectName} (${p.id})`));

    const hoProject = projectsRes.data.data.find(
      (p: any) =>
        p.projectName.toLowerCase().includes('ho') || p.department === 'HO' || p.code === 'HO'
    );

    if (!hoProject) {
      console.log('Could not find specific "Ho" project. Using the first available project.');
    }

    const projectId = hoProject ? hoProject.id : projectsRes.data.data[0].id;
    console.log(
      `Using Project ID: ${projectId} (${hoProject ? hoProject.projectName : 'Fallback'})`
    );

    // --- Test 2: Upload File ---
    console.log('\n2. Testing File Upload (.dat)...');
    const filePath = 'c:\\Users\\100654\\test_data\\test.dat';
    if (!fs.existsSync(filePath)) {
      console.error('Test file not found at ' + filePath);
      return;
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('projectLocationId', projectId);
    form.append('importNote', 'Test Upload via Script (admin1)');

    const uploadRes = await axios.post(`${API_URL}/scan-data/import`, form, {
      headers: {
        ...AUTH_HEADER,
        ...form.getHeaders(),
      },
    });

    console.log('Upload Result:', JSON.stringify(uploadRes.data, null, 2));

    // --- Test 3: Upload Text ---
    console.log('\n3. Testing Text Upload...');
    const textData = `200022 2023-11-12 08:00:00
200022 2023-11-12 17:00:00`;

    const textUploadRes = await axios.post(
      `${API_URL}/scan-data/import-text`,
      {
        projectLocationId: projectId,
        textData: textData,
        importNote: 'Test Text Upload via Script (admin1)',
      },
      { headers: AUTH_HEADER }
    );

    console.log('Text Upload Result:', JSON.stringify(textUploadRes.data, null, 2));
  } catch (error: any) {
    console.error('Test Failed:', error.response ? error.response.data : error.message);
  }
}

runTest();
