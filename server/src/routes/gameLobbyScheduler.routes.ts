import { Router } from 'express';
import {
    getLobbySchedulerStats,
    forceLobbySchedulerCheck,
    startLobbyScheduler,
    stopLobbyScheduler,
    cleanupOldRooms,
    getLobbyStats
} from '../controllers/gameLobbyScheduler.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Публичные роуты (для просмотра статистики)
router.route('/stats').get(getLobbySchedulerStats);
router.route('/lobby-stats').get(getLobbyStats);

// Защищенные роуты управления планировщиком (только для админов)
router.route('/force-check').post(protect, forceLobbySchedulerCheck);
router.route('/start').post(protect, startLobbyScheduler);
router.route('/stop').post(protect, stopLobbyScheduler);
router.route('/cleanup').post(protect, cleanupOldRooms);

export default router;