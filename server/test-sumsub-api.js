const crypto = require('crypto');
const axios = require('axios');

// Ваши данные
const appToken = 'sbx:0PjId0q9WYAKiCPouNAHgTBC.jyCTlFoQirkBFgcNIG6TugrACKJ8FC4D';
const secretKey = 'iouLJAHP7ZlOrWk012XQLCQT8gBOpAND';

// Sandbox URL для API
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

async function testAPI() {
    try {
        console.log('Testing Sumsub API connection...');
        console.log('App Token:', appToken);
        console.log('Base URL:', baseUrl);
        
        // Тестируем создание аппликанта
        const endpoint = '/resources/applicants?levelName=basic-kyc-level';
        const applicantData = {
            externalUserId: 'test-user-123',
            info: {
                firstName: 'Test',
                lastName: 'User'
            }
        };
        
        const body = JSON.stringify(applicantData);
        const headers = createHeaders('POST', endpoint, body);
        
        console.log('\nHeaders:', headers);
        console.log('Body:', body);
        
        const response = await axios({
            method: 'POST',
            url: `${baseUrl}${endpoint}`,
            headers,
            data: body
        });
        
        console.log('\nSUCCESS! Applicant created:');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
        // Тестируем получение access token
        const tokenEndpoint = '/resources/accessTokens';
        const tokenData = {
            userId: response.data.id,
            levelName: 'basic-kyc-level',
            ttlInSecs: 3600
        };
        
        const tokenBody = JSON.stringify(tokenData);
        const tokenHeaders = createHeaders('POST', tokenEndpoint, tokenBody);
        
        const tokenResponse = await axios({
            method: 'POST',
            url: `${baseUrl}${tokenEndpoint}`,
            headers: tokenHeaders,
            data: tokenBody
        });
        
        console.log('\nACCESS TOKEN SUCCESS:');
        console.log('Token response:', JSON.stringify(tokenResponse.data, null, 2));
        
    } catch (error) {
        console.error('\nAPI ERROR:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Full error:', error.message);
    }
}

testAPI();