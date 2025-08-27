import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';
import { DominoEngine, Domino, DominoGameState } from './domino-engine';

type DominoMove = {
    type: 'PLAY' | 'DRAW' | 'PASS';
    domino?: Domino;
    side?: 'left' | 'right';
};

// Enhanced Domino AI functions
function analyzeHand(hand: Domino[]): Map<number, number> {
    const numberCount = new Map<number, number>();
    
    // Count occurrences of each number
    for (const domino of hand) {
        numberCount.set(domino.left, (numberCount.get(domino.left) || 0) + 1);
        numberCount.set(domino.right, (numberCount.get(domino.right) || 0) + 1);
    }
    
    return numberCount;
}

function calculateHandValue(hand: Domino[]): number {
    return hand.reduce((sum, domino) => sum + domino.left + domino.right, 0);
}

function getChainEnds(gameState: DominoGameState): { left: number; right: number } {
    if (gameState.board.length === 0) {
        return { left: -1, right: -1 };
    }
    
    // Get the actual ends from chain ends or board
    const leftEnd = gameState.chainEnds?.left?.value ?? gameState.board[0]?.left ?? -1;
    const rightEnd = gameState.chainEnds?.right?.value ?? gameState.board[gameState.board.length - 1]?.right ?? -1;
    
    return { left: leftEnd, right: rightEnd };
}

function canPlayNumber(hand: Domino[], number: number): boolean {
    return hand.some(domino => domino.left === number || domino.right === number);
}

function evaluateDominoMove(gameState: DominoGameState, move: any, playerIndex: 0 | 1, botHand: Domino[], opponentHand: Domino[]): number {
    let score = 0;
    const domino = move.domino;
    const side = move.side;
    
    if (!domino) return -1000;
    
    const dominoValue = domino.left + domino.right;
    const isDouble = domino.left === domino.right;
    
    // 1. Priority: Get rid of high-value dominoes
    score += dominoValue * 2;
    
    // 2. Bonus for playing doubles (they can be harder to play later)
    if (isDouble) {
        score += 15;
    }
    
    // 3. Hand control strategy
    const botNumberCount = analyzeHand(botHand);
    const chainEnds = getChainEnds(gameState);
    
    // The number that will be exposed after playing this domino
    let exposedNumber: number;
    if (side === 'left') {
        exposedNumber = domino.left === chainEnds.left ? domino.right : domino.left;
    } else {
        exposedNumber = domino.right === chainEnds.right ? domino.left : domino.right;
    }
    
    // 4. Control strategy: prefer numbers we have more of
    const numberCount = botNumberCount.get(exposedNumber) || 0;
    score += numberCount * 8;
    
    // 5. Blocking strategy: estimate opponent's ability to play
    const opponentCanPlay = canPlayNumber(opponentHand, exposedNumber);
    if (!opponentCanPlay) {
        score += 25; // High bonus for potential blocking
    }
    
    // 6. Flexibility bonus: prefer keeping diverse numbers
    const uniqueNumbers = new Set<number>();
    for (const d of botHand) {
        if (d.id !== domino.id) { // Exclude the domino we're playing
            uniqueNumbers.add(d.left);
            uniqueNumbers.add(d.right);
        }
    }
    score += uniqueNumbers.size * 2;
    
    // 7. Endgame strategy: when few dominoes left, minimize hand value
    if (botHand.length <= 3) {
        score += dominoValue * 3; // Extra priority to get rid of high values
    }
    
    // 8. Opening strategy: if this is early in game, prefer middle numbers (more flexible)
    if (gameState.board.length <= 3) {
        if (exposedNumber >= 3 && exposedNumber <= 4) {
            score += 5;
        }
    }
    
    // 9. Side preference: slightly prefer playing on the side that gives more control
    const leftEnd = chainEnds.left;
    const rightEnd = chainEnds.right;
    const leftCount = botNumberCount.get(leftEnd) || 0;
    const rightCount = botNumberCount.get(rightEnd) || 0;
    
    if (side === 'left' && leftCount > rightCount) {
        score += 3;
    } else if (side === 'right' && rightCount > leftCount) {
        score += 3;
    }
    
    // 10. Avoid leaving only high-value dominoes
    const remainingAfterPlay = botHand.filter(d => d.id !== domino.id);
    const avgRemainingValue = remainingAfterPlay.length > 0 ?
        calculateHandValue(remainingAfterPlay) / remainingAfterPlay.length : 0;
    if (avgRemainingValue > 8 && remainingAfterPlay.length > 1) {
        score += 5; // Bonus for playing when hand average is high
    }
    
    return score;
}

function findBestDominoMove(gameState: DominoGameState, validMoves: any[], playerIndex: 0 | 1): any {
    const botHand = gameState.players[playerIndex]?.hand || [];
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentHand = gameState.players[opponentIndex]?.hand || [];
    
    // Prioritize playing dominoes over drawing/passing
    const playMoves = validMoves.filter(move => move.type === 'PLAY');
    const drawMoves = validMoves.filter(move => move.type === 'DRAW');
    const passMoves = validMoves.filter(move => move.type === 'PASS');
    
    if (playMoves.length > 0) {
        // Evaluate each play move
        const evaluatedMoves = playMoves.map(move => {
            const score = evaluateDominoMove(gameState, move, playerIndex, botHand, opponentHand);
            return { move, score };
        });
        
        // Sort by score and add some randomness to avoid predictability
        evaluatedMoves.forEach(item => {
            item.score += Math.random() * 2; // Small random factor
        });
        
        evaluatedMoves.sort((a, b) => b.score - a.score);
        
        // Sometimes choose from top 2-3 moves for variety
        const topMoves = evaluatedMoves.slice(0, Math.min(3, evaluatedMoves.length));
        const weights = [0.6, 0.3, 0.1];
        const random = Math.random();
        let cumulativeWeight = 0;
        
        for (let i = 0; i < topMoves.length; i++) {
            cumulativeWeight += weights[i] || 0;
            if (random <= cumulativeWeight) {
                return topMoves[i].move;
            }
        }
        
        return evaluatedMoves[0].move;
    }
    
    // If no play moves available, prefer drawing over passing when possible
    if (drawMoves.length > 0) {
        return drawMoves[0];
    }
    
    if (passMoves.length > 0) {
        return passMoves[0];
    }
    
    return validMoves[0] || null;
}

export const dominoLogic: IGameLogic = {
    createInitialState(players: Room['players']): DominoGameState {
        console.log('[Domino] Creating initial state for players:', players.length);
        
        if (players.length < 2) {
            console.log('[Domino] Not enough players to start game');
            // Return a basic state for single player waiting
            return {
                players: [
                    { hand: [], score: 0 },
                    { hand: [], score: 0 }
                ],
                boneyard: [],
                board: [],
                placedDominoes: [],
                currentPlayerIndex: 0,
                turn: players.length > 0 ? (players[0].user as any)._id.toString() : '',
                gameOver: false,
                mustDraw: false,
                gamePhase: 'DEALING',
                lastAction: 'Waiting for players',
                chainEnds: {
                    left: { value: -1, position: { x: 0, y: 0 }, direction: 'left' },
                    right: { value: -1, position: { x: 0, y: 0 }, direction: 'right' }
                }
            };
        }
        
        const engine = new DominoEngine();
        const gameState = engine.getGameState();
        
        // Set the turn to the starting player
        const startingPlayerIndex = gameState.currentPlayerIndex;
        gameState.turn = (players[startingPlayerIndex].user as any)._id.toString();
        
        console.log('[Domino] Initial state created:', {
            turn: gameState.turn,
            currentPlayerIndex: gameState.currentPlayerIndex,
            player1Hand: gameState.players[0]?.hand?.length,
            player2Hand: gameState.players[1]?.hand?.length,
            boneyardSize: gameState.boneyard?.length
        });
        
        return gameState;
    },

    processMove(gameState: DominoGameState, move: DominoMove, playerId: string, players: Room['players']) {
        console.log('[Domino] Processing move:', { move, playerId, currentPlayerIndex: gameState.currentPlayerIndex, turn: gameState.turn });
        
        const playerIndex = players.findIndex(p => (p.user as any)._id.toString() === playerId);
        if (playerIndex === -1) {
            console.log('[Domino] Player not found');
            return { newState: gameState, error: "Player not found.", turnShouldSwitch: false };
        }

        // Check if it's the player's turn - allow if turn is empty (game just started)
        if (gameState.turn && gameState.turn !== playerId) {
            console.log('[Domino] Not player\'s turn. Expected:', gameState.turn, 'Actual:', playerId);
            return { newState: gameState, error: "It's not your turn.", turnShouldSwitch: false };
        }

        // Check if it's the correct player's turn based on game state
        if (playerIndex !== gameState.currentPlayerIndex) {
            console.log('[Domino] Wrong player index. Expected:', gameState.currentPlayerIndex, 'Actual:', playerIndex);
            return { newState: gameState, error: "It's not your turn.", turnShouldSwitch: false };
        }

        // Create engine instance with current state
        const engine = new DominoEngine();
        // Set the engine state to current game state
        (engine as any).gameState = { ...gameState };

        // Process the move
        const moveResult = engine.makeMove(move, playerIndex);
        
        if (!moveResult.success) {
            console.log('[Domino] Invalid move:', moveResult.error);
            return { newState: gameState, error: moveResult.error || "Invalid move.", turnShouldSwitch: false };
        }

        const newGameState = engine.getGameState();
        
        // Determine next turn
        let nextTurn = gameState.turn;
        let turnShouldSwitch = false;
        
        if (!newGameState.gameOver) {
            const nextPlayerIndex = newGameState.currentPlayerIndex;
            const nextPlayer = players[nextPlayerIndex];
            if (nextPlayer) {
                nextTurn = (nextPlayer.user as any)._id.toString();
                turnShouldSwitch = nextTurn !== playerId;
            }
        }

        newGameState.turn = nextTurn;

        console.log('[Domino] Move processed successfully. Next turn:', nextTurn, 'Current player index:', newGameState.currentPlayerIndex);
        
        return { newState: newGameState, error: undefined, turnShouldSwitch };
    },

    checkGameEnd(gameState: DominoGameState, players: Room['players']) {
        console.log('[Domino] Checking game end. Game over:', gameState.gameOver);
        
        if (!gameState.gameOver) {
            return { isGameOver: false, isDraw: false };
        }

        // Determine winner
        let winnerId: string | undefined;
        let isDraw = false;
        
        if (gameState.winner) {
            const winnerIndex = parseInt(gameState.winner.replace('player', ''));
            const winner = players[winnerIndex];
            if (winner) {
                winnerId = (winner.user as any)._id.toString();
            }
        } else {
            // Check if it's a draw (blocked game with equal points)
            const player1Points = gameState.players[0].hand.reduce((sum, d) => sum + d.left + d.right, 0);
            const player2Points = gameState.players[1].hand.reduce((sum, d) => sum + d.left + d.right, 0);
            isDraw = player1Points === player2Points;
        }

        return { 
            isGameOver: true, 
            winnerId,
            isDraw
        };
    },
    
    makeBotMove(gameState: DominoGameState, playerIndex: 0 | 1): GameMove {
        console.log('[Domino] Bot making move for player:', playerIndex);
        
        // Check if it's bot's turn
        if (playerIndex !== gameState.currentPlayerIndex) {
            console.log('[Domino] Bot move requested but it\'s not bot\'s turn');
            return {};
        }

        // Create engine instance to get valid moves
        const engine = new DominoEngine();
        (engine as any).gameState = { ...gameState };
        
        const validMoves = engine.getValidMoves(playerIndex);
        console.log('[Domino] Available moves for bot:', validMoves.length);
        
        if (validMoves.length === 0) {
            return {};
        }

        // Use intelligent strategy
        const selectedMove = findBestDominoMove(gameState, validMoves, playerIndex);
        
        if (selectedMove) {
            console.log('[Domino] Bot selected intelligent move:', selectedMove.type);
            return {
                type: selectedMove.type,
                domino: selectedMove.domino,
                side: selectedMove.side
            };
        }
        
        console.log('[Domino] No valid moves for bot');
        return {};
    }
};