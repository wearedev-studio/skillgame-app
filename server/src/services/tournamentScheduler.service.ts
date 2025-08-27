import { Server } from 'socket.io';
import TournamentTemplate, { ITournamentTemplate } from '../models/TournamentTemplate.model';
import Tournament, { ITournament } from '../models/Tournament.model';
import { createTournament } from './tournament.service';
import { getIO } from '../socket';
import User from '../models/User.model';

interface SchedulerStats {
    totalTemplates: number;
    activeTemplates: number;
    tournamentsCreatedToday: number;
    lastCheck: Date;
    nextScheduledCheck: Date;
}

class TournamentSchedulerService {
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private stats: SchedulerStats = {
        totalTemplates: 0,
        activeTemplates: 0,
        tournamentsCreatedToday: 0,
        lastCheck: new Date(),
        nextScheduledCheck: new Date()
    };

    // Запуск планировщика
    public start(): void {
        if (this.isRunning) {
            console.log('[TournamentScheduler] Scheduler is already running');
            return;
        }

        console.log('[TournamentScheduler] Starting tournament scheduler...');
        this.isRunning = true;

        // Запускаем проверку каждые 2 минуты
        this.intervalId = setInterval(() => {
            this.checkAndCreateTournaments();
        }, 2 * 60 * 1000);

        // Выполняем первую проверку сразу
        setTimeout(() => {
            this.checkAndCreateTournaments();
        }, 5000); // Небольшая задержка для инициализации системы

        console.log('[TournamentScheduler] Tournament scheduler started');
    }

    // Остановка планировщика
    public stop(): void {
        if (!this.isRunning) {
            console.log('[TournamentScheduler] Scheduler is not running');
            return;
        }

        console.log('[TournamentScheduler] Stopping tournament scheduler...');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        console.log('[TournamentScheduler] Tournament scheduler stopped');
    }

    // Основная функция проверки и создания турниров
    private async checkAndCreateTournaments(): Promise<void> {
        try {
            console.log('[TournamentScheduler] Checking for tournaments to create...');
            
            const io = getIO();
            if (!io) {
                console.log('[TournamentScheduler] Socket.io not available, skipping check');
                return;
            }

            this.stats.lastCheck = new Date();

            // Получаем все активные шаблоны
            const templates = await TournamentTemplate.find({ isActive: true });
            this.stats.totalTemplates = await TournamentTemplate.countDocuments({});
            this.stats.activeTemplates = templates.length;

            console.log(`[TournamentScheduler] Found ${templates.length} active templates`);

            for (const template of templates) {
                await this.processTemplate(io, template);
            }

            this.stats.nextScheduledCheck = new Date(Date.now() + 2 * 60 * 1000);
            console.log('[TournamentScheduler] Check completed');

        } catch (error) {
            console.error('[TournamentScheduler] Error in tournament check:', error);
        }
    }

    // Обработка отдельного шаблона
    private async processTemplate(io: Server, template: ITournamentTemplate): Promise<void> {
        try {
            // Проверяем, должен ли создаваться турнир по этому шаблону
            if (!template.shouldCreateTournament()) {
                return;
            }

            let shouldCreate = false;

            switch (template.schedule.type) {
                case 'interval':
                    shouldCreate = await this.checkIntervalSchedule(template);
                    break;
                case 'fixed_time':
                    shouldCreate = await this.checkFixedTimeSchedule(template);
                    break;
                case 'dynamic':
                    shouldCreate = await this.checkDynamicSchedule(template);
                    break;
            }

            if (shouldCreate) {
                await this.createTournamentFromTemplate(io, template);
            }

        } catch (error) {
            console.error(`[TournamentScheduler] Error processing template ${template._id}:`, error);
        }
    }

    // Проверка расписания по интервалу
    private async checkIntervalSchedule(template: ITournamentTemplate): Promise<boolean> {
        if (!template.schedule.intervalMinutes) return false;

        const now = new Date();
        const intervalMs = template.schedule.intervalMinutes * 60 * 1000;

        // Если это первый турнир по шаблону
        if (!template.lastTournamentCreated) {
            return true;
        }

        // Проверяем, прошел ли интервал
        const timeSinceLastTournament = now.getTime() - template.lastTournamentCreated.getTime();
        return timeSinceLastTournament >= intervalMs;
    }

    // Проверка фиксированного расписания
    private async checkFixedTimeSchedule(template: ITournamentTemplate): Promise<boolean> {
        if (!template.schedule.fixedTimes || template.schedule.fixedTimes.length === 0) return false;

        const now = new Date();
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: template.timeSettings.timeZone }));
        const currentTimeString = `${moscowTime.getHours().toString().padStart(2, '0')}:${moscowTime.getMinutes().toString().padStart(2, '0')}`;

        // Проверяем, есть ли время в расписании для текущего времени (с точностью до 2 минут)
        for (const scheduledTime of template.schedule.fixedTimes) {
            const [schedHours, schedMinutes] = scheduledTime.split(':').map(Number);
            const scheduledTimeMs = schedHours * 60 + schedMinutes;
            const currentTimeMs = moscowTime.getHours() * 60 + moscowTime.getMinutes();

            // Проверяем, попадаем ли в окно 2 минуты
            if (Math.abs(currentTimeMs - scheduledTimeMs) <= 2) {
                // Проверяем, не создавали ли мы турнир в последние 10 минут
                if (template.lastTournamentCreated) {
                    const timeSinceLastTournament = now.getTime() - template.lastTournamentCreated.getTime();
                    if (timeSinceLastTournament < 10 * 60 * 1000) {
                        return false; // Не создаваем турнир, если уже создавали недавно
                    }
                }
                return true;
            }
        }

        return false;
    }

    // Проверка динамического расписания
    private async checkDynamicSchedule(template: ITournamentTemplate): Promise<boolean> {
        if (!template.schedule.dynamicRules) return false;

        const rules = template.schedule.dynamicRules;

        // Подсчитываем активные турниры данного типа игры
        const activeTournaments = await Tournament.countDocuments({
            gameType: template.gameType,
            status: { $in: ['WAITING', 'ACTIVE'] },
            maxPlayers: template.maxPlayers,
            entryFee: template.entryFee
        });

        console.log(`[TournamentScheduler] Active tournaments for ${template.gameType}: ${activeTournaments}`);

        // Если слишком много активных турниров
        if (activeTournaments >= rules.maxActiveTournaments) {
            return false;
        }

        // Если недостаточно активных турниров
        if (activeTournaments < rules.minActiveTournaments) {
            // Проверяем количество онлайн игроков (примерная оценка)
            const onlinePlayersCount = await this.getOnlinePlayersCount();
            console.log(`[TournamentScheduler] Online players: ${onlinePlayersCount}`);

            if (onlinePlayersCount >= rules.minPlayersOnline) {
                // Проверяем, не создавали ли мы турнир слишком недавно
                if (template.lastTournamentCreated) {
                    const timeSinceLastTournament = Date.now() - template.lastTournamentCreated.getTime();
                    const minIntervalBetweenDynamic = 10 * 60 * 1000; // 10 минут минимум между динамическими турнирами
                    
                    if (timeSinceLastTournament < minIntervalBetweenDynamic) {
                        return false;
                    }
                }
                return true;
            }
        }

        return false;
    }

    // Создание турнира на основе шаблона
    private async createTournamentFromTemplate(io: Server, template: ITournamentTemplate): Promise<void> {
        try {
            console.log(`[TournamentScheduler] Creating tournament from template: ${template.name}`);

            // Генерируем название турнира без времени
            let tournamentName = template.name;
            
            // Добавляем суффиксы только для некоторых типов расписания
            switch (template.schedule.type) {
                case 'dynamic':
                    tournamentName = `${template.name} - Auto`;
                    break;
                case 'fixed_time':
                    tournamentName = `${template.name} - Timed`;
                    break;
                case 'interval':
                default:
                    // Для интервальных турниров оставляем название без суффикса
                    tournamentName = template.name;
            }

            // Рассчитываем призовой фонд
            const prizePool = template.entryFee * template.maxPlayers;

            // Создаем турнир
            const tournament = await createTournament(
                io,
                tournamentName,
                template.gameType,
                template.maxPlayers,
                template.entryFee,
                prizePool,
                template.platformCommission
            );

            if (tournament) {
                // Обновляем статистику шаблона
                template.updateStats(tournament);
                await template.save();

                // Обновляем статистику планировщика
                this.stats.tournamentsCreatedToday++;

                console.log(`[TournamentScheduler] Successfully created tournament: ${tournament.name} (ID: ${tournament._id})`);
                
                // Отправляем уведомление всем подключенным пользователям
                io.emit('scheduledTournamentCreated', {
                    tournament,
                    template: {
                        name: template.name,
                        scheduleType: template.schedule.type
                    }
                });

            } else {
                console.error(`[TournamentScheduler] Failed to create tournament from template: ${template.name}`);
            }

        } catch (error) {
            console.error(`[TournamentScheduler] Error creating tournament from template ${template._id}:`, error);
        }
    }

    // Получение примерного количества онлайн игроков
    private async getOnlinePlayersCount(): Promise<number> {
        try {
            // Подсчитываем пользователей, которые были активны в последние 10 минут
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            
            const onlineCount = await User.countDocuments({
                lastActivity: { $gte: tenMinutesAgo }
            });

            return onlineCount;
        } catch (error) {
            console.error('[TournamentScheduler] Error getting online players count:', error);
            return 0;
        }
    }

    // Получение статистики планировщика
    public getStats(): SchedulerStats {
        return { ...this.stats };
    }

    // Проверка статуса планировщика
    public isSchedulerRunning(): boolean {
        return this.isRunning;
    }

    // Принудительная проверка (для админки)
    public async forceCheck(): Promise<void> {
        if (!this.isRunning) {
            throw new Error('Scheduler is not running');
        }
        
        console.log('[TournamentScheduler] Forced check triggered');
        await this.checkAndCreateTournaments();
    }

    // Создание базовых шаблонов при инициализации
    public async createDefaultTemplates(creatorId: string): Promise<void> {
        try {
            console.log('[TournamentScheduler] Creating default tournament templates...');

            const existingTemplatesCount = await TournamentTemplate.countDocuments({});
            if (existingTemplatesCount > 0) {
                console.log('[TournamentScheduler] Default templates already exist, skipping creation');
                return;
            }

            const defaultTemplates = [
                // Chess - every hour
                {
                    name: "Hourly Chess Tournament",
                    gameType: "chess" as const,
                    maxPlayers: 8 as const,
                    entryFee: 10,
                    platformCommission: 10,
                    schedule: {
                        type: "interval" as const,
                        intervalMinutes: 60
                    },
                    timeSettings: {
                        timeZone: "Europe/Moscow",
                        daysOfWeek: [1, 2, 3, 4, 5, 6, 0], // All days
                        startHour: 8,
                        endHour: 23
                    },
                    createdBy: creatorId
                },
                
                // Checkers - dynamic
                {
                    name: "Dynamic Checkers",
                    gameType: "checkers" as const,
                    maxPlayers: 8 as const,
                    entryFee: 5,
                    platformCommission: 10,
                    schedule: {
                        type: "dynamic" as const,
                        dynamicRules: {
                            minActiveTournaments: 1,
                            maxActiveTournaments: 3,
                            minPlayersOnline: 6
                        }
                    },
                    timeSettings: {
                        timeZone: "Europe/Moscow",
                        daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
                        startHour: 10,
                        endHour: 22
                    },
                    createdBy: creatorId
                },

                // Tic-Tac-Toe - fixed time
                {
                    name: "Quick Tic-Tac-Toe",
                    gameType: "tic-tac-toe" as const,
                    maxPlayers: 4 as const,
                    entryFee: 2.5,
                    platformCommission: 10,
                    schedule: {
                        type: "fixed_time" as const,
                        fixedTimes: ["12:00", "15:00", "18:00", "21:00"]
                    },
                    timeSettings: {
                        timeZone: "Europe/Moscow",
                        daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
                        startHour: 10,
                        endHour: 23
                    },
                    createdBy: creatorId
                }
            ];

            for (const templateData of defaultTemplates) {
                const template = new TournamentTemplate(templateData);
                await template.save();
                console.log(`[TournamentScheduler] Created default template: ${template.name}`);
            }

            console.log(`[TournamentScheduler] Created ${defaultTemplates.length} default templates`);

        } catch (error) {
            console.error('[TournamentScheduler] Error creating default templates:', error);
        }
    }
}

// Экспортируем единственный экземпляр планировщика
export const tournamentScheduler = new TournamentSchedulerService();

export default tournamentScheduler;