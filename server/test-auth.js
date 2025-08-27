const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Подключаемся к MongoDB
mongoose.connect(process.env.MONGO_URI);

// Импортируем модель User
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'BANNED'], default: 'ACTIVE' },
    balance: { type: Number, default: 0 },
    kycStatus: { type: String, enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'], default: 'NOT_SUBMITTED' },
    kycProvider: { type: String, enum: ['LEGACY', 'SUMSUB'], default: 'LEGACY' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function testAuth() {
    try {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YWI0M2EwNGFlMDQzYTY5Njc2MzhiOSIsImlhdCI6MTc1NjA1NDQzMiwiZXhwIjoxNzU4NjQ2NDMyfQ.i343ppbDvsC4Ac4xwZgTKSBedxHapkSs4O6jTGK8ZCs';
        
        console.log('🔍 Testing JWT token...');
        console.log('Token:', token);
        
        // Декодируем токен
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token decoded successfully:', decoded);
        
        // Ищем пользователя
        const user = await User.findById(decoded.id).select('-password');
        console.log('🔍 Searching for user with ID:', decoded.id);
        
        if (user) {
            console.log('✅ User found:', {
                id: user._id,
                username: user.username,
                email: user.email,
                status: user.status,
                role: user.role
            });
        } else {
            console.log('❌ User not found in database');
        }
        
    } catch (error) {
        console.error('❌ Auth test failed:', error);
    } finally {
        mongoose.connection.close();
    }
}

testAuth();