import mongoose, { Document, Schema } from 'mongoose';

export interface ITournamentTemplate extends Document {
    _id: string;
    name: string;
    gameType: 'tic-tac-toe' | 'checkers' | 'chess' | 'backgammon' | 'durak' | 'domino' | 'dice' | 'bingo';
    maxPlayers: 4 | 8 | 16 | 32;
    entryFee: number;
    platformCommission: number;
    isActive: boolean;
    
    // Расписание
    schedule: {
        type: 'interval' | 'fixed_time' | 'dynamic';
        intervalMinutes?: number; // Для типа 'interval' - каждые X минут
        fixedTimes?: string[]; // Для типа 'fixed_time' - массив времени в формате "HH:mm"
        dynamicRules?: {
            minActiveTournaments: number; // Минимальное количество активных турниров данного типа
            maxActiveTournaments: number; // Максимальное количество активных турниров
            minPlayersOnline: number; // Минимальное количество игроков онлайн для создания
        };
    };
    
    // Настройки времени
    timeSettings: {
        timeZone: string; // Часовой пояс для расписания
        daysOfWeek: number[]; // Дни недели когда активен (0-6, где 0 = воскресенье)
        startHour: number; // Час начала активности (0-23)
        endHour: number; // Час окончания активности (0-23)
    };
    
    // Метаданные
    createdBy: string; // ID админа, который создал шаблон
    createdAt: Date;
    updatedAt: Date;
    lastTournamentCreated?: Date;
    totalTournamentsCreated: number;
    
    // Статистика
    stats: {
        totalPlayers: number;
        totalPrizePool: number;
        averagePlayerCount: number;
        successRate: number; // Процент турниров, которые стартовали
    };
    
    // Методы экземпляра
    shouldCreateTournament(): boolean;
    getNextTournamentTime(): Date | null;
    updateStats(tournament: any): void;
}

const TournamentTemplateSchema = new Schema<ITournamentTemplate>({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    gameType: {
        type: String,
        required: true,
        enum: ['tic-tac-toe', 'checkers', 'chess', 'backgammon', 'durak', 'domino', 'dice', 'bingo']
    },
    maxPlayers: {
        type: Number,
        required: true,
        enum: [4, 8, 16, 32]
    },
    entryFee: {
        type: Number,
        required: true,
        min: 0
    },
    platformCommission: {
        type: Number,
        required: true,
        min: 0,
        max: 50,
        default: 10
    },
    isActive: {
        type: Boolean,
        default: true
    },
    
    schedule: {
        type: {
            type: String,
            required: true,
            enum: ['interval', 'fixed_time', 'dynamic']
        },
        intervalMinutes: {
            type: Number,
            min: 5,
            max: 1440 // Максимум раз в день
        },
        fixedTimes: [{
            type: String,
            match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/ // Формат HH:mm
        }],
        dynamicRules: {
            minActiveTournaments: {
                type: Number,
                min: 0,
                default: 1
            },
            maxActiveTournaments: {
                type: Number,
                min: 1,
                default: 5
            },
            minPlayersOnline: {
                type: Number,
                min: 1,
                default: 4
            }
        }
    },
    
    timeSettings: {
        timeZone: {
            type: String,
            default: 'Europe/Moscow'
        },
        daysOfWeek: [{
            type: Number,
            min: 0,
            max: 6
        }],
        startHour: {
            type: Number,
            min: 0,
            max: 23,
            default: 0
        },
        endHour: {
            type: Number,
            min: 0,
            max: 23,
            default: 23
        }
    },
    
    createdBy: {
        type: String,
        required: true
    },
    lastTournamentCreated: Date,
    totalTournamentsCreated: {
        type: Number,
        default: 0
    },
    
    stats: {
        totalPlayers: {
            type: Number,
            default: 0
        },
        totalPrizePool: {
            type: Number,
            default: 0
        },
        averagePlayerCount: {
            type: Number,
            default: 0
        },
        successRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    }
}, {
    timestamps: true
});

// Индексы для оптимизации запросов
TournamentTemplateSchema.index({ isActive: 1, 'schedule.type': 1 });
TournamentTemplateSchema.index({ gameType: 1, isActive: 1 });
TournamentTemplateSchema.index({ createdBy: 1 });
TournamentTemplateSchema.index({ 'timeSettings.daysOfWeek': 1, 'timeSettings.startHour': 1, 'timeSettings.endHour': 1 });

// Валидация
TournamentTemplateSchema.pre('save', function(next) {
    // Проверяем, что настройки расписания корректны
    if (this.schedule.type === 'interval' && !this.schedule.intervalMinutes) {
        return next(new Error('intervalMinutes is required for interval schedule type'));
    }
    
    if (this.schedule.type === 'fixed_time' && (!this.schedule.fixedTimes || this.schedule.fixedTimes.length === 0)) {
        return next(new Error('fixedTimes is required for fixed_time schedule type'));
    }
    
    if (this.schedule.type === 'dynamic' && !this.schedule.dynamicRules) {
        return next(new Error('dynamicRules is required for dynamic schedule type'));
    }
    
    // Проверяем логику времени
    if (this.timeSettings.startHour >= this.timeSettings.endHour && this.timeSettings.endHour !== 0) {
        return next(new Error('startHour must be less than endHour (except for overnight periods)'));
    }
    
    // Проверяем дни недели
    if (this.timeSettings.daysOfWeek.length === 0) {
        this.timeSettings.daysOfWeek = [0, 1, 2, 3, 4, 5, 6]; // Все дни по умолчанию
    }
    
    next();
});

// Методы экземпляра
TournamentTemplateSchema.methods.shouldCreateTournament = function(): boolean {
    const now = new Date();
    const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: this.timeSettings.timeZone }));
    
    // Проверяем день недели
    const dayOfWeek = moscowTime.getDay();
    if (!this.timeSettings.daysOfWeek.includes(dayOfWeek)) {
        return false;
    }
    
    // Проверяем время
    const currentHour = moscowTime.getHours();
    if (this.timeSettings.endHour > this.timeSettings.startHour) {
        // Обычный период (например, 9-17)
        if (currentHour < this.timeSettings.startHour || currentHour >= this.timeSettings.endHour) {
            return false;
        }
    } else if (this.timeSettings.endHour < this.timeSettings.startHour) {
        // Ночной период (например, 22-06)
        if (currentHour < this.timeSettings.startHour && currentHour >= this.timeSettings.endHour) {
            return false;
        }
    }
    
    return this.isActive;
};

TournamentTemplateSchema.methods.getNextTournamentTime = function(): Date | null {
    if (this.schedule.type === 'interval' && this.schedule.intervalMinutes) {
        const now = new Date();
        return new Date(now.getTime() + this.schedule.intervalMinutes * 60 * 1000);
    }
    
    if (this.schedule.type === 'fixed_time' && this.schedule.fixedTimes) {
        const now = new Date();
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: this.timeSettings.timeZone }));
        const currentHour = moscowTime.getHours();
        const currentMinute = moscowTime.getMinutes();
        const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        
        // Ищем следующее время в том же дне
        for (const timeStr of this.schedule.fixedTimes.sort()) {
            if (timeStr > currentTimeString) {
                const [hours, minutes] = timeStr.split(':').map(Number);
                const nextTime = new Date(moscowTime);
                nextTime.setHours(hours, minutes, 0, 0);
                return nextTime;
            }
        }
        
        // Если не нашли время сегодня, берем первое время завтра
        const firstTime = this.schedule.fixedTimes.sort()[0];
        const [hours, minutes] = firstTime.split(':').map(Number);
        const nextTime = new Date(moscowTime);
        nextTime.setDate(nextTime.getDate() + 1);
        nextTime.setHours(hours, minutes, 0, 0);
        return nextTime;
    }
    
    return null; // Для динамических турниров нет фиксированного времени
};

TournamentTemplateSchema.methods.updateStats = function(tournament: any) {
    this.stats.totalPlayers += tournament.players.length;
    this.stats.totalPrizePool += tournament.prizePool;
    this.totalTournamentsCreated += 1;
    this.stats.averagePlayerCount = this.stats.totalPlayers / this.totalTournamentsCreated;
    
    // Обновляем процент успешности (турниры, которые стартовали)
    if (tournament.status === 'ACTIVE' || tournament.status === 'FINISHED') {
        this.stats.successRate = ((this.stats.successRate * (this.totalTournamentsCreated - 1)) + 100) / this.totalTournamentsCreated;
    } else {
        this.stats.successRate = (this.stats.successRate * (this.totalTournamentsCreated - 1)) / this.totalTournamentsCreated;
    }
    
    this.lastTournamentCreated = new Date();
};

export default mongoose.model<ITournamentTemplate>('TournamentTemplate', TournamentTemplateSchema);