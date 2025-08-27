export interface Domino {
    left: number;
    right: number;
    id: string;
}

export interface PlacedDomino extends Domino {
    position: { x: number; y: number };
    orientation: 'horizontal' | 'vertical';
    rotation: number; // 0, 90, 180, 270 degrees
}

export interface DominoGameState {
    players: {
        hand: Domino[];
        score: number;
    }[];
    boneyard: Domino[];
    board: Domino[];
    placedDominoes: PlacedDomino[]; // Visual chain representation
    currentPlayerIndex: number;
    turn: string;
    gameOver: boolean;
    winner?: string;
    lastAction?: string;
    mustDraw: boolean;
    gamePhase: 'DEALING' | 'PLAYING' | 'GAME_OVER';
    chainEnds: {
        left: { value: number; position: { x: number; y: number }; direction: 'up' | 'down' | 'left' | 'right' };
        right: { value: number; position: { x: number; y: number }; direction: 'up' | 'down' | 'left' | 'right' };
    };
}

export class DominoEngine {
    private gameState: DominoGameState;

    constructor() {
        this.gameState = this.createInitialState();
    }

    private createInitialState(): DominoGameState {
        const dominoes = this.createDominoSet();
        const shuffledDominoes = this.shuffleDominoes(dominoes);
        
        // Deal 7 dominoes to each player
        const player1Hand = shuffledDominoes.splice(0, 7);
        const player2Hand = shuffledDominoes.splice(0, 7);
        
        // Remaining dominoes go to boneyard
        const boneyard = shuffledDominoes;
        
        // Determine starting player (player with highest sum of dots)
        const player1Sum = this.calculateHandSum(player1Hand);
        const player2Sum = this.calculateHandSum(player2Hand);
        const startingPlayerIndex = player1Sum >= player2Sum ? 0 : 1;
        
        console.log('[DominoEngine] Creating initial state:', {
            player1HandSize: player1Hand.length,
            player2HandSize: player2Hand.length,
            boneyardSize: boneyard.length,
            player1Sum,
            player2Sum,
            startingPlayer: startingPlayerIndex
        });

        return {
            players: [
                { hand: player1Hand, score: 0 },
                { hand: player2Hand, score: 0 }
            ],
            boneyard,
            board: [],
            placedDominoes: [],
            currentPlayerIndex: startingPlayerIndex,
            turn: '', // Will be set by game logic
            gameOver: false,
            mustDraw: false,
            gamePhase: 'PLAYING',
            lastAction: `Player ${startingPlayerIndex + 1} starts (highest sum: ${startingPlayerIndex === 0 ? player1Sum : player2Sum})`,
            chainEnds: {
                left: { value: -1, position: { x: 0, y: 0 }, direction: 'left' },
                right: { value: -1, position: { x: 0, y: 0 }, direction: 'right' }
            }
        };
    }

    private createDominoSet(): Domino[] {
        const dominoes: Domino[] = [];
        let id = 0;
        
        // Standard double-six domino set (0-0 to 6-6)
        for (let left = 0; left <= 6; left++) {
            for (let right = left; right <= 6; right++) {
                dominoes.push({
                    left,
                    right,
                    id: `domino-${id++}`
                });
            }
        }
        
        return dominoes;
    }

    private shuffleDominoes(dominoes: Domino[]): Domino[] {
        const shuffled = [...dominoes];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    private calculateHandSum(hand: Domino[]): number {
        return hand.reduce((sum, domino) => sum + domino.left + domino.right, 0);
    }

    public getGameState(): DominoGameState {
        return { ...this.gameState };
    }

    public canPlayDomino(domino: Domino, playerIndex: number): boolean {
        if (this.gameState.gameOver) return false;
        if (playerIndex !== this.gameState.currentPlayerIndex) return false;
        
        const playerHand = this.gameState.players[playerIndex].hand;
        const dominoInHand = playerHand.find(d => d.id === domino.id);
        if (!dominoInHand) return false;

        // First domino can always be played
        if (this.gameState.board.length === 0) return true;

        // Check if domino can connect to either end of the board
        const leftEnd = this.getLeftEnd();
        const rightEnd = this.getRightEnd();

        return domino.left === leftEnd || domino.right === leftEnd ||
               domino.left === rightEnd || domino.right === rightEnd;
    }

    public playDomino(domino: Domino, side: 'left' | 'right', playerIndex: number): { success: boolean; error?: string } {
        if (!this.canPlayDomino(domino, playerIndex)) {
            return { success: false, error: "Cannot play this domino" };
        }

        const playerHand = this.gameState.players[playerIndex].hand;
        const dominoIndex = playerHand.findIndex(d => d.id === domino.id);
        
        if (dominoIndex === -1) {
            return { success: false, error: "Domino not in hand" };
        }

        // Remove domino from player's hand
        playerHand.splice(dominoIndex, 1);

        // Place domino on board and update visual chain
        if (this.gameState.board.length === 0) {
            // First domino - place in center
            this.gameState.board.push(domino);
            const placedDomino: PlacedDomino = {
                ...domino,
                position: { x: 0, y: 0 },
                orientation: 'horizontal',
                rotation: 0
            };
            this.gameState.placedDominoes.push(placedDomino);
            
            // Initialize chain ends
            this.gameState.chainEnds = {
                left: { value: domino.left, position: { x: -1, y: 0 }, direction: 'left' },
                right: { value: domino.right, position: { x: 1, y: 0 }, direction: 'right' }
            };
        } else {
            const leftEnd = this.getLeftEnd();
            const rightEnd = this.getRightEnd();
            let placedDomino: PlacedDomino;
            
            if (side === 'left') {
                // Connect to left end
                if (domino.right === leftEnd) {
                    this.gameState.board.unshift(domino);
                    placedDomino = this.calculateDominoPosition(domino, 'left', false);
                } else if (domino.left === leftEnd) {
                    // Flip domino
                    const flippedDomino = { ...domino, left: domino.right, right: domino.left };
                    this.gameState.board.unshift(flippedDomino);
                    placedDomino = this.calculateDominoPosition(flippedDomino, 'left', true);
                } else {
                    return { success: false, error: "Domino doesn't match left end" };
                }
                this.gameState.placedDominoes.unshift(placedDomino);
            } else {
                // Connect to right end
                if (domino.left === rightEnd) {
                    this.gameState.board.push(domino);
                    placedDomino = this.calculateDominoPosition(domino, 'right', false);
                } else if (domino.right === rightEnd) {
                    // Flip domino
                    const flippedDomino = { ...domino, left: domino.right, right: domino.left };
                    this.gameState.board.push(flippedDomino);
                    placedDomino = this.calculateDominoPosition(flippedDomino, 'right', true);
                } else {
                    return { success: false, error: "Domino doesn't match right end" };
                }
                this.gameState.placedDominoes.push(placedDomino);
            }
            
            // Update chain ends
            this.updateChainEnds();
        }

        this.gameState.mustDraw = false;
        this.gameState.lastAction = `Player ${playerIndex + 1} played ${domino.left}-${domino.right}`;

        // Check for win condition
        if (playerHand.length === 0) {
            this.gameState.gameOver = true;
            this.gameState.winner = `player${playerIndex}`;
            this.gameState.gamePhase = 'GAME_OVER';
            this.gameState.lastAction += ` and won!`;
        } else {
            // Switch turns
            this.gameState.currentPlayerIndex = playerIndex === 0 ? 1 : 0;
        }

        return { success: true };
    }

    private calculateDominoPosition(domino: Domino, side: 'left' | 'right', flipped: boolean): PlacedDomino {
        const chainLength = this.gameState.placedDominoes.length;
        
        if (side === 'left') {
            // Add to the left side of the chain
            const leftmostDomino = this.gameState.placedDominoes[0];
            
            let newX = leftmostDomino.position.x;
            let newY = leftmostDomino.position.y;
            let orientation: 'horizontal' | 'vertical' = 'horizontal';
            let rotation = 0;
            
            // Simple left movement with occasional turns
            if (leftmostDomino.orientation === 'horizontal') {
                newX -= 1; // Move left
                
                // Turn every 5-7 dominoes to create interesting patterns
                if (chainLength > 0 && (chainLength % 6 === 0 || newX < -4)) {
                    orientation = 'vertical';
                    rotation = 90;
                    newX = leftmostDomino.position.x;
                    newY = leftmostDomino.position.y - 1; // Turn up
                }
            } else {
                newY -= 1; // Move up
                
                // Turn back to horizontal after 3-4 vertical dominoes
                if (chainLength > 0 && (chainLength % 3 === 0 || newY < -2)) {
                    orientation = 'horizontal';
                    rotation = 0;
                    newX = leftmostDomino.position.x - 1; // Continue left
                    newY = leftmostDomino.position.y;
                }
            }
            
            return {
                ...domino,
                position: { x: newX, y: newY },
                orientation,
                rotation
            };
        } else {
            // Add to the right side of the chain
            const rightmostDomino = this.gameState.placedDominoes[this.gameState.placedDominoes.length - 1];
            
            let newX = rightmostDomino.position.x;
            let newY = rightmostDomino.position.y;
            let orientation: 'horizontal' | 'vertical' = 'horizontal';
            let rotation = 0;
            
            // Simple right movement with occasional turns
            if (rightmostDomino.orientation === 'horizontal') {
                newX += 1; // Move right
                
                // Turn every 5-7 dominoes to create interesting patterns
                if (chainLength > 0 && (chainLength % 6 === 0 || newX > 4)) {
                    orientation = 'vertical';
                    rotation = 90;
                    newX = rightmostDomino.position.x;
                    newY = rightmostDomino.position.y + 1; // Turn down
                }
            } else {
                newY += 1; // Move down
                
                // Turn back to horizontal after 3-4 vertical dominoes
                if (chainLength > 0 && (chainLength % 3 === 0 || newY > 2)) {
                    orientation = 'horizontal';
                    rotation = 0;
                    newX = rightmostDomino.position.x + 1; // Continue right
                    newY = rightmostDomino.position.y;
                }
            }
            
            return {
                ...domino,
                position: { x: newX, y: newY },
                orientation,
                rotation
            };
        }
    }

    private updateChainEnds(): void {
        if (this.gameState.placedDominoes.length === 0) return;
        
        const leftDomino = this.gameState.placedDominoes[0];
        const rightDomino = this.gameState.placedDominoes[this.gameState.placedDominoes.length - 1];
        
        // Update chain ends based on actual positions
        this.gameState.chainEnds = {
            left: {
                value: this.gameState.board[0].left,
                position: { x: leftDomino.position.x - 1, y: leftDomino.position.y },
                direction: 'left'
            },
            right: {
                value: this.gameState.board[this.gameState.board.length - 1].right,
                position: { x: rightDomino.position.x + 1, y: rightDomino.position.y },
                direction: 'right'
            }
        };
    }

    public drawFromBoneyard(playerIndex: number): { success: boolean; error?: string; domino?: Domino } {
        if (this.gameState.gameOver) {
            return { success: false, error: "Game is over" };
        }

        if (playerIndex !== this.gameState.currentPlayerIndex) {
            return { success: false, error: "Not your turn" };
        }

        if (this.gameState.boneyard.length === 0) {
            return { success: false, error: "Boneyard is empty" };
        }

        const drawnDomino = this.gameState.boneyard.pop()!;
        this.gameState.players[playerIndex].hand.push(drawnDomino);
        
        this.gameState.lastAction = `Player ${playerIndex + 1} drew from boneyard`;

        // Check if drawn domino can be played
        if (this.canPlayDomino(drawnDomino, playerIndex)) {
            this.gameState.mustDraw = false;
        } else {
            // If still can't play, check if any domino in hand can be played
            const canPlayAny = this.gameState.players[playerIndex].hand.some(d => this.canPlayDomino(d, playerIndex));
            if (!canPlayAny) {
                // Must continue drawing or pass if boneyard empty
                this.gameState.mustDraw = this.gameState.boneyard.length > 0;
                if (!this.gameState.mustDraw) {
                    // Pass turn
                    this.gameState.currentPlayerIndex = playerIndex === 0 ? 1 : 0;
                    this.gameState.lastAction += ` and passed`;
                }
            }
        }

        return { success: true, domino: drawnDomino };
    }

    public passTurn(playerIndex: number): { success: boolean; error?: string } {
        if (this.gameState.gameOver) {
            return { success: false, error: "Game is over" };
        }

        if (playerIndex !== this.gameState.currentPlayerIndex) {
            return { success: false, error: "Not your turn" };
        }

        // Can only pass if boneyard is empty and no valid moves
        if (this.gameState.boneyard.length > 0) {
            return { success: false, error: "Must draw from boneyard first" };
        }

        const canPlayAny = this.gameState.players[playerIndex].hand.some(d => this.canPlayDomino(d, playerIndex));
        if (canPlayAny) {
            return { success: false, error: "Must play a domino if possible" };
        }

        // Check if opponent can play
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponentCanPlay = this.gameState.players[opponentIndex].hand.some(d => this.canPlayDomino(d, opponentIndex));

        if (!opponentCanPlay) {
            // Game is blocked - determine winner by lowest points
            this.endBlockedGame();
        } else {
            // Switch turns
            this.gameState.currentPlayerIndex = opponentIndex;
            this.gameState.lastAction = `Player ${playerIndex + 1} passed`;
        }

        return { success: true };
    }

    private endBlockedGame(): void {
        const player1Points = this.calculateHandSum(this.gameState.players[0].hand);
        const player2Points = this.calculateHandSum(this.gameState.players[1].hand);

        this.gameState.gameOver = true;
        this.gameState.gamePhase = 'GAME_OVER';

        if (player1Points < player2Points) {
            this.gameState.winner = 'player0';
            this.gameState.lastAction = `Game blocked - Player 1 wins with ${player1Points} points vs ${player2Points}`;
        } else if (player2Points < player1Points) {
            this.gameState.winner = 'player1';
            this.gameState.lastAction = `Game blocked - Player 2 wins with ${player2Points} points vs ${player1Points}`;
        } else {
            this.gameState.lastAction = `Game blocked - Draw with ${player1Points} points each`;
        }
    }

    private getLeftEnd(): number {
        if (this.gameState.board.length === 0) return -1;
        return this.gameState.board[0].left;
    }

    private getRightEnd(): number {
        if (this.gameState.board.length === 0) return -1;
        return this.gameState.board[this.gameState.board.length - 1].right;
    }

    public getValidMoves(playerIndex: number): any[] {
        const moves: any[] = [];
        const player = this.gameState.players[playerIndex];

        if (this.gameState.gameOver || playerIndex !== this.gameState.currentPlayerIndex) {
            return moves;
        }

        // Check each domino in hand
        player.hand.forEach((domino, index) => {
            if (this.canPlayDomino(domino, playerIndex)) {
                if (this.gameState.board.length === 0) {
                    // First domino - can play on either side
                    moves.push({
                        type: 'PLAY',
                        domino,
                        side: 'left',
                        dominoIndex: index
                    });
                } else {
                    const leftEnd = this.getLeftEnd();
                    const rightEnd = this.getRightEnd();

                    // Check left side
                    if (domino.left === leftEnd || domino.right === leftEnd) {
                        moves.push({
                            type: 'PLAY',
                            domino,
                            side: 'left',
                            dominoIndex: index
                        });
                    }

                    // Check right side
                    if (domino.left === rightEnd || domino.right === rightEnd) {
                        moves.push({
                            type: 'PLAY',
                            domino,
                            side: 'right',
                            dominoIndex: index
                        });
                    }
                }
            }
        });

        // Check if can draw
        if (moves.length === 0 && this.gameState.boneyard.length > 0) {
            moves.push({ type: 'DRAW' });
        }

        // Check if can pass
        if (moves.length === 0 && this.gameState.boneyard.length === 0) {
            moves.push({ type: 'PASS' });
        }

        return moves;
    }

    public makeMove(move: any, playerIndex: number): { success: boolean; error?: string } {
        switch (move.type) {
            case 'PLAY':
                return this.playDomino(move.domino, move.side, playerIndex);
            case 'DRAW':
                const drawResult = this.drawFromBoneyard(playerIndex);
                return { success: drawResult.success, error: drawResult.error };
            case 'PASS':
                return this.passTurn(playerIndex);
            default:
                return { success: false, error: "Invalid move type" };
        }
    }

    public setTurn(playerId: string): void {
        this.gameState.turn = playerId;
    }
}