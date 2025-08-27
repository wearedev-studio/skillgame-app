import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';
import { ChessEngine, Position, PieceColor, ChessBoard, ChessPiece, PieceType } from './chess-engine';

type ChessState = {
    board: ChessBoard;
    currentPlayer: PieceColor;
    moveHistory: ChessMove[];
    moveCount: number;
    isGameOver: boolean;
    winner?: string;
    isDraw: boolean;
    turn: string;
    lastMove?: {
        from: Position;
        to: Position;
    };
};

type ChessMove = {
    from: Position;
    to: Position;
    promotion?: PieceType;
};

function positionFromAlgebraic(algebraic: string): Position {
    const col = algebraic.charCodeAt(0) - 97;
    const row = 8 - parseInt(algebraic[1]);
    return { row, col };
}

function positionToAlgebraic(pos: Position): string {
    const col = String.fromCharCode(97 + pos.col);
    const row = (8 - pos.row).toString();
    return col + row;
}

function convertEngineMove(move: any): ChessMove {
    if (typeof move.from === 'string') {
        return {
            from: positionFromAlgebraic(move.from),
            to: positionFromAlgebraic(move.to),
            promotion: move.promotion as PieceType
        };
    }
    return move;
}

function createEngineFromState(gameState: ChessState): ChessEngine {
    const engine = new ChessEngine();
    
    for (const move of gameState.moveHistory) {
        engine.makeMove(move.from, move.to, move.promotion);
    }
    
    return engine;
}

// Chess AI evaluation and strategy functions
const PIECE_VALUES: { [key in PieceType]: number } = {
    'pawn': 100,
    'knight': 320,
    'bishop': 330,
    'rook': 500,
    'queen': 900,
    'king': 20000
};

// Position bonus tables (from white's perspective)
const PAWN_TABLE = [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_TABLE = [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MIDDLE_GAME_TABLE = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
];

function evaluatePosition(board: ChessBoard, color: PieceColor): number {
    let score = 0;
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;
            
            const pieceValue = PIECE_VALUES[piece.type];
            const position = row * 8 + col;
            const adjustedPosition = piece.color === 'white' ? position : 63 - position;
            
            let positionalBonus = 0;
            switch (piece.type) {
                case 'pawn':
                    positionalBonus = PAWN_TABLE[adjustedPosition];
                    break;
                case 'knight':
                    positionalBonus = KNIGHT_TABLE[adjustedPosition];
                    break;
                case 'bishop':
                    positionalBonus = BISHOP_TABLE[adjustedPosition];
                    break;
                case 'rook':
                    positionalBonus = ROOK_TABLE[adjustedPosition];
                    break;
                case 'queen':
                    positionalBonus = QUEEN_TABLE[adjustedPosition];
                    break;
                case 'king':
                    positionalBonus = KING_MIDDLE_GAME_TABLE[adjustedPosition];
                    break;
            }
            
            const totalValue = pieceValue + positionalBonus;
            
            if (piece.color === color) {
                score += totalValue;
            } else {
                score -= totalValue;
            }
        }
    }
    
    return score;
}

function simulateChessMove(gameState: ChessState, move: { from: Position; to: Position }, engine: ChessEngine): ChessState | null {
    try {
        // Create a copy of the engine state
        const testEngine = createEngineFromState(gameState);
        const moveSuccess = testEngine.makeMove(move.from, move.to);
        
        if (!moveSuccess) return null;
        
        return {
            ...gameState,
            board: testEngine.getBoard(),
            currentPlayer: testEngine.getCurrentPlayer(),
            moveHistory: [...gameState.moveHistory, move]
        };
    } catch (error) {
        return null;
    }
}

function findBestChessMove(gameState: ChessState, engine: ChessEngine, color: PieceColor): GameMove | null {
    const allMoves: { from: Position; to: Position; piece: ChessPiece; score: number }[] = [];
    
    // Generate all possible moves
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.board[row][col];
            if (piece && piece.color === color) {
                const possibleMoves = engine.getPossibleMoves({ row, col });
                for (const move of possibleMoves) {
                    allMoves.push({
                        from: { row, col },
                        to: move,
                        piece,
                        score: 0
                    });
                }
            }
        }
    }
    
    if (allMoves.length === 0) return null;
    
    // Evaluate each move
    for (const move of allMoves) {
        let score = 0;
        
        // Basic capture evaluation
        const targetPiece = gameState.board[move.to.row][move.to.col];
        if (targetPiece && targetPiece.color !== color) {
            score += PIECE_VALUES[targetPiece.type];
            
            // Bonus for capturing with less valuable pieces
            score += PIECE_VALUES[targetPiece.type] - PIECE_VALUES[move.piece.type];
        }
        
        // Simulate the move to evaluate position
        const newState = simulateChessMove(gameState, move, engine);
        if (newState) {
            const positionScore = evaluatePosition(newState.board, color);
            const currentScore = evaluatePosition(gameState.board, color);
            score += (positionScore - currentScore) * 0.1; // Weight positional improvements
        }
        
        // Center control bonus
        const centerSquares = [
            { row: 3, col: 3 }, { row: 3, col: 4 },
            { row: 4, col: 3 }, { row: 4, col: 4 }
        ];
        if (centerSquares.some(square => square.row === move.to.row && square.col === move.to.col)) {
            score += 20;
        }
        
        // Development bonus (knights and bishops moving from back rank)
        if ((move.piece.type === 'knight' || move.piece.type === 'bishop')) {
            const backRank = color === 'white' ? 7 : 0;
            if (move.from.row === backRank && move.to.row !== backRank) {
                score += 15;
            }
        }
        
        // Avoid moving the same piece multiple times in opening
        if (gameState.moveCount < 10) {
            const pieceAlreadyMoved = gameState.moveHistory.some(prevMove =>
                prevMove.from.row === move.from.row && prevMove.from.col === move.from.col
            );
            if (pieceAlreadyMoved && move.piece.type !== 'pawn') {
                score -= 10;
            }
        }
        
        // King safety - avoid early king moves
        if (move.piece.type === 'king' && gameState.moveCount < 8) {
            score -= 50;
        }
        
        move.score = score;
    }
    
    // Sort moves by score and add some randomness to top moves
    allMoves.sort((a, b) => b.score - a.score);
    
    // Choose from top 3 moves with some randomness
    const topMoves = allMoves.slice(0, Math.min(3, allMoves.length));
    const weights = [0.6, 0.3, 0.1];
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (let i = 0; i < topMoves.length; i++) {
        cumulativeWeight += weights[i] || 0;
        if (random <= cumulativeWeight) {
            const selectedMove = topMoves[i];
            return {
                from: selectedMove.from,
                to: selectedMove.to
            };
        }
    }
    
    // Fallback to best move
    return {
        from: allMoves[0].from,
        to: allMoves[0].to
    };
}

export const chessLogic: IGameLogic = {
    createInitialState(players: Room['players']): ChessState {
        console.log('[Chess] Creating initial state for players:', players.length);
        
        const engine = new ChessEngine();
        
        return {
            board: engine.getBoard(),
            currentPlayer: 'white',
            moveHistory: [],
            moveCount: 0,
            isGameOver: false,
            isDraw: false,
            // @ts-ignore
            turn: players[0]?.user._id.toString()
        };
    },

    processMove(gameState: ChessState, move: ChessMove, playerId: string, players: Room['players']) {
        console.log('[Chess] Processing move:', { move, playerId, currentPlayer: gameState.currentPlayer });
        
        const playerIndex = players.findIndex(p => (p.user as any)._id.toString() === playerId);
        if (playerIndex === -1) {
            console.log('[Chess] Player not found');
            return { newState: gameState, error: "Player not found.", turnShouldSwitch: false };
        }

        const expectedColor: PieceColor = playerIndex === 0 ? 'white' : 'black';
        
        if (gameState.currentPlayer !== expectedColor) {
            console.log('[Chess] Wrong player turn. Expected:', expectedColor, 'Actual:', gameState.currentPlayer);
            return { newState: gameState, error: "Not your turn.", turnShouldSwitch: false };
        }

        const engine = createEngineFromState(gameState);
        
        const convertedMove = convertEngineMove(move);
        
        const possibleMoves = engine.getPossibleMoves(convertedMove.from);
        const isValidMove = possibleMoves.some(pos =>
            pos.row === convertedMove.to.row && pos.col === convertedMove.to.col
        );
        
        if (!isValidMove) {
            console.log('[Chess] Invalid move');
            return { newState: gameState, error: "Invalid move.", turnShouldSwitch: false };
        }

        const moveSuccess = engine.makeMove(
            convertedMove.from,
            convertedMove.to,
            convertedMove.promotion
        );
        
        if (!moveSuccess) {
            console.log('[Chess] Move execution failed');
            return { newState: gameState, error: "Move cannot be executed.", turnShouldSwitch: false };
        }

        const gameStatus = engine.getGameStatus();

        let nextTurn = gameState.turn;
        if (!gameStatus.isGameOver) {
            const nextPlayerIndex = playerIndex === 0 ? 1 : 0;
            const nextPlayer = players[nextPlayerIndex];
            nextTurn = nextPlayer ? (nextPlayer.user as any)._id.toString() : gameState.turn;
        }
        
        const newGameState: ChessState = {
            board: engine.getBoard(),
            currentPlayer: engine.getCurrentPlayer(),
            moveHistory: [...gameState.moveHistory, convertedMove],
            moveCount: gameState.moveCount + 1,
            isGameOver: gameStatus.isGameOver,
            isDraw: gameStatus.isDraw,
            turn: nextTurn,
            lastMove: {
                from: convertedMove.from,
                to: convertedMove.to
            }
        };

        if (gameStatus.isGameOver && !gameStatus.isDraw && gameStatus.winner) {
            const winnerIndex = gameStatus.winner === 'white' ? 0 : 1;
            const winner = players[winnerIndex];
            if (winner) {
                newGameState.winner = (winner.user as any)._id.toString();
            }
        }

        console.log('[Chess] Move processed successfully. New player:', newGameState.currentPlayer);
        console.log('[Chess] Game status:', { isGameOver: gameStatus.isGameOver, isDraw: gameStatus.isDraw });
        
        return { newState: newGameState, error: undefined, turnShouldSwitch: true };
    },

    checkGameEnd(gameState: ChessState, players: Room['players']) {
        console.log('[Chess] Checking game end. Game over:', gameState.isGameOver);
        
        if (!gameState.isGameOver) {
            return { isGameOver: false, isDraw: false };
        }

        return { 
            isGameOver: true, 
            winnerId: gameState.winner,
            isDraw: gameState.isDraw 
        };
    },
    
    makeBotMove(gameState: ChessState, playerIndex: 0 | 1): GameMove {
        console.log('[Chess] Bot making move for player:', playerIndex);
        
        const expectedColor: PieceColor = playerIndex === 0 ? 'white' : 'black';
        
        if (gameState.currentPlayer !== expectedColor) {
            console.log(`[Chess] Bot move requested but it's not bot's turn. Expected: ${expectedColor}, Actual: ${gameState.currentPlayer}`);
            return {};
        }

        const engine = createEngineFromState(gameState);
        const bestMove = findBestChessMove(gameState, engine, expectedColor);
        
        if (bestMove) {
            console.log('[Chess] Bot selected intelligent move:', bestMove);
            return bestMove;
        }
        
        console.log('[Chess] No moves available for bot');
        return {};
    }
};