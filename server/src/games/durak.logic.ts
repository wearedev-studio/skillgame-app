import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';
import { DurakEngine, Card, DurakGameState } from './durak-engine';

type DurakMove = {
    type: 'ATTACK' | 'DEFEND' | 'PASS' | 'TAKE';
    card?: Card;
    attackIndex?: number;
};

// Enhanced Durak AI functions
function getCardValue(card: Card): number {
    // Ace = 14, King = 13, Queen = 12, Jack = 11, 10 = 10, ... 6 = 6
    if (card.value === 1) return 14; // Ace
    return card.value;
}

function countRemainingCards(gameState: DurakGameState): Map<string, number> {
    const allCards = new Map<string, number>();
    
    // Initialize full deck
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    for (const suit of suits) {
        for (let value = 6; value <= 14; value++) {
            const key = `${suit}-${value}`;
            allCards.set(key, 1);
        }
    }
    
    // Remove cards that are known to be played
    for (const pair of gameState.table) {
        if (pair.attackCard) {
            const key = `${pair.attackCard.suit}-${getCardValue(pair.attackCard)}`;
            allCards.set(key, 0);
        }
        if (pair.defendCard) {
            const key = `${pair.defendCard.suit}-${getCardValue(pair.defendCard)}`;
            allCards.set(key, 0);
        }
    }
    
    // Remove cards from bot's hand
    const botHand = gameState.players[0]?.hand || [];
    for (const card of botHand) {
        const key = `${card.suit}-${getCardValue(card)}`;
        allCards.set(key, 0);
    }
    
    return allCards;
}

function evaluateHandStrength(hand: Card[], trumpSuit: string): number {
    let strength = 0;
    
    for (const card of hand) {
        const value = getCardValue(card);
        const isTrump = card.suit === trumpSuit;
        
        // Trump cards are more valuable
        if (isTrump) {
            strength += value * 1.5;
        } else {
            strength += value;
        }
        
        // High cards are more valuable
        if (value >= 12) strength += 5;
        if (value === 14) strength += 10; // Ace bonus
    }
    
    return strength;
}

function canCardBeBeaten(card: Card, trumpSuit: string, remainingCards: Map<string, number>): number {
    let beatingProbability = 0;
    
    if (card.suit === trumpSuit) {
        // Trump cards can only be beaten by higher trumps
        const cardValue = getCardValue(card);
        for (let value = cardValue + 1; value <= 14; value++) {
            const key = `${trumpSuit}-${value}`;
            if (remainingCards.get(key)) {
                beatingProbability += 0.1; // Assume 10% chance per higher trump
            }
        }
    } else {
        // Non-trump cards can be beaten by higher cards of same suit or any trump
        const cardValue = getCardValue(card);
        
        // Higher cards of same suit
        for (let value = cardValue + 1; value <= 14; value++) {
            const key = `${card.suit}-${value}`;
            if (remainingCards.get(key)) {
                beatingProbability += 0.05;
            }
        }
        
        // Any trump card
        for (let value = 6; value <= 14; value++) {
            const key = `${trumpSuit}-${value}`;
            if (remainingCards.get(key)) {
                beatingProbability += 0.08;
            }
        }
    }
    
    return Math.min(beatingProbability, 0.9);
}

function findBestDurakMove(gameState: DurakGameState, validMoves: any[], playerIndex: 0 | 1): any {
    if (validMoves.length === 0) return null;
    if (validMoves.length === 1) return validMoves[0];
    
    const botHand = gameState.players[playerIndex]?.hand || [];
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentHand = gameState.players[opponentIndex]?.hand || [];
    const trumpSuit = gameState.trumpSuit;
    const remainingCards = countRemainingCards(gameState);
    
    if (gameState.phase === 'ATTACKING') {
        return findBestAttackMove(gameState, validMoves, botHand, opponentHand, trumpSuit, remainingCards);
    } else if (gameState.phase === 'DEFENDING') {
        return findBestDefenseMove(gameState, validMoves, botHand, opponentHand, trumpSuit, remainingCards);
    }
    
    return validMoves[0];
}

function findBestAttackMove(gameState: DurakGameState, validMoves: any[], botHand: Card[], opponentHand: Card[], trumpSuit: string, remainingCards: Map<string, number>): any {
    const attackMoves = validMoves.filter(move => move.type === 'ATTACK');
    const passMoves = validMoves.filter(move => move.type === 'PASS');
    
    if (attackMoves.length === 0) {
        return passMoves[0] || validMoves[0];
    }
    
    // Evaluate each attack move
    const evaluatedMoves = attackMoves.map(move => {
        let score = 0;
        const card = move.card;
        const cardValue = getCardValue(card);
        const isTrump = card.suit === trumpSuit;
        
        // Strategy: Attack with cards that are hard to beat but not too valuable
        
        // Prefer non-trump cards (save trumps for defense)
        if (!isTrump) {
            score += 20;
        } else {
            score -= 10; // Penalty for using trumps in attack
        }
        
        // Prefer medium-value cards (not too low, not too high)
        if (cardValue >= 8 && cardValue <= 11) {
            score += 15;
        } else if (cardValue >= 12) {
            score -= 10; // Don't waste high cards in attack
        }
        
        // Check how difficult this card is to beat
        const beatingProbability = canCardBeBeaten(card, trumpSuit, remainingCards);
        score += (1 - beatingProbability) * 25; // Prefer hard-to-beat cards
        
        // If opponent has few cards, be more aggressive
        if (opponentHand.length <= 3) {
            score += 10;
        }
        
        // If we have many cards, prefer to attack more
        if (botHand.length >= 7) {
            score += 5;
        }
        
        // Prefer cards that match already played cards (can add more attacks)
        const tableCards = gameState.table.map(pair => pair.attackCard).filter(Boolean);
        if (tableCards.some(tableCard => tableCard && getCardValue(tableCard) === cardValue)) {
            score += 8;
        }
        
        // Small randomness to avoid predictability
        score += Math.random() * 2;
        
        return { move, score };
    });
    
    evaluatedMoves.sort((a, b) => b.score - a.score);
    
    // Sometimes pass if we have a good hand and opponent has many cards
    if (passMoves.length > 0 && opponentHand.length >= 6 && botHand.length <= 4) {
        const handStrength = evaluateHandStrength(botHand, trumpSuit);
        if (handStrength > 150 && Math.random() < 0.3) {
            return passMoves[0];
        }
    }
    
    return evaluatedMoves[0].move;
}

function findBestDefenseMove(gameState: DurakGameState, validMoves: any[], botHand: Card[], opponentHand: Card[], trumpSuit: string, remainingCards: Map<string, number>): any {
    const defendMoves = validMoves.filter(move => move.type === 'DEFEND');
    const takeMoves = validMoves.filter(move => move.type === 'TAKE');
    
    if (defendMoves.length === 0) {
        return takeMoves[0] || validMoves[0];
    }
    
    // Count undefended attacks
    const undefendedAttacks = gameState.table.filter(pair => pair.defendCard === null).length;
    const totalAttacks = gameState.table.length;
    
    // Decision: Should we take or defend?
    const shouldTake = decideShouldTake(gameState, botHand, opponentHand, trumpSuit, undefendedAttacks, totalAttacks);
    
    if (shouldTake && takeMoves.length > 0) {
        return takeMoves[0];
    }
    
    // Find best defense move
    const evaluatedDefenses = defendMoves.map(move => {
        let score = 0;
        const card = move.card;
        const cardValue = getCardValue(card);
        const isTrump = card.suit === trumpSuit;
        
        // Get the attack card we're defending against
        const attackIndex = move.attackIndex || 0;
        const attackCard = gameState.table[attackIndex]?.attackCard;
        
        if (!attackCard) return { move, score: -1000 };
        
        const attackValue = getCardValue(attackCard);
        const attackIsTrump = attackCard.suit === trumpSuit;
        
        // Prefer to defend with minimal value difference
        const valueDifference = cardValue - attackValue;
        if (valueDifference > 0 && valueDifference <= 2) {
            score += 20; // Good minimal defense
        } else if (valueDifference > 2) {
            score -= valueDifference * 3; // Penalty for overkill
        }
        
        // Avoid using trumps unless necessary
        if (isTrump && !attackIsTrump) {
            score -= 15; // Penalty for using trump on non-trump attack
        }
        
        // Prefer to use cards that are less valuable strategically
        if (cardValue <= 9) {
            score += 10; // Low cards are good for defense
        } else if (cardValue >= 13) {
            score -= 15; // High cards should be saved
        }
        
        // Consider hand size
        if (botHand.length <= 3) {
            score += 5; // More willing to defend when few cards
        }
        
        return { move, score };
    });
    
    evaluatedDefenses.sort((a, b) => b.score - a.score);
    
    // If best defense is still poor, consider taking
    if (evaluatedDefenses[0].score < -10 && takeMoves.length > 0) {
        return takeMoves[0];
    }
    
    return evaluatedDefenses[0].move;
}

function decideShouldTake(gameState: DurakGameState, botHand: Card[], opponentHand: Card[], trumpSuit: string, undefendedAttacks: number, totalAttacks: number): boolean {
    // Too many attacks to defend
    if (undefendedAttacks >= 4) return true;
    
    // If we have very few cards and opponent has many
    if (botHand.length <= 2 && opponentHand.length >= 6) return true;
    
    // If we would have to use too many valuable cards
    const trumpsInHand = botHand.filter(card => card.suit === trumpSuit).length;
    const highCardsInHand = botHand.filter(card => getCardValue(card) >= 12).length;
    
    if (undefendedAttacks >= 2 && (trumpsInHand <= 1 || highCardsInHand >= 4)) return true;
    
    // Strategic taking: if we have a very strong hand, sometimes take to get more cards
    const handStrength = evaluateHandStrength(botHand, trumpSuit);
    if (handStrength > 200 && botHand.length <= 4 && Math.random() < 0.2) return true;
    
    return false;
}

export const durakLogic: IGameLogic = {
    createInitialState(players: Room['players']): DurakGameState {
        console.log('[Durak] Creating initial state for Attack/Defense Durak with players:', players.length);
        
        if (players.length < 2) {
            console.log('[Durak] Not enough players to start game');
            // Return a basic state for single player waiting
            return {
                deck: [],
                trumpSuit: 'hearts',
                trumpCard: null,
                players: [
                    { hand: [], isAttacker: true },
                    { hand: [], isAttacker: false }
                ],
                table: [],
                phase: 'DEALING',
                turn: players.length > 0 ? (players[0].user as any)._id.toString() : '',
                currentAttackerIndex: 0,
                currentDefenderIndex: 1,
                gameOver: false,
                lastAction: 'Waiting for players'
            };
        }
        
        const engine = new DurakEngine();
        const gameState = engine.getGameState();
        
        // Set the turn to the first player (attacker)
        gameState.turn = (players[0].user as any)._id.toString();
        gameState.phase = 'ATTACKING'; // Make sure we start in attacking phase
        
        console.log('[Durak] Initial state created for Attack/Defense Durak:', {
            turn: gameState.turn,
            phase: gameState.phase,
            player1Hand: gameState.players[0]?.hand?.length,
            player2Hand: gameState.players[1]?.hand?.length,
            trumpSuit: gameState.trumpSuit,
            currentAttacker: gameState.currentAttackerIndex,
            currentDefender: gameState.currentDefenderIndex
        });
        
        return gameState;
    },

    processMove(gameState: DurakGameState, move: DurakMove, playerId: string, players: Room['players']) {
        console.log('[Durak] Processing move for Attack/Defense Durak:', { move, playerId, phase: gameState.phase });
        
        const playerIndex = players.findIndex(p => (p.user as any)._id.toString() === playerId);
        if (playerIndex === -1) {
            console.log('[Durak] Player not found');
            return { newState: gameState, error: "Player not found.", turnShouldSwitch: false };
        }

        // Check if it's the player's turn
        if (gameState.turn !== playerId) {
            console.log('[Durak] Not player\'s turn. Expected:', gameState.turn, 'Actual:', playerId);
            return { newState: gameState, error: "It's not your turn.", turnShouldSwitch: false };
        }

        // Validate move based on current phase and player role
        if (gameState.phase === 'ATTACKING' && playerIndex !== gameState.currentAttackerIndex) {
            return { newState: gameState, error: "You are not the attacker.", turnShouldSwitch: false };
        }
        
        if (gameState.phase === 'DEFENDING' && playerIndex !== gameState.currentDefenderIndex) {
            return { newState: gameState, error: "You are not the defender.", turnShouldSwitch: false };
        }

        // Create engine instance with current state
        const engine = new DurakEngine();
        // Set the engine state to current game state
        (engine as any).gameState = { ...gameState };

        // Process the move
        const moveResult = engine.makeMove(move, playerIndex);
        
        if (!moveResult.success) {
            console.log('[Durak] Invalid move:', moveResult.error);
            return { newState: gameState, error: moveResult.error || "Invalid move.", turnShouldSwitch: false };
        }

        const newGameState = engine.getGameState();
        
        // Determine next turn
        let nextTurn = gameState.turn;
        let turnShouldSwitch = false;
        
        if (!newGameState.gameOver) {
            if (newGameState.phase === 'ATTACKING') {
                // Attacker's turn
                const attackerIndex = newGameState.currentAttackerIndex;
                const attacker = players[attackerIndex];
                if (attacker) {
                    nextTurn = (attacker.user as any)._id.toString();
                    turnShouldSwitch = nextTurn !== playerId;
                }
            } else if (newGameState.phase === 'DEFENDING') {
                // Defender's turn
                const defenderIndex = newGameState.currentDefenderIndex;
                const defender = players[defenderIndex];
                if (defender) {
                    nextTurn = (defender.user as any)._id.toString();
                    turnShouldSwitch = nextTurn !== playerId;
                }
            }
        }

        newGameState.turn = nextTurn;

        console.log('[Durak] Move processed successfully. Phase:', newGameState.phase, 'Next turn:', nextTurn, 'Attacker:', newGameState.currentAttackerIndex, 'Defender:', newGameState.currentDefenderIndex);
        
        return { newState: newGameState, error: undefined, turnShouldSwitch };
    },

    checkGameEnd(gameState: DurakGameState, players: Room['players']) {
        console.log('[Durak] Checking game end for Attack/Defense Durak. Game over:', gameState.gameOver);
        
        if (!gameState.gameOver) {
            return { isGameOver: false, isDraw: false };
        }

        // In Attack/Defense Durak, the player who gets rid of all cards first wins
        let winnerId: string | undefined;
        
        if (gameState.winner) {
            const winnerIndex = parseInt(gameState.winner.replace('player', ''));
            const winner = players[winnerIndex];
            if (winner) {
                winnerId = (winner.user as any)._id.toString();
            }
        }

        return { 
            isGameOver: true, 
            winnerId,
            isDraw: false // Durak doesn't have draws
        };
    },
    
    makeBotMove(gameState: DurakGameState, playerIndex: 0 | 1): GameMove {
        console.log('[Durak] Bot making move for Attack/Defense Durak, player:', playerIndex);
        
        // Check if it's bot's turn
        const botIsAttacker = playerIndex === gameState.currentAttackerIndex;
        const botIsDefender = playerIndex === gameState.currentDefenderIndex;
        
        if (!botIsAttacker && !botIsDefender) {
            console.log('[Durak] Bot move requested but it\'s not bot\'s turn');
            return {};
        }

        // Create engine instance to get valid moves
        const engine = new DurakEngine();
        (engine as any).gameState = { ...gameState };
        
        const validMoves = engine.getValidMoves(playerIndex);
        console.log('[Durak] Available moves for bot:', validMoves.length);
        
        if (validMoves.length === 0) {
            return {};
        }

        // Use intelligent strategy
        const selectedMove = findBestDurakMove(gameState, validMoves, playerIndex);
        
        if (selectedMove) {
            console.log('[Durak] Bot selected intelligent move:', selectedMove.type);
            return {
                type: selectedMove.type,
                card: selectedMove.card,
                attackIndex: selectedMove.attackIndex
            };
        }
        
        console.log('[Durak] No valid moves for bot');
        return {};
    }
};