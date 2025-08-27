import { Router } from 'express';
import {
    getAllTemplates,
    getActiveTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleTemplateActive,
    getSchedulerStats,
    forceSchedulerCheck,
    startScheduler,
    stopScheduler,
    createDefaultTemplates
} from '../controllers/tournamentTemplate.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Публичные роуты (для просмотра активных шаблонов)
router.route('/active').get(getActiveTemplates);
router.route('/scheduler/stats').get(getSchedulerStats);

// Защищенные роуты (требуют аутентификации)
router.route('/').get(protect, getAllTemplates);
router.route('/').post(protect, createTemplate);
router.route('/defaults').post(protect, createDefaultTemplates);

router.route('/:templateId').get(protect, getTemplate);
router.route('/:templateId').put(protect, updateTemplate);
router.route('/:templateId').delete(protect, deleteTemplate);
router.route('/:templateId/toggle').patch(protect, toggleTemplateActive);

// Роуты управления планировщиком (только для админов)
router.route('/scheduler/force-check').post(protect, forceSchedulerCheck);
router.route('/scheduler/start').post(protect, startScheduler);
router.route('/scheduler/stop').post(protect, stopScheduler);

export default router;