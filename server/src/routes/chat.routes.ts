import express from 'express';
import {
  getUserChats,
  getAdminChats,
  createChat,
  getChatById,
  markMessagesAsRead,
  assignChat,
  closeChat,
  getChatStats,
  sendMessage,
  sendGuestMessage
} from '../controllers/chat.controller';
import { protect } from '../middleware/auth.middleware';
import { adminProtect } from '../middleware/admin.middleware';

const router = express.Router();

// Public routes (for guest users from landing)
router.post('/create', createChat); // Allow both authenticated and guest users
router.post('/guest/message', sendGuestMessage); // Allow guest users to send messages
router.get('/:chatId', getChatById); // Allow both authenticated and guest users to get chat

// Admin routes (specific routes first, no global protect middleware interference)
router.get('/stats', adminProtect, getChatStats); // GET /api/chat/stats for CRM client
router.get('/admin/all', adminProtect, getAdminChats);
router.get('/admin/stats', adminProtect, getChatStats);
router.post('/:chatId/assign', adminProtect, assignChat); // POST /api/chat/:chatId/assign for CRM client
router.post('/:chatId/close', adminProtect, closeChat); // POST /api/chat/:chatId/close for CRM client
router.put('/:chatId/assign', adminProtect, assignChat);
router.get('/', adminProtect, getAdminChats); // GET /api/chat for CRM client

// Protected routes (require authentication) - specific routes
router.get('/user', protect, getUserChats);
router.put('/:chatId/read', protect, markMessagesAsRead);
router.post('/:chatId/read', protect, markMessagesAsRead); // POST /api/chat/:chatId/read for CRM client
router.post('/:chatId/message', protect, sendMessage); // POST /api/chat/:chatId/message for authenticated users
router.put('/:chatId/close', protect, closeChat);

export default router;