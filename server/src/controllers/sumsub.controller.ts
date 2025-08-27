import { Request, Response } from 'express';
import { sumsubService } from '../services/sumsub.service';
import User from '../models/User.model';
import { createNotification } from '../services/notification.service';

/**
 * Получает access token для Sumsub WebSDK
 */
export const getSumsubAccessToken = async (req: Request, res: Response) => {
    try {
        // Проверяем наличие пользователя в req
        if (!req.user || !req.user.id) {
            console.error('❌ [SUMSUB] No user in request object');
            return res.status(401).json({
                message: 'User not authenticated',
                code: 'NO_USER_IN_REQUEST'
            });
        }

        const userId = req.user.id;
        console.log(`🔍 [SUMSUB] Getting access token for user: ${userId}`);
        
        const user = await User.findById(userId);
        
        if (!user) {
            console.error(`❌ [SUMSUB] User not found in database: ${userId}`);
            return res.status(404).json({
                message: 'User not found in database',
                code: 'USER_NOT_FOUND_DB'
            });
        }

        console.log(`✅ [SUMSUB] User found: ${user.username} (${user.email})`);

        // Генерируем access token через Sumsub API (или mock)
        const tokenData = await sumsubService.generateAccessToken(userId);
        
        // Обновляем данные пользователя
        if (!user.sumsubData) {
            user.sumsubData = {
                externalUserId: userId,
                levelName: 'basic-kyc-level'
            };
        }
        
        user.sumsubData.applicantId = tokenData.userId;
        user.kycProvider = 'SUMSUB';
        await user.save();

        console.log(`✅ [SUMSUB] Access token generated successfully for user: ${userId}`);

        res.json({
            token: tokenData.token,
            applicantId: tokenData.userId
        });
    } catch (error: any) {
        console.error('❌ [SUMSUB] Error generating access token:', error);
        res.status(500).json({
            message: 'Failed to generate access token',
            error: error.message,
            code: 'ACCESS_TOKEN_ERROR'
        });
    }
};

/**
 * Получает статус верификации пользователя из Sumsub
 */
export const getSumsubVerificationStatus = async (req: Request, res: Response) => {
    try {
        // Проверяем наличие пользователя в req
        if (!req.user || !req.user.id) {
            console.error('❌ [SUMSUB] No user in request object for verification status');
            return res.status(401).json({
                message: 'User not authenticated',
                status: 'NOT_STARTED',
                code: 'NO_USER_IN_REQUEST'
            });
        }

        const userId = req.user.id;
        console.log(`🔍 [SUMSUB] Getting verification status for user: ${userId}`);
        
        const user = await User.findById(userId);
        
        if (!user) {
            console.error(`❌ [SUMSUB] User not found in database: ${userId}`);
            return res.status(404).json({
                message: 'User not found in database',
                status: 'NOT_STARTED',
                code: 'USER_NOT_FOUND_DB'
            });
        }

        console.log(`✅ [SUMSUB] User found: ${user.username}, KYC Provider: ${user.kycProvider || 'NONE'}`);

        // Если у пользователя нет Sumsub данных, возвращаем NOT_STARTED
        if (!user.sumsubData?.applicantId) {
            console.log(`ℹ️ [SUMSUB] No Sumsub applicant for user: ${userId}`);
            return res.status(200).json({
                message: 'Sumsub verification not started yet',
                status: 'NOT_STARTED',
                kycStatus: user.kycStatus || 'NOT_SUBMITTED'
            });
        }

        // Получаем статус из Sumsub (или mock)
        const verificationStatus = await sumsubService.getVerificationStatus(user.sumsubData.applicantId);
        
        // Обновляем локальный статус пользователя
        let kycStatus = user.kycStatus;
        switch (verificationStatus.status) {
            case 'APPROVED':
                kycStatus = 'APPROVED';
                break;
            case 'REJECTED':
                kycStatus = 'REJECTED';
                user.kycRejectionReason = verificationStatus.moderationComment || 'Verification failed';
                break;
            case 'PENDING':
                kycStatus = 'PENDING';
                break;
            default:
                kycStatus = 'NOT_SUBMITTED';
        }

        if (user.kycStatus !== kycStatus) {
            user.kycStatus = kycStatus;
            await user.save();
        }

        console.log(`✅ [SUMSUB] Verification status retrieved: ${verificationStatus.status}`);

        res.json({
            status: verificationStatus.status,
            kycStatus: user.kycStatus,
            reviewResult: verificationStatus.reviewResult,
            moderationComment: verificationStatus.moderationComment,
            applicantId: user.sumsubData.applicantId
        });
    } catch (error: any) {
        console.error('❌ [SUMSUB] Error getting verification status:', error);
        res.status(500).json({
            message: 'Failed to get verification status',
            error: error.message,
            code: 'VERIFICATION_STATUS_ERROR'
        });
    }
};

/**
 * Webhook endpoint для получения уведомлений от Sumsub
 */
export const handleSumsubWebhook = async (req: Request, res: Response) => {
    try {
        const signature = req.headers['x-payload-digest'] as string;
        
        if (!signature) {
            return res.status(400).json({ message: 'Missing signature header' });
        }

        // Получаем raw body для проверки подписи
        const rawBody = req.body;
        const payloadString = rawBody.toString('utf8');
        
        // Проверяем подпись webhook
        const isValidSignature = sumsubService.verifyWebhookSignature(
            payloadString,
            signature
        );

        if (!isValidSignature) {
            console.error('Invalid webhook signature');
            return res.status(401).json({ message: 'Invalid signature' });
        }

        // Парсим JSON после проверки подписи
        const payload = JSON.parse(payloadString);
        
        // Обрабатываем webhook
        const webhookResult = await sumsubService.processWebhook(payload);
        
        // Находим пользователя по externalUserId
        const user = await User.findById(webhookResult.userId);
        if (!user) {
            console.error('User not found for webhook:', webhookResult.userId);
            return res.status(404).json({ message: 'User not found' });
        }

        // Обновляем статус пользователя
        const oldStatus = user.kycStatus;
        user.kycStatus = webhookResult.status as any;
        
        // Обновляем Sumsub данные
        if (!user.sumsubData) {
            user.sumsubData = {
                externalUserId: webhookResult.userId
            };
        }
        
        user.sumsubData.applicantId = webhookResult.applicantId;
        user.sumsubData.reviewResult = webhookResult.reviewResult as any;
        user.sumsubData.updatedAt = new Date();
        user.sumsubData.webhookData = payload;

        await user.save();

        // Отправляем уведомление пользователю, если статус изменился
        if (oldStatus !== webhookResult.status) {
            const io = req.app.get('io');
            
            let notificationMessage = '';
            switch (webhookResult.status) {
                case 'APPROVED':
                    notificationMessage = 'Your identity verification has been approved! You can now withdraw funds.';
                    break;
                case 'REJECTED':
                    notificationMessage = 'Your identity verification was rejected. Please contact support for more information.';
                    break;
                case 'PENDING':
                    notificationMessage = 'Your identity verification is being reviewed. This may take 1-3 business days.';
                    break;
            }

            if (notificationMessage) {
                await createNotification(io, webhookResult.userId, {
                    title: 'Verification Status Update',
                    message: notificationMessage
                });
            }

            // Отправляем обновление статуса через WebSocket
            if (io) {
                io.emit('kycStatusUpdated', {
                    userId: webhookResult.userId,
                    kycStatus: webhookResult.status,
                    reviewResult: webhookResult.reviewResult
                });
            }
        }

        console.log('Webhook processed successfully:', {
            userId: webhookResult.userId,
            status: webhookResult.status,
            applicantId: webhookResult.applicantId
        });

        res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error: any) {
        console.error('Error processing Sumsub webhook:', error);
        res.status(500).json({ 
            message: 'Failed to process webhook',
            error: error.message 
        });
    }
};

/**
 * Получает информацию об аппликанте Sumsub (для админ панели)
 */
export const getSumsubApplicantInfo = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        
        if (!user || !user.sumsubData?.applicantId) {
            return res.status(404).json({ message: 'Sumsub applicant not found' });
        }

        // Получаем полную информацию об аппликанте
        const applicantInfo = await sumsubService.getApplicant(user.sumsubData.applicantId);
        const verificationStatus = await sumsubService.getVerificationStatus(user.sumsubData.applicantId);

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            },
            sumsub: {
                applicantId: user.sumsubData.applicantId,
                externalUserId: user.sumsubData.externalUserId,
                levelName: user.sumsubData.levelName,
                applicantInfo,
                verificationStatus
            },
            localKycStatus: user.kycStatus
        });
    } catch (error: any) {
        console.error('Error getting Sumsub applicant info:', error);
        res.status(500).json({ 
            message: 'Failed to get applicant info',
            error: error.message 
        });
    }
};

/**
 * Принудительно синхронизирует статус из Sumsub (для админ панели)
 */
export const syncSumsubStatus = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        
        if (!user || !user.sumsubData?.applicantId) {
            return res.status(404).json({ message: 'Sumsub applicant not found' });
        }

        // Получаем актуальный статус из Sumsub
        const verificationStatus = await sumsubService.getVerificationStatus(user.sumsubData.applicantId);
        
        const oldStatus = user.kycStatus;
        
        // Обновляем статус пользователя
        switch (verificationStatus.status) {
            case 'APPROVED':
                user.kycStatus = 'APPROVED';
                user.kycRejectionReason = undefined;
                break;
            case 'REJECTED':
                user.kycStatus = 'REJECTED';
                user.kycRejectionReason = verificationStatus.moderationComment || 'Verification failed';
                break;
            case 'PENDING':
                user.kycStatus = 'PENDING';
                user.kycRejectionReason = undefined;
                break;
            default:
                user.kycStatus = 'NOT_SUBMITTED';
        }

        // Обновляем Sumsub данные
        user.sumsubData.reviewResult = verificationStatus.reviewResult as any;
        user.sumsubData.updatedAt = new Date();

        await user.save();

        // Отправляем обновление через WebSocket, если статус изменился
        if (oldStatus !== user.kycStatus) {
            const io = req.app.get('io');
            if (io) {
                io.emit('kycStatusUpdated', {
                    userId: userId,
                    kycStatus: user.kycStatus,
                    reviewResult: verificationStatus.reviewResult
                });
            }
        }

        res.json({
            message: 'Status synchronized successfully',
            oldStatus,
            newStatus: user.kycStatus,
            verificationStatus
        });
    } catch (error: any) {
        console.error('Error syncing Sumsub status:', error);
        res.status(500).json({ 
            message: 'Failed to sync status',
            error: error.message 
        });
    }
};