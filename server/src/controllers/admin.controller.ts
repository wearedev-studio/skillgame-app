import { Request, Response } from 'express';
import { Server } from 'socket.io';
import { Room } from '../socket';
import User from '../models/User.model';
import { IGameLogic } from '../games/game.logic.interface';
import Tournament from '../models/Tournament.model';

import Transaction from '../models/Transaction.model';
import GameRecord from '../models/GameRecord.model';
import { createNotification } from '../services/notification.service';
import { createTournament as createTournamentService } from '../services/tournament.service';
import path from 'path';
import * as XLSX from 'xlsx';

let roomsRef: Record<string, Room> = {}; 
let gameLogicsRef: Record<string, IGameLogic> = {};

export const setSocketData = (rooms: Record<string, Room>, gameLogics: Record<string, IGameLogic>) => {
    roomsRef = rooms;
    gameLogicsRef = gameLogics;
};

export const createAdminRoom = (req: Request, res: Response) => {
    const { gameType, bet } = req.body as { gameType: Room['gameType'], bet: number };

    if (!gameType || !bet || !gameLogicsRef[gameType]) {
        return res.status(400).json({ message: 'Incorrect game type or bet.' });
    }

    const gameLogic = gameLogicsRef[gameType];
    const roomId = `admin-${gameType}-${Date.now()}`;

    const newRoom: Room = {
        id: roomId,
        gameType,
        bet,
        players: [],
        gameState: null,
    };

    roomsRef[roomId] = newRoom;

    const io: Server = req.app.get('io');
    const availableRooms = Object.values(roomsRef)
        .filter(room => room.gameType === gameType && room.players.length < 2)
        .map(r => ({ id: r.id, bet: r.bet, host: r.players.length > 0 ? r.players[0] : { user: { username: 'Waiting for the player' } } }));
    
    io.to(`lobby-${gameType}`).emit('roomsList', availableRooms);

    console.log(`[Admin] Room ${roomId} created.`);
    res.status(201).json({ message: 'The room was created successfully', room: newRoom });
};

export const getActiveRooms = (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const gameType = req.query.gameType as string;
    const search = req.query.search as string;
    
    // Get all rooms and map them
    let allRooms = Object.values(roomsRef).map(room => {
        return {
            id: room.id,
            gameType: room.gameType,
            bet: room.bet,
            players: room.players.map(p => p.user.username)
        }
    });
    
    // Apply filters
    if (gameType && gameType !== 'all') {
        allRooms = allRooms.filter(room => room.gameType === gameType);
    }
    if (search) {
        allRooms = allRooms.filter(room =>
            room.id.toLowerCase().includes(search.toLowerCase()) ||
            room.players.some(player => player.toLowerCase().includes(search.toLowerCase()))
        );
    }
    
    // Calculate pagination
    const total = allRooms.length;
    const skip = (page - 1) * limit;
    const paginatedRooms = allRooms.slice(skip, skip + limit);
    
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;
    
    res.json({
        success: true,
        data: paginatedRooms,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: total,
            itemsPerPage: limit,
            hasNext,
            hasPrev
        }
    });
};

export const deleteRoom = (req: Request, res: Response) => {
    const { roomId } = req.params;
    const room = roomsRef[roomId];
    const io: Server = req.app.get('io');
    
    if (room) {
        io.to(roomId).emit('error', { message: 'The room was closed by the administrator.' });
        
        delete roomsRef[roomId];
        
        const availableRooms = Object.values(roomsRef) /* ... */;
        io.to(`lobby-${room.gameType}`).emit('roomsList', availableRooms);
        
        res.json({ message: `Room ${roomId} successfully deleted.` });
    } else {
        res.status(404).json({ message: 'Room not found.' });
    }
};

export const createTournament = async (req: Request, res: Response) => {
    const { name, gameType, entryFee, maxPlayers } = req.body;

    if (!name || !gameType || !maxPlayers) {
        return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    try {
        const io: Server = req.app.get('io');
        
        // Calculate prize pool (90% of total entry fees)
        const totalEntryFees = Number(entryFee) * Number(maxPlayers);
        const prizePool = Math.floor(totalEntryFees * 0.9);
        const platformCommission = 10; // 10%

        const tournament = await createTournamentService(
            io,
            name,
            gameType,
            Number(maxPlayers),
            Number(entryFee) || 0,
            prizePool,
            platformCommission
        );

        if (!tournament) {
            return res.status(400).json({ message: 'Failed to create tournament. Invalid game type or parameters.' });
        }

        res.status(201).json(tournament);
    } catch (error: any) {
        console.error('[Admin] Error creating tournament:', error);
        res.status(500).json({ message: 'Server Error when creating a tournament', error: error.message });
    }
};

export const getAllAdminTournaments = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status as string;
        const gameType = req.query.gameType as string;
        const search = req.query.search as string;
        
        // Build filter query
        const filter: any = {};
        if (status && status !== 'all') {
            filter.status = status.toUpperCase();
        }
        if (gameType && gameType !== 'all') {
            filter.gameType = gameType;
        }
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
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
            data: tournaments,
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
        console.error('Error fetching admin tournaments:', error);
        res.status(500).json({ message: 'Error fetching tournaments list' });
    }
};

export const updateTournament = async (req: Request, res: Response) => {
    try {
        const tournament = await Tournament.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!tournament) return res.status(404).json({ message: 'No tournament found' });
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export const deleteTournament = async (req: Request, res: Response) => {
    try {
        const tournament = await Tournament.findByIdAndDelete(req.params.id);
        if (!tournament) return res.status(404).json({ message: 'No tournament found' });
        res.json({ message: 'The tournament has been deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const role = req.query.role as string;
        const search = req.query.search as string;
        
        console.log('[Admin] getAllUsers query params:', { page, limit, role, search });
        
        // Build filter query
        const filter: any = {};
        if (role && role !== 'all') {
            filter.role = role.toUpperCase();
        }
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            console.log('[Admin] Applying search filter for:', searchTerm);
            filter.$or = [
                { username: { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } },
                { _id: { $regex: searchTerm, $options: 'i' } }
            ];
        }
        
        console.log('[Admin] Final filter object:', JSON.stringify(filter, null, 2));
        
        const skip = (page - 1) * limit;
        
        // Get users with pagination
        const [users, total] = await Promise.all([
            User.find(filter)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(filter)
        ]);
        
        console.log('[Admin] Search results:', { foundUsers: users.length, total });
        
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        res.json({
            success: true,
            data: users,
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
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.username = req.body.username || user.username;
        user.email = req.body.email || user.email;
        user.role = req.body.role || user.role;
        user.balance = req.body.balance !== undefined ? req.body.balance : user.balance;

        const updatedUser = await user.save();
        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
            balance: updatedUser.balance
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        await user.deleteOne();
        res.json({ message: 'User successfully deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export const getAllTransactions = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const type = req.query.type as string;
        const status = req.query.status as string;
        const search = req.query.search as string;
        
        // Build filter query
        const filter: any = {};
        if (type && type !== 'all') {
            filter.type = type.toUpperCase();
        }
        if (status && status !== 'all') {
            filter.status = status.toUpperCase();
        }
        if (search) {
            // Search by transaction ID or user's username
            const userFilter = await User.find({
                username: { $regex: search, $options: 'i' }
            }).select('_id');
            const userIds = userFilter.map(user => user._id);
            
            filter.$or = [
                { _id: { $regex: search, $options: 'i' } },
                { user: { $in: userIds } }
            ];
        }
        
        const skip = (page - 1) * limit;
        
        // Get transactions with pagination
        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .populate('user', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Transaction.countDocuments(filter)
        ]);
        
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        res.json({
            success: true,
            data: transactions,
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
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const getAllGameRecords = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status as string;
        const gameName = req.query.gameName as string;
        const search = req.query.search as string;
        
        // Build filter query
        const filter: any = {};
        if (status && status !== 'all') {
            filter.status = status.toUpperCase();
        }
        if (gameName && gameName !== 'all') {
            filter.gameName = { $regex: gameName, $options: 'i' };
        }
        if (search) {
            // Search by game ID or user's username
            const userFilter = await User.find({
                username: { $regex: search, $options: 'i' }
            }).select('_id');
            const userIds = userFilter.map(user => user._id);
            
            filter.$or = [
                { _id: { $regex: search, $options: 'i' } },
                { user: { $in: userIds } },
                { opponent: { $regex: search, $options: 'i' } }
            ];
        }
        
        const skip = (page - 1) * limit;
        
        // Get game records with pagination
        const [games, total] = await Promise.all([
            GameRecord.find(filter)
                .populate('user', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            GameRecord.countDocuments(filter)
        ]);
        
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        res.json({
            success: true,
            data: games,
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
        console.error('Error fetching game records:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const getKycSubmissions = async (req: Request, res: Response) => {
    try {
        const { status } = req.query;
        
        const filter: any = {};
        if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status as string)) {
            filter.kycStatus = status;
        } else {
            filter.kycStatus = 'PENDING';
        }

        const submissions = await User.find(filter).select('username email kycStatus kycDocuments');
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export const reviewKycSubmission = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { action, reason } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const io: Server = req.app.get('io');
        
        if (action === 'APPROVE') {
            user.kycStatus = 'APPROVED';
            await createNotification(io, userId, {
                title: '✅ Verification completed',
                message: 'Your account has been successfully verified!'
            });
        } else if (action === 'REJECT' && reason) {
            user.kycStatus = 'REJECTED';
            user.kycRejectionReason = reason;
             await createNotification(io, userId, {
                title: '❌ Verification rejected',
                message: `Cause: ${reason}`
            });
        } else {
            return res.status(400).json({ message: 'Incorrect action or missing reason for refusal.' });
        }
        
        await user.save();

        if (io) {
            io.emit('kycStatusUpdated', {
                userId: userId,
                kycStatus: user.kycStatus,
                kycRejectionReason: user.kycRejectionReason
            });
        }

        res.json({ message: `User's request ${user.username} has been processed.` });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export const exportUsersToExcel = async (req: Request, res: Response) => {
    try {
        const role = req.query.role as string;
        const search = req.query.search as string;
        
        console.log('[Admin] Exporting users to Excel with filters:', { role, search });
        
        // Build filter query (same as getAllUsers)
        const filter: any = {};
        if (role && role !== 'all') {
            filter.role = role.toUpperCase();
        }
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            filter.$or = [
                { username: { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } },
                { _id: { $regex: searchTerm, $options: 'i' } }
            ];
        }
        
        // Get all users without pagination for export
        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 });
        
        // Prepare data for Excel export
        const excelData = users.map((user, index) => {
            const userDoc = user as any; // Type assertion for timestamps
            return {
                '#': index + 1,
                'User ID': userDoc._id?.toString() || 'N/A',
                'Username': user.username,
                'Email': user.email,
                'Role': user.role,
                'Status': user.status,
                'Balance': user.balance.toFixed(2),
                'KYC Status': user.kycStatus,
                'KYC Provider': user.kycProvider,
                'Registration Date': userDoc.createdAt ? new Date(userDoc.createdAt).toLocaleDateString('en-US') : 'N/A',
                'Last Updated': userDoc.updatedAt ? new Date(userDoc.updatedAt).toLocaleDateString('en-US') : 'N/A',
                'Age Confirmed': user.ageConfirmed ? 'Yes' : 'No',
                'Terms Accepted': user.termsAccepted ? 'Yes' : 'No',
                'Privacy Policy Accepted': user.privacyPolicyAccepted ? 'Yes' : 'No',
                'KYC Documents Count': user.kycDocuments?.length || 0,
                'KYC Rejection Reason': user.kycRejectionReason || 'N/A',
                'Sumsub Applicant ID': user.sumsubData?.applicantId || 'N/A',
                'Sumsub Review Status': user.sumsubData?.reviewStatus || 'N/A',
                'Sumsub Review Result': user.sumsubData?.reviewResult || 'N/A'
            };
        });
        
        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Add some styling and formatting
        const columnWidths = [
            { wch: 5 },   // #
            { wch: 25 },  // User ID
            { wch: 20 },  // Username
            { wch: 30 },  // Email
            { wch: 10 },  // Role
            { wch: 12 },  // Balance
            { wch: 15 },  // KYC Status
            { wch: 18 },  // Registration Date
            { wch: 15 },  // Last Login
            { wch: 12 },  // Games Played
            { wch: 15 },  // Total Winnings
            { wch: 15 },  // Total Deposits
            { wch: 18 }   // Total Withdrawals
        ];
        worksheet['!cols'] = columnWidths;
        
        // Add summary information
        const summaryData = [
            { 'Summary': 'Total Users', 'Value': users.length },
            { 'Summary': 'Total Admins', 'Value': users.filter(u => u.role === 'ADMIN').length },
            { 'Summary': 'Total Regular Users', 'Value': users.filter(u => u.role === 'USER').length },
            { 'Summary': 'Total Balance', 'Value': `$${users.reduce((sum, u) => sum + u.balance, 0).toFixed(2)}` },
            { 'Summary': 'KYC Approved', 'Value': users.filter(u => u.kycStatus === 'APPROVED').length },
            { 'Summary': 'KYC Pending', 'Value': users.filter(u => u.kycStatus === 'PENDING').length },
            { 'Summary': 'Export Date', 'Value': new Date().toLocaleDateString('en-US') }
        ];
        
        const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
        summaryWorksheet['!cols'] = [{ wch: 20 }, { wch: 30 }];
        
        // Add worksheets to workbook
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
        
        // Generate Excel file buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `users-report-${timestamp}.xlsx`;
        
        // Set response headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', excelBuffer.length);
        
        console.log(`[Admin] Excel export completed: ${users.length} users exported to ${filename}`);
        
        // Send the Excel file
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error exporting users to Excel:', error);
        res.status(500).json({ message: 'Failed to export users to Excel' });
    }
};

export const exportTransactionsToExcel = async (req: Request, res: Response) => {
    try {
        const type = req.query.type as string;
        const status = req.query.status as string;
        const search = req.query.search as string;
        
        console.log('[Admin] Exporting transactions to Excel with filters:', { type, status, search });
        
        // Build filter query (same as getAllTransactions)
        const filter: any = {};
        if (type && type !== 'all') {
            filter.type = type.toUpperCase();
        }
        if (status && status !== 'all') {
            filter.status = status.toUpperCase();
        }
        if (search && search.trim() !== '') {
            // Search by transaction ID or user's username
            const userFilter = await User.find({
                username: { $regex: search.trim(), $options: 'i' }
            }).select('_id');
            const userIds = userFilter.map(user => user._id);
            
            filter.$or = [
                { _id: { $regex: search.trim(), $options: 'i' } },
                { user: { $in: userIds } }
            ];
        }
        
        // Get all transactions without pagination for export
        const transactions = await Transaction.find(filter)
            .populate('user', 'username')
            .sort({ createdAt: -1 });
        
        // Prepare data for Excel export
        const excelData = transactions.map((transaction, index) => {
            const transactionDoc = transaction as any;
            return {
                '#': index + 1,
                'Transaction ID': transactionDoc._id?.toString() || 'N/A',
                'User': transactionDoc.user?.username || 'N/A',
                'Type': transaction.type,
                'Status': transaction.status,
                'Amount': `$${transaction.amount.toFixed(2)}`,
                'Created Date': transactionDoc.createdAt ? new Date(transactionDoc.createdAt).toLocaleDateString('en-US') : 'N/A',
                'Created Time': transactionDoc.createdAt ? new Date(transactionDoc.createdAt).toLocaleTimeString('en-US') : 'N/A',
                'Updated Date': transactionDoc.updatedAt ? new Date(transactionDoc.updatedAt).toLocaleDateString('en-US') : 'N/A'
            };
        });
        
        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Add column widths
        const columnWidths = [
            { wch: 5 },   // #
            { wch: 25 },  // Transaction ID
            { wch: 20 },  // User
            { wch: 18 },  // Type
            { wch: 12 },  // Status
            { wch: 12 },  // Amount
            { wch: 15 },  // Created Date
            { wch: 15 },  // Created Time
            { wch: 15 }   // Updated Date
        ];
        worksheet['!cols'] = columnWidths;
        
        // Calculate summary statistics
        const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        const depositCount = transactions.filter(tx => tx.type === 'DEPOSIT').length;
        const withdrawalCount = transactions.filter(tx => tx.type === 'WITHDRAWAL').length;
        const completedCount = transactions.filter(tx => tx.status === 'COMPLETED').length;
        const pendingCount = transactions.filter(tx => tx.status === 'PENDING').length;
        
        // Add summary information
        const summaryData = [
            { 'Summary': 'Total Transactions', 'Value': transactions.length },
            { 'Summary': 'Total Amount', 'Value': `$${totalAmount.toFixed(2)}` },
            { 'Summary': 'Deposits', 'Value': depositCount },
            { 'Summary': 'Withdrawals', 'Value': withdrawalCount },
            { 'Summary': 'Completed', 'Value': completedCount },
            { 'Summary': 'Pending', 'Value': pendingCount },
            { 'Summary': 'Failed', 'Value': transactions.filter(tx => tx.status === 'FAILED').length },
            { 'Summary': 'Export Date', 'Value': new Date().toLocaleDateString('en-US') },
            { 'Summary': 'Export Time', 'Value': new Date().toLocaleTimeString('en-US') }
        ];
        
        const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
        summaryWorksheet['!cols'] = [{ wch: 20 }, { wch: 30 }];
        
        // Add worksheets to workbook
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
        
        // Generate Excel file buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `transactions-report-${timestamp}.xlsx`;
        
        // Set response headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', excelBuffer.length);
        
        console.log(`[Admin] Excel export completed: ${transactions.length} transactions exported to ${filename}`);
        
        // Send the Excel file
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error exporting transactions to Excel:', error);
        res.status(500).json({ message: 'Failed to export transactions to Excel' });
    }
};

export const getKycDocument = async (req: Request, res: Response) => {
    const { userId, fileName } = req.params;
    try {
        const user = await User.findById(userId);
        if (!user || !user.kycDocuments.some(doc => doc.filePath.endsWith(fileName))) {
            return res.status(404).json({ message: 'Document not found or access denied.' });
        }
        
        const filePath = path.resolve(process.cwd(), `private/kyc-documents/${fileName}`);
        
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error("File send error:", err);
                res.status(404).json({ message: "The file was not found on the server." });
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};