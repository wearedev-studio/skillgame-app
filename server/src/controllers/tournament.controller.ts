import { Request, Response } from 'express';
import { Server } from 'socket.io';
import Tournament from '../models/Tournament.model';
import User from '../models/User.model';
import {
    createTournament,
    registerPlayerInTournament,
    getActiveTournaments,
    getAllTournaments,
    getTournamentById,
    clearTournamentTimer,
    removeFromActiveTournaments
} from '../services/tournament.service';

export const getActiveTournamentsController = async (req: Request, res: Response) => {
    try {
        const tournaments = await getActiveTournaments();
        res.json(tournaments);
    } catch (error) {
        console.error('Error fetching tournaments:', error);
        res.status(500).json({ message: 'Error fetching tournaments list' });
    }
};

export const getAllTournamentsController = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 12;
        const status = req.query.status as string;
        const gameType = req.query.gameType as string;
        
        // Build filter query
        const filter: any = {};
        if (status && status !== 'all') {
            filter.status = status.toUpperCase();
        }
        if (gameType && gameType !== 'all') {
            filter.gameType = gameType;
        }
        
        const skip = (page - 1) * limit;
        
        // Get tournaments with pagination
        const [tournaments, total] = await Promise.all([
            Tournament.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('players._id', 'username avatar'),
            Tournament.countDocuments(filter)
        ]);
        
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        res.json({
            tournaments,
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
        console.error('Error fetching all tournaments:', error);
        res.status(500).json({ message: 'Error fetching all tournaments list' });
    }
};

export const getTournament = async (req: Request, res: Response) => {
    try {
        const { tournamentId } = req.params;
        const tournament = await getTournamentById(tournamentId);
        
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found' });
        }
        
        res.json(tournament);
    } catch (error) {
        console.error('Error fetching tournament:', error);
        res.status(500).json({ message: 'Error fetching tournament' });
    }
};

export const createNewTournament = async (req: Request, res: Response) => {
    try {
        const { name, gameType, maxPlayers, entryFee, platformCommission } = req.body;
        
        if (!name || !gameType || !maxPlayers || entryFee === undefined) {
            return res.status(400).json({ 
                message: 'Must specify name, game type, number of players and entry fee'
            });
        }

        if (![4, 8, 16, 32].includes(maxPlayers)) {
            return res.status(400).json({ 
                message: 'Number of players must be 4, 8, 16 or 32'
            });
        }

        if (!['checkers', 'chess', 'backgammon', 'tic-tac-toe'].includes(gameType)) {
            return res.status(400).json({ 
                message: 'Unsupported game type'
            });
        }

        const io: Server = req.app.get('io');
        const prizePool = entryFee * maxPlayers;
        
        const tournament = await createTournament(
            io,
            name,
            gameType,
            maxPlayers,
            entryFee,
            prizePool,
            platformCommission || 10
        );

        if (!tournament) {
            return res.status(500).json({ message: 'Error creating tournament' });
        }

        res.status(201).json({
            message: 'Tournament successfully created',
            tournament
        });
    } catch (error) {
        console.error('Error creating tournament:', error);
        res.status(500).json({ message: 'Error creating tournament' });
    }
};

export const registerInTournament = async (req: Request, res: Response) => {
    try {
        const { tournamentId } = req.params;
        const userId = req.user?._id?.toString();

        if (!userId) {
            return res.status(401).json({ message: 'Authorization required' });
        }

        const socketId = req.headers['x-socket-id'] as string || 'offline';

        const io: Server = req.app.get('io');
        
        const result = await registerPlayerInTournament(io, tournamentId, userId, socketId);

        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }

        res.json({ message: result.message });
    } catch (error) {
        console.error('Error registering in tournament:', error);
        res.status(500).json({ message: 'Error registering in tournament' });
    }
};

export const unregisterFromTournament = async (req: Request, res: Response) => {
    try {
        const { tournamentId } = req.params;
        const userId = req.user?._id?.toString();

        if (!userId) {
            return res.status(401).json({ message: 'Authorization required' });
        }

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found' });
        }

        if (tournament.status !== 'WAITING') {
            return res.status(400).json({ message: 'Cannot cancel registration after tournament starts' });
        }

        const playerIndex = tournament.players.findIndex(p => p._id === userId);
        if (playerIndex === -1) {
            return res.status(400).json({ message: 'You are not registered in this tournament' });
        }

        const user = await User.findById(userId);
        if (user) {
            user.balance += tournament.entryFee;
            await user.save();
        }

        tournament.players.splice(playerIndex, 1);
        
        if (tournament.players.length === 0) {
            tournament.firstRegistrationTime = undefined;
            
            // Clear the tournament timer if no players left
            clearTournamentTimer(tournamentId);
            
            // Remove from active tournaments cache if no players
            removeFromActiveTournaments(tournamentId);
        } else {
            // Check if only bots are left and reset tournament state if needed
            const realPlayersLeft = tournament.players.filter(p => !p.isBot);
            if (realPlayersLeft.length === 0) {
                // Remove all bot players and reset tournament
                tournament.players = [];
                tournament.firstRegistrationTime = undefined;
                
                clearTournamentTimer(tournamentId);
                removeFromActiveTournaments(tournamentId);
                
                console.log(`[Tournament] All real players left tournament ${tournamentId}, removing bots and resetting`);
            }
        }

        // Ensure tournament status is correct
        if (tournament.players.length === 0 && tournament.status === 'WAITING') {
            // Tournament should remain in WAITING state but with no registered time
            tournament.firstRegistrationTime = undefined;
        }

        await tournament.save();

        const io: Server = req.app.get('io');
        io.emit('tournamentUpdated', tournament);

        res.json({ message: 'Registration cancelled, entry fee refunded' });
    } catch (error) {
        console.error('Error unregistering from tournament:', error);
        res.status(500).json({ message: 'Error cancelling registration' });
    }
};

export const getPlayerTournaments = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id?.toString();

        if (!userId) {
            return res.status(401).json({ message: 'Authorization required' });
        }

        const tournaments = await Tournament.find({
            'players._id': userId
        }).sort({ createdAt: -1 });

        res.json(tournaments);
    } catch (error) {
        console.error('Error fetching player tournaments:', error);
        res.status(500).json({ message: 'Error fetching player tournaments' });
    }
};

export const getTournamentHistory = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, gameType } = req.query;
        
        const query: any = { status: 'FINISHED' };
        if (gameType && gameType !== 'all') {
            query.gameType = gameType;
        }

        const tournaments = await Tournament.find(query)
            .sort({ finishedAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await Tournament.countDocuments(query);

        res.json({
            tournaments,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching tournament history:', error);
        res.status(500).json({ message: 'Error fetching tournament history' });
    }
};

export const getTournamentStats = async (req: Request, res: Response) => {
    try {
        const stats = await Tournament.aggregate([
            {
                $group: {
                    _id: '$gameType',
                    total: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['WAITING', 'ACTIVE']] }, 1, 0]
                        }
                    },
                    finished: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'FINISHED'] }, 1, 0]
                        }
                    },
                    totalPrizePool: { $sum: '$prizePool' }
                }
            }
        ]);

        const totalStats = await Tournament.aggregate([
            {
                $group: {
                    _id: null,
                    totalTournaments: { $sum: 1 },
                    totalPrizePool: { $sum: '$prizePool' },
                    activeTournaments: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['WAITING', 'ACTIVE']] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        res.json({
            byGameType: stats,
            overall: totalStats[0] || {
                totalTournaments: 0,
                totalPrizePool: 0,
                activeTournaments: 0
            }
        });
    } catch (error) {
        console.error('Error fetching tournament stats:', error);
        res.status(500).json({ message: 'Error fetching tournament statistics' });
    }
};