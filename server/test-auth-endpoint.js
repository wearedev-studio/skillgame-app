const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Простая копия auth middleware для тестирования
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: String,
    status: String,
    balance: Number,
    kycStatus: String,
    kycProvider: String,
}, { timestamps: true });

const User = mongoose.model('TestUser', userSchema);

const testProtect = async (req, res, next) => {
    let token;
    console.log('🔍 [AUTH MIDDLEWARE] Starting authentication...');
    
    // Extract token from different sources
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        console.log('✅ [AUTH MIDDLEWARE] Token found in Authorization header');
    } else {
        console.log('❌ [AUTH MIDDLEWARE] No token in Authorization header');
    }

    if (!token || token === 'null' || token === 'undefined') {
        console.log('❌ [AUTH MIDDLEWARE] No valid token provided');
        return res.status(401).json({
            message: 'Access denied. No token provided.',
            code: 'NO_TOKEN'
        });
    }

    try {
        console.log('🔍 [AUTH MIDDLEWARE] Verifying JWT token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ [AUTH MIDDLEWARE] Token verified:', { id: decoded.id });

        console.log('🔍 [AUTH MIDDLEWARE] Looking up user in database...');
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            console.log('❌ [AUTH MIDDLEWARE] User not found in database');
            return res.status(401).json({
                message: 'User no longer exists',
                code: 'USER_NOT_FOUND'
            });
        }

        console.log('✅ [AUTH MIDDLEWARE] User found:', {
            id: user._id,
            username: user.username,
            email: user.email
        });

        // Attach user to request
        req.user = user;
        console.log('✅ [AUTH MIDDLEWARE] User attached to request object');
        
        next();
    } catch (error) {
        console.log('❌ [AUTH MIDDLEWARE] JWT verification failed:', error.message);
        return res.status(401).json({ 
            message: 'Authentication failed',
            code: 'AUTH_FAILED',
            error: error.message
        });
    }
};

// Test endpoint
app.get('/test-auth', testProtect, (req, res) => {
    console.log('🎯 [TEST ENDPOINT] Reached protected endpoint');
    console.log('🔍 [TEST ENDPOINT] req.user exists:', !!req.user);
    console.log('🔍 [TEST ENDPOINT] req.user.id exists:', !!req.user?.id);
    console.log('🔍 [TEST ENDPOINT] req.user object:', req.user);
    
    res.json({
        message: 'Authentication successful!',
        user: {
            id: req.user?.id || req.user?._id,
            username: req.user?.username,
            email: req.user?.email
        }
    });
});

const PORT = 5002;
app.listen(PORT, () => {
    console.log(`🚀 Test auth server running on port ${PORT}`);
    console.log(`Test with: curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:${PORT}/test-auth`);
});