export interface BingoCard {
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
}

export interface BingoGameState {
    currentPlayer: number;
    players: {
        card: BingoCard;
        markedNumbers: Set<number>;
        hasWon: boolean;
    }[];
    calledNumbers: number[];
    currentNumber: number | null;
    gamePhase: 'WAITING' | 'CALLING' | 'MARKING' | 'FINISHED';
    winner: number | null;
    turn: string;
    numberPool: number[];
    callHistory: { number: number; timestamp: number }[];
}

export interface BingoMove {
    type: 'CALL_NUMBER' | 'MARK_NUMBER' | 'CLAIM_BINGO' | 'CONTINUE_GAME';
    number?: number;
}

export class BingoGameEngine {
    public state: BingoGameState;

    constructor() {
        this.state = this.createInitialState();
    }

    public createInitialState(): BingoGameState {
        return {
            currentPlayer: 0,
            players: [],
            calledNumbers: [],
            currentNumber: null,
            gamePhase: 'WAITING',
            winner: null,
            turn: '',
            numberPool: this.createNumberPool(),
            callHistory: []
        };
    }

    public initializeGame(playerIds: string[]): BingoGameState {
        const players = playerIds.map(() => ({
            card: this.generateBingoCard(),
            markedNumbers: new Set<number>(),
            hasWon: false
        }));

        this.state = {
            currentPlayer: 0,
            players,
            calledNumbers: [],
            currentNumber: null,
            gamePhase: 'CALLING',
            winner: null,
            turn: playerIds[0],
            numberPool: this.createNumberPool(),
            callHistory: []
        };

        return this.state;
    }

    private createNumberPool(): number[] {
        const pool: number[] = [];
        // B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
        for (let i = 1; i <= 75; i++) {
            pool.push(i);
        }
        return this.shuffleArray(pool);
    }

    private generateBingoCard(): BingoCard {
        const card: BingoCard = {
            B: this.getRandomNumbers(1, 15, 5),
            I: this.getRandomNumbers(16, 30, 5),
            N: this.getRandomNumbers(31, 45, 5),
            G: this.getRandomNumbers(46, 60, 5),
            O: this.getRandomNumbers(61, 75, 5)
        };

        // Center square is free (traditional bingo)
        card.N[2] = 0; // Free space

        return card;
    }

    private getRandomNumbers(min: number, max: number, count: number): number[] {
        const numbers: number[] = [];
        const available: number[] = [];
        
        for (let i = min; i <= max; i++) {
            available.push(i);
        }

        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * available.length);
            numbers.push(available[randomIndex]);
            available.splice(randomIndex, 1);
        }

        return numbers.sort((a, b) => a - b);
    }

    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    public callNextNumber(): { success: boolean; number?: number; error?: string } {
        if (this.state.gamePhase !== 'CALLING') {
            return { success: false, error: 'Not in calling phase' };
        }

        if (this.state.numberPool.length === 0) {
            return { success: false, error: 'No more numbers to call' };
        }

        const number = this.state.numberPool.shift()!;
        this.state.calledNumbers.push(number);
        this.state.currentNumber = number;
        this.state.callHistory.push({ number, timestamp: Date.now() });
        this.state.gamePhase = 'MARKING';

        return { success: true, number };
    }

    public markNumber(playerIndex: number, number: number): { success: boolean; error?: string } {
        if (this.state.gamePhase !== 'MARKING') {
            return { success: false, error: 'Not in marking phase' };
        }

        if (!this.state.calledNumbers.includes(number)) {
            return { success: false, error: 'Number has not been called' };
        }

        const player = this.state.players[playerIndex];
        if (!player) {
            return { success: false, error: 'Invalid player' };
        }

        // Check if number is on player's card
        const hasNumber = this.isNumberOnCard(player.card, number);
        if (!hasNumber) {
            return { success: false, error: 'Number not on your card' };
        }

        player.markedNumbers.add(number);
        return { success: true };
    }

    private isNumberOnCard(card: BingoCard, number: number): boolean {
        return (
            card.B.includes(number) ||
            card.I.includes(number) ||
            card.N.includes(number) ||
            card.G.includes(number) ||
            card.O.includes(number)
        );
    }

    public checkForWin(playerIndex: number): boolean {
        const player = this.state.players[playerIndex];
        if (!player) return false;

        const card = player.card;
        const marked = player.markedNumbers;

        // Add free space to marked numbers for checking
        const markedWithFree = new Set([...marked, 0]);

        // Check rows
        const columns = [card.B, card.I, card.N, card.G, card.O];
        for (let row = 0; row < 5; row++) {
            let rowComplete = true;
            for (let col = 0; col < 5; col++) {
                const number = columns[col][row];
                if (!markedWithFree.has(number)) {
                    rowComplete = false;
                    break;
                }
            }
            if (rowComplete) return true;
        }

        // Check columns
        for (const column of columns) {
            let colComplete = true;
            for (const number of column) {
                if (!markedWithFree.has(number)) {
                    colComplete = false;
                    break;
                }
            }
            if (colComplete) return true;
        }

        // Check diagonals
        const diagonal1 = [card.B[0], card.I[1], card.N[2], card.G[3], card.O[4]];
        const diagonal2 = [card.B[4], card.I[3], card.N[2], card.G[1], card.O[0]];

        const diagonal1Complete = diagonal1.every(num => markedWithFree.has(num));
        const diagonal2Complete = diagonal2.every(num => markedWithFree.has(num));

        return diagonal1Complete || diagonal2Complete;
    }

    public claimBingo(playerIndex: number): { success: boolean; isWinner: boolean; error?: string } {
        if (this.state.gamePhase !== 'MARKING') {
            return { success: false, isWinner: false, error: 'Not in marking phase' };
        }

        const isWinner = this.checkForWin(playerIndex);
        if (isWinner) {
            this.state.players[playerIndex].hasWon = true;
            this.state.winner = playerIndex;
            this.state.gamePhase = 'FINISHED';
            return { success: true, isWinner: true };
        }

        return { success: true, isWinner: false, error: 'No winning pattern found' };
    }

    public continueGame(): void {
        if (this.state.gamePhase === 'MARKING') {
            this.state.gamePhase = 'CALLING';
            this.state.currentPlayer = this.state.currentPlayer === 0 ? 1 : 0;
        }
    }

    public getCardNumbers(card: BingoCard): number[] {
        const allNumbers: number[] = [];
        allNumbers.push(...card.B, ...card.I, ...card.N, ...card.G, ...card.O);
        return allNumbers;
    }

    public getNumberColumn(number: number): string {
        if (number >= 1 && number <= 15) return 'B';
        if (number >= 16 && number <= 30) return 'I';
        if (number >= 31 && number <= 45) return 'N';
        if (number >= 46 && number <= 60) return 'G';
        if (number >= 61 && number <= 75) return 'O';
        return '';
    }
}