const axios = require('axios');

async function testAPI() {
    try {
        console.log('Testing API: GET /api/wage-periods');
        const response = await axios.get('http://localhost:4000/api/wage-periods', {
            headers: {
                'Authorization': 'Bearer dummy-token-for-testing'
            }
        });

        console.log('\n✅ Response Status:', response.status);
        console.log('✅ Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('\n❌ Error:', error.response?.status, error.response?.statusText);
        console.error('❌ Error Data:', error.response?.data);
    }
}

testAPI();
