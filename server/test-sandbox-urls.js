const crypto = require('crypto');
const axios = require('axios');

// Ваши данные
const appToken = 'sbx:0PjId0q9WYAKiCPouNAHgTBC.jyCTlFoQirkBFgcNIG6TugrACKJ8FC4D';
const secretKey = 'iouLJAHP7ZlOrWk012XQLCQT8gBOpAND';

// Возможные sandbox URLs
const possibleUrls = [
    'https://api.sumsub.com',
    'https://test-api.sumsub.com', 
    'https://sandbox-api.sumsub.com',
    'https://sbx-api.sumsub.com'
];

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

async function testUrls() {
    console.log('Testing different Sumsub API URLs...');
    
    for (const baseUrl of possibleUrls) {
        console.log(`\n🧪 Testing URL: ${baseUrl}`);
        
        try {
            // Попробуем создать access token напрямую без аппликанта
            const endpoint = '/resources/accessTokens';
            const tokenData = {
                externalUserId: `test-user-${Date.now()}`,
                levelName: 'basic-kyc-level', // Попробуем стандартное название
                ttlInSecs: 3600
            };
            
            const body = JSON.stringify(tokenData);
            const headers = createHeaders('POST', endpoint, body);
            
            const response = await axios({
                method: 'POST',
                url: `${baseUrl}${endpoint}`,
                headers,
                data: body,
                timeout: 10000
            });
            
            console.log(`✅ SUCCESS with URL: ${baseUrl}`);
            console.log('Response:', JSON.stringify(response.data, null, 2));
            return baseUrl;
            
        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                console.log(`❌ URL not accessible: ${baseUrl}`);
            } else {
                console.log(`⚠️  URL accessible but error: ${baseUrl}`);
                console.log('Status:', error.response?.status);
                console.log('Error:', error.response?.data?.description || error.message);
            }
        }
    }
    
    console.log('\n❌ No working URLs found');
    return null;
}

testUrls();