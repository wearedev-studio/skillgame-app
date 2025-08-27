import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';
import { BackgammonEngine, PlayerColor, BackgammonPiece, Point, DiceRoll } from './backgammon-engine';

type BackgammonState = {
    board: Point[];
    bar: { white: BackgammonPiece[]; black: BackgammonPiece[] };
    home: { white: BackgammonPiece[]; black: BackgammonPiece[] };
    currentPlayer: PlayerColor;
    diceRoll: DiceRoll | null;
    moveHistory: any[];
    turn: string;
    turnPhase: 'ROLLING' | 'MOVING';
    isGameOver: boolean;
    winner?: string;
};

type BackgammonMove = {
    from: number;
    to: number;
    dieValue: number;
};

function createEngineFromState(gameState: BackgammonState): BackgammonEngine {
    const engine = new BackgammonEngine();
    
    // Deep clone the state to avoid reference issues
    const clonedState = {
        board: gameState.board.map(point => ({
            pieces: point.pieces.map(piece => ({ color: piece.color }))
        })),
        bar: {
            white: gameState.bar.white.map(piece => ({ color: piece.color })),
            black: gameState.bar.black.map(piece => ({ color: piece.color }))
        },
        home: {
            white: gameState.home.white.map(piece => ({ color: piece.color })),
            black: gameState.home.black.map(piece => ({ color: piece.color }))
        },
        currentPlayer: gameState.currentPlayer,
        diceRoll: gameState.diceRoll ? {
            dice: [...gameState.diceRoll.dice],
            availableMoves: [...gameState.diceRoll.availableMoves]
        } : null,
        moveHistory: gameState.moveHistory.map(move => ({ ...move }))
    };
    
    engine.restoreGameState(clonedState);
    return engine;
}

// Enhanced Backgammon AI functions
function calculatePipCount(board: Point[], bar: any, color: PlayerColor): number {
    let pipCount = 0;
    
    // Count pieces on the bar
    const barPieces = bar[color] || [];
    pipCount += barPieces.length * (color === 'white' ? 25 : 0);
    
    // Count pieces on the board
    for (let i = 0; i < 24; i++) {
        const point = board[i];
        if (point && point.pieces) {
            const pieces = point.pieces.filter((piece: any) => piece.color === color);
            if (pieces.length > 0) {
                const distance = color === 'white' ? (24 - i) : (i + 1);
                pipCount += pieces.length * distance;
            }
        }
    }
    
    return pipCount;
}

function evaluatePosition(gameState: BackgammonState, color: PlayerColor): number {
    let score = 0;
    const opponentColor = color === 'white' ? 'black' : 'white';
    
    // Pip count advantage (lower is better)
    const myPips = calculatePipCount(gameState.board, gameState.bar, color);
    const opponentPips = calculatePipCount(gameState.board, gameState.bar, opponentColor);
    score += (opponentPips - myPips) * 0.5;
    
    // Penalty for pieces on the bar
    const myBarPieces = gameState.bar[color]?.length || 0;
    const opponentBarPieces = gameState.bar[opponentColor]?.length || 0;
    score -= myBarPieces * 10;
    score += opponentBarPieces * 8;
    
    // Evaluate board positions
    for (let i = 0; i < 24; i++) {
        const point = gameState.board[i];
        if (!point || !point.pieces) continue;
        
        const myPieces = point.pieces.filter((piece: any) => piece.color === color);
        const opponentPieces = point.pieces.filter((piece: any) => piece.color === opponentColor);
        
        if (myPieces.length > 0) {
            // Bonus for multiple pieces (safe)
            if (myPieces.length >= 2) {
                score += 2;
                
                // Extra bonus for blocking points in opponent's home board
                const isOpponentHomeBoard = color === 'white' ? (i < 6) : (i >= 18);
                if (isOpponentHomeBoard) {
                    score += 3;
                }
            } else {
                // Penalty for blots (single pieces)
                const vulnerabilityPenalty = calculateVulnerability(gameState, i, color);
                score -= vulnerabilityPenalty;
            }
            
            // Bonus for advanced pieces
            const advancement = color === 'white' ? (24 - i) : (i + 1);
            score += Math.max(0, advancement - 12) * 0.1;
        }
        
        if (opponentPieces.length === 1) {
            // Opportunity to hit opponent's blot
            const hitChance = calculateHitProbability(i, color);
            score += hitChance * 2;
        }
    }
    
    // Bonus for pieces in home board (ready to bear off)
    const homeBoard = color === 'white' ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let piecesInHome = 0;
    for (const pointIndex of homeBoard) {
        const point = gameState.board[pointIndex];
        if (point && point.pieces) {
            const myPieces = point.pieces.filter((piece: any) => piece.color === color);
            piecesInHome += myPieces.length;
        }
    }
    score += piecesInHome * 1.5;
    
    return score;
}

function calculateVulnerability(gameState: BackgammonState, pointIndex: number, color: PlayerColor): number {
    const opponentColor = color === 'white' ? 'black' : 'white';
    let vulnerability = 0;
    
    // Calculate probability of being hit
    for (let distance = 1; distance <= 6; distance++) {
        const opponentPosition = color === 'white' ? pointIndex + distance : pointIndex - distance;
        
        // Check if opponent can hit from this position
        if (opponentPosition >= 0 && opponentPosition < 24) {
            const point = gameState.board[opponentPosition];
            if (point && point.pieces) {
                const opponentPieces = point.pieces.filter((piece: any) => piece.color === opponentColor);
                if (opponentPieces.length > 0) {
                    // Probability of rolling this exact distance
                    const rollProbability = distance === 6 ? 11/36 : (6 - distance + 1) / 36;
                    vulnerability += rollProbability * opponentPieces.length;
                }
            }
        }
        
        // Check bar pieces
        const barPieces = gameState.bar[opponentColor]?.length || 0;
        if (barPieces > 0) {
            const targetPoint = color === 'white' ? (25 - distance) : (distance - 1);
            if (targetPoint === pointIndex) {
                vulnerability += 1/6 * barPieces;
            }
        }
    }
    
    return Math.min(vulnerability * 3, 8); // Cap the penalty
}

function calculateHitProbability(targetPoint: number, color: PlayerColor): number {
    // Calculate probability of hitting a piece at targetPoint
    let probability = 0;
    
    for (let distance = 1; distance <= 6; distance++) {
        const shooterPosition = color === 'white' ? targetPoint - distance : targetPoint + distance;
        
        if (shooterPosition >= 0 && shooterPosition < 24) {
            // Direct hit probability
            probability += 1/6;
        }
    }
    
    // Double probability for distances that can be made with two dice
    for (let die1 = 1; die1 <= 6; die1++) {
        for (let die2 = 1; die2 <= 6; die2++) {
            if (die1 + die2 <= 6 && die1 + die2 >= 1) {
                const shooterPosition = color === 'white' ? targetPoint - (die1 + die2) : targetPoint + (die1 + die2);
                if (shooterPosition >= 0 && shooterPosition < 24) {
                    probability += 1/36;
                }
            }
        }
    }
    
    return Math.min(probability, 1);
}

function simulateBackgammonMove(gameState: BackgammonState, move: any, engine: BackgammonEngine): BackgammonState | null {
    try {
        const testEngine = createEngineFromState(gameState);
        const moveSuccess = testEngine.makeMove(move.from, move.to, move.dieValue);
        
        if (!moveSuccess) return null;
        
        const newEngineState = testEngine.getGameState();
        return {
            ...gameState,
            board: newEngineState.board,
            bar: newEngineState.bar,
            home: newEngineState.home,
            diceRoll: newEngineState.diceRoll
        };
    } catch (error) {
        return null;
    }
}

function findBestBackgammonMove(gameState: BackgammonState, possibleMoves: any[], color: PlayerColor, engine: BackgammonEngine): any {
    if (possibleMoves.length === 0) return null;
    if (possibleMoves.length === 1) return possibleMoves[0];
    
    // Evaluate each possible move
    const evaluatedMoves = possibleMoves.map(move => {
        let score = 0;
        
        // Prioritize bear off moves (highest priority)
        if (move.to === -2) {
            score += 100;
            // Prefer bearing off from higher points first
            score += move.from;
        }
        
        // High priority for getting pieces off the bar
        if (move.from === -1) {
            score += 80;
            // Prefer safer landing spots
            const targetPoint = gameState.board[move.to];
            if (targetPoint && targetPoint.pieces && targetPoint.pieces.length === 1) {
                const enemyPiece = targetPoint.pieces[0];
                if (enemyPiece.color !== color) {
                    score += 20; // Bonus for hitting
                }
            }
        }
        
        // Simulate the move and evaluate resulting position
        const newState = simulateBackgammonMove(gameState, move, engine);
        if (newState) {
            const positionScore = evaluatePosition(newState, color);
            const currentScore = evaluatePosition(gameState, color);
            score += (positionScore - currentScore);
        }
        
        // Bonus for hitting opponent pieces
        const targetPoint = gameState.board[move.to];
        if (targetPoint && targetPoint.pieces && targetPoint.pieces.length === 1) {
            const targetPiece = targetPoint.pieces[0];
            if (targetPiece.color !== color) {
                score += 15;
            }
        }
        
        // Bonus for making safe moves (creating or joining safe points)
        const landingPoint = gameState.board[move.to];
        if (landingPoint && landingPoint.pieces) {
            const samePieces = landingPoint.pieces.filter((piece: any) => piece.color === color);
            if (samePieces.length >= 1) {
                score += 5; // Making a safe point
            }
        }
        
        // Penalty for leaving blots
        const sourcePoint = gameState.board[move.from];
        if (sourcePoint && sourcePoint.pieces && sourcePoint.pieces.length === 2) {
            // Would leave a blot
            const vulnerability = calculateVulnerability(gameState, move.from, color);
            score -= vulnerability;
        }
        
        // Small randomness to avoid completely predictable play
        score += Math.random() * 0.5;
        
        return { move, score };
    });
    
    // Sort by score and pick the best
    evaluatedMoves.sort((a, b) => b.score - a.score);
    
    // Add some variety by occasionally picking from top 3 moves
    const topMoves = evaluatedMoves.slice(0, Math.min(3, evaluatedMoves.length));
    const weights = [0.7, 0.2, 0.1];
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

export const backgammonLogic: IGameLogic = {
    createInitialState(players: Room['players']): BackgammonState {
        console.log('[Backgammon] Creating initial state for players:', players.length);
        
        const engine = new BackgammonEngine();
        const engineState = engine.getGameState();
        
        return {
            board: engineState.board,
            bar: engineState.bar,
            home: engineState.home,
            currentPlayer: engineState.currentPlayer,
            diceRoll: engineState.diceRoll,
            moveHistory: engineState.moveHistory,
            // @ts-ignore
            turn: players[0]?.user._id.toString(),
            turnPhase: 'ROLLING',
            isGameOver: false
        };
    },

    processMove(gameState: BackgammonState, move: BackgammonMove, playerId: string, players: Room['players']) {
        console.log('[Backgammon] Processing move:', { move, playerId, turnPhase: gameState.turnPhase });
        
        if (gameState.turn !== playerId) {
            console.log('[Backgammon] Wrong player turn');
            return { newState: gameState, error: "Not your turn.", turnShouldSwitch: false };
        }

        if (gameState.turnPhase !== 'MOVING') {
            console.log('[Backgammon] Wrong turn phase');
            return { newState: gameState, error: "Roll the dice first.", turnShouldSwitch: false };
        }

        const playerIndex = players.findIndex(p => (p.user as any)._id.toString() === playerId);
        if (playerIndex === -1) {
            console.log('[Backgammon] Player not found');
            return { newState: gameState, error: "Player not found.", turnShouldSwitch: false };
        }

        const expectedColor: PlayerColor = playerIndex === 0 ? 'white' : 'black';
        
        if (gameState.currentPlayer !== expectedColor) {
            console.log('[Backgammon] Wrong color turn. Expected:', expectedColor, 'Actual:', gameState.currentPlayer);
            return { newState: gameState, error: "Not your turn according to backgammon rules.", turnShouldSwitch: false };
        }

        const engine = createEngineFromState(gameState);
        
        const moveSuccess = engine.makeMove(move.from, move.to, move.dieValue);
        
        if (!moveSuccess) {
            console.log('[Backgammon] Move execution failed');
            return { newState: gameState, error: "Invalid move.", turnShouldSwitch: false };
        }

        const newEngineState = engine.getGameState();
        
        const gameStatus = engine.isGameOver();
        
        let turnShouldSwitch = false;
        let nextTurn = gameState.turn;
        let nextTurnPhase: 'ROLLING' | 'MOVING' = gameState.turnPhase;
        
        if (!newEngineState.diceRoll || newEngineState.diceRoll.availableMoves.length === 0 || !engine.hasAvailableMoves()) {
            turnShouldSwitch = true;
            nextTurnPhase = 'ROLLING';
            
            if (!gameStatus.isGameOver) {
                engine.switchPlayer();
                const updatedEngineState = engine.getGameState();
                const nextPlayerIndex = playerIndex === 0 ? 1 : 0;
                const nextPlayer = players[nextPlayerIndex];
                nextTurn = nextPlayer ? (nextPlayer.user as any)._id.toString() : gameState.turn;
                
                newEngineState.currentPlayer = updatedEngineState.currentPlayer;
                newEngineState.diceRoll = null;
            }
        }

        const newGameState: BackgammonState = {
            board: newEngineState.board,
            bar: newEngineState.bar,
            home: newEngineState.home,
            currentPlayer: newEngineState.currentPlayer,
            diceRoll: newEngineState.diceRoll,
            moveHistory: newEngineState.moveHistory,
            turn: nextTurn,
            turnPhase: nextTurnPhase,
            isGameOver: gameStatus.isGameOver
        };

        if (gameStatus.isGameOver && gameStatus.winner) {
            const winnerIndex = gameStatus.winner === 'white' ? 0 : 1;
            const winner = players[winnerIndex];
            if (winner) {
                newGameState.winner = (winner.user as any)._id.toString();
            }
        }

        console.log('[Backgammon] Move processed successfully. Turn should switch:', turnShouldSwitch);
        return { newState: newGameState, error: undefined, turnShouldSwitch };
    },

    checkGameEnd(gameState: BackgammonState, players: Room['players']) {
        console.log('[Backgammon] Checking game end. Game over:', gameState.isGameOver);
        
        if (!gameState.isGameOver) {
            return { isGameOver: false, isDraw: false };
        }

        return { 
            isGameOver: true, 
            winnerId: gameState.winner,
            isDraw: false 
        };
    },
    
    makeBotMove(gameState: BackgammonState, playerIndex: 0 | 1): GameMove {
        console.log('[Backgammon] Bot making move for player:', playerIndex, 'Current player:', gameState.currentPlayer, 'Turn phase:', gameState.turnPhase);
        
        const expectedColor: PlayerColor = playerIndex === 0 ? 'white' : 'black';
        
        if (gameState.currentPlayer !== expectedColor) {
            console.log(`[Backgammon] Bot move requested but it's not bot's turn. Expected: ${expectedColor}, Actual: ${gameState.currentPlayer}`);
            return {};
        }

        if (gameState.turnPhase !== 'MOVING') {
            console.log('[Backgammon] Bot cannot move - wrong phase:', gameState.turnPhase);
            return {};
        }

        if (!gameState.diceRoll) {
            console.log('[Backgammon] Bot cannot move - no dice roll available');
            return {};
        }

        const engine = createEngineFromState(gameState);
        const possibleMoves = engine.getPossibleMoves();
        
        console.log('[Backgammon] Available moves for bot:', possibleMoves.length, 'Dice:', gameState.diceRoll?.dice, 'Available dice:', gameState.diceRoll?.availableMoves);
        
        if (possibleMoves.length > 0) {
            const bestMove = findBestBackgammonMove(gameState, possibleMoves, expectedColor, engine);
            
            if (!bestMove) {
                console.log('[Backgammon] No best move found despite available moves');
                return {};
            }
            
            const botMove = {
                from: bestMove.from,
                to: bestMove.to,
                dieValue: bestMove.dieValue
            };
            
            console.log('[Backgammon] Bot selected intelligent move:', botMove);
            return botMove;
        }
        
        console.log('[Backgammon] No moves available for bot');
        return {};
    }
};

export function rollDiceForBackgammon(gameState: BackgammonState, playerId: string, players: Room['players']): { newState: BackgammonState; error?: string } {
    console.log('[Backgammon] Rolling dice for player:', playerId);
    
    if (gameState.turn !== playerId) {
        console.log('[Backgammon] Wrong player turn for dice roll');
        return { newState: gameState, error: "Not your turn." };
    }

    if (gameState.turnPhase !== 'ROLLING') {
        console.log('[Backgammon] Wrong turn phase for dice roll');
        return { newState: gameState, error: "Not time to roll dice." };
    }

    const engine = createEngineFromState(gameState);
    
    const diceRoll = engine.rollDice();
    
    const newEngineState = engine.getGameState();
    
    const newGameState: BackgammonState = {
        ...gameState,
        diceRoll: newEngineState.diceRoll,
        turnPhase: 'MOVING'
    };

    console.log('[Backgammon] Dice rolled:', diceRoll.dice, 'Available moves:', diceRoll.availableMoves);
    
    if (!engine.hasAvailableMoves()) {
        console.log('[Backgammon] No available moves, skipping turn');
        newGameState.turnPhase = 'ROLLING';
        
        engine.switchPlayer();
        const updatedEngineState = engine.getGameState();
        
        const playerIndex = players.findIndex(p => (p.user as any)._id.toString() === playerId);
        const nextPlayerIndex = playerIndex === 0 ? 1 : 0;
        const nextPlayer = players[nextPlayerIndex];
        if (nextPlayer) {
            newGameState.turn = (nextPlayer.user as any)._id.toString();
            newGameState.currentPlayer = updatedEngineState.currentPlayer;
        }
        
        newGameState.diceRoll = null;
    }
    
    return { newState: newGameState };
}