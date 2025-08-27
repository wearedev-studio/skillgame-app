const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};

const userSchema = new mongoose.Schema({
    email: String,
    kycStatus: { type: String, default: 'NOT_SUBMITTED' },
    kycProvider: { type: String, enum: ['LEGACY', 'SUMSUB'], default: 'SUMSUB' },
    sumsubData: {
        applicantId: String,
        reviewStatus: String,
        reviewResult: String,
        lastUpdated: Date
    }
});

const User = mongoose.model('User', userSchema);

const resetKycStatus = async () => {
    await connectDB();
    
    try {
        const result = await User.findOneAndUpdate(
            { email: 'test2@example.com' },
            { 
                $set: {
                    kycStatus: 'NOT_SUBMITTED',
                    kycProvider: 'SUMSUB'
                },
                $unset: {
                    sumsubData: ""
                }
            },
            { new: true }
        );
        
        if (result) {
            console.log('User KYC status reset successfully:', {
                email: result.email,
                kycStatus: result.kycStatus,
                kycProvider: result.kycProvider
            });
        } else {
            console.log('User not found');
        }
    } catch (error) {
        console.error('Error resetting KYC status:', error);
    } finally {
        await mongoose.connection.close();
    }
};

resetKycStatus();