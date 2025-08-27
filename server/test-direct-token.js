const crypto = require('crypto');
const axios = require('axios');

// Ваши данные
const appToken = 'sbx:0PjId0q9WYAKiCPouNAHgTBC.jyCTlFoQirkBFgcNIG6TugrACKJ8FC4D';
const secretKey = 'iouLJAHP7ZlOrWk012XQLCQT8gBOpAND';
const baseUrl = 'https://api.sumsub.com';

function createSignature(method, url, timestamp, body) {
    const requestData = timestamp + method.toUpperCase() + url + (body || '');
    return crypto
        .createHmac('sha256', secretKey)
        .update(requestData)
        .digest('hex');
}

function createHeaders(method, url, body) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createSignature(method, url, timestamp, body);

    return {
        'X-App-Token': appToken,
        'X-App-Access-Ts': timestamp.toString(),
        'X-App-Access-Sig': signature,
        'Content-Type': 'application/json'
    };
}

async function testDirectToken() {
    try {
        console.log('Testing direct access token creation...');
        
        // Создаем access token без аппликанта, используя только externalUserId
        const endpoint = '/resources/accessTokens';
        const tokenData = {
            externalUserId: `test-user-${Date.now()}`,
            ttlInSecs: 3600
        };
        
        console.log('Token data:', JSON.stringify(tokenData, null, 2));
        
        const body = JSON.stringify(tokenData);
        const headers = createHeaders('POST', endpoint, body);
        
        console.log('Headers:', headers);
        
        const response = await axios({
            method: 'POST',
            url: `${baseUrl}${endpoint}`,
            headers,
            data: body
        });
        
        console.log('✅ SUCCESS! Direct token creation works!');
        console.log('Token response:', JSON.stringify(response.data, null, 2));
        
        // Теперь попробуем получить информацию об этом токене
        console.log('\n🔍 Testing token validation...');
        
        return response.data;
        
    } catch (error) {
        console.error('❌ Direct token creation failed:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Error:', error.message);
    }
}

testDirectToken();