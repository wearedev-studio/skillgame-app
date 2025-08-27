import { Types } from 'mongoose';

export interface IGameUser {
    _id: string;
    username: string;
    avatar: string;
    balance: number;
}

export interface IPlayer {
    socketId: string;
    user: IGameUser;
}

export interface IBot {
    socketId: string;
    user: {
        _id: string;
        username: string;
        avatar: string;
        balance: number;
    };
}

export type GamePlayer = IPlayer | IBot;

export interface ITournamentPlayer {
    _id: string;
    username: string;
    isBot?: boolean;
}

export interface ITournamentMatch {
    matchId: number;
    players: ITournamentPlayer[];
    winner?: ITournamentPlayer;
    roomId?: string;
}

export interface ITournamentRound {
    roundName: string;
    matches: ITournamentMatch[];
}

export interface IBaseGameState {
    turn: string;
}

export interface ITicTacToeState extends IBaseGameState {
    board: ('X' | 'O' | null)[];
}

export interface IChessState extends IBaseGameState {
    fen: string;
    gameHistory: string[];
}

export interface ICheckersState extends IBaseGameState {
    board: (IPiece | null)[];
    mustCaptureWith: number | null;
}

export interface IBackgammonState extends IBaseGameState {
    points: IPoint[];
    dice: number[];
    turnPhase: 'ROLLING' | 'MOVING';
    borneOff: [number, number];
}

export interface IPiece {
    playerIndex: 0 | 1;
    isKing: boolean;
}

export type IPoint = [playerIndex: 0 | 1, count: number] | null;

export interface IBasicMove {
    from?: number | string;
    to?: number | string;
}

export interface ITicTacToeMove {
    cellIndex: number;
}

export interface IChessMove {
    from: string;
    to: string;
    promotion?: string;
}

export interface ICheckersMove extends IBasicMove {
    from: number;
    to: number;
    isCapture: boolean;
}

export interface IBackgammonMove extends IBasicMove {
    from: number;
    to: number;
}

export type GameMove = ITicTacToeMove | IChessMove | ICheckersMove | IBackgammonMove | Record<string, any>;
export type GameState = ITicTacToeState | IChessState | ICheckersState | IBackgammonState | Record<string, any>;

export interface IRoom {
    id: string;
    gameType: 'tic-tac-toe' | 'checkers' | 'chess' | 'backgammon' | 'durak' | 'domino' | 'dice';
    bet: number;
    players: GamePlayer[];
    gameState: GameState;
    botJoinTimer?: NodeJS.Timeout;
    disconnectTimer?: NodeJS.Timeout;
}

export interface IGameResult {
    isGameOver: boolean;
    winnerId?: string;
    isDraw: boolean;
}

export interface IMoveResult {
    newState: GameState;
    error?: string;
    turnShouldSwitch: boolean;
}

export interface IGameLogic {
    createInitialState(players: GamePlayer[]): GameState;
    processMove(gameState: GameState, move: GameMove, playerId: string, players: GamePlayer[]): IMoveResult;
    checkGameEnd(gameState: GameState, players: GamePlayer[]): IGameResult;
    makeBotMove(gameState: GameState, playerIndex: 0 | 1): GameMove;
}

export interface ISocketEvents {
    joinLobby: (gameType: string) => void;
    leaveLobby: (gameType: string) => void;
    roomsList: (rooms: any[]) => void;
    
    createRoom: (data: { gameType: string; bet: number }) => void;
    joinRoom: (roomId: string) => void;
    leaveGame: (roomId: string) => void;
    playerMove: (data: { roomId: string; move: GameMove }) => void;
    rollDice: (roomId: string) => void;
    getGameState: (roomId: string) => void;
    
    joinTournamentGame: (roomId: string) => void;
    matchReady: (data: { tournamentId: string; roomId: string }) => void;
    tournamentUpdated: (data: { tournamentId: string }) => void;
    
    gameStart: (roomState: any) => void;
    gameUpdate: (roomState: any) => void;
    gameEnd: (data: { winner: any; isDraw: boolean }) => void;
    
    playerReconnected: (data: { message: string }) => void;
    opponentDisconnected: (data: { message: string }) => void;
    
    error: (data: { message: string }) => void;
}