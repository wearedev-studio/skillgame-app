import { Server, Socket } from 'socket.io';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User, { IUser } from './models/User.model';
import GameRecord from './models/GameRecord.model';
import Transaction from './models/Transaction.model';
import Chat, { IMessage } from './models/Chat.model';
import { IGameLogic, GameState, GameMove } from './games/game.logic.interface';
import { ticTacToeLogic } from './games/tic-tac-toe.logic';
import { checkersLogic } from './games/checkers.logic';
import { chessLogic } from './games/chess.logic';
import { backgammonLogic, rollDiceForBackgammon } from './games/backgammon.logic';
import { durakLogic } from './games/durak.logic';
import { dominoLogic } from './games/domino.logic';
import { DiceGameLogic } from './games/dice.logic';
import { BingoGameLogic } from './games/bingo.logic';

const diceLogic = new DiceGameLogic();
const bingoLogic = new BingoGameLogic();
import {
    advanceTournamentWinner,
    handleTournamentPlayerLeft,
    handleTournamentPlayerReturned,
    handleTournamentPlayerForfeited
} from './services/tournament.service';
import {
    joinTournamentRoom,
    processTournamentMove,
    tournamentPlayerSockets
} from './services/tournamentRoom.service';

interface Player {
    socketId: string;
    user: Pick<IUser, '_id' | 'username' | 'avatar' | 'balance'>;
}

export interface Room {
    id: string;
    gameType: 'tic-tac-toe' | 'checkers' | 'chess' | 'backgammon' | 'durak' | 'domino' | 'dice' | 'bingo';
    bet: number;
    players: Player[];
    gameState: GameState;
    botJoinTimer?: NodeJS.Timeout;
    disconnectTimer?: NodeJS.Timeout;
    // Move timer properties
    moveTimer?: NodeJS.Timeout;
    turnStartTime?: number;
    moveTimeLimit?: number; // in milliseconds, default 30 seconds
    // Private room properties
    isPrivate?: boolean;
    invitationToken?: string;
    allowBots?: boolean;
    hostUserId?: string;
    expiresAt?: Date;
}

export interface PrivateRoomInvitation {
    id: string;
    roomId: string;
    gameType: string;
    bet: number;
    hostUsername: string;
    token: string;
    expiresAt: Date;
    usedAt?: Date;
    isUsed: boolean;
}

export const rooms: Record<string, Room> = {};
export const privateInvitations: Record<string, PrivateRoomInvitation> = {};
export const userSocketMap: Record<string, string> = {};
export const chatUserSockets: Record<string, string> = {}; // For chat connections

// Simple ID generator for chat messages
const generateChatId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Generate secure invitation token
const generateInvitationToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Clean expired invitations
const cleanExpiredInvitations = (): void => {
  const now = new Date();
  Object.keys(privateInvitations).forEach(token => {
    if (privateInvitations[token].expiresAt < now) {
      delete privateInvitations[token];
    }
  });
};

// Run cleanup every 5 minutes
setInterval(cleanExpiredInvitations, 5 * 60 * 1000);

let globalIO: Server | null = null;

export const getIO = (): Server | null => globalIO;
export const setIO = (io: Server): void => {
    globalIO = io;
};

export const gameLogics: Record<Room['gameType'], IGameLogic> = {
    'tic-tac-toe': ticTacToeLogic,
    'checkers': checkersLogic,
    'chess': chessLogic,
    'backgammon': backgammonLogic,
    'durak': durakLogic,
    'domino': dominoLogic,
    'dice': diceLogic,
    'bingo': bingoLogic
};

const BOT_WAIT_TIME = 15000;
const MOVE_TIME_LIMIT = 30000; // 30 seconds
const TIMER_WARNING_TIME = 20000; // Show warning at 20 seconds (10 seconds remaining)
export const botUsernames = ["Michael", "Sarah", "David", "Jessica", "Robert", "Emily"];

// Timer management functions
function startMoveTimer(io: Server, room: Room): void {
    // Clear any existing timer
    if (room.moveTimer) {
        console.log('[Timer] Clearing existing timer before starting new one');
        clearTimeout(room.moveTimer);
        room.moveTimer = undefined;
    }

    // Only start timer when there are 2 players (opponent found)
    if (room.players.length < 2) {
        console.log('[Timer] Not starting timer - waiting for opponent, players:', room.players.length);
        return;
    }

    // Check if game is properly initialized
    if (!room.gameState || !room.gameState.turn) {
        console.log('[Timer] Not starting timer - game not initialized, gameState:', !!room.gameState, 'turn:', room.gameState?.turn);
        return;
    }

    // Check if game is already finished
    if (room.gameState.isGameFinished) {
        console.log('[Timer] Not starting timer - game already finished');
        return;
    }

    // Don't start timer for bot players
    // @ts-ignore
    const currentPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn);
    if (currentPlayer && isBot(currentPlayer)) {
        console.log('[Timer] Not starting timer - current player is bot:', currentPlayer.user.username);
        return;
    }

    console.log(`[Timer] Starting move timer for player: ${room.gameState.turn} in room: ${room.id}, timeout in ${MOVE_TIME_LIMIT}ms`);

    room.turnStartTime = Date.now();
    room.moveTimeLimit = MOVE_TIME_LIMIT;

    // Send timer start event to clients
    io.to(room.id).emit('moveTimerStart', {
        timeLimit: MOVE_TIME_LIMIT,
        currentPlayerId: room.gameState.turn,
        startTime: room.turnStartTime
    });

    // Set warning timer (at 20 seconds - 10 seconds remaining)
    const warningTimer = setTimeout(() => {
        const currentRoom = rooms[room.id];
        if (currentRoom && currentRoom.gameState && currentRoom.gameState.turn === room.gameState.turn && !currentRoom.gameState.isGameFinished) {
            console.log(`[Timer] Sending warning for player: ${room.gameState.turn} in room: ${room.id}`);
            io.to(room.id).emit('moveTimerWarning', {
                timeRemaining: MOVE_TIME_LIMIT - TIMER_WARNING_TIME,
                currentPlayerId: room.gameState.turn
            });
        }
    }, TIMER_WARNING_TIME);

    // Set timeout timer (at 30 seconds)
    room.moveTimer = setTimeout(() => {
        console.log(`[Timer] Timer expired for room: ${room.id}, calling handleMoveTimeout`);
        handleMoveTimeout(io, room.id);
    }, MOVE_TIME_LIMIT);
    
    console.log(`[Timer] Timer set successfully for room: ${room.id}, timer ID exists:`, !!room.moveTimer);
}

function stopMoveTimer(room: Room): void {
    console.log(`[Timer] Stopping move timer for room: ${room.id}, timer exists:`, !!room.moveTimer);
    if (room.moveTimer) {
        clearTimeout(room.moveTimer);
        room.moveTimer = undefined;
        console.log(`[Timer] Timer cleared successfully for room: ${room.id}`);
    }
    room.turnStartTime = undefined;
}

function handleMoveTimeout(io: Server, roomId: string): void {
    console.log(`[MoveTimer] handleMoveTimeout called for room: ${roomId}`);
    
    const room = rooms[roomId];
    if (!room) {
        console.log(`[MoveTimer] Room ${roomId} not found, timeout cancelled`);
        return;
    }

    // Double check that timer is still valid and game isn't finished
    if (room.gameState.isGameFinished) {
        console.log(`[MoveTimer] Game already finished in room ${roomId}, timeout cancelled`);
        return;
    }

    if (!room.gameState.turn) {
        console.log(`[MoveTimer] No current player turn in room ${roomId}, timeout cancelled`);
        return;
    }

    console.log(`[MoveTimer] Processing timeout in room ${roomId} for player ${room.gameState.turn}`);

    // Clear timer
    stopMoveTimer(room);

    // Find the player who timed out and the winner
    // @ts-ignore
    const timedOutPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn);
    // @ts-ignore
    const winnerPlayer = room.players.find(p => p.user._id.toString() !== room.gameState.turn);

    if (!timedOutPlayer) {
        console.log(`[MoveTimer] Timed out player not found in room ${roomId} for ID: ${room.gameState.turn}`);
        return;
    }

    if (!winnerPlayer) {
        console.log(`[MoveTimer] Winner player not found in room ${roomId}`);
        return;
    }

    console.log(`[MoveTimer] Player ${timedOutPlayer.user.username} (${timedOutPlayer.user._id}) timed out, ${winnerPlayer.user.username} (${winnerPlayer.user._id}) wins`);
    
    // Mark game as finished to prevent further moves
    room.gameState.isGameFinished = true;
    console.log(`[MoveTimer] Game marked as finished in room ${roomId}`);
    
    // Send timeout notification with clear message
    const timeoutEvent = {
        timedOutPlayerId: room.gameState.turn,
        timedOutPlayerName: timedOutPlayer.user.username,
        // @ts-ignore
        winnerId: winnerPlayer.user._id.toString(),
        winnerName: winnerPlayer.user.username,
        message: `${timedOutPlayer.user.username} превысил время хода (30 сек). ${winnerPlayer.user.username} побеждает!`,
        reason: 'timeout'
    };
    
    console.log(`[MoveTimer] Emitting gameTimeout event:`, timeoutEvent);
    io.to(roomId).emit('gameTimeout', timeoutEvent);

    // End the game with the winner
    // @ts-ignore
    console.log(`[MoveTimer] Calling endGame for room ${roomId} with winner: ${winnerPlayer.user._id.toString()}`);
    // @ts-ignore
    endGame(io, room, winnerPlayer.user._id.toString(), false);
    
    console.log(`[MoveTimer] Timeout handling completed for room ${roomId}`);
}

function isBot(player: Player): boolean {
    if (!player || !player.user || !player.user._id) return false;
    return player.user._id.toString().startsWith('bot-');
}

function broadcastLobbyState(io: Server, gameType: Room['gameType']) {
    const availableRooms = Object.values(rooms)
        .filter(room =>
            room.gameType === gameType &&
            room.players.length < 2 &&
            !room.isPrivate  // Exclude private rooms from public lobby
        )
        .map(r => ({ id: r.id, bet: r.bet, host: r.players.length > 0
                ? r.players[0]
                : { user: { username: 'Waiting for player' } } }));
    
    io.to(`lobby-${gameType}`).emit('roomsList', availableRooms);
}

function getPublicRoomState(room: Room) {
    // Создаем безопасную копию без циклических ссылок
    return {
        id: room.id,
        gameType: room.gameType,
        bet: room.bet,
        players: room.players.map(player => ({
            socketId: player.socketId,
            user: {
                _id: player.user._id,
                username: player.user.username,
                avatar: player.user.avatar,
                balance: player.user.balance
            }
        })),
        gameState: room.gameState ? JSON.parse(JSON.stringify(room.gameState)) : null,
        turnStartTime: room.turnStartTime,
        moveTimeLimit: room.moveTimeLimit,
        isPrivate: room.isPrivate,
        invitationToken: room.invitationToken,
        allowBots: room.allowBots,
        hostUserId: room.hostUserId,
        expiresAt: room.expiresAt
    };
}

function formatGameNameForDB(gameType: string): 'Checkers' | 'Chess' | 'Backgammon' | 'Tic-Tac-Toe' | 'Durak' | 'Domino' | 'Dice' | 'Bingo' {
    switch (gameType) {
        case 'tic-tac-toe': return 'Tic-Tac-Toe';
        case 'checkers': return 'Checkers';
        case 'chess': return 'Chess';
        case 'backgammon': return 'Backgammon';
        case 'durak': return 'Durak';
        case 'domino': return 'Domino';
        case 'dice': return 'Dice';
        case 'bingo': return 'Bingo';
        default: return 'Tic-Tac-Toe';
    }
}

async function endGame(io: Server, room: Room, winnerId?: string, isDraw: boolean = false) {
    console.log(`[EndGame] Starting endGame for room: ${room.id}, Winner: ${winnerId}, Draw: ${isDraw}`);
    
    if (!room) {
        console.log(`[EndGame] Room not found, cannot end game`);
        return;
    }
    
    // Mark game as finished immediately to prevent race conditions
    if (room.gameState) {
        room.gameState.isGameFinished = true;
        console.log(`[EndGame] Game marked as finished for room: ${room.id}`);
    }
    
    if (room.disconnectTimer) {
        console.log(`[EndGame] Clearing disconnect timer for room: ${room.id}`);
        clearTimeout(room.disconnectTimer);
    }
    
    if (room.botJoinTimer) {
        console.log(`[EndGame] Clearing bot join timer for room: ${room.id}`);
        clearTimeout(room.botJoinTimer);
    }
    
    // Stop move timer
    console.log(`[EndGame] Stopping move timer for room: ${room.id}`);
    stopMoveTimer(room);
    
    // @ts-ignore
    const winner = room.players.find(p => p.user._id.toString() === winnerId);
    // @ts-ignore
    const loser = room.players.find(p => p.user._id.toString() !== winnerId);

    console.log(`[EndGame] Found players - Winner: ${winner?.user.username}, Loser: ${loser?.user.username}`);

    const gameNameForDB = formatGameNameForDB(room.gameType);

    if (isDraw) {
        for (const player of room.players) {
            if (!isBot(player)) {
                const opponent = room.players.find(p => p.user._id !== player.user._id);
                await GameRecord.create({
                    user: player.user._id,
                    gameName: gameNameForDB,
                    status: 'DRAW',
                    amountChanged: 0,
                    opponent: opponent?.user.username || 'Bot'
                });
            }
        }
        io.to(room.id).emit('gameEnd', { winner: null, isDraw: true });
    } else if (winner && loser) {
        if (!isBot(winner)) {
            const updatedWinner = await User.findByIdAndUpdate(winner.user._id, { $inc: { balance: room.bet } }, { new: true });
            await GameRecord.create({
                user: winner.user._id,
                gameName: gameNameForDB,
                status: 'WON',
                amountChanged: room.bet,
                opponent: loser.user.username
            });
            const winnerTransaction = await Transaction.create({
                user: winner.user._id,
                type: 'WAGER_WIN',
                amount: room.bet
            });

            if (updatedWinner) {
                io.emit('balanceUpdated', {
                    userId: (winner.user._id as any).toString(),
                    newBalance: updatedWinner.balance,
                    transaction: {
                        type: winnerTransaction.type,
                        amount: winnerTransaction.amount,
                        status: winnerTransaction.status,
                        createdAt: new Date()
                    }
                });
            }
        }
        if (!isBot(loser)) {
            const updatedLoser = await User.findByIdAndUpdate(loser.user._id, { $inc: { balance: -room.bet } }, { new: true });
            await GameRecord.create({
                user: loser.user._id,
                gameName: gameNameForDB,
                status: 'LOST',
                amountChanged: -room.bet,
                opponent: winner.user.username
            });
            const loserTransaction = await Transaction.create({
                user: loser.user._id,
                type: 'WAGER_LOSS',
                amount: room.bet
            });

            if (updatedLoser) {
                io.emit('balanceUpdated', {
                    userId: (loser.user._id as any).toString(),
                    newBalance: updatedLoser.balance,
                    transaction: {
                        type: loserTransaction.type,
                        amount: loserTransaction.amount,
                        status: loserTransaction.status,
                        createdAt: new Date()
                    }
                });
            }
        }
        io.to(room.id).emit('gameEnd', { winner, isDraw: false });
    }
    
    console.log(`[EndGame] Game completed successfully, cleaning up room: ${room.id}`);
    const gameType = room.gameType;
    delete rooms[room.id];
    console.log(`[EndGame] Room ${room.id} deleted from rooms object`);
    broadcastLobbyState(io, gameType);
    console.log(`[EndGame] Lobby state updated for gameType: ${gameType}`);
}

async function processBotMoveInRegularGame(
    io: Server,
    roomId: string,
    nextPlayer: any,
    gameLogic: any
): Promise<void> {
    try {
        let currentRoom = rooms[roomId];
        if (!currentRoom) return;

        console.log(`[Bot] Processing bot move for ${currentRoom.gameType}, player:`, nextPlayer.user.username);

        if (currentRoom.gameType === 'backgammon') {
            // @ts-ignore
            const botPlayerId = nextPlayer.user._id.toString();
            
            if ((currentRoom.gameState as any).turnPhase === 'ROLLING') {
                console.log('[Bot] Bot is in ROLLING phase, rolling dice first');
                const { newState: diceState, error: diceError } = rollDiceForBackgammon(
                    currentRoom.gameState,
                    botPlayerId,
                    currentRoom.players
                );
                
                if (diceError) {
                    console.log('[Bot] Dice roll error:', diceError);
                    return;
                }
                
                currentRoom.gameState = diceState;
                io.to(roomId).emit('gameUpdate', getPublicRoomState(currentRoom));
                
                // If still in ROLLING phase, bot has no moves - exit
                if ((currentRoom.gameState as any).turnPhase === 'ROLLING') {
                    console.log('[Bot] No moves available after dice roll, skipping turn');
                    return;
                }
                
                console.log('[Bot] Dice rolled successfully, proceeding to moves');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        let botCanMove = true;
        let safetyBreak = 0;

        while (botCanMove && safetyBreak < 10) {
            safetyBreak++;
            
            const botPlayerIndex = currentRoom.players.findIndex(p => isBot(p));
            console.log(`[Bot] Bot player index: ${botPlayerIndex}, total players: ${currentRoom.players.length}`);
            console.log(`[Bot] Players:`, currentRoom.players.map(p => ({ id: (p.user._id as any).toString(), username: p.user.username, isBot: isBot(p) })));
            console.log(`[Bot] Current turn: ${currentRoom.gameState.turn}, Bot ID: ${(nextPlayer.user._id as any).toString()}`);
            
            if (botPlayerIndex === -1) {
                console.log('[Bot] No bot found in players array, breaking');
                break;
            }
            
            const botMove = gameLogic.makeBotMove(currentRoom.gameState, botPlayerIndex as 0 | 1);
            console.log(`[Bot] Bot move generated:`, botMove);
            
            if (!botMove || Object.keys(botMove).length === 0) {
                console.log('[Bot] No valid move generated, breaking');
                break;
            }

            const botProcessResult = gameLogic.processMove(
                currentRoom.gameState,
                botMove,
                // @ts-ignore
                nextPlayer.user._id.toString(),
                currentRoom.players
            );

            if (botProcessResult.error) {
                console.log(`[Bot] Move error: ${botProcessResult.error}`);
                break;
            }

            console.log(`[Bot] Move processed successfully, turn should switch: ${botProcessResult.turnShouldSwitch}`);
            currentRoom.gameState = botProcessResult.newState;
            
            const botGameResult = gameLogic.checkGameEnd(currentRoom.gameState, currentRoom.players);
            if (botGameResult.isGameOver) {
                console.log('[Bot] Game ended, winner:', botGameResult.winnerId);
                return endGame(io, currentRoom, botGameResult.winnerId, botGameResult.isDraw);
            }
            
            botCanMove = !('turnShouldSwitch' in botProcessResult ? botProcessResult.turnShouldSwitch : true);
            
            if (currentRoom.gameType === 'backgammon' &&
                ('turnShouldSwitch' in botProcessResult ? botProcessResult.turnShouldSwitch : true)) {
                break;
            }

            // For dice and bingo games, add delay between moves and check if bot should continue
            if (currentRoom.gameType === 'dice' || currentRoom.gameType === 'bingo') {
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // Check if bot is still in SELECTING phase after SELECT_DICE move
                const diceState = currentRoom.gameState as any;
                if (diceState.gamePhase === 'BANKING' && diceState.currentPlayer === botPlayerIndex) {
                    // Bot should continue to make banking decision
                    botCanMove = true;
                    console.log('[Bot] Continuing to banking phase');
                } else if (diceState.gamePhase === 'SELECTING' && diceState.currentPlayer === botPlayerIndex) {
                    // Bot should continue to select more dice if needed
                    botCanMove = true;
                    console.log('[Bot] Continuing to select more dice');
                }
                
                // For bingo, check if bot should continue in marking phase
                if (currentRoom.gameType === 'bingo') {
                    const bingoState = currentRoom.gameState as any;
                    if (bingoState.gamePhase === 'MARKING' && bingoState.currentPlayer === botPlayerIndex) {
                        botCanMove = true;
                        console.log('[Bot] Continuing bingo marking phase');
                    }
                }
            }
        }

        if (currentRoom) {
            const publicState = getPublicRoomState(currentRoom);
            console.log('[Bot] Emitting game update:', {
                gameType: publicState.gameType,
                board: publicState.gameState?.board?.slice(0, 3), // Show first 3 points
                currentPlayer: publicState.gameState?.currentPlayer,
                turnPhase: publicState.gameState?.turnPhase
            });
            io.to(roomId).emit('gameUpdate', publicState);
            
            // ВАЖНО: После хода бота запускать таймер для следующего игрока-человека
            // @ts-ignore
            const nextPlayer = currentRoom.players.find(p => p.user._id.toString() === currentRoom.gameState.turn);
            if (nextPlayer && !isBot(nextPlayer)) {
                console.log(`[Bot] Starting timer for next human player after bot move: ${nextPlayer.user.username}`);
                startMoveTimer(io, currentRoom);
            }
        }
    } catch (error) {
        console.error(`[Bot] Error in regular game bot move:`, error);
    }
}

export const initializeSocket = (io: Server) => {
    setIO(io);

    io.use(async (socket: Socket, next: (err?: Error) => void) => {
        try {
            let token = socket.handshake.auth.token;
            
            // Allow guest connections (no token)
            if (!token) {
                (socket as any).user = null; // Guest user
                return next();
            }
            
            // Remove "Bearer " prefix if present
            if (token.startsWith('Bearer ')) {
                token = token.slice(7);
            }
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
            const user = await User.findById(decoded.id).select('username avatar balance role').lean();
            if (!user) return next(new Error('User not found'));
            (socket as any).user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const initialUser = (socket as any).user as IUser | null;
        
        // Only map authenticated users
        if (initialUser) {
            // @ts-ignore
            userSocketMap[initialUser._id.toString()] = socket.id;
            // @ts-ignore
            socket.data = { userId: initialUser._id.toString() };
        }

        // Only handle game reconnection for authenticated users
        if (initialUser) {
            const previousRoom = Object.values(rooms).find(r =>
                // @ts-ignore
                r.disconnectTimer && r.players.some(p => p.user._id.toString() === initialUser._id.toString())
            );

            if (previousRoom) {
                console.log(`[+] Player ${initialUser.username} reconnected to room ${previousRoom.id}`);
                
                clearTimeout(previousRoom.disconnectTimer);
                previousRoom.disconnectTimer = undefined;

                // @ts-ignore
                const playerInRoom = previousRoom.players.find(p => p.user._id.toString() === initialUser._id.toString())!;
                playerInRoom.socketId = socket.id;
                
                socket.join(previousRoom.id);
                io.to(previousRoom.id).emit('playerReconnected', { message: `Player ${initialUser.username} returned to the game!` });
                io.to(previousRoom.id).emit('gameUpdate', getPublicRoomState(previousRoom));
            }
        }


        socket.on('joinLobby', (gameType: Room['gameType']) => {
            console.log(`[Lobby] Player joining lobby for ${gameType}`);
            socket.join(`lobby-${gameType}`);
            broadcastLobbyState(io, gameType);
        });

        socket.on('leaveLobby', (gameType: Room['gameType']) => {
            console.log(`[Lobby] Player leaving lobby for ${gameType}`);
            socket.leave(`lobby-${gameType}`);
        });

        socket.on('requestRoomsList', (gameType: Room['gameType']) => {
            console.log(`[Lobby] Player requesting rooms list for ${gameType}`);
            if (socket.rooms.has(`lobby-${gameType}`)) {
                broadcastLobbyState(io, gameType);
            } else {
                console.log(`[Lobby] Player not in lobby-${gameType}, joining first`);
                socket.join(`lobby-${gameType}`);
                broadcastLobbyState(io, gameType);
            }
        });

        socket.on('joinTournamentGame', async (matchId: string) => {
            // @ts-ignore
            const userId = initialUser._id.toString();
            const success = await joinTournamentRoom(io, socket, matchId, userId);
            
            if (success) {
                tournamentPlayerSockets[userId] = socket.id;
            }
        });

        socket.on('leaveTournamentGame', async (matchId: string) => {
            // @ts-ignore
            const userId = initialUser._id.toString();
            console.log(`[Tournament] Player ${userId} leaving tournament game ${matchId}`);
            
            if (tournamentPlayerSockets[userId]) {
                delete tournamentPlayerSockets[userId];
            }
            
            socket.leave(`tournament-${matchId}`);
        });

        socket.on('tournamentMove', async ({ matchId, move }: { matchId: string, move: any }) => {
            // @ts-ignore
            const userId = initialUser._id.toString();
            await processTournamentMove(io, socket, matchId, userId, move);
        });

        socket.on('tournamentPlayerLeft', async ({ matchId, timestamp }: { matchId: string, timestamp: number }) => {
            // @ts-ignore
            const userId = initialUser._id.toString();
            await handleTournamentPlayerLeft(io, matchId, userId, timestamp);
        });

        socket.on('tournamentPlayerReturned', async ({ matchId }: { matchId: string }) => {
            // @ts-ignore
            const userId = initialUser._id.toString();
            await handleTournamentPlayerReturned(io, matchId, userId);
        });

        socket.on('tournamentPlayerForfeited', async ({ matchId, reason }: { matchId: string, reason?: string }) => {
            // @ts-ignore
            const userId = initialUser._id.toString();
            await handleTournamentPlayerForfeited(io, matchId, userId, reason);
        });

        socket.on('rollDice', (roomId: string) => {
            const room = rooms[roomId];
            const currentPlayerId = (socket as any).user._id.toString();

            if (!room || room.gameType !== 'backgammon') {
                return;
            }

            const { newState, error } = rollDiceForBackgammon(room.gameState, currentPlayerId, room.players);
            
            if (error) {
                return socket.emit('error', { message: error });
            }

            room.gameState = newState;
            io.to(roomId).emit('gameUpdate', getPublicRoomState(room));
            
            // @ts-ignore
            const nextPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn);
            if (nextPlayer && isBot(nextPlayer) && (room.gameState as any).turnPhase === 'ROLLING') {
                setTimeout(() => {
                    const currentRoom = rooms[roomId];
                    if (!currentRoom) return;
                    
                    // @ts-ignore
                    const botPlayerId = nextPlayer.user._id.toString();
                    const { newState: botDiceState, error: botDiceError } = rollDiceForBackgammon(
                        currentRoom.gameState,
                        botPlayerId,
                        currentRoom.players
                    );
                    
                    if (!botDiceError) {
                        currentRoom.gameState = botDiceState;
                        io.to(roomId).emit('gameUpdate', getPublicRoomState(currentRoom));
                        
                        // After bot rolls dice successfully, trigger bot moves if in MOVING phase
                        if ((currentRoom.gameState as any).turnPhase === 'MOVING') {
                            console.log('[Bot] Bot rolled dice successfully, now making moves');
                            setTimeout(() => {
                                const gameLogic = gameLogics[currentRoom.gameType];
                                processBotMoveInRegularGame(io, roomId, nextPlayer, gameLogic);
                            }, 800);
                        }
                    }
                }, 1000);
            }
        });

        socket.on('createRoom', async ({ gameType, bet }: { gameType: Room['gameType'], bet: number }) => {
            if (!initialUser) {
                return socket.emit('error', { message: 'Authentication required' });
            }
            
            const gameLogic = gameLogics[gameType];
            if (!gameLogic || !gameLogic.createInitialState) return socket.emit('error', { message: "Game unavailable." });
            
            const currentUser = await User.findById(initialUser._id);
            if (!currentUser) return socket.emit('error', { message: "User not found." });
            if (currentUser.balance < bet) return socket.emit('error', { message: 'Insufficient funds.' });

            const roomId = `room-${socket.id}`;
            const players: Player[] = [{ socketId: socket.id, user: currentUser }];
            const newRoom: Room = { id: roomId, gameType, bet, players, gameState: gameLogic.createInitialState(players) };
            rooms[roomId] = newRoom;
            socket.join(roomId);

            socket.emit('gameStart', getPublicRoomState(newRoom));
            broadcastLobbyState(io, gameType);

            newRoom.botJoinTimer = setTimeout(() => {
                const room = rooms[roomId];
                if (room && room.players.length === 1) {
                    const botUser: Player['user'] = { _id: `bot-${Date.now()}` as any, username: botUsernames[Math.floor(Math.random() * botUsernames.length)], avatar: 'bot_avatar.png', balance: 9999 };
                    room.players.push({ socketId: 'bot_socket_id', user: botUser });
                    room.gameState = gameLogic.createInitialState(room.players);
                    io.to(roomId).emit('gameStart', getPublicRoomState(room));
                    
                    // Start move timer if human player goes first
                    // @ts-ignore
                    const firstPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn);
                    if (firstPlayer && !isBot(firstPlayer)) {
                        startMoveTimer(io, room);
                    }
                    
                    // Check if bot should start first in domino, dice, or bingo
                    if (room.gameType === 'domino' || room.gameType === 'dice' || room.gameType === 'bingo') {
                        const botPlayer = room.players.find(p => isBot(p));
                        if (botPlayer && room.gameState.turn === (botPlayer.user._id as any).toString()) {
                            setTimeout(() => {
                                processBotMoveInRegularGame(io, roomId, botPlayer, gameLogic);
                            }, 1500);
                        }
                    }
                }
            }, BOT_WAIT_TIME);
        });

        socket.on('createPrivateRoom', async ({ gameType, bet }: { gameType: Room['gameType'], bet: number }) => {
            if (!initialUser) {
                return socket.emit('error', { message: 'Authentication required' });
            }
            
            const gameLogic = gameLogics[gameType];
            if (!gameLogic || !gameLogic.createInitialState) return socket.emit('error', { message: "Game unavailable." });
            
            const currentUser = await User.findById(initialUser._id);
            if (!currentUser) return socket.emit('error', { message: "User not found." });
            if (currentUser.balance < bet) return socket.emit('error', { message: 'Insufficient funds.' });

            const roomId = `private-room-${socket.id}-${Date.now()}`;
            const invitationToken = generateInvitationToken();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            
            const players: Player[] = [{ socketId: socket.id, user: currentUser }];
            const newRoom: Room = {
                id: roomId,
                gameType,
                bet,
                players,
                gameState: gameLogic.createInitialState(players),
                isPrivate: true,
                invitationToken,
                allowBots: false,
                hostUserId: (currentUser._id as any).toString(),
                expiresAt
            };
            
            rooms[roomId] = newRoom;
            socket.join(roomId);

            // Create invitation record
            const invitation: PrivateRoomInvitation = {
                id: generateChatId(),
                roomId,
                gameType,
                bet,
                hostUsername: currentUser.username,
                token: invitationToken,
                expiresAt,
                isUsed: false
            };
            
            privateInvitations[invitationToken] = invitation;

            const invitationUrl = `https://platform.skillgame.pro/private-room/${invitationToken}`;
            
            socket.emit('privateRoomCreated', {
                room: getPublicRoomState(newRoom),
                invitationToken,
                invitationUrl,
                expiresAt
            });

            console.log(`Private room created: ${roomId} with token: ${invitationToken}`);
        });

        socket.on('joinPrivateRoom', async (token: string) => {
            if (!initialUser) {
                return socket.emit('error', { message: 'Authentication required' });
            }

            const invitation = privateInvitations[token];
            if (!invitation) {
                return socket.emit('error', { message: 'Invalid or expired invitation' });
            }

            if (invitation.isUsed) {
                return socket.emit('error', { message: 'This invitation has already been used' });
            }

            if (invitation.expiresAt < new Date()) {
                delete privateInvitations[token];
                return socket.emit('error', { message: 'Invitation has expired' });
            }

            const room = rooms[invitation.roomId];
            if (!room) {
                delete privateInvitations[token];
                return socket.emit('error', { message: 'Room no longer exists' });
            }

            if (room.players.length >= 2) {
                return socket.emit('error', { message: 'Room is already full' });
            }

            const currentUser = await User.findById(initialUser._id);
            if (!currentUser) return socket.emit('error', { message: "User not found." });
            if (currentUser.balance < room.bet) return socket.emit('error', { message: 'Insufficient funds to join.' });

            // Check if user is the host (prevent host from joining their own room via invitation)
            if (room.hostUserId === (currentUser._id as any).toString()) {
                return socket.emit('error', { message: 'Cannot join your own private room via invitation' });
            }

            const gameLogic = gameLogics[room.gameType];
            room.players.push({ socketId: socket.id, user: currentUser });
            socket.join(room.id);

            // Mark invitation as used
            invitation.isUsed = true;
            invitation.usedAt = new Date();

            // Update game state for 2 players
            room.gameState = gameLogic.createInitialState(room.players);
            io.to(room.id).emit('gameStart', getPublicRoomState(room));
            
            // Start move timer for the first player
            // @ts-ignore
            const firstPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn);
            if (firstPlayer && !isBot(firstPlayer)) {
                startMoveTimer(io, room);
            }

            console.log(`User ${currentUser.username} joined private room ${room.id} using token ${token}`);
        });

        socket.on('getPrivateRoomInfo', (token: string) => {
            const invitation = privateInvitations[token];
            if (!invitation) {
                return socket.emit('error', { message: 'Invalid or expired invitation' });
            }

            if (invitation.expiresAt < new Date()) {
                delete privateInvitations[token];
                return socket.emit('error', { message: 'Invitation has expired' });
            }

            const room = rooms[invitation.roomId];
            if (!room) {
                delete privateInvitations[token];
                return socket.emit('error', { message: 'Room no longer exists' });
            }

            socket.emit('privateRoomInfo', {
                gameType: invitation.gameType,
                bet: invitation.bet,
                hostUsername: invitation.hostUsername,
                isUsed: invitation.isUsed,
                playersCount: room.players.length,
                expiresAt: invitation.expiresAt
            });
        });

        socket.on('joinRoom', async (roomId: string) => {
            if (!initialUser) {
                return socket.emit('error', { message: 'Authentication required' });
            }
            
            const room = rooms[roomId];
            const currentUser = await User.findById(initialUser._id);

            if (!currentUser || !room) {
                return socket.emit('error', { message: 'Room not found or user does not exist.' });
            }
            if (room.players.length >= 2) {
                return socket.emit('error', { message: 'Room is already full.' });
            }
            if (currentUser.balance < room.bet) {
                return socket.emit('error', { message: 'Insufficient funds to join.' });
            }

            const gameLogic = gameLogics[room.gameType];
            room.players.push({ socketId: socket.id, user: currentUser });
            socket.join(roomId);

            if (room.players.length === 1) {
                room.gameState = gameLogic.createInitialState(room.players);
                socket.emit('gameStart', getPublicRoomState(room));

                room.botJoinTimer = setTimeout(() => {
                    const currentRoom = rooms[roomId];
                    if (currentRoom && currentRoom.players.length === 1) {
                        const botUser: Player['user'] = { _id: `bot-${Date.now()}` as any, username: botUsernames[Math.floor(Math.random() * botUsernames.length)], avatar: 'bot_avatar.png', balance: 9999 };
                        currentRoom.players.push({ socketId: 'bot_socket_id', user: botUser });
                        currentRoom.gameState = gameLogic.createInitialState(currentRoom.players);
                        io.to(roomId).emit('gameStart', getPublicRoomState(currentRoom));
                        
                        // Start move timer if human player goes first
                        // @ts-ignore
                        const firstPlayer = currentRoom.players.find(p => p.user._id.toString() === currentRoom.gameState.turn);
                        if (firstPlayer && !isBot(firstPlayer)) {
                            startMoveTimer(io, currentRoom);
                        }
                        
                        // Check if bot should start first in domino, dice, or bingo
                        if (currentRoom.gameType === 'domino' || currentRoom.gameType === 'dice' || currentRoom.gameType === 'bingo') {
                            const botPlayer = currentRoom.players.find(p => isBot(p));
                            if (botPlayer && currentRoom.gameState.turn === (botPlayer.user._id as any).toString()) {
                                setTimeout(() => {
                                    processBotMoveInRegularGame(io, roomId, botPlayer, gameLogic);
                                }, 1500);
                            }
                        }
                    }
                }, BOT_WAIT_TIME);

            } else {
                if (room.botJoinTimer) {
                    clearTimeout(room.botJoinTimer);
                }
                
                room.gameState = gameLogic.createInitialState(room.players);
                io.to(roomId).emit('gameStart', getPublicRoomState(room));
                
                // Start move timer for the first player
                // @ts-ignore
                const firstPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn);
                if (firstPlayer && !isBot(firstPlayer)) {
                    startMoveTimer(io, room);
                }
                
                // Check if bot should start first in domino, dice, or bingo
                if (room.gameType === 'domino' || room.gameType === 'dice' || room.gameType === 'bingo') {
                    const botPlayer = room.players.find(p => isBot(p));
                    if (botPlayer && room.gameState.turn === (botPlayer.user._id as any).toString()) {
                        setTimeout(() => {
                            processBotMoveInRegularGame(io, roomId, botPlayer, gameLogic);
                        }, 1500);
                    }
                }
            }
            
            broadcastLobbyState(io, room.gameType);
        });
        
        socket.on('playerMove', ({ roomId, move }: { roomId: string, move: GameMove }) => {
            const room = rooms[roomId];
            // @ts-ignore
            const currentPlayerId = initialUser._id.toString();

            console.log(`[PlayerMove] Player ${currentPlayerId} making move in room ${roomId}`);

            if (!room) {
                return socket.emit('error', { message: 'Room not found' });
            }
            if (room.players.length < 2) {
                return socket.emit('error', { message: 'Wait for the second player' });
            }
            if (room.gameState.turn !== currentPlayerId) {
                return socket.emit('error', { message: 'Not your turn' });
            }
            if (room.gameState.isGameFinished) {
                return socket.emit('error', { message: 'Game is already finished' });
            }

            const gameLogic = gameLogics[room.gameType];
            
            const result = gameLogic.processMove(room.gameState, move, currentPlayerId, room.players);
            
            if (result.error) return socket.emit('error', { message: result.error });

            room.gameState = result.newState;
            
            // Stop current move timer
            console.log(`[PlayerMove] Stopping timer after move by player ${currentPlayerId}`);
            stopMoveTimer(room);
            
            const gameResult = gameLogic.checkGameEnd(room.gameState, room.players);
            if (gameResult.isGameOver) {
                console.log(`[PlayerMove] Game over detected, ending game with winner: ${gameResult.winnerId}`);
                return endGame(io, room, gameResult.winnerId, gameResult.isDraw);
            }
            
            io.to(roomId).emit('gameUpdate', getPublicRoomState(room));
            
            // @ts-ignore
            const nextPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn);
            console.log(`[PlayerMove] Next player: ${nextPlayer?.user.username} (${room.gameState.turn}), isBot: ${nextPlayer ? isBot(nextPlayer) : 'undefined'}`);
            
            // ВАЖНО: Запускать таймер для КАЖДОГО следующего хода, если это человек
            if (nextPlayer && !isBot(nextPlayer)) {
                console.log(`[PlayerMove] Starting timer for next human player: ${nextPlayer.user.username}`);
                startMoveTimer(io, room);
            }
            
            // Schedule bot move if it's a bot's turn
            const shouldScheduleBotMove = nextPlayer && isBot(nextPlayer) &&
                ('turnShouldSwitch' in result ? result.turnShouldSwitch : true);
                
            if (shouldScheduleBotMove) {
                console.log(`[PlayerMove] Scheduling bot move for: ${nextPlayer.user.username}`);
                setTimeout(() => {
                    processBotMoveInRegularGame(io, roomId, nextPlayer, gameLogic);
                }, 1200);
            }
        });

        socket.on('leaveGame', (roomId: string) => {
            const room = rooms[roomId];
            if (!room) return;
            
            const winningPlayer = room.players.find(p => p.socketId !== socket.id);
            if (winningPlayer) {
                // @ts-ignore
                endGame(io, room, winningPlayer.user._id.toString());
            } else {
                if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
                delete rooms[roomId];
                broadcastLobbyState(io, room.gameType);
            }
        });

        socket.on('getGameState', (roomId: string) => {
            const room = rooms[roomId];
            if (room && room.players.some(p => p.socketId === socket.id)) {
                socket.emit('gameUpdate', getPublicRoomState(room));
            }
        });
        
        socket.on('disconnect', () => {
            if (initialUser) {
                console.log(`[-] User disconnected: ${initialUser.username}`);
                // @ts-ignore
                delete userSocketMap[initialUser._id.toString()];
            } else {
                console.log(`[-] Guest user disconnected`);
            }

            const roomId = Object.keys(rooms).find(id => rooms[id].players.some(p => p.socketId === socket.id));
            if (!roomId) return;

            const room = rooms[roomId];
            if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
            
            const remainingPlayer = room.players.find(p => p.socketId !== socket.id);

            if (room.players.length < 2 || !remainingPlayer) {
                delete rooms[roomId];
                broadcastLobbyState(io, room.gameType);
            } else {
                io.to(remainingPlayer.socketId).emit('opponentDisconnected', { message: `Opponent disconnected. Waiting for reconnection (60 sec)...` });
                room.disconnectTimer = setTimeout(() => {
                    // @ts-ignore
                    endGame(io, room, remainingPlayer.user._id.toString());
                }, 60000);
            }
        });

        // ============ UNIFIED CHAT EVENT HANDLERS ============
        
        // Join chat room - unified for all user types (guest, user, admin)
        socket.on('joinChat', async (data: string | { chatId?: string, userId?: string, autoCreate?: boolean }) => {
            try {
                const userId = (socket as any).user?._id?.toString();
                let chatId: string | null = null;
                let autoCreate = false;

                // Handle different parameter formats for backward compatibility
                if (typeof data === 'string') {
                    chatId = data; // Direct chatId for existing chats (landing, admin)
                } else if (data.chatId) {
                    chatId = data.chatId; // Existing chat
                } else if (data.userId && data.userId === userId) {
                    // Auto-find or create user's support chat (client app)
                    autoCreate = data.autoCreate || false;
                }

                let chat = null;

                if (chatId) {
                    // Join existing chat
                    chat = await Chat.findOne({ id: chatId });
                    if (!chat) {
                        return socket.emit('chatError', { message: 'Chat not found' });
                    }
                } else if (userId && autoCreate) {
                    // Find existing support chat for authenticated user
                    chat = await Chat.findOne({
                        userId: userId,
                        source: 'client',
                        status: { $ne: 'closed' }
                    }).sort({ createdAt: -1 });
                }

                if (chat) {
                    // Check permissions for existing chat
                    let hasAccess = false;

                    if (userId) {
                        const user = await User.findById(userId);
                        const isAdmin = user?.role === 'ADMIN';
                        const isOwner = chat.userId?.toString() === userId;
                        const isAssigned = chat.assignedAdmin?.toString() === userId;
                        hasAccess = isAdmin || isOwner || isAssigned;
                    } else {
                        // Guest user - check if this is their chat
                        hasAccess = !!chat.guestId;
                    }

                    if (!hasAccess) {
                        return socket.emit('chatError', { message: 'Access denied to this chat' });
                    }

                    socket.join(`chat-${chat.id}`);
                    
                    // Track user socket for chat
                    if (userId) {
                        chatUserSockets[userId] = socket.id;
                    } else {
                        chatUserSockets[`guest-${chat.id}`] = socket.id;
                    }

                    socket.emit('chatJoined', {
                        chatId: chat.id,
                        message: 'Successfully joined chat',
                        chat: chat
                    });

                    console.log(`User ${userId || 'Guest'} joined chat ${chat.id}`);
                } else {
                    // No chat found - will be created on first message
                    socket.emit('chatJoined', {
                        chatId: null,
                        message: 'No active chat. Send a message to start a conversation.',
                        chat: null
                    });
                    console.log(`User ${userId || 'Guest'} ready to start new chat`);
                }
            } catch (error) {
                console.error('Error joining chat:', error);
                socket.emit('chatError', { message: 'Error joining chat' });
            }
        });

        // Leave chat room
        socket.on('leaveChat', (chatId: string) => {
            socket.leave(`chat-${chatId}`);
            const userId = (socket as any).user?._id?.toString();
            
            if (userId && chatUserSockets[userId] === socket.id) {
                delete chatUserSockets[userId];
            }
            
            socket.emit('chatLeft', { chatId });
            console.log(`User ${userId || 'Guest'} left chat ${chatId}`);
        });

        // Send message - unified for all user types with auto-chat creation
        socket.on('sendMessage', async ({ chatId, content, guestInfo, autoCreate }: {
            chatId?: string,
            content: string,
            guestInfo?: { id: string, name: string },
            autoCreate?: boolean
        }) => {
            try {
                if (!content || content.trim().length === 0) {
                    return socket.emit('chatError', { message: 'Message content cannot be empty' });
                }

                if (content.length > 1000) {
                    return socket.emit('chatError', { message: 'Message too long (max 1000 characters)' });
                }

                const userId = (socket as any).user?._id?.toString();
                let chat = null;

                // Try to find existing chat
                if (chatId) {
                    chat = await Chat.findOne({ id: chatId });
                }

                // Auto-create chat if needed
                if (!chat && (autoCreate || !chatId)) {
                    const newChatId = generateChatId();
                    
                    let newChatData: any = {
                        id: newChatId,
                        subject: 'Support Request',
                        status: 'pending',
                        messages: [],
                        createdAt: new Date(),
                        lastActivity: new Date()
                    };

                    if (userId) {
                        // Authenticated user
                        const user = await User.findById(userId);
                        if (!user) {
                            return socket.emit('chatError', { message: 'User not found' });
                        }
                        
                        newChatData.userId = userId;
                        newChatData.source = 'client';
                        newChatData.userInfo = {
                            id: userId,
                            name: user.username,
                            email: user.email
                        };
                    } else {
                        // Guest user
                        const guestId = guestInfo?.id || generateChatId();
                        const guestName = guestInfo?.name || 'Guest';
                        
                        newChatData.guestId = guestId;
                        newChatData.source = 'landing';
                        newChatData.guestInfo = {
                            id: guestId,
                            name: guestName
                        };
                    }

                    chat = new Chat(newChatData);
                    chatId = newChatId;
                }

                if (!chat) {
                    return socket.emit('chatError', { message: 'Chat not found and cannot be created' });
                }

                // Determine sender info
                let senderInfo;
                if (userId) {
                    const user = await User.findById(userId);
                    const isAdmin = user?.role === 'ADMIN';
                    senderInfo = {
                        id: userId,
                        name: user?.username || 'User',
                        type: isAdmin ? 'admin' as const : 'user' as const
                    };
                } else {
                    // Guest user
                    senderInfo = {
                        id: guestInfo?.id || chat.guestId || generateChatId(),
                        name: guestInfo?.name || 'Guest',
                        type: 'guest' as const
                    };
                }

                const newMessage: IMessage = {
                    id: generateChatId(),
                    chatId: chatId!,
                    content: content.trim(),
                    sender: senderInfo,
                    timestamp: new Date(),
                    isRead: false
                };

                // Add message to chat
                chat.messages.push(newMessage);
                chat.lastActivity = new Date();
                
                // If admin responds, set status to active
                if (senderInfo.type === 'admin' && chat.status === 'pending') {
                    chat.status = 'active';
                    chat.assignedAdmin = userId;
                }

                await chat.save();

                // Auto-join the chat room if not already joined
                socket.join(`chat-${chatId}`);
                
                // Track user socket
                if (userId) {
                    chatUserSockets[userId] = socket.id;
                } else {
                    chatUserSockets[`guest-${chatId}`] = socket.id;
                }

                // Broadcast message to all users in chat room
                io.to(`chat-${chatId}`).emit('newMessage', {
                    chatId,
                    message: newMessage
                });

                // Send chat creation confirmation if this was a new chat
                if (!chatId || newMessage.id === chat.messages[0]?.id) {
                    socket.emit('chatJoined', {
                        chatId,
                        message: 'Chat created and joined successfully',
                        chat: chat
                    });
                }

                // Note: Removed chatNotification to prevent duplicate notifications
                // Admins receive notifications through newMessage event only

                console.log(`Message sent in chat ${chatId} by ${senderInfo.name} (${senderInfo.type})`);
            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('chatError', { message: 'Error sending message' });
            }
        });

        // Mark messages as read
        socket.on('markChatRead', async (chatId: string) => {
            try {
                const userId = (socket as any).user?._id?.toString();
                const chat = await Chat.findOne({ id: chatId });
                
                if (!chat) {
                    return socket.emit('chatError', { message: 'Chat not found' });
                }

                let hasUpdates = false;
                chat.messages.forEach(message => {
                    if (message.sender.id !== userId && !message.isRead) {
                        message.isRead = true;
                        hasUpdates = true;
                    }
                });

                if (hasUpdates) {
                    await chat.save();
                    
                    socket.to(`chat-${chatId}`).emit('messagesRead', {
                        chatId,
                        readBy: userId
                    });
                }

                socket.emit('chatReadConfirmed', { chatId });
            } catch (error) {
                console.error('Error marking messages as read:', error);
                socket.emit('chatError', { message: 'Error marking messages as read' });
            }
        });

        // Typing indicator - unified
        socket.on('chatTyping', ({ chatId, isTyping }: { chatId: string, isTyping: boolean }) => {
            const userId = (socket as any).user?._id?.toString();
            const userName = (socket as any).user?.username || 'Guest';
            
            socket.to(`chat-${chatId}`).emit('userTyping', {
                chatId,
                userId,
                userName,
                isTyping
            });
        });

        // Close chat - unified
        socket.on('closeChat', async (chatId: string) => {
            try {
                const userId = (socket as any).user?._id?.toString();
                const user = await User.findById(userId);
                
                const chat = await Chat.findOne({ id: chatId });
                if (!chat) {
                    return socket.emit('chatError', { message: 'Chat not found' });
                }

                // Check permissions
                const isAdmin = user?.role === 'ADMIN';
                const isOwner = chat.userId?.toString() === userId;
                const isAssigned = chat.assignedAdmin?.toString() === userId;

                if (!isAdmin && !isOwner && !isAssigned) {
                    return socket.emit('chatError', { message: 'Access denied' });
                }

                chat.status = 'closed';
                await chat.save();

                io.to(`chat-${chatId}`).emit('chatClosed', {
                    chatId,
                    closedBy: user?.username || 'System'
                });

                console.log(`Chat ${chatId} closed by ${user?.username || 'Unknown'}`);
            } catch (error) {
                console.error('Error closing chat:', error);
                socket.emit('chatError', { message: 'Error closing chat' });
            }
        });
    });
}