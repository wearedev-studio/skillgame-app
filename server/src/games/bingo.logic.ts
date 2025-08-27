import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';
import { BingoGameEngine, BingoGameState, BingoMove } from './bingo-engine';

export interface IBingoGameState extends BingoGameState {
    turn: string;
}

export class BingoGameLogic implements IGameLogic {
    public createInitialState(players: Room['players']): IBingoGameState {
        const engine = new BingoGameEngine();
        const playerIds = players.map(p => (p.user as any)._id.toString());
        const engineState = engine.initializeGame(playerIds);
        
        return {
            ...engineState,
            turn: playerIds[0]
        };
    }

    public processMove(gameState: GameState, move: GameMove, playerId: string, players: Room['players']): { newState: GameState; error?: string; turnShouldSwitch: boolean } {
        const bingoState = gameState as IBingoGameState;
        
        const bingoMove = this.convertToBingoMove(move);
        if (!bingoMove) {
            return {
                newState: bingoState,
                error: 'Invalid move format',
                turnShouldSwitch: false
            };
        }

        console.log(`[Bingo] Processing move:`, bingoMove, 'for player:', playerId);

        const result = this.processMoveDirect(bingoState, bingoMove, playerId, players);
        return result;
    }

    public checkGameEnd(gameState: GameState, players: Room['players']): { isGameOver: boolean; winnerId?: string; isDraw: boolean } {
        const bingoState = gameState as IBingoGameState;
        
        if (bingoState.winner !== null) {
            return {
                isGameOver: true,
                winnerId: (players[bingoState.winner].user as any)._id.toString(),
                isDraw: false
            };
        }

        // Check for draw (all numbers called, no winner)
        if (bingoState.calledNumbers.length >= 75 && bingoState.winner === null) {
            return {
                isGameOver: true,
                isDraw: true
            };
        }

        return {
            isGameOver: false,
            isDraw: false
        };
    }

    public makeBotMove(gameState: GameState, playerIndex: 0 | 1): GameMove {
        const bingoState = gameState as IBingoGameState;
        
        console.log(`[Bot] Making bingo move for player ${playerIndex}, phase: ${bingoState.gamePhase}`);
        
        const players = bingoState.players;
        if (!players || !players[playerIndex]) {
            console.log('[Bot] No player data available');
            return { type: 'CALL_NUMBER' };
        }

        // Use intelligent strategy
        return this.makeIntelligentBingoMove(bingoState, playerIndex);
    }

    private convertToBingoMove(move: GameMove): BingoMove | null {
        const moveObj = move as any;
        
        if (!moveObj || typeof moveObj.type !== 'string') {
            return null;
        }

        switch (moveObj.type) {
            case 'CALL_NUMBER':
            case 'CLAIM_BINGO':
            case 'CONTINUE_GAME':
                return { type: moveObj.type };
            case 'MARK_NUMBER':
                if (typeof moveObj.number === 'number') {
                    return {
                        type: moveObj.type,
                        number: moveObj.number
                    };
                }
                return null;
            default:
                return null;
        }
    }

    private processMoveDirect(gameState: IBingoGameState, move: BingoMove, playerId: string, players: Room['players']): { newState: IBingoGameState; error?: string; turnShouldSwitch: boolean } {
        const newState = { ...gameState };
        const engine = new BingoGameEngine();
        engine.state = newState;
        
        const playerIndex = players.findIndex(p => (p.user as any)._id.toString() === playerId);
        if (playerIndex === -1) {
            return { newState: gameState, error: 'Player not found', turnShouldSwitch: false };
        }

        // Check if it's player's turn (except for CLAIM_BINGO which can be done anytime)
        if (move.type !== 'CLAIM_BINGO' && newState.turn !== playerId) {
            return { newState: gameState, error: 'Not your turn', turnShouldSwitch: false };
        }

        console.log(`[Bingo] Processing direct move: ${move.type}, current phase: ${newState.gamePhase}, current turn: ${newState.turn}`);

        switch (move.type) {
            case 'CALL_NUMBER':
                // Only current player can call numbers during CALLING phase
                if (newState.gamePhase !== 'CALLING') {
                    return { newState: gameState, error: 'Not in calling phase', turnShouldSwitch: false };
                }

                const callResult = engine.callNextNumber();
                if (!callResult.success) {
                    return { newState: gameState, error: callResult.error, turnShouldSwitch: false };
                }

                newState.currentNumber = callResult.number!;
                newState.calledNumbers = [...engine.state.calledNumbers];
                newState.gamePhase = 'MARKING';
                newState.callHistory = [...engine.state.callHistory];

                console.log(`[Bingo] Called number: ${callResult.number}`);
                
                // Switch turn after calling a number
                this.switchPlayerDirect(newState, players);
                return { newState, turnShouldSwitch: true };

            case 'MARK_NUMBER':
                // Players can mark numbers during MARKING phase
                if (newState.gamePhase !== 'MARKING') {
                    return { newState: gameState, error: 'Not in marking phase', turnShouldSwitch: false };
                }

                if (!move.number) {
                    return { newState: gameState, error: 'Number is required', turnShouldSwitch: false };
                }

                const markResult = engine.markNumber(playerIndex, move.number);
                if (!markResult.success) {
                    return { newState: gameState, error: markResult.error, turnShouldSwitch: false };
                }

                newState.players[playerIndex].markedNumbers = new Set(engine.state.players[playerIndex].markedNumbers);
                console.log(`[Bingo] Player ${playerIndex} marked number: ${move.number}`);

                // Don't switch turn for marking - same player continues
                return { newState, turnShouldSwitch: false };

            case 'CONTINUE_GAME':
                // Continue to next number calling phase
                if (newState.gamePhase === 'MARKING') {
                    newState.gamePhase = 'CALLING';
                    console.log(`[Bingo] Continuing game - back to CALLING phase`);
                    // Switch turn when continuing to calling phase
                    this.switchPlayerDirect(newState, players);
                    return { newState, turnShouldSwitch: true };
                }
                return { newState, turnShouldSwitch: false };

            case 'CLAIM_BINGO':
                // Players can claim BINGO anytime (no turn restriction)
                const claimResult = engine.claimBingo(playerIndex);
                if (!claimResult.success) {
                    return { newState: gameState, error: claimResult.error, turnShouldSwitch: false };
                }

                if (claimResult.isWinner) {
                    newState.winner = playerIndex;
                    newState.gamePhase = 'FINISHED';
                    newState.players[playerIndex].hasWon = true;
                    console.log(`[Bingo] Player ${playerIndex} won with BINGO!`);
                    return { newState, turnShouldSwitch: false };
                } else {
                    // False bingo claim, continue game
                    return { newState, error: 'No winning pattern found', turnShouldSwitch: false };
                }

            default:
                return { newState: gameState, error: 'Invalid move type', turnShouldSwitch: false };
        }
    }

    private switchPlayerDirect(gameState: IBingoGameState, players: Room['players']): void {
        // Find current player index
        const currentPlayerIndex = players.findIndex(p => (p.user as any)._id.toString() === gameState.turn);
        
        // Switch to the other player
        const nextPlayerIndex = currentPlayerIndex === 0 ? 1 : 0;
        gameState.currentPlayer = nextPlayerIndex;
        gameState.turn = (players[nextPlayerIndex].user as any)._id.toString();
        
        console.log(`[Bingo] Switched from player ${currentPlayerIndex} to player ${nextPlayerIndex}, new turn: ${gameState.turn}`);
    }

    private isNumberOnCard(card: any, number: number): boolean {
        return (
            card.B.includes(number) ||
            card.I.includes(number) ||
            card.N.includes(number) ||
            card.G.includes(number) ||
            card.O.includes(number)
        );
    }

    private markNumberForBot(gameState: IBingoGameState, playerIndex: number, number: number): { success: boolean; error?: string } {
        const player = gameState.players[playerIndex];
        if (!player) {
            return { success: false, error: 'Invalid player' };
        }

        if (!gameState.calledNumbers.includes(number)) {
            return { success: false, error: 'Number has not been called' };
        }

        const hasNumber = this.isNumberOnCard(player.card, number);
        if (!hasNumber) {
            return { success: false, error: 'Number not on card' };
        }

        player.markedNumbers.add(number);
        return { success: true };
    }

    // Enhanced Bingo AI functions
    private makeIntelligentBingoMove(gameState: IBingoGameState, playerIndex: 0 | 1): GameMove {
        switch (gameState.gamePhase) {
            case 'CALLING':
                console.log('[Bot] Calling next number');
                return { type: 'CALL_NUMBER' };

            case 'MARKING':
                return this.processMarkingPhase(gameState, playerIndex);

            default:
                console.log('[Bot] Default case, calling number');
                return { type: 'CALL_NUMBER' };
        }
    }

    private processMarkingPhase(gameState: IBingoGameState, playerIndex: 0 | 1): GameMove {
        const currentNumber = gameState.currentNumber;
        const botPlayer = gameState.players[playerIndex];
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponentPlayer = gameState.players[opponentIndex];

        // First priority: Check if we can win immediately
        const engine = new BingoGameEngine();
        engine.state = gameState;
        const hasWin = engine.checkForWin(playerIndex);
        if (hasWin) {
            console.log('[Bot] Claiming BINGO!');
            return { type: 'CLAIM_BINGO' };
        }

        // Second priority: Mark the called number if it's on our card and strategic
        if (currentNumber !== null) {
            const shouldMark = this.shouldMarkNumber(gameState, playerIndex, currentNumber);
            if (shouldMark) {
                console.log(`[Bot] Strategically marking number ${currentNumber}`);
                return { type: 'MARK_NUMBER', number: currentNumber };
            }
        }

        // Third priority: Analyze if we should claim BINGO after potential marking
        if (currentNumber !== null && this.isNumberOnCard(botPlayer.card, currentNumber)) {
            const markedNumbers = botPlayer.markedNumbers instanceof Set ?
                botPlayer.markedNumbers : new Set(Array.isArray(botPlayer.markedNumbers) ? botPlayer.markedNumbers : []);
            
            if (!markedNumbers.has(currentNumber)) {
                // Simulate marking this number
                const tempMarked = new Set(markedNumbers);
                tempMarked.add(currentNumber);
                
                const tempEngine = new BingoGameEngine();
                tempEngine.state = { ...gameState };
                tempEngine.state.players[playerIndex].markedNumbers = tempMarked;
                
                const wouldWin = tempEngine.checkForWin(playerIndex);
                if (wouldWin) {
                    console.log('[Bot] Will win after marking this number');
                    return { type: 'MARK_NUMBER', number: currentNumber };
                }
            }
        }

        // Fourth priority: Continue the game
        console.log('[Bot] Continuing game - no immediate action needed');
        return { type: 'CONTINUE_GAME' };
    }

    private shouldMarkNumber(gameState: IBingoGameState, playerIndex: 0 | 1, number: number): boolean {
        const botPlayer = gameState.players[playerIndex];
        const markedNumbers = botPlayer.markedNumbers instanceof Set ?
            botPlayer.markedNumbers : new Set(Array.isArray(botPlayer.markedNumbers) ? botPlayer.markedNumbers : []);

        // Don't mark if already marked
        if (markedNumbers.has(number)) {
            return false;
        }

        // Don't mark if not on card
        if (!this.isNumberOnCard(botPlayer.card, number)) {
            return false;
        }

        // Always mark if it leads to immediate win
        const tempMarked = new Set(markedNumbers);
        tempMarked.add(number);
        
        const tempEngine = new BingoGameEngine();
        tempEngine.state = { ...gameState };
        tempEngine.state.players[playerIndex].markedNumbers = tempMarked;
        
        if (tempEngine.checkForWin(playerIndex)) {
            return true;
        }

        // Evaluate strategic value of marking this number
        const strategicValue = this.evaluateNumberStrategicValue(gameState, playerIndex, number);
        
        // Mark if strategic value is high enough
        return strategicValue > 0.6;
    }

    private evaluateNumberStrategicValue(gameState: IBingoGameState, playerIndex: 0 | 1, number: number): number {
        const botPlayer = gameState.players[playerIndex];
        const markedNumbers = botPlayer.markedNumbers instanceof Set ?
            botPlayer.markedNumbers : new Set(Array.isArray(botPlayer.markedNumbers) ? botPlayer.markedNumbers : []);

        let value = 0.5; // Base value for marking any number on our card

        // Analyze contribution to potential winning patterns
        const patterns = this.analyzeWinningPatterns(botPlayer.card, markedNumbers, number);
        
        // Value based on how many patterns this number helps
        value += patterns.helpsPatterns * 0.1;
        
        // Higher value for numbers that complete lines
        value += patterns.completesLines * 0.3;
        
        // Value based on proximity to winning
        const proximityBonus = this.calculateProximityToWin(botPlayer.card, markedNumbers, number);
        value += proximityBonus * 0.2;

        // Urgency factor - if opponent is close to winning, be more aggressive
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponentThreat = this.assessOpponentThreat(gameState, opponentIndex);
        if (opponentThreat > 0.7) {
            value += 0.2; // Be more aggressive when opponent is close
        }

        return Math.min(value, 1.0);
    }

    private analyzeWinningPatterns(card: any, markedNumbers: Set<number>, newNumber: number): { helpsPatterns: number; completesLines: number } {
        let helpsPatterns = 0;
        let completesLines = 0;

        const tempMarked = new Set(markedNumbers);
        tempMarked.add(newNumber);

        // Check rows
        const columns = ['B', 'I', 'N', 'G', 'O'];
        for (let row = 0; row < 5; row++) {
            let markedInRow = 0;
            for (const col of columns) {
                const cellValue = card[col][row];
                if (col === 'N' && row === 2) {
                    markedInRow++; // Free space
                } else if (tempMarked.has(cellValue)) {
                    markedInRow++;
                }
            }
            
            if (markedInRow === 5) completesLines++;
            else if (markedInRow >= 3) helpsPatterns++;
        }

        // Check columns
        for (const col of columns) {
            let markedInCol = 0;
            for (let row = 0; row < 5; row++) {
                const cellValue = card[col][row];
                if (col === 'N' && row === 2) {
                    markedInCol++; // Free space
                } else if (tempMarked.has(cellValue)) {
                    markedInCol++;
                }
            }
            
            if (markedInCol === 5) completesLines++;
            else if (markedInCol >= 3) helpsPatterns++;
        }

        // Check diagonals
        let diag1Marked = 0, diag2Marked = 0;
        for (let i = 0; i < 5; i++) {
            const col1 = columns[i];
            const col2 = columns[4 - i];
            
            // Main diagonal
            if (i === 2) {
                diag1Marked++; // Free space
            } else if (tempMarked.has(card[col1][i])) {
                diag1Marked++;
            }
            
            // Anti-diagonal
            if (i === 2) {
                diag2Marked++; // Free space
            } else if (tempMarked.has(card[col2][i])) {
                diag2Marked++;
            }
        }

        if (diag1Marked === 5) completesLines++;
        else if (diag1Marked >= 3) helpsPatterns++;

        if (diag2Marked === 5) completesLines++;
        else if (diag2Marked >= 3) helpsPatterns++;

        return { helpsPatterns, completesLines };
    }

    private calculateProximityToWin(card: any, markedNumbers: Set<number>, newNumber: number): number {
        const tempMarked = new Set(markedNumbers);
        tempMarked.add(newNumber);

        let bestProximity = 0;
        const columns = ['B', 'I', 'N', 'G', 'O'];

        // Check all possible winning patterns and find the closest one
        
        // Rows
        for (let row = 0; row < 5; row++) {
            let marked = 0;
            for (let col = 0; col < 5; col++) {
                const colName = columns[col];
                if (colName === 'N' && row === 2) {
                    marked++; // Free space
                } else if (tempMarked.has(card[colName][row])) {
                    marked++;
                }
            }
            bestProximity = Math.max(bestProximity, marked / 5);
        }

        // Columns
        for (let col = 0; col < 5; col++) {
            let marked = 0;
            const colName = columns[col];
            for (let row = 0; row < 5; row++) {
                if (colName === 'N' && row === 2) {
                    marked++; // Free space
                } else if (tempMarked.has(card[colName][row])) {
                    marked++;
                }
            }
            bestProximity = Math.max(bestProximity, marked / 5);
        }

        // Diagonals
        let diag1 = 0, diag2 = 0;
        for (let i = 0; i < 5; i++) {
            // Main diagonal
            if (i === 2) {
                diag1++; // Free space
            } else if (tempMarked.has(card[columns[i]][i])) {
                diag1++;
            }
            
            // Anti-diagonal
            if (i === 2) {
                diag2++; // Free space
            } else if (tempMarked.has(card[columns[4-i]][i])) {
                diag2++;
            }
        }

        bestProximity = Math.max(bestProximity, diag1 / 5, diag2 / 5);

        return bestProximity;
    }

    private assessOpponentThreat(gameState: IBingoGameState, opponentIndex: number): number {
        if (!gameState.players[opponentIndex]) return 0;

        const opponentPlayer = gameState.players[opponentIndex];
        const opponentMarked = opponentPlayer.markedNumbers instanceof Set ?
            opponentPlayer.markedNumbers : new Set(Array.isArray(opponentPlayer.markedNumbers) ? opponentPlayer.markedNumbers : []);

        // Calculate opponent's best proximity to winning
        const opponentProximity = this.calculateOpponentBestProximity(opponentPlayer.card, opponentMarked);
        
        // Higher threat if opponent is closer to winning
        return opponentProximity;
    }

    private calculateOpponentBestProximity(card: any, markedNumbers: Set<number>): number {
        let bestProximity = 0;
        const columns = ['B', 'I', 'N', 'G', 'O'];

        // Check rows
        for (let row = 0; row < 5; row++) {
            let marked = 0;
            for (let col = 0; col < 5; col++) {
                const colName = columns[col];
                if (colName === 'N' && row === 2) {
                    marked++; // Free space
                } else if (markedNumbers.has(card[colName][row])) {
                    marked++;
                }
            }
            bestProximity = Math.max(bestProximity, marked / 5);
        }

        // Check columns
        for (let col = 0; col < 5; col++) {
            let marked = 0;
            const colName = columns[col];
            for (let row = 0; row < 5; row++) {
                if (colName === 'N' && row === 2) {
                    marked++; // Free space
                } else if (markedNumbers.has(card[colName][row])) {
                    marked++;
                }
            }
            bestProximity = Math.max(bestProximity, marked / 5);
        }

        // Check diagonals
        let diag1 = 0, diag2 = 0;
        for (let i = 0; i < 5; i++) {
            if (i === 2) {
                diag1++;
                diag2++; // Free space in center
            } else {
                if (markedNumbers.has(card[columns[i]][i])) diag1++;
                if (markedNumbers.has(card[columns[4-i]][i])) diag2++;
            }
        }

        bestProximity = Math.max(bestProximity, diag1 / 5, diag2 / 5);

        return bestProximity;
    }
}