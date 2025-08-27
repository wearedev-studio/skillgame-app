import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';

type TicTacToeState = {
    board: ('X' | 'O' | null)[];
    turn: string;
};

// Minimax algorithm for intelligent bot play
function checkWinner(board: (string | null)[]): string | null {
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const combination of winningCombinations) {
        const [a, b, c] = combination;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

function isBoardFull(board: (string | null)[]): boolean {
    return board.every(cell => cell !== null);
}

function getAvailableMoves(board: (string | null)[]): number[] {
    const moves: number[] = [];
    board.forEach((cell, index) => {
        if (cell === null) {
            moves.push(index);
        }
    });
    return moves;
}

function minimax(board: (string | null)[], depth: number, isMaximizing: boolean, botSymbol: string, humanSymbol: string): number {
    const winner = checkWinner(board);
    
    // Terminal states
    if (winner === botSymbol) return 10 - depth; // Bot wins (prefer faster wins)
    if (winner === humanSymbol) return depth - 10; // Human wins (prefer slower losses)
    if (isBoardFull(board)) return 0; // Draw
    
    if (isMaximizing) {
        let maxEval = -Infinity;
        const availableMoves = getAvailableMoves(board);
        
        for (const move of availableMoves) {
            board[move] = botSymbol;
            const eval_ = minimax(board, depth + 1, false, botSymbol, humanSymbol);
            board[move] = null;
            maxEval = Math.max(maxEval, eval_);
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        const availableMoves = getAvailableMoves(board);
        
        for (const move of availableMoves) {
            board[move] = humanSymbol;
            const eval_ = minimax(board, depth + 1, true, botSymbol, humanSymbol);
            board[move] = null;
            minEval = Math.min(minEval, eval_);
        }
        return minEval;
    }
}

function findBestMove(board: (string | null)[], botSymbol: string, humanSymbol: string): number {
    const availableMoves = getAvailableMoves(board);
    
    if (availableMoves.length === 0) return -1;
    
    // For the first move, choose center or corner for better strategy
    if (availableMoves.length === 9) {
        // Prefer center, then corners
        if (board[4] === null) return 4; // center
        const corners = [0, 2, 6, 8];
        return corners[Math.floor(Math.random() * corners.length)];
    }
    
    let bestMove = availableMoves[0];
    let bestValue = -Infinity;
    
    for (const move of availableMoves) {
        board[move] = botSymbol;
        const moveValue = minimax(board, 0, false, botSymbol, humanSymbol);
        board[move] = null;
        
        if (moveValue > bestValue) {
            bestValue = moveValue;
            bestMove = move;
        }
    }
    
    return bestMove;
}

export const ticTacToeLogic: IGameLogic = {
    createInitialState(players: Room['players']): TicTacToeState {
        console.log(`[TicTacToe] Creating initial state for players:`, players.map(p => ({ 
            // @ts-ignore
            id: p.user._id, 
            // @ts-ignore
            username: p.user.username 
        })));
        
        // @ts-ignore
        const firstPlayerId = players[0].user._id.toString();
        console.log(`[TicTacToe] First player turn: ${firstPlayerId}`);
        
        return {
            board: Array(9).fill(null),
            turn: firstPlayerId,
        };
    },

    processMove(gameState: TicTacToeState, move: { cellIndex: number }, playerId: string, players: Room['players']) {
        console.log(`[TicTacToe] Processing move for player ${playerId}, cell: ${move.cellIndex}`);

        if (gameState.turn && gameState.turn.toString() !== playerId.toString()) {
            console.log(`[TicTacToe] Turn check failed: expected ${gameState.turn}, got ${playerId}`);
            return { newState: gameState, error: "Not your turn.", turnShouldSwitch: false };
        }

        if (!move || typeof move.cellIndex !== 'number') {
            console.log(`[TicTacToe] Invalid move format:`, move);
            return { newState: gameState, error: "Invalid move format.", turnShouldSwitch: false };
        }

        if (move.cellIndex < 0 || move.cellIndex > 8) {
            console.log(`[TicTacToe] Cell index out of bounds: ${move.cellIndex}`);
            return { newState: gameState, error: "Invalid cell index.", turnShouldSwitch: false };
        }

        if (gameState.board[move.cellIndex] !== null) {
            console.log(`[TicTacToe] Cell already occupied: ${move.cellIndex}`);
            return { newState: gameState, error: "Cell already occupied.", turnShouldSwitch: false };
        }

        // @ts-ignore
        const playerIndex = players.findIndex(p => p.user._id.toString() === playerId.toString());
        if (playerIndex === -1) {
            console.log(`[TicTacToe] Player not found in players list`);
            return { newState: gameState, error: "Player not found.", turnShouldSwitch: false };
        }

        const playerSymbol = playerIndex === 0 ? 'X' : 'O';
        console.log(`[TicTacToe] Player ${playerId} (index ${playerIndex}) plays ${playerSymbol}`);

        const newBoard = [...gameState.board];
        newBoard[move.cellIndex] = playerSymbol;

        // @ts-ignore
        const nextPlayer = players.find(p => p.user._id.toString() !== playerId.toString());
        if (!nextPlayer) {
            console.log(`[TicTacToe] Next player not found`);
            return { newState: gameState, error: "Next player not found.", turnShouldSwitch: false };
        }

        const newGameState = { 
            ...gameState, 
            board: newBoard, 
            // @ts-ignore
            turn: nextPlayer.user._id.toString() 
        };

        console.log(`[TicTacToe] Move successful, next turn: ${newGameState.turn}`);

        return { newState: newGameState, error: undefined, turnShouldSwitch: true };
    },

    checkGameEnd(gameState: TicTacToeState, players: Room['players']) {
        const board = gameState.board;
        const winningCombinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (const combination of winningCombinations) {
            const [a, b, c] = combination;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                const winnerSymbol = board[a] as 'X' | 'O';
                const winner = players[winnerSymbol === 'X' ? 0 : 1];
                // @ts-ignore
                return { isGameOver: true, winnerId: winner.user._id.toString(), isDraw: false };
            }
        }

        if (board.every(cell => cell !== null)) {
            return { isGameOver: true, winnerId: undefined, isDraw: true };
        }

        return { isGameOver: false, isDraw: false };
    },
    
    makeBotMove(gameState: { board: (string | null)[] }, playerIndex: 0 | 1): GameMove {
        const board = gameState.board;
        const botSymbol = playerIndex === 0 ? 'X' : 'O';
        const humanSymbol = playerIndex === 0 ? 'O' : 'X';

        // Get available moves
        const availableCells: number[] = [];
        board.forEach((cell, index) => {
            if (cell === null) {
                availableCells.push(index);
            }
        });

        if (availableCells.length === 0) {
            return { cellIndex: -1 };
        }

        // Use minimax algorithm for optimal play
        const bestMove = findBestMove(board, botSymbol, humanSymbol);
        return { cellIndex: bestMove };
    }
};