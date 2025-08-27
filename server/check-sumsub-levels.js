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

async function checkLevels() {
    try {
        console.log('Checking available Sumsub levels...');
        
        // Получаем доступные уровни
        const endpoint = '/resources/levels';
        const headers = createHeaders('GET', endpoint);
        
        const response = await axios({
            method: 'GET',
            url: `${baseUrl}${endpoint}`,
            headers
        });
        
        console.log('\nAvailable levels:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('\nAPI ERROR:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Full error:', error.message);
    }
}

checkLevels();