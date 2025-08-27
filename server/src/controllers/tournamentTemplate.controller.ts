import { Request, Response } from 'express';
import TournamentTemplate, { ITournamentTemplate } from '../models/TournamentTemplate.model';
import tournamentScheduler from '../services/tournamentScheduler.service';

// Тип для аутентифицированных запросов (user уже определен в глобальной декларации)
type AuthenticatedRequest = Request;

// Получить все шаблоны турниров с пагинацией
export const getAllTemplates = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const status = req.query.status as string;
        const gameType = req.query.gameType as string;
        const search = req.query.search as string;
        
        // Build filter query
        const filter: any = {};
        if (status && status !== 'all') {
            if (status === 'active') {
                filter.isActive = true;
            } else if (status === 'inactive') {
                filter.isActive = false;
            }
        }
        if (gameType && gameType !== 'all') {
            filter.gameType = gameType;
        }
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }
        
        const skip = (page - 1) * limit;
        
        // Get templates with pagination
        const [templates, total] = await Promise.all([
            TournamentTemplate.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            TournamentTemplate.countDocuments(filter)
        ]);
        
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.json({
            success: true,
            data: templates,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: limit,
                hasNext,
                hasPrev
            }
        });
    } catch (error) {
        console.error('Error getting tournament templates:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving tournament templates'
        });
    }
};

// Получить активные шаблоны
export const getActiveTemplates = async (req: Request, res: Response) => {
    try {
        const templates = await TournamentTemplate.find({ isActive: true })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('Error getting active tournament templates:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving active tournament templates'
        });
    }
};

// Получить конкретный шаблон
export const getTemplate = async (req: Request, res: Response) => {
    try {
        const { templateId } = req.params;
        
        const template = await TournamentTemplate.findById(templateId);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Tournament template not found'
            });
        }

        res.json({
            success: true,
            data: template
        });
    } catch (error) {
        console.error('Error getting tournament template:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving tournament template'
        });
    }
};

// Создать новый шаблон
export const createTemplate = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const {
            name,
            gameType,
            maxPlayers,
            entryFee,
            platformCommission,
            schedule,
            timeSettings
        } = req.body;

        const userId = (req.user!._id as any).toString();

        // Валидация обязательных полей
        if (!name || !gameType || !maxPlayers || entryFee === undefined || !schedule) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Валидация типов игр
        const validGameTypes = ['tic-tac-toe', 'checkers', 'chess', 'backgammon', 'durak', 'domino', 'dice', 'bingo'];
        if (!validGameTypes.includes(gameType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid game type'
            });
        }

        // Валидация количества игроков
        if (![4, 8, 16, 32].includes(maxPlayers)) {
            return res.status(400).json({
                success: false,
                message: 'Max players must be 4, 8, 16, or 32'
            });
        }

        // Валидация типа расписания
        const validScheduleTypes = ['interval', 'fixed_time', 'dynamic'];
        if (!validScheduleTypes.includes(schedule.type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid schedule type'
            });
        }

        // Создаем шаблон
        const template = new TournamentTemplate({
            name: name.trim(),
            gameType,
            maxPlayers,
            entryFee,
            platformCommission: platformCommission || 10,
            schedule,
            timeSettings: timeSettings || {
                timeZone: 'Europe/Moscow',
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                startHour: 0,
                endHour: 23
            },
            createdBy: userId,
            isActive: true,
            totalTournamentsCreated: 0,
            stats: {
                totalPlayers: 0,
                totalPrizePool: 0,
                averagePlayerCount: 0,
                successRate: 0
            }
        });

        await template.save();

        res.status(201).json({
            success: true,
            message: 'Tournament template created successfully',
            data: template
        });
    } catch (error) {
        console.error('Error creating tournament template:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating tournament template'
        });
    }
};

// Обновить шаблон
export const updateTemplate = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { templateId } = req.params;
        const updateData = req.body;

        const template = await TournamentTemplate.findById(templateId);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Tournament template not found'
            });
        }

        // Обновляем разрешенные поля
        const allowedFields = [
            'name', 'gameType', 'maxPlayers', 'entryFee', 'platformCommission',
            'schedule', 'timeSettings', 'isActive'
        ];

        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                (template as any)[field] = updateData[field];
            }
        });

        await template.save();

        res.json({
            success: true,
            message: 'Tournament template updated successfully',
            data: template
        });
    } catch (error) {
        console.error('Error updating tournament template:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating tournament template'
        });
    }
};

// Удалить шаблон
export const deleteTemplate = async (req: Request, res: Response) => {
    try {
        const { templateId } = req.params;

        const template = await TournamentTemplate.findById(templateId);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Tournament template not found'
            });
        }

        await TournamentTemplate.findByIdAndDelete(templateId);

        res.json({
            success: true,
            message: 'Tournament template deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting tournament template:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting tournament template'
        });
    }
};

// Переключить активность шаблона
export const toggleTemplateActive = async (req: Request, res: Response) => {
    try {
        const { templateId } = req.params;

        const template = await TournamentTemplate.findById(templateId);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Tournament template not found'
            });
        }

        template.isActive = !template.isActive;
        await template.save();

        res.json({
            success: true,
            message: `Tournament template ${template.isActive ? 'activated' : 'deactivated'} successfully`,
            data: template
        });
    } catch (error) {
        console.error('Error toggling tournament template:', error);
        res.status(500).json({
            success: false,
            message: 'Error toggling tournament template'
        });
    }
};

// Получить статистику планировщика
export const getSchedulerStats = async (req: Request, res: Response) => {
    try {
        const stats = tournamentScheduler.getStats();
        const isRunning = tournamentScheduler.isSchedulerRunning();

        // Получаем дополнительную статистику
        const totalTemplates = await TournamentTemplate.countDocuments({});
        const activeTemplates = await TournamentTemplate.countDocuments({ isActive: true });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const tournamentsCreatedToday = await TournamentTemplate.aggregate([
            {
                $match: {
                    lastTournamentCreated: {
                        $gte: today,
                        $lt: tomorrow
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                ...stats,
                isRunning,
                totalTemplates,
                activeTemplates,
                tournamentsCreatedToday: tournamentsCreatedToday[0]?.count || 0
            }
        });
    } catch (error) {
        console.error('Error getting scheduler stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving scheduler statistics'
        });
    }
};

// Принудительная проверка планировщика
export const forceSchedulerCheck = async (req: Request, res: Response) => {
    try {
        await tournamentScheduler.forceCheck();

        res.json({
            success: true,
            message: 'Forced scheduler check completed'
        });
    } catch (error) {
        console.error('Error forcing scheduler check:', error);
        res.status(500).json({
            success: false,
            message: 'Error forcing scheduler check'
        });
    }
};

// Запуск планировщика
export const startScheduler = async (req: Request, res: Response) => {
    try {
        if (tournamentScheduler.isSchedulerRunning()) {
            return res.status(400).json({
                success: false,
                message: 'Scheduler is already running'
            });
        }

        tournamentScheduler.start();

        res.json({
            success: true,
            message: 'Tournament scheduler started successfully'
        });
    } catch (error) {
        console.error('Error starting scheduler:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting scheduler'
        });
    }
};

// Остановка планировщика
export const stopScheduler = async (req: Request, res: Response) => {
    try {
        if (!tournamentScheduler.isSchedulerRunning()) {
            return res.status(400).json({
                success: false,
                message: 'Scheduler is not running'
            });
        }

        tournamentScheduler.stop();

        res.json({
            success: true,
            message: 'Tournament scheduler stopped successfully'
        });
    } catch (error) {
        console.error('Error stopping scheduler:', error);
        res.status(500).json({
            success: false,
            message: 'Error stopping scheduler'
        });
    }
};

// Создать базовые шаблоны
export const createDefaultTemplates = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = (req.user!._id as any).toString();
        
        await tournamentScheduler.createDefaultTemplates(userId);

        res.json({
            success: true,
            message: 'Default tournament templates created successfully'
        });
    } catch (error) {
        console.error('Error creating default templates:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating default templates'
        });
    }
};