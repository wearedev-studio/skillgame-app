const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Загружаем переменные окружения
dotenv.config();

// Подключаемся к MongoDB
mongoose.connect(process.env.MONGO_URI);

// Определяем схему пользователя (упрощенная версия)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'BANNED'], default: 'ACTIVE' },
    balance: { type: Number, default: 0 },
    kycStatus: { type: String, enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'], default: 'NOT_SUBMITTED' },
    kycProvider: { type: String, enum: ['LEGACY', 'SUMSUB'], default: 'LEGACY' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createTestUser() {
    try {
        console.log('🚀 Creating test user...');
        
        // Проверяем, существует ли уже пользователь
        const existingUser = await User.findOne({ email: 'test@example.com' });
        if (existingUser) {
            console.log('✅ Test user already exists:', existingUser.email);
            return;
        }
        
        // Хешируем пароль
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);
        
        // Создаем пользователя
        const testUser = new User({
            username: 'testuser',
            email: 'test@example.com',
            password: hashedPassword,
            role: 'USER',
            status: 'ACTIVE',
            balance: 1000, // Даем тестовому пользователю 1000 единиц баланса
            kycStatus: 'NOT_SUBMITTED',
            kycProvider: 'LEGACY'
        });
        
        await testUser.save();
        
        console.log('✅ Test user created successfully!');
        console.log('📧 Email: test@example.com');
        console.log('🔑 Password: password123');
        console.log('💰 Balance: 1000');
        console.log('🆔 User ID:', testUser._id);
        
    } catch (error) {
        console.error('❌ Error creating test user:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Запускаем создание тестового пользователя
createTestUser();