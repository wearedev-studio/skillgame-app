import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import {
    createDeposit,
    createWithdrawal,
    getPaymentStatus,
    handleWebhook,
    getUserPayments
} from '../controllers/payment.controller';

const router = Router();

// Protected routes (require authentication)
router.post('/deposit', protect, createDeposit);
router.post('/withdrawal', protect, createWithdrawal);
router.get('/status/:paymentId', protect, getPaymentStatus);
router.get('/history', protect, getUserPayments);

// Public webhook route (no authentication required)
router.post('/webhook', handleWebhook);

export default router;