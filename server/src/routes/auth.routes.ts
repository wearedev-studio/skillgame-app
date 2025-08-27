import { Router } from 'express';
import { 
  registerUser, 
  loginUser, 
  forgotPassword, 
  resetPassword 
} from '../controllers/auth.controller';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;