const mongoose = require('mongoose');
require('dotenv').config();

// Подключение к MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

// Миграция существующих KYC данных
const migrateKycData = async () => {
    try {
        console.log('Starting KYC data migration...');

        // 1. Обновляем всех пользователей без поля kycProvider на LEGACY
        const legacyUpdate = await mongoose.connection.db.collection('users').updateMany(
            { kycProvider: { $exists: false } },
            { $set: { kycProvider: 'LEGACY' } }
        );

        console.log(`Updated ${legacyUpdate.modifiedCount} users to LEGACY provider`);

        // 2. Обновляем всех новых пользователей без KYC данных на SUMSUB
        const newUsersUpdate = await mongoose.connection.db.collection('users').updateMany(
            { 
                kycProvider: { $exists: false },
                kycStatus: 'NOT_SUBMITTED',
                kycDocuments: { $size: 0 }
            },
            { $set: { kycProvider: 'SUMSUB' } }
        );

        console.log(`Updated ${newUsersUpdate.modifiedCount} new users to SUMSUB provider`);

        // 3. Получаем статистику после миграции
        const stats = await mongoose.connection.db.collection('users').aggregate([
            {
                $group: {
                    _id: {
                        provider: '$kycProvider',
                        status: '$kycStatus'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.provider': 1, '_id.status': 1 } }
        ]).toArray();

        console.log('\n=== Migration Statistics ===');
        console.log('Provider | Status | Count');
        console.log('---------|--------|-------');
        
        stats.forEach(stat => {
            const provider = stat._id.provider || 'NULL';
            const status = stat._id.status || 'NULL';
            console.log(`${provider.padEnd(8)} | ${status.padEnd(6)} | ${stat.count}`);
        });

        // 4. Проверяем целостность данных
        const totalUsers = await mongoose.connection.db.collection('users').countDocuments();
        const usersWithProvider = await mongoose.connection.db.collection('users').countDocuments({
            kycProvider: { $exists: true }
        });

        console.log('\n=== Data Integrity Check ===');
        console.log(`Total users: ${totalUsers}`);
        console.log(`Users with provider: ${usersWithProvider}`);
        console.log(`Users without provider: ${totalUsers - usersWithProvider}`);

        if (totalUsers === usersWithProvider) {
            console.log('✅ All users have kycProvider field - migration successful!');
        } else {
            console.log('⚠️  Some users still missing kycProvider field');
        }

        // 5. Создаем индексы для оптимизации
        await mongoose.connection.db.collection('users').createIndex({ kycProvider: 1 });
        await mongoose.connection.db.collection('users').createIndex({ 'sumsubData.applicantId': 1 });
        
        console.log('✅ Created database indexes for KYC fields');

        console.log('\n=== Migration Completed Successfully ===');
        
    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    }
};

// Функция отката миграции (если понадобится)
const rollbackMigration = async () => {
    try {
        console.log('Starting migration rollback...');

        // Удаляем поля kycProvider и sumsubData
        const rollbackResult = await mongoose.connection.db.collection('users').updateMany(
            {},
            { 
                $unset: { 
                    kycProvider: "",
                    sumsubData: ""
                }
            }
        );

        console.log(`Rolled back ${rollbackResult.modifiedCount} users`);
        console.log('✅ Rollback completed successfully');
        
    } catch (error) {
        console.error('Rollback error:', error);
        throw error;
    }
};

// Основная функция
const main = async () => {
    await connectDB();

    const command = process.argv[2];

    switch (command) {
        case 'migrate':
            await migrateKycData();
            break;
        case 'rollback':
            await rollbackMigration();
            break;
        case 'stats':
            // Показать только статистику без изменений
            const stats = await mongoose.connection.db.collection('users').aggregate([
                {
                    $group: {
                        _id: {
                            provider: '$kycProvider',
                            status: '$kycStatus'
                        },
                        count: { $sum: 1 }
                    }
                }
            ]).toArray();
            
            console.log('Current KYC Statistics:');
            console.log(stats);
            break;
        default:
            console.log('Usage:');
            console.log('  node migrate-kyc-to-sumsub.js migrate   - Run migration');
            console.log('  node migrate-kyc-to-sumsub.js rollback  - Rollback migration');
            console.log('  node migrate-kyc-to-sumsub.js stats     - Show current stats');
            break;
    }

    await mongoose.connection.close();
    console.log('Database connection closed');
};

// Обработка ошибок
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});

// Запуск скрипта
main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});