export interface DiceGameState {
    currentPlayer: number;
    scores: [number, number]; // Total scores for each player
    turnScore: number; // Points accumulated in current turn
    dice: number[]; // Current dice values (1-6)
    selectedDice: boolean[]; // Which dice are selected/scored
    availableDice: number; // Number of dice available to roll
    gamePhase: 'ROLLING' | 'SELECTING' | 'BANKING' | 'FINISHED';
    winner: number | null;
    canRoll: boolean;
    canBank: boolean;
    mustRoll: boolean; // True when player hasn't scored 500 yet
    lastRoll: number[]; // Last dice roll for display
    rollCount: number; // Number of rolls in current turn
}

export interface DiceMove {
    type: 'ROLL' | 'SELECT_DICE' | 'BANK_POINTS';
    diceIndices?: number[]; // For selecting dice
}

export class DiceGameEngine {
    private state: DiceGameState;

    constructor() {
        this.state = this.initializeGame();
    }

    private initializeGame(): DiceGameState {
        return {
            currentPlayer: 0,
            scores: [0, 0],
            turnScore: 0,
            dice: [1, 2, 3, 4, 5, 6], // Show different values initially
            selectedDice: [false, false, false, false, false, false],
            availableDice: 6,
            gamePhase: 'ROLLING',
            winner: null,
            canRoll: true,
            canBank: false,
            mustRoll: true,
            lastRoll: [],
            rollCount: 0
        };
    }

    public getState(): DiceGameState {
        return { ...this.state };
    }

    public makeMove(move: DiceMove): { success: boolean; error?: string } {
        try {
            switch (move.type) {
                case 'ROLL':
                    return this.rollDice();
                case 'SELECT_DICE':
                    return this.selectDice(move.diceIndices || []);
                case 'BANK_POINTS':
                    return this.bankPoints();
                default:
                    return { success: false, error: 'Invalid move type' };
            }
        } catch (error) {
            return { success: false, error: 'Move execution failed' };
        }
    }

    private rollDice(): { success: boolean; error?: string } {
        if (!this.state.canRoll) {
            return { success: false, error: 'Cannot roll dice now' };
        }

        // Roll available dice
        const newDice = [...this.state.dice];
        for (let i = 0; i < 6; i++) {
            if (!this.state.selectedDice[i]) {
                newDice[i] = Math.floor(Math.random() * 6) + 1;
            }
        }

        this.state.dice = newDice;
        this.state.lastRoll = newDice.filter((_, i) => !this.state.selectedDice[i]);
        this.state.rollCount++;
        this.state.gamePhase = 'SELECTING';
        this.state.canRoll = false;

        // Check if any scoring combinations exist
        const availableDice = this.state.dice.filter((_, i) => !this.state.selectedDice[i]);
        const hasScoring = this.hasAnyScoring(availableDice);

        if (!hasScoring) {
            // Farkle! Lose all turn points
            this.state.turnScore = 0;
            this.state.gamePhase = 'ROLLING';
            this.switchPlayer();
            return { success: true };
        }

        return { success: true };
    }

    private selectDice(diceIndices: number[]): { success: boolean; error?: string } {
        if (this.state.gamePhase !== 'SELECTING') {
            return { success: false, error: 'Cannot select dice now' };
        }

        // Validate selection
        const availableDice = diceIndices.filter(i => !this.state.selectedDice[i]);
        if (availableDice.length !== diceIndices.length) {
            return { success: false, error: 'Cannot select already selected dice' };
        }

        // Calculate points for selected dice
        const selectedValues = diceIndices.map(i => this.state.dice[i]);
        const points = this.calculatePoints(selectedValues);

        if (points === 0) {
            return { success: false, error: 'Selected dice do not score any points' };
        }

        // Mark dice as selected
        diceIndices.forEach(i => {
            this.state.selectedDice[i] = true;
        });

        this.state.turnScore += points;
        this.state.availableDice = this.state.selectedDice.filter(selected => !selected).length;

        // If all dice are selected, reset for hot dice
        if (this.state.availableDice === 0) {
            this.state.selectedDice = [false, false, false, false, false, false];
            this.state.availableDice = 6;
        }

        this.state.gamePhase = 'BANKING';
        this.state.canRoll = true;
        this.state.canBank = this.canPlayerBank();

        return { success: true };
    }

    private bankPoints(): { success: boolean; error?: string } {
        if (!this.state.canBank) {
            return { success: false, error: 'Cannot bank points now' };
        }

        // Add turn score to total score
        this.state.scores[this.state.currentPlayer] += this.state.turnScore;

        // Check for win condition
        if (this.state.scores[this.state.currentPlayer] >= 10000) {
            this.state.winner = this.state.currentPlayer;
            this.state.gamePhase = 'FINISHED';
            return { success: true };
        }

        // Reset for next player
        this.state.turnScore = 0;
        this.state.gamePhase = 'ROLLING';
        this.switchPlayer();

        return { success: true };
    }

    private switchPlayer(): void {
        this.state.currentPlayer = this.state.currentPlayer === 0 ? 1 : 0;
        this.state.selectedDice = [false, false, false, false, false, false];
        this.state.availableDice = 6;
        this.state.canRoll = true;
        this.state.canBank = false;
        this.state.rollCount = 0;
        this.state.mustRoll = this.state.scores[this.state.currentPlayer] < 500;
    }

    private canPlayerBank(): boolean {
        // Must have at least 500 total points to get on board
        const totalIfBanked = this.state.scores[this.state.currentPlayer] + this.state.turnScore;
        return totalIfBanked >= 500 && this.state.turnScore > 0;
    }

    private hasAnyScoring(dice: number[]): boolean {
        // Check for any scoring combinations
        const counts = this.getDiceCounts(dice);
        
        // Singles (1s and 5s)
        if (counts[1] > 0 || counts[5] > 0) return true;
        
        // Three or more of a kind
        for (let i = 1; i <= 6; i++) {
            if (counts[i] >= 3) return true;
        }
        
        // Straight
        if (this.isStraight(dice)) return true;
        
        // Three pairs
        if (this.isThreePairs(dice)) return true;
        
        return false;
    }

    private calculatePoints(dice: number[]): number {
        if (dice.length === 0) return 0;

        const counts = this.getDiceCounts(dice);
        let points = 0;

        // Check for special combinations first
        if (dice.length === 6) {
            if (this.isStraight(dice)) return 1500;
            if (this.isThreePairs(dice)) return 1500;
        }

        // Check for multiples of same number
        for (let num = 1; num <= 6; num++) {
            const count = counts[num];
            if (count >= 3) {
                if (count === 6) {
                    points += 3000;
                } else if (count === 5) {
                    points += 2000;
                } else if (count === 4) {
                    points += 1000;
                } else if (count === 3) {
                    if (num === 1) {
                        points += 1000;
                    } else {
                        points += num * 100;
                    }
                }
                
                // Add remaining singles
                const remaining = count - (count >= 3 ? 3 : 0);
                if (num === 1) {
                    points += remaining * 100;
                } else if (num === 5) {
                    points += remaining * 50;
                }
            } else {
                // Just singles
                if (num === 1) {
                    points += count * 100;
                } else if (num === 5) {
                    points += count * 50;
                }
            }
        }

        return points;
    }

    private getDiceCounts(dice: number[]): Record<number, number> {
        const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        dice.forEach(die => counts[die]++);
        return counts;
    }

    private isStraight(dice: number[]): boolean {
        if (dice.length !== 6) return false;
        const sorted = [...dice].sort();
        return sorted.join('') === '123456';
    }

    private isThreePairs(dice: number[]): boolean {
        if (dice.length !== 6) return false;
        const counts = this.getDiceCounts(dice);
        const pairs = Object.values(counts).filter(count => count === 2);
        return pairs.length === 3;
    }

    public isGameFinished(): boolean {
        return this.state.winner !== null;
    }

    public getWinner(): number | null {
        return this.state.winner;
    }

    public getCurrentPlayer(): number {
        return this.state.currentPlayer;
    }
}