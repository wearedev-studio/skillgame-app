import { Router } from 'express';
import express from 'express';
import {
    getSumsubAccessToken,
    getSumsubVerificationStatus,
    handleSumsubWebhook,
    getSumsubApplicantInfo,
    syncSumsubStatus
} from '../controllers/sumsub.controller';
import { protect } from '../middleware/auth.middleware';
import { adminProtect } from '../middleware/admin.middleware';
import User from '../models/User.model';

const router = Router();

// Пользовательские роуты
router.route('/access-token').get(protect, getSumsubAccessToken);
router.route('/verification-status').get(protect, getSumsubVerificationStatus);

// Mock KYC submission route для развития
router.post('/mock-submission', protect, async (req, res) => {
    try {
        const {
            kycProvider,
            kycStatus,
            mockMode,
            applicantId,
            documents,
            documentType,
            filesCount
        } = req.body;

        console.log('📥 Received mock KYC submission:', {
            userId: (req as any).user.id,
            applicantId,
            documentsCount: documents?.length || 0
        });

        // Находим пользователя
        const user = await User.findById((req as any).user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Создаем mock документы для сохранения
        const mockDocuments = documents.map((doc: any) => ({
            documentType: doc.documentType,
            filePath: `mock/${applicantId}/${doc.fileName}`,
            submittedAt: new Date(),
            mockData: true
        }));

        // Обновляем пользователя с KYC данными
        const updateData = {
            kycStatus: kycStatus || 'PENDING',
            kycProvider: 'SUMSUB',
            kycDocuments: mockDocuments,
            sumsubApplicantId: applicantId,
            sumsubProvider: 'SUMSUB',
            sumsubStatus: 'PENDING',
            sumsubData: {
                applicantId: applicantId,
                externalUserId: (req as any).user.id,
                mockMode: true,
                reviewStatus: 'pending',
                submittedAt: new Date(),
                documents: mockDocuments
            }
        };

        await User.findByIdAndUpdate((req as any).user.id, updateData, { new: true });

        console.log('✅ Mock KYC submission saved for user:', (req as any).user.id);

        res.json({
            success: true,
            message: 'Mock KYC submission saved successfully',
            applicantId: applicantId,
            status: 'PENDING',
            documents: mockDocuments
        });

    } catch (error: any) {
        console.error('❌ Error saving mock KYC submission:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save mock KYC submission',
            error: error.message
        });
    }
});

// Webhook роут (без аутентификации, проверяется подпись)
// Используем raw body для проверки подписи
router.route('/webhook').post(
    express.raw({ type: 'application/json' }),
    handleSumsubWebhook
);

// Админские роуты
router.route('/admin/applicant/:userId').get(adminProtect, getSumsubApplicantInfo);
router.route('/admin/sync/:userId').post(adminProtect, syncSumsubStatus);

export default router;