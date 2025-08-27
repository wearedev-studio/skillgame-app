import { Server } from 'socket.io';
import { getIO, rooms } from '../socket';
import User from '../models/User.model';

interface LobbySchedulerStats {
    isRunning: boolean;
    lastCheck: Date;
    nextScheduledCheck: Date;
    roomsCreated: {
        [gameType: string]: number;
    };
    totalRoomsCreated: number;
}

class GameLobbySchedulerService {
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private stats: LobbySchedulerStats = {
        isRunning: false,
        lastCheck: new Date(),
        nextScheduledCheck: new Date(),
        roomsCreated: {},
        totalRoomsCreated: 0
    };

    // Поддерживаемые типы игр
    private gameTypes = ['tic-tac-toe', 'checkers', 'chess', 'backgammon', 'durak', 'domino', 'dice', 'bingo'];
    
    // Размеры ставок от $5 до $100
    private betSizes = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
    
    // Максимальное количество пустых комнат в лобби
    private readonly MAX_EMPTY_ROOMS = 10;

    public start(): void {
        if (this.isRunning) {
            console.log('[GameLobbyScheduler] Scheduler is already running');
            return;
        }

        console.log('[GameLobbyScheduler] Starting game lobby scheduler...');
        this.isRunning = true;
        this.stats.isRunning = true;

        // Запускаем проверку каждые 30 секунд (чаще чем турнирный)
        this.intervalId = setInterval(() => {
            this.checkAndCreateRooms();
        }, 30 * 1000);

        // Выполняем первую проверку сразу
        setTimeout(() => {
            this.checkAndCreateRooms();
        }, 2000);

        console.log('[GameLobbyScheduler] Game lobby scheduler started');
    }

    public stop(): void {
        if (!this.isRunning) {
            console.log('[GameLobbyScheduler] Scheduler is not running');
            return;
        }

        console.log('[GameLobbyScheduler] Stopping game lobby scheduler...');
        this.isRunning = false;
        this.stats.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        console.log('[GameLobbyScheduler] Game lobby scheduler stopped');
    }

    private async checkAndCreateRooms(): Promise<void> {
        try {
            console.log('[GameLobbyScheduler] Checking lobby rooms...');
            
            const io = getIO();
            if (!io) {
                console.log('[GameLobbyScheduler] Socket.io not available, skipping check');
                return;
            }

            this.stats.lastCheck = new Date();

            // Проверяем каждый тип игры
            for (const gameType of this.gameTypes) {
                await this.processGameTypeLobby(gameType);
            }

            this.stats.nextScheduledCheck = new Date(Date.now() + 30 * 1000);
            console.log('[GameLobbyScheduler] Lobby check completed');

        } catch (error) {
            console.error('[GameLobbyScheduler] Error in lobby check:', error);
        }
    }

    private async processGameTypeLobby(gameType: string): Promise<void> {
        try {
            // Подсчитываем пустые комнаты для данного типа игры
            const emptyRooms = Object.values(rooms).filter(room =>
                room.gameType === gameType &&
                room.players.length === 0 && // Полностью пустая комната
                !room.id.startsWith('private-') && // Не приватные комнаты
                !room.id.startsWith('tourney-') // Не турнирные комнаты
            );

            console.log(`[GameLobbyScheduler] ${gameType}: Found ${emptyRooms.length} empty rooms (max: ${this.MAX_EMPTY_ROOMS})`);

            if (emptyRooms.length < this.MAX_EMPTY_ROOMS) {
                const roomsToCreate = this.MAX_EMPTY_ROOMS - emptyRooms.length;
                console.log(`[GameLobbyScheduler] ${gameType}: Creating ${roomsToCreate} new rooms`);

                for (let i = 0; i < roomsToCreate; i++) {
                    await this.createEmptyRoom(gameType);
                }
            }

        } catch (error) {
            console.error(`[GameLobbyScheduler] Error processing ${gameType} lobby:`, error);
        }
    }

    private async createEmptyRoom(gameType: string): Promise<void> {
        try {
            // Получаем случайный размер ставки
            const bet = this.getRandomBetSize();

            // Создаем полностью пустую комнату (как в админке)
            const roomId = `lobby-${gameType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const newRoom = {
                id: roomId,
                gameType: gameType as any,
                bet,
                players: [], // Пустой массив игроков
                gameState: null // Состояние игры не инициализировано
            };

            // Добавляем комнату в глобальный объект rooms
            (global as any).rooms = (global as any).rooms || {};
            rooms[roomId] = newRoom;

            // Обновляем статистику
            if (!this.stats.roomsCreated[gameType]) {
                this.stats.roomsCreated[gameType] = 0;
            }
            this.stats.roomsCreated[gameType]++;
            this.stats.totalRoomsCreated++;

            console.log(`[GameLobbyScheduler] Created empty room for ${gameType} with bet $${bet} (ID: ${roomId})`);

            // Уведомляем лобби об обновлении
            const io = getIO();
            if (io) {
                this.broadcastLobbyState(io, gameType);
            }

        } catch (error) {
            console.error(`[GameLobbyScheduler] Error creating empty room for ${gameType}:`, error);
        }
    }

    private getRandomBetSize(): number {
        return this.betSizes[Math.floor(Math.random() * this.betSizes.length)];
    }


    private broadcastLobbyState(io: Server, gameType: string): void {
        try {
            const availableRooms = Object.values(rooms)
                .filter(room =>
                    room.gameType === gameType &&
                    room.players.length < 2 &&
                    !room.id.startsWith('private-') &&
                    !room.id.startsWith('tourney-')
                )
                .map(room => ({
                    id: room.id,
                    gameType: room.gameType,
                    bet: room.bet,
                    players: room.players.length,
                    host: room.players.length > 0 ? room.players[0] : { user: { username: 'Waiting for player' } }
                }));

            io.to(`lobby-${gameType}`).emit('roomsList', availableRooms);
        } catch (error) {
            console.error(`[GameLobbyScheduler] Error broadcasting lobby state for ${gameType}:`, error);
        }
    }

    // Получение статистики планировщика
    public getStats(): LobbySchedulerStats {
        return { ...this.stats };
    }

    // Проверка статуса планировщика
    public isSchedulerRunning(): boolean {
        return this.isRunning;
    }

    // Принудительная проверка (для админки)
    public async forceCheck(): Promise<void> {
        if (!this.isRunning) {
            throw new Error('Lobby scheduler is not running');
        }
        
        console.log('[GameLobbyScheduler] Forced check triggered');
        await this.checkAndCreateRooms();
    }

    // Получение статистики лобби
    public getLobbyStats(): { [gameType: string]: { emptyRooms: number; totalRooms: number } } {
        const stats: { [gameType: string]: { emptyRooms: number; totalRooms: number } } = {};

        for (const gameType of this.gameTypes) {
            const gameRooms = Object.values(rooms).filter(room =>
                room.gameType === gameType &&
                !room.id.startsWith('private-') &&
                !room.id.startsWith('tourney-')
            );

            const emptyRooms = gameRooms.filter(room => room.players.length === 0);

            stats[gameType] = {
                emptyRooms: emptyRooms.length,
                totalRooms: gameRooms.length
            };
        }

        return stats;
    }

    // Очистка старых пустых комнат (опционально)
    public cleanupOldEmptyRooms(): void {
        try {
            const now = Date.now();
            const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 минут

            Object.keys(rooms).forEach(roomId => {
                const room = rooms[roomId];
                
                // Проверяем только наши lobby комнаты (создано шедулером)
                if (room.id.startsWith('lobby-') &&
                    room.players.length === 0 &&
                    room.gameState === null) {
                    
                    // Если комната создана давно (предполагаем по ID с timestamp)
                    const roomTimestamp = parseInt(roomId.split('-')[2]) || 0;
                    if (now - roomTimestamp > ROOM_TIMEOUT) {
                        delete rooms[roomId];
                        console.log(`[GameLobbyScheduler] Cleaned up old empty room: ${roomId}`);
                    }
                }
            });

        } catch (error) {
            console.error('[GameLobbyScheduler] Error cleaning up old rooms:', error);
        }
    }
}

// Экспортируем единственный экземпляр планировщика
export const gameLobbyScheduler = new GameLobbySchedulerService();

export default gameLobbyScheduler;