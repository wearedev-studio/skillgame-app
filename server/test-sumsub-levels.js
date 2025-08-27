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

async function testLevels() {
    try {
        console.log('Testing different level names...');
        
        // Попробуем разные названия уровней
        const possibleLevels = ['basic', 'standard', 'kyc', 'basic-kyc', 'kyc-basic', 'default'];
        let applicantCreated = false;
        let workingLevel = null;
        let applicantData = null;
        
        for (const levelName of possibleLevels) {
            console.log(`\nTrying level: ${levelName}`);
            const endpoint = `/resources/applicants?levelName=${levelName}`;
            const requestData = {
                externalUserId: `test-user-${Date.now()}`,
                info: {
                    firstName: 'Test',
                    lastName: 'User'
                }
            };
            
            try {
                const body = JSON.stringify(requestData);
                const headers = createHeaders('POST', endpoint, body);
                
                const response = await axios({
                    method: 'POST',
                    url: `${baseUrl}${endpoint}`,
                    headers,
                    data: body
                });
                
                console.log(`✓ SUCCESS with level: ${levelName}`);
                console.log('Response data:', JSON.stringify(response.data, null, 2));
                applicantCreated = true;
                workingLevel = levelName;
                applicantData = response.data;
                break;
            } catch (error) {
                console.log(`✗ Failed with level ${levelName}:`, error.response?.data?.description || error.message);
            }
        }
        
        if (!applicantCreated) {
            console.log('\n❌ All level attempts failed');
            return;
        }
        
        // Теперь тестируем создание access token
        console.log(`\n🔑 Testing access token creation with working level: ${workingLevel}`);
        const tokenEndpoint = '/resources/accessTokens';
        const tokenData = {
            userId: applicantData.id,
            levelName: workingLevel,
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
        
        console.log('✓ ACCESS TOKEN SUCCESS:');
        console.log('Token response:', JSON.stringify(tokenResponse.data, null, 2));
        console.log(`\n🎉 WORKING LEVEL NAME: ${workingLevel}`);
        
    } catch (error) {
        console.error('\n❌ API ERROR:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

testLevels();