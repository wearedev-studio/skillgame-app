import { Request, Response } from 'express';
import gameLobbyScheduler from '../services/gameLobbyScheduler.service';

// Получить статистику планировщика лобби
export const getLobbySchedulerStats = async (req: Request, res: Response) => {
    try {
        const stats = gameLobbyScheduler.getStats();
        const lobbyStats = gameLobbyScheduler.getLobbyStats();
        const isRunning = gameLobbyScheduler.isSchedulerRunning();

        res.json({
            success: true,
            data: {
                ...stats,
                isRunning,
                lobbyStats
            }
        });
    } catch (error) {
        console.error('Error getting lobby scheduler stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving lobby scheduler statistics'
        });
    }
};

// Принудительная проверка планировщика лобби
export const forceLobbySchedulerCheck = async (req: Request, res: Response) => {
    try {
        await gameLobbyScheduler.forceCheck();

        res.json({
            success: true,
            message: 'Forced lobby scheduler check completed'
        });
    } catch (error) {
        console.error('Error forcing lobby scheduler check:', error);
        res.status(500).json({
            success: false,
            message: 'Error forcing lobby scheduler check'
        });
    }
};

// Запуск планировщика лобби
export const startLobbyScheduler = async (req: Request, res: Response) => {
    try {
        if (gameLobbyScheduler.isSchedulerRunning()) {
            return res.status(400).json({
                success: false,
                message: 'Lobby scheduler is already running'
            });
        }

        gameLobbyScheduler.start();

        res.json({
            success: true,
            message: 'Game lobby scheduler started successfully'
        });
    } catch (error) {
        console.error('Error starting lobby scheduler:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting lobby scheduler'
        });
    }
};

// Остановка планировщика лобби
export const stopLobbyScheduler = async (req: Request, res: Response) => {
    try {
        if (!gameLobbyScheduler.isSchedulerRunning()) {
            return res.status(400).json({
                success: false,
                message: 'Lobby scheduler is not running'
            });
        }

        gameLobbyScheduler.stop();

        res.json({
            success: true,
            message: 'Game lobby scheduler stopped successfully'
        });
    } catch (error) {
        console.error('Error stopping lobby scheduler:', error);
        res.status(500).json({
            success: false,
            message: 'Error stopping lobby scheduler'
        });
    }
};

// Очистка старых пустых комнат
export const cleanupOldRooms = async (req: Request, res: Response) => {
    try {
        gameLobbyScheduler.cleanupOldEmptyRooms();

        res.json({
            success: true,
            message: 'Old empty rooms cleanup completed'
        });
    } catch (error) {
        console.error('Error cleaning up old rooms:', error);
        res.status(500).json({
            success: false,
            message: 'Error cleaning up old rooms'
        });
    }
};

// Получить статистику лобби
export const getLobbyStats = async (req: Request, res: Response) => {
    try {
        const lobbyStats = gameLobbyScheduler.getLobbyStats();

        res.json({
            success: true,
            data: lobbyStats
        });
    } catch (error) {
        console.error('Error getting lobby stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving lobby statistics'
        });
    }
};