const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const Redis = require('ioredis');

describe('Security Tests', () => {
    let server;
    let redis;

    beforeAll(async () => {
        // Connect to test database
        const mongoUri = process.env.TEST_DATABASE_URI || 'mongodb://localhost:27017/skillgame-pro-test';
        await mongoose.connect(mongoUri);
        
        // Connect to Redis
        redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            db: 1 // Use different DB for testing
        });
        
        server = app.listen(0); // Use random port for testing
    });

    afterAll(async () => {
        await mongoose.connection.close();
        await redis.quit();
        await server.close();
    });

    beforeEach(async () => {
        // Clear Redis cache before each test
        await redis.flushdb();
    });

    describe('Rate Limiting Tests', () => {
        test('should enforce global rate limiting', async () => {
            const promises = [];
            const maxRequests = 50; // Lower than production for testing
            
            // Send requests in parallel to test rate limiting
            for (let i = 0; i < maxRequests + 10; i++) {
                promises.push(
                    request(app)
                        .get('/health')
                        .set('X-Forwarded-For', '192.168.1.100')
                );
            }
            
            const responses = await Promise.all(promises);
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        }, 30000);

        test('should enforce authentication rate limiting', async () => {
            const promises = [];
            const authRequests = 10;
            
            for (let i = 0; i < authRequests; i++) {
                promises.push(
                    request(app)
                        .post('/api/auth/login')
                        .set('X-Forwarded-For', '192.168.1.101')
                        .send({
                            email: 'test@example.com',
                            password: 'wrongpassword'
                        })
                );
            }
            
            const responses = await Promise.all(promises);
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('CSRF Protection Tests', () => {
        test('should reject requests without CSRF token', async () => {
            const response = await request(app)
                .post('/api/admin/users')
                .send({
                    username: 'testuser',
                    email: 'test@example.com'
                });
            
            expect(response.status).toBe(403);
            expect(response.body.code).toBe('CSRF_TOKEN_MISSING');
        });

        test('should accept requests with valid CSRF token', async () => {
            // First get CSRF token
            const tokenResponse = await request(app)
                .get('/api/csrf-token');
            
            expect(tokenResponse.status).toBe(200);
            expect(tokenResponse.body.csrfToken).toBeDefined();
            
            // Then make request with token
            const response = await request(app)
                .post('/api/admin/test-endpoint')
                .set('x-csrf-token', tokenResponse.body.csrfToken)
                .send({
                    test: 'data'
                });
            
            // Should not be rejected for CSRF (may fail for other reasons like auth)
            expect(response.body.code).not.toBe('CSRF_TOKEN_MISSING');
        });
    });

    describe('XSS Protection Tests', () => {
        const xssPayloads = [
            '<script>alert("xss")</script>',
            'javascript:alert("xss")',
            '<img src="x" onerror="alert(\'xss\')">',
            '<svg onload="alert(\'xss\')">',
            '"><script>alert("xss")</script>',
            '<iframe src="javascript:alert(\'xss\')"></iframe>'
        ];

        test.each(xssPayloads)('should sanitize XSS payload: %s', async (payload) => {
            const response = await request(app)
                .post('/api/test-xss')
                .send({
                    userInput: payload,
                    description: `Testing XSS with ${payload}`
                });
            
            // Response should not contain the raw payload
            expect(JSON.stringify(response.body)).not.toContain('<script>');
            expect(JSON.stringify(response.body)).not.toContain('javascript:');
            expect(JSON.stringify(response.body)).not.toContain('onerror=');
        });
    });

    describe('SQL/NoSQL Injection Tests', () => {
        const injectionPayloads = [
            { "$ne": null },
            { "$where": "function() { return true; }" },
            { "$regex": ".*" },
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            { "$gt": "" }
        ];

        test.each(injectionPayloads)('should prevent NoSQL injection: %o', async (payload) => {
            const response = await request(app)
                .post('/api/test-injection')
                .send({
                    query: payload,
                    filter: payload
                });
            
            // Should not execute malicious queries
            expect(response.status).not.toBe(500);
        });
    });

    describe('File Upload Security Tests', () => {
        test('should reject malicious file types', async () => {
            const maliciousFiles = [
                { filename: 'test.exe', mimetype: 'application/octet-stream' },
                { filename: 'script.js', mimetype: 'application/javascript' },
                { filename: 'virus.bat', mimetype: 'application/x-msdownload' },
                { filename: 'shell.php', mimetype: 'application/x-php' }
            ];

            for (const file of maliciousFiles) {
                const response = await request(app)
                    .post('/api/upload-test')
                    .attach('file', Buffer.from('malicious content'), file);
                
                expect(response.status).toBe(400);
            }
        });

        test('should accept safe file types', async () => {
            const safeFiles = [
                { filename: 'image.jpg', mimetype: 'image/jpeg' },
                { filename: 'document.pdf', mimetype: 'application/pdf' },
                { filename: 'photo.png', mimetype: 'image/png' }
            ];

            for (const file of safeFiles) {
                const response = await request(app)
                    .post('/api/upload-test')
                    .attach('file', Buffer.from('safe content'), file);
                
                // Should not be rejected for file type (may fail for other reasons)
                expect(response.status).not.toBe(400);
            }
        });

        test('should reject oversized files', async () => {
            const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
            
            const response = await request(app)
                .post('/api/upload-test')
                .attach('file', largeBuffer, {
                    filename: 'large.jpg',
                    mimetype: 'image/jpeg'
                });
            
            expect(response.status).toBe(413); // Payload too large
        });
    });

    describe('Authentication Security Tests', () => {
        test('should enforce strong JWT validation', async () => {
            const invalidTokens = [
                'invalid.token.here',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
                '',
                'Bearer invalid-token'
            ];

            for (const token of invalidTokens) {
                const response = await request(app)
                    .get('/api/admin/users')
                    .set('Authorization', `Bearer ${token}`);
                
                expect(response.status).toBe(401);
            }
        });

        test('should reject expired tokens', async () => {
            // Create an expired token for testing
            const jwt = require('jsonwebtoken');
            const expiredToken = jwt.sign(
                { userId: 'test', email: 'test@example.com' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '-1h' } // Expired 1 hour ago
            );

            const response = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${expiredToken}`);
            
            expect(response.status).toBe(401);
        });
    });

    describe('Brute Force Protection Tests', () => {
        test('should block IP after multiple failed login attempts', async () => {
            const attempts = [];
            const maxAttempts = 6; // One more than the limit
            
            for (let i = 0; i < maxAttempts; i++) {
                attempts.push(
                    request(app)
                        .post('/api/auth/login')
                        .set('X-Forwarded-For', '192.168.1.200')
                        .send({
                            email: 'nonexistent@example.com',
                            password: 'wrongpassword'
                        })
                );
            }
            
            const responses = await Promise.all(attempts);
            const blockedResponses = responses.filter(res => 
                res.status === 429 || res.body.message?.includes('blocked')
            );
            
            expect(blockedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('Security Headers Tests', () => {
        test('should include security headers', async () => {
            const response = await request(app).get('/health');
            
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-xss-protection']).toBe('1; mode=block');
            expect(response.headers['strict-transport-security']).toBeDefined();
            expect(response.headers['content-security-policy']).toBeDefined();
        });

        test('should set proper CORS headers', async () => {
            const response = await request(app)
                .options('/api/health')
                .set('Origin', 'http://localhost:3000');
            
            expect(response.headers['access-control-allow-origin']).toBeDefined();
            expect(response.headers['access-control-allow-methods']).toBeDefined();
        });
    });

    describe('Input Validation Tests', () => {
        test('should validate email format', async () => {
            const invalidEmails = [
                'notanemail',
                '@domain.com',
                'user@',
                'user@domain',
                'user..user@domain.com'
            ];

            for (const email of invalidEmails) {
                const response = await request(app)
                    .post('/api/auth/register')
                    .send({
                        email: email,
                        password: 'ValidPassword123!',
                        username: 'testuser'
                    });
                
                expect(response.status).toBe(400);
            }
        });

        test('should enforce password complexity', async () => {
            const weakPasswords = [
                '123456',
                'password',
                'abc',
                '12345678',
                'PASSWORD123'
            ];

            for (const password of weakPasswords) {
                const response = await request(app)
                    .post('/api/auth/register')
                    .send({
                        email: 'test@example.com',
                        password: password,
                        username: 'testuser'
                    });
                
                expect(response.status).toBe(400);
            }
        });
    });

    describe('Security Monitoring Tests', () => {
        test('should log security events', async () => {
            // Trigger a security event
            await request(app)
                .post('/api/auth/login')
                .set('X-Forwarded-For', '192.168.1.300')
                .send({
                    email: 'test@example.com',
                    password: '<script>alert("xss")</script>'
                });
            
            // Check if event was logged in Redis
            const events = await redis.lrange('security_events', 0, -1);
            expect(events.length).toBeGreaterThan(0);
        });

        test('should track failed login attempts', async () => {
            const ip = '192.168.1.400';
            
            await request(app)
                .post('/api/auth/login')
                .set('X-Forwarded-For', ip)
                .send({
                    email: 'nonexistent@example.com',
                    password: 'wrongpassword'
                });
            
            // Check if attempt was tracked
            const attempts = await redis.get(`failed_attempts:${ip}`);
            expect(parseInt(attempts) || 0).toBeGreaterThan(0);
        });
    });

    describe('API Security Tests', () => {
        test('should require authentication for protected endpoints', async () => {
            const protectedEndpoints = [
                '/api/admin/users',
                '/api/admin/tournaments',
                '/api/admin/transactions',
                '/api/security/metrics'
            ];

            for (const endpoint of protectedEndpoints) {
                const response = await request(app).get(endpoint);
                expect(response.status).toBe(401);
            }
        });

        test('should validate request content type', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'text/plain')
                .send('invalid content');
            
            expect(response.status).toBe(400);
        });
    });

    describe('Error Handling Security Tests', () => {
        test('should not expose sensitive information in errors', async () => {
            const response = await request(app)
                .get('/api/nonexistent-endpoint');
            
            expect(response.status).toBe(404);
            expect(JSON.stringify(response.body)).not.toMatch(/stack|trace|error.*\.js/i);
        });

        test('should handle malformed JSON gracefully', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}');
            
            expect(response.status).toBe(400);
        });
    });

    describe('Performance Security Tests', () => {
        test('should handle concurrent requests without crashing', async () => {
            const promises = [];
            const concurrentRequests = 100;
            
            for (let i = 0; i < concurrentRequests; i++) {
                promises.push(
                    request(app)
                        .get('/health')
                        .set('X-Forwarded-For', `192.168.1.${i % 255}`)
                );
            }
            
            const responses = await Promise.all(promises);
            const successfulResponses = responses.filter(res => res.status < 500);
            
            // Most requests should succeed (some may be rate limited)
            expect(successfulResponses.length).toBeGreaterThan(concurrentRequests * 0.7);
        }, 30000);
    });
});

// Utility functions for testing
const generateValidJWT = (payload = {}) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { userId: 'test-user', email: 'test@example.com', ...payload },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
    );
};

const createTestUser = async () => {
    // Helper function to create test user
    return await request(app)
        .post('/api/auth/register')
        .send({
            email: 'testuser@example.com',
            password: 'TestPassword123!',
            username: 'testuser'
        });
};

module.exports = {
    generateValidJWT,
    createTestUser
};