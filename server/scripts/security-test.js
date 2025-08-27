#!/usr/bin/env node

/**
 * Manual Security Testing Script
 * This script performs various security tests against the running application
 * Usage: node scripts/security-test.js [--host=localhost] [--port=5000]
 */

const axios = require('axios');
const colors = require('colors');

// Configuration
const config = {
    host: process.argv.find(arg => arg.startsWith('--host='))?.split('=')[1] || 'localhost',
    port: process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || '5000',
    timeout: 5000
};

const baseURL = `http://${config.host}:${config.port}`;

console.log(colors.cyan('🛡️  SkillGame Pro Security Test Suite'));
console.log(colors.gray(`Testing server: ${baseURL}\n`));

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

const logTest = (name, passed, message = '') => {
    totalTests++;
    if (passed) {
        passedTests++;
        console.log(colors.green(`✓ ${name}`));
    } else {
        failedTests++;
        console.log(colors.red(`✗ ${name}`));
        if (message) console.log(colors.yellow(`  ${message}`));
    }
};

const testSection = (name) => {
    console.log(colors.blue(`\n📋 ${name}`));
    console.log(colors.gray('─'.repeat(50)));
};

// Test functions
const testHealthEndpoint = async () => {
    try {
        const response = await axios.get(`${baseURL}/health`, { timeout: config.timeout });
        logTest('Health endpoint accessible', response.status === 200);
        return response.status === 200;
    } catch (error) {
        logTest('Health endpoint accessible', false, error.message);
        return false;
    }
};

const testSecurityHeaders = async () => {
    try {
        const response = await axios.get(`${baseURL}/health`, { timeout: config.timeout });
        const headers = response.headers;
        
        logTest('X-Content-Type-Options header', headers['x-content-type-options'] === 'nosniff');
        logTest('X-Frame-Options header', headers['x-frame-options'] === 'DENY');
        logTest('X-XSS-Protection header', headers['x-xss-protection'] === '1; mode=block');
        logTest('Strict-Transport-Security header', !!headers['strict-transport-security']);
        logTest('Content-Security-Policy header', !!headers['content-security-policy']);
        
    } catch (error) {
        logTest('Security headers test', false, error.message);
    }
};

const testRateLimiting = async () => {
    try {
        const requests = [];
        const rapidRequests = 20;
        
        console.log(colors.yellow(`  Sending ${rapidRequests} rapid requests...`));
        
        for (let i = 0; i < rapidRequests; i++) {
            requests.push(
                axios.get(`${baseURL}/health`, { 
                    timeout: config.timeout,
                    validateStatus: () => true // Don't throw on 429
                })
            );
        }
        
        const responses = await Promise.all(requests);
        const rateLimited = responses.some(r => r.status === 429);
        
        logTest('Rate limiting active', rateLimited, 
            rateLimited ? 'Some requests were rate limited' : 'No rate limiting detected');
        
    } catch (error) {
        logTest('Rate limiting test', false, error.message);
    }
};

const testCSRFProtection = async () => {
    try {
        // Test without CSRF token
        const response = await axios.post(`${baseURL}/api/admin/test`, {
            data: 'test'
        }, { 
            timeout: config.timeout,
            validateStatus: () => true
        });
        
        const csrfProtected = response.status === 403 && 
            (response.data.code === 'CSRF_TOKEN_MISSING' || response.data.error?.includes('CSRF'));
        
        logTest('CSRF protection active', csrfProtected,
            csrfProtected ? 'Requests without CSRF token are blocked' : 'CSRF protection may not be active');
        
    } catch (error) {
        logTest('CSRF protection test', false, error.message);
    }
};

const testXSSProtection = async () => {
    try {
        const xssPayload = '<script>alert("xss")</script>';
        const response = await axios.post(`${baseURL}/api/test`, {
            input: xssPayload
        }, { 
            timeout: config.timeout,
            validateStatus: () => true
        });
        
        // Check if payload was sanitized or request was blocked
        const protected = !JSON.stringify(response.data).includes('<script>');
        
        logTest('XSS protection active', protected,
            protected ? 'XSS payloads are sanitized' : 'XSS protection may not be active');
        
    } catch (error) {
        logTest('XSS protection test', false, error.message);
    }
};

const testBruteForceProtection = async () => {
    try {
        const attempts = [];
        const maxAttempts = 6;
        
        console.log(colors.yellow(`  Testing brute force protection with ${maxAttempts} failed login attempts...`));
        
        for (let i = 0; i < maxAttempts; i++) {
            attempts.push(
                axios.post(`${baseURL}/api/auth/login`, {
                    email: 'nonexistent@example.com',
                    password: 'wrongpassword'
                }, { 
                    timeout: config.timeout,
                    validateStatus: () => true,
                    headers: {
                        'X-Forwarded-For': '192.168.100.200' // Consistent IP for testing
                    }
                })
            );
        }
        
        const responses = await Promise.all(attempts);
        const blocked = responses.some(r => 
            r.status === 429 || 
            r.data.message?.includes('blocked') ||
            r.data.message?.includes('attempts')
        );
        
        logTest('Brute force protection active', blocked,
            blocked ? 'Multiple failed attempts trigger blocking' : 'Brute force protection may not be active');
        
    } catch (error) {
        logTest('Brute force protection test', false, error.message);
    }
};

const testInputValidation = async () => {
    try {
        // Test with invalid email
        const response = await axios.post(`${baseURL}/api/auth/register`, {
            email: 'invalid-email',
            password: 'ValidPassword123!',
            username: 'testuser'
        }, { 
            timeout: config.timeout,
            validateStatus: () => true
        });
        
        const validated = response.status === 400;
        
        logTest('Input validation active', validated,
            validated ? 'Invalid inputs are rejected' : 'Input validation may not be active');
        
    } catch (error) {
        logTest('Input validation test', false, error.message);
    }
};

const testSecurityEndpoints = async () => {
    try {
        // Test security dashboard endpoint (should require auth)
        const response = await axios.get(`${baseURL}/api/security/metrics`, { 
            timeout: config.timeout,
            validateStatus: () => true
        });
        
        const protected = response.status === 401;
        
        logTest('Security endpoints protected', protected,
            protected ? 'Security endpoints require authentication' : 'Security endpoints may be exposed');
        
    } catch (error) {
        logTest('Security endpoints test', false, error.message);
    }
};

const testFileUploadSecurity = async () => {
    try {
        // Test with dangerous file type
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', Buffer.from('malicious content'), {
            filename: 'malware.exe',
            contentType: 'application/octet-stream'
        });
        
        const response = await axios.post(`${baseURL}/api/upload`, form, {
            headers: form.getHeaders(),
            timeout: config.timeout,
            validateStatus: () => true
        });
        
        const protected = response.status === 400 || response.status === 415;
        
        logTest('File upload security active', protected,
            protected ? 'Dangerous file types are rejected' : 'File upload security may not be active');
        
    } catch (error) {
        logTest('File upload security test', false, error.message);
    }
};

// Main test execution
const runTests = async () => {
    try {
        testSection('Basic Connectivity');
        const serverRunning = await testHealthEndpoint();
        
        if (!serverRunning) {
            console.log(colors.red('\n❌ Server is not running or not accessible'));
            console.log(colors.yellow('Please ensure the server is running and try again.'));
            process.exit(1);
        }
        
        testSection('Security Headers');
        await testSecurityHeaders();
        
        testSection('Rate Limiting');
        await testRateLimiting();
        
        testSection('CSRF Protection');
        await testCSRFProtection();
        
        testSection('XSS Protection');
        await testXSSProtection();
        
        testSection('Brute Force Protection');
        await testBruteForceProtection();
        
        testSection('Input Validation');
        await testInputValidation();
        
        testSection('Authentication Protection');
        await testSecurityEndpoints();
        
        testSection('File Upload Security');
        await testFileUploadSecurity();
        
        // Summary
        console.log(colors.blue('\n📊 Test Summary'));
        console.log(colors.gray('─'.repeat(50)));
        console.log(`Total Tests: ${totalTests}`);
        console.log(colors.green(`Passed: ${passedTests}`));
        console.log(colors.red(`Failed: ${failedTests}`));
        
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        console.log(`Success Rate: ${successRate}%`);
        
        if (failedTests === 0) {
            console.log(colors.green('\n🎉 All security tests passed!'));
        } else if (successRate >= 80) {
            console.log(colors.yellow('\n⚠️  Most security tests passed, but some issues were found.'));
        } else {
            console.log(colors.red('\n🚨 Multiple security issues detected. Please review and fix.'));
        }
        
        // Recommendations
        console.log(colors.blue('\n💡 Recommendations'));
        console.log(colors.gray('─'.repeat(50)));
        console.log('• Review failed tests and ensure proper configuration');
        console.log('• Run automated test suite: npm run test:security');
        console.log('• Check security logs for detailed information');
        console.log('• Verify environment variables are properly set');
        console.log('• Consider running penetration testing tools');
        
    } catch (error) {
        console.error(colors.red('❌ Test execution failed:'), error.message);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(colors.yellow('\n\n⏹️  Tests interrupted by user'));
    process.exit(0);
});

// Start tests
runTests().catch(error => {
    console.error(colors.red('❌ Unexpected error:'), error.message);
    process.exit(1);
});