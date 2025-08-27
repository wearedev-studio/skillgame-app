export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
    suit: Suit;
    rank: Rank;
    value: number; // 6=6, 7=7, 8=8, 9=9, 10=10, J=11, Q=12, K=13, A=14
}

export interface TablePair {
    attackCard: Card;
    defendCard: Card | null;
}

export type GamePhase = 'DEALING' | 'ATTACKING' | 'DEFENDING' | 'DRAWING' | 'GAME_OVER';

export interface DurakGameState {
    deck: Card[];
    trumpSuit: Suit;
    trumpCard: Card | null;
    players: {
        hand: Card[];
        isAttacker: boolean;
    }[];
    table: TablePair[];
    phase: GamePhase;
    turn: string;
    currentAttackerIndex: number;
    currentDefenderIndex: number;
    gameOver: boolean;
    winner?: string;
    lastAction?: string;
}

export class DurakEngine {
    private static readonly RANKS: Rank[] = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    private static readonly SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    private static readonly RANK_VALUES: Record<Rank, number> = {
        '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
        'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };

    private gameState: DurakGameState;

    constructor() {
        this.gameState = this.createInitialState();
    }

    private createInitialState(): DurakGameState {
        const deck = this.createDeck();
        const shuffledDeck = this.shuffleDeck(deck);
        
        // Deal 6 cards to each player
        const player1Hand = shuffledDeck.splice(0, 6);
        const player2Hand = shuffledDeck.splice(0, 6);
        
        // Set trump card (bottom card of remaining deck)
        const trumpCard = shuffledDeck.length > 0 ? shuffledDeck[shuffledDeck.length - 1] : null;
        const trumpSuit = trumpCard ? trumpCard.suit : 'hearts';

        console.log('[DurakEngine] Creating initial state for Attack/Defense Durak:', {
            player1HandSize: player1Hand.length,
            player2HandSize: player2Hand.length,
            deckSize: shuffledDeck.length,
            trumpSuit,
            trumpCard: trumpCard ? `${trumpCard.rank} of ${trumpCard.suit}` : 'none'
        });

        return {
            deck: shuffledDeck,
            trumpSuit,
            trumpCard,
            players: [
                { hand: player1Hand, isAttacker: true },
                { hand: player2Hand, isAttacker: false }
            ],
            table: [],
            phase: 'ATTACKING',
            turn: '', // Will be set by game logic
            currentAttackerIndex: 0,
            currentDefenderIndex: 1,
            gameOver: false,
            lastAction: 'Game started - Attack/Defense Durak rules'
        };
    }

    private createDeck(): Card[] {
        const deck: Card[] = [];
        for (const suit of DurakEngine.SUITS) {
            for (const rank of DurakEngine.RANKS) {
                deck.push({
                    suit,
                    rank,
                    value: DurakEngine.RANK_VALUES[rank]
                });
            }
        }
        return deck;
    }

    private shuffleDeck(deck: Card[]): Card[] {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    public getGameState(): DurakGameState {
        return { ...this.gameState };
    }

    public canAttackWith(card: Card, playerIndex: number): boolean {
        if (this.gameState.phase !== 'ATTACKING') return false;
        if (playerIndex !== this.gameState.currentAttackerIndex) return false;
        
        // First attack - any card is allowed
        if (this.gameState.table.length === 0) return true;
        
        // Subsequent attacks - card rank must match any card on table
        const tableRanks = new Set<Rank>();
        this.gameState.table.forEach(pair => {
            tableRanks.add(pair.attackCard.rank);
            if (pair.defendCard) {
                tableRanks.add(pair.defendCard.rank);
            }
        });
        
        return tableRanks.has(card.rank);
    }

    public canDefendWith(card: Card, attackCardIndex: number, playerIndex: number): boolean {
        if (this.gameState.phase !== 'DEFENDING') return false;
        if (playerIndex !== this.gameState.currentDefenderIndex) return false;
        if (attackCardIndex >= this.gameState.table.length) return false;
        
        const pair = this.gameState.table[attackCardIndex];
        if (pair.defendCard !== null) return false; // Already defended
        
        const attackCard = pair.attackCard;
        
        // Same suit - must be higher value
        if (card.suit === attackCard.suit) {
            return card.value > attackCard.value;
        }
        
        // Trump beats non-trump
        if (card.suit === this.gameState.trumpSuit && attackCard.suit !== this.gameState.trumpSuit) {
            return true;
        }
        
        return false;
    }

    public attack(card: Card, playerIndex: number): { success: boolean; error?: string } {
        // Validation checks
        if (this.gameState.gameOver) {
            return { success: false, error: "Game is already over" };
        }
        
        if (playerIndex < 0 || playerIndex >= this.gameState.players.length) {
            return { success: false, error: "Invalid player index" };
        }
        
        if (!card || !card.suit || !card.rank) {
            return { success: false, error: "Invalid card" };
        }
        
        if (!this.canAttackWith(card, playerIndex)) {
            return { success: false, error: "Cannot attack with this card" };
        }

        // Remove card from player's hand
        const playerHand = this.gameState.players[playerIndex].hand;
        const cardIndex = playerHand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
        if (cardIndex === -1) {
            return { success: false, error: "Card not in hand" };
        }

        playerHand.splice(cardIndex, 1);
        
        // Add to table
        this.gameState.table.push({
            attackCard: card,
            defendCard: null
        });

        // Switch to defending phase
        this.gameState.phase = 'DEFENDING';
        this.gameState.lastAction = `Player ${playerIndex + 1} attacked with ${card.rank} of ${card.suit}`;
        
        return { success: true };
    }

    public defend(card: Card, attackCardIndex: number, playerIndex: number): { success: boolean; error?: string } {
        // Validation checks
        if (this.gameState.gameOver) {
            return { success: false, error: "Game is already over" };
        }
        
        if (playerIndex < 0 || playerIndex >= this.gameState.players.length) {
            return { success: false, error: "Invalid player index" };
        }
        
        if (!card || !card.suit || !card.rank) {
            return { success: false, error: "Invalid card" };
        }
        
        if (attackCardIndex < 0 || attackCardIndex >= this.gameState.table.length) {
            return { success: false, error: "Invalid attack card index" };
        }
        
        if (!this.canDefendWith(card, attackCardIndex, playerIndex)) {
            return { success: false, error: "Cannot defend with this card" };
        }

        // Remove card from player's hand
        const playerHand = this.gameState.players[playerIndex].hand;
        const cardIndex = playerHand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
        if (cardIndex === -1) {
            return { success: false, error: "Card not in hand" };
        }

        playerHand.splice(cardIndex, 1);
        
        // Add defend card to table
        this.gameState.table[attackCardIndex].defendCard = card;

        // Check if all attacks are defended
        const allDefended = this.gameState.table.every(pair => pair.defendCard !== null);
        
        if (allDefended) {
            // All attacks defended - attacker can add more cards or pass
            const attackerHand = this.gameState.players[this.gameState.currentAttackerIndex].hand;
            const defenderHand = this.gameState.players[this.gameState.currentDefenderIndex].hand;
            
            // Check if attacker can add more cards (defender must have enough cards to potentially defend)
            const maxNewAttacks = Math.min(6 - this.gameState.table.length, defenderHand.length);
            
            if (maxNewAttacks > 0 && attackerHand.length > 0) {
                this.gameState.phase = 'ATTACKING';
            } else {
                this.endRound(true); // Successful defense
            }
        }

        this.gameState.lastAction = `Player ${playerIndex + 1} defended with ${card.rank} of ${card.suit}`;
        return { success: true };
    }

    public defenderTakesCards(): void {
        const defenderIndex = this.gameState.currentDefenderIndex;
        const defenderHand = this.gameState.players[defenderIndex].hand;
        
        // Add all table cards to defender's hand
        this.gameState.table.forEach(pair => {
            defenderHand.push(pair.attackCard);
            if (pair.defendCard) {
                defenderHand.push(pair.defendCard);
            }
        });

        this.gameState.lastAction = `Player ${defenderIndex + 1} took ${this.gameState.table.length} cards`;
        this.endRound(false); // Failed defense
    }

    public passAttack(playerIndex: number): { success: boolean; error?: string } {
        // Validation checks
        if (this.gameState.gameOver) {
            return { success: false, error: "Game is already over" };
        }
        
        if (playerIndex < 0 || playerIndex >= this.gameState.players.length) {
            return { success: false, error: "Invalid player index" };
        }
        
        if (this.gameState.phase !== 'ATTACKING') {
            return { success: false, error: "Not in attacking phase" };
        }
        
        if (playerIndex !== this.gameState.currentAttackerIndex) {
            return { success: false, error: "Not your turn to attack" };
        }

        if (this.gameState.table.length === 0) {
            return { success: false, error: "Must attack with at least one card" };
        }

        // Check if all attacks are defended
        const allDefended = this.gameState.table.every(pair => pair.defendCard !== null);
        
        if (allDefended) {
            this.endRound(true); // Successful defense
        } else {
            // Some attacks not defended - defender must take
            this.defenderTakesCards();
        }

        this.gameState.lastAction = `Player ${playerIndex + 1} passed their turn`;
        return { success: true };
    }

    private endRound(successfulDefense: boolean): void {
        // Clear table
        this.gameState.table = [];
        
        if (successfulDefense) {
            // Defender successfully defended - defender becomes attacker, attacker becomes defender
            this.swapRoles();
        } else {
            // Defender took cards - roles stay the same (attacker continues attacking)
            // Defender stays defender until they successfully defend
        }

        // Draw cards phase
        this.gameState.phase = 'DRAWING';
        this.drawCards();
        
        // Check for game end
        if (this.checkGameEnd()) {
            this.gameState.phase = 'GAME_OVER';
            this.gameState.gameOver = true;
        } else {
            this.gameState.phase = 'ATTACKING';
        }
    }

    private swapRoles(): void {
        const temp = this.gameState.currentAttackerIndex;
        this.gameState.currentAttackerIndex = this.gameState.currentDefenderIndex;
        this.gameState.currentDefenderIndex = temp;
        
        this.gameState.players[0].isAttacker = this.gameState.currentAttackerIndex === 0;
        this.gameState.players[1].isAttacker = this.gameState.currentAttackerIndex === 1;
    }

    private drawCards(): void {
        // Attacker draws first, then defender
        const drawOrder = [this.gameState.currentAttackerIndex, this.gameState.currentDefenderIndex];
        
        for (const playerIndex of drawOrder) {
            const player = this.gameState.players[playerIndex];
            while (player.hand.length < 6 && this.gameState.deck.length > 0) {
                const card = this.gameState.deck.shift()!;
                player.hand.push(card);
            }
        }
    }

    private checkGameEnd(): boolean {
        // Game ends when a player has no cards and deck is empty
        for (let i = 0; i < this.gameState.players.length; i++) {
            if (this.gameState.players[i].hand.length === 0) {
                this.gameState.winner = `player${i}`;
                return true;
            }
        }
        return false;
    }

    public getValidMoves(playerIndex: number): any[] {
        const moves: any[] = [];
        const player = this.gameState.players[playerIndex];
        
        if (this.gameState.phase === 'ATTACKING' && playerIndex === this.gameState.currentAttackerIndex) {
            // Can attack with valid cards
            player.hand.forEach((card, cardIndex) => {
                if (this.canAttackWith(card, playerIndex)) {
                    moves.push({
                        type: 'ATTACK',
                        card,
                        cardIndex
                    });
                }
            });
            
            // Can pass if there are cards on table
            if (this.gameState.table.length > 0) {
                moves.push({ type: 'PASS' });
            }
        } else if (this.gameState.phase === 'DEFENDING' && playerIndex === this.gameState.currentDefenderIndex) {
            // Can defend against undefended attacks
            this.gameState.table.forEach((pair, attackIndex) => {
                if (pair.defendCard === null) {
                    player.hand.forEach((card, cardIndex) => {
                        if (this.canDefendWith(card, attackIndex, playerIndex)) {
                            moves.push({
                                type: 'DEFEND',
                                card,
                                cardIndex,
                                attackIndex
                            });
                        }
                    });
                }
            });
            
            // Can always take cards
            moves.push({ type: 'TAKE' });
        }
        
        return moves;
    }

    public makeMove(move: any, playerIndex: number): { success: boolean; error?: string } {
        switch (move.type) {
            case 'ATTACK':
                return this.attack(move.card, playerIndex);
            case 'DEFEND':
                return this.defend(move.card, move.attackIndex, playerIndex);
            case 'PASS':
                return this.passAttack(playerIndex);
            case 'TAKE':
                this.defenderTakesCards();
                return { success: true };
            default:
                return { success: false, error: "Invalid move type" };
        }
    }

    public setTurn(playerId: string): void {
        this.gameState.turn = playerId;
    }
}