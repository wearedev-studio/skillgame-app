// Jest setup file for security tests
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const Redis = require('ioredis');

let mongoServer;
let redisClient;

// Global setup before all tests
beforeAll(async () => {
    // Setup in-memory MongoDB for testing
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri);
    
    // Setup Redis mock or in-memory Redis
    redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: 15, // Use different DB for testing
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
    });
    
    // Wait for Redis connection or use mock
    try {
        await redisClient.ping();
        console.log('Connected to Redis for testing');
    } catch (error) {
        console.warn('Redis not available, using mock for tests');
        // Could implement Redis mock here if needed
    }
    
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-min-32-chars';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.RATE_LIMIT_MAX_REQUESTS = '50';
    process.env.AUTH_RATE_LIMIT_MAX = '5';
    process.env.MAX_LOGIN_ATTEMPTS = '5';
    process.env.CSRF_ENABLED = 'true';
    process.env.XSS_PROTECTION_ENABLED = 'true';
    process.env.BRUTE_FORCE_ENABLED = 'true';
    
    // Disable some features for testing
    process.env.DISABLE_RATE_LIMITING = 'false';
    process.env.ENABLE_DEBUG_LOGS = 'false';
});

// Global cleanup after all tests
afterAll(async () => {
    // Cleanup database
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
    
    if (mongoServer) {
        await mongoServer.stop();
    }
    
    // Cleanup Redis
    if (redisClient) {
        await redisClient.quit();
    }
    
    // Wait for any pending async operations
    await new Promise(resolve => setTimeout(resolve, 100));
});

// Setup before each test
beforeEach(async () => {
    // Clear Redis cache before each test
    if (redisClient && redisClient.status === 'ready') {
        try {
            await redisClient.flushdb();
        } catch (error) {
            console.warn('Could not flush Redis DB:', error.message);
        }
    }
    
    // Clear any collections if needed
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});

// Global error handling for tests
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection in tests:', error);
});

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
console.error = (...args) => {
    // Only log actual errors, not expected test errors
    if (!args[0]?.toString().includes('Test error') && 
        !args[0]?.toString().includes('Expected failure')) {
        originalConsoleError(...args);
    }
};

// Export utilities for tests
module.exports = {
    getRedisClient: () => redisClient,
    getMongoUri: () => mongoServer?.getUri(),
    
    // Helper to create test user
    createTestUser: async () => {
        const User = require('../src/models/User');
        const bcrypt = require('bcryptjs');
        
        const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
        
        return await User.create({
            username: 'testuser',
            email: 'test@example.com',
            password: hashedPassword,
            role: 'USER',
            balance: 100
        });
    },
    
    // Helper to create admin user
    createAdminUser: async () => {
        const User = require('../src/models/User');
        const bcrypt = require('bcryptjs');
        
        const hashedPassword = await bcrypt.hash('AdminPassword123!', 12);
        
        return await User.create({
            username: 'admin',
            email: 'admin@example.com',
            password: hashedPassword,
            role: 'ADMIN',
            balance: 1000
        });
    },
    
    // Helper to generate JWT token
    generateToken: (payload = {}) => {
        const jwt = require('jsonwebtoken');
        return jwt.sign(
            { userId: 'test-user-id', ...payload },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
    },
    
    // Helper to wait for async operations
    wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};