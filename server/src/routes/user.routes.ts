import { Router } from 'express';
import {
    getUserProfile,
    getGameHistory,
    getTransactionHistory,
    updateUserPassword,
    updateUserBalance,
    updateUserAvatar,
    submitKyc
} from '../controllers/user.controller';
import { protect } from '../middleware/auth.middleware';
import { upload } from '../config/multer';
import { uploadKyc } from '../config/multerKyc';

const router = Router();

router.route('/profile').get(protect, getUserProfile);
router.route('/profile/avatar').put(protect, upload.single('avatar'), updateUserAvatar);

router.route('/history/games').get(protect, getGameHistory);
router.route('/history/transactions').get(protect, getTransactionHistory);

router.route('/profile/password').put(protect, updateUserPassword);
router.route('/balance').post(protect, updateUserBalance);
router.post('/kyc', protect, uploadKyc.single('document'), submitKyc);


export default router;