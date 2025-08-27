export type PlayerColor = 'white' | 'black';

export interface BackgammonPiece {
    color: PlayerColor;
}

export interface Point {
    pieces: BackgammonPiece[];
}

export interface BackgammonMove {
    from: number;
    to: number;
    piece: BackgammonPiece;
}

export interface DiceRoll {
    dice: [number, number];
    availableMoves: number[];
}

export class BackgammonEngine {
    private board: Point[];
    private bar: { white: BackgammonPiece[]; black: BackgammonPiece[] };
    private home: { white: BackgammonPiece[]; black: BackgammonPiece[] };
    private currentPlayer: PlayerColor;
    private diceRoll: DiceRoll | null;
    private moveHistory: BackgammonMove[];

    constructor() {
        this.board = this.createInitialBoard();
        this.bar = { white: [], black: [] };
        this.home = { white: [], black: [] };
        this.currentPlayer = 'white';
        this.diceRoll = null;
        this.moveHistory = [];
    }

    private createInitialBoard(): Point[] {
        const board: Point[] = Array(24).fill(null).map(() => ({ pieces: [] }));

        // Standard backgammon setup
        // White pieces (moving from low numbers to high numbers: 0->23)
        for (let i = 0; i < 2; i++) {
            board[0].pieces.push({ color: 'white' });
        }
        for (let i = 0; i < 5; i++) {
            board[11].pieces.push({ color: 'white' });
        }
        for (let i = 0; i < 3; i++) {
            board[16].pieces.push({ color: 'white' });
        }
        for (let i = 0; i < 5; i++) {
            board[18].pieces.push({ color: 'white' });
        }

        // Black pieces (moving from high numbers to low numbers: 23->0)
        for (let i = 0; i < 2; i++) {
            board[23].pieces.push({ color: 'black' });
        }
        for (let i = 0; i < 5; i++) {
            board[12].pieces.push({ color: 'black' });
        }
        for (let i = 0; i < 3; i++) {
            board[7].pieces.push({ color: 'black' });
        }
        for (let i = 0; i < 5; i++) {
            board[5].pieces.push({ color: 'black' });
        }

        return board;
    }

    public getBoard(): Point[] {
        return this.board.map(point => ({
            pieces: [...point.pieces]
        }));
    }

    public getBar(): { white: BackgammonPiece[]; black: BackgammonPiece[] } {
        return {
            white: [...this.bar.white],
            black: [...this.bar.black]
        };
    }

    public getHome(): { white: BackgammonPiece[]; black: BackgammonPiece[] } {
        return {
            white: [...this.home.white],
            black: [...this.home.black]
        };
    }

    public getCurrentPlayer(): PlayerColor {
        return this.currentPlayer;
    }

    public getDiceRoll(): DiceRoll | null {
        return this.diceRoll ? {
            dice: [...this.diceRoll.dice],
            availableMoves: [...this.diceRoll.availableMoves]
        } : null;
    }

    public getMoveHistory(): BackgammonMove[] {
        return [...this.moveHistory];
    }

    public rollDice(): DiceRoll {
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        
        let availableMoves: number[];
        if (die1 === die2) {
            availableMoves = [die1, die1, die1, die1];
        } else {
            availableMoves = [die1, die2];
        }

        this.diceRoll = {
            dice: [die1, die2],
            availableMoves
        };

        return this.getDiceRoll()!;
    }

    private areAllPiecesInHome(color: PlayerColor): boolean {
        const homeRange = color === 'white' ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
        
        if (this.bar[color].length > 0) return false;

        let piecesOnBoard = 0;
        for (let i = 0; i < 24; i++) {
            const piecesOfColor = this.board[i].pieces.filter(p => p.color === color).length;
            if (piecesOfColor > 0) {
                if (!homeRange.includes(i)) return false;
                piecesOnBoard += piecesOfColor;
            }
        }

        return piecesOnBoard + this.home[color].length === 15;
    }

    private getMoveDirection(color: PlayerColor): number {
        return color === 'white' ? 1 : -1;
    }

    public canMakeMove(from: number, to: number, dieValue: number): boolean {
        if (!this.diceRoll || !this.diceRoll.availableMoves.includes(dieValue)) {
            return false;
        }

        if (from === -1) {
            if (this.bar[this.currentPlayer].length === 0) return false;
            
            const targetPoint = this.currentPlayer === 'white' ? dieValue - 1 : 24 - dieValue;
            if (to !== targetPoint) return false;
            
            return this.canPlacePieceOnPoint(to);
        }

        if (from < 0 || from >= 24) return false;
        if (this.board[from].pieces.length === 0) return false;
        if (this.board[from].pieces[this.board[from].pieces.length - 1].color !== this.currentPlayer) return false;

        if (this.bar[this.currentPlayer].length > 0) return false;

        const direction = this.getMoveDirection(this.currentPlayer);
        const expectedTo = from + (dieValue * direction);

        if (to === -2) {
            if (!this.areAllPiecesInHome(this.currentPlayer)) return false;
            
            const homeRange = this.currentPlayer === 'white' ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
            if (!homeRange.includes(from)) return false;
            
            if (expectedTo === (this.currentPlayer === 'white' ? 24 : -1)) return true;
            
            if (this.currentPlayer === 'white' && expectedTo > 23) {
                return this.isHighestPieceInHome(from, this.currentPlayer);
            } else if (this.currentPlayer === 'black' && expectedTo < 0) {
                return this.isHighestPieceInHome(from, this.currentPlayer);
            }
            
            return false;
        }

        if (to !== expectedTo) return false;
        if (to < 0 || to >= 24) return false;

        return this.canPlacePieceOnPoint(to);
    }

    private canPlacePieceOnPoint(pointIndex: number): boolean {
        if (pointIndex < 0 || pointIndex >= 24) return false;
        
        const point = this.board[pointIndex];
        if (point.pieces.length === 0) return true;
        if (point.pieces[0].color === this.currentPlayer) return true;
        if (point.pieces.length === 1) return true;
        
        return false;
    }

    private isHighestPieceInHome(from: number, color: PlayerColor): boolean {
        const homeRange = color === 'white' ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
        
        for (const pointIndex of homeRange) {
            if (color === 'white' && pointIndex > from) {
                if (this.board[pointIndex].pieces.some(p => p.color === color)) {
                    return false;
                }
            } else if (color === 'black' && pointIndex < from) {
                if (this.board[pointIndex].pieces.some(p => p.color === color)) {
                    return false;
                }
            }
        }
        
        return true;
    }

    public makeMove(from: number, to: number, dieValue: number): boolean {
        if (!this.canMakeMove(from, to, dieValue)) {
            return false;
        }

        let piece: BackgammonPiece;

        if (from === -1) {
            piece = this.bar[this.currentPlayer].pop()!;
        } else {
            piece = this.board[from].pieces.pop()!;
        }

        if (to === -2) {
            this.home[this.currentPlayer].push(piece);
        } else {
            if (this.board[to].pieces.length === 1 && 
                this.board[to].pieces[0].color !== this.currentPlayer) {
                const hitPiece = this.board[to].pieces.pop()!;
                this.bar[hitPiece.color].push(hitPiece);
            }
            
            this.board[to].pieces.push(piece);
        }

        const moveIndex = this.diceRoll!.availableMoves.indexOf(dieValue);
        this.diceRoll!.availableMoves.splice(moveIndex, 1);

        this.moveHistory.push({ from, to, piece });

        return true;
    }

    public getPossibleMoves(): Array<{ from: number; to: number; dieValue: number }> {
        if (!this.diceRoll) return [];

        const moves: Array<{ from: number; to: number; dieValue: number }> = [];

        if (this.bar[this.currentPlayer].length > 0) {
            for (const dieValue of this.diceRoll.availableMoves) {
                const to = this.currentPlayer === 'white' ? dieValue - 1 : 24 - dieValue;
                if (this.canMakeMove(-1, to, dieValue)) {
                    moves.push({ from: -1, to, dieValue });
                }
            }
            return moves;
        }

        for (let from = 0; from < 24; from++) {
            if (this.board[from].pieces.length === 0) continue;
            if (this.board[from].pieces[this.board[from].pieces.length - 1].color !== this.currentPlayer) continue;

            for (const dieValue of this.diceRoll.availableMoves) {
                const direction = this.getMoveDirection(this.currentPlayer);
                const to = from + (dieValue * direction);

                if (this.canMakeMove(from, to, dieValue)) {
                    moves.push({ from, to, dieValue });
                }

                if (this.areAllPiecesInHome(this.currentPlayer) && this.canMakeMove(from, -2, dieValue)) {
                    moves.push({ from, to: -2, dieValue });
                }
            }
        }

        return moves;
    }

    public isGameOver(): { isGameOver: boolean; winner?: PlayerColor } {
        if (this.home.white.length === 15) {
            return { isGameOver: true, winner: 'white' };
        }
        if (this.home.black.length === 15) {
            return { isGameOver: true, winner: 'black' };
        }
        return { isGameOver: false };
    }

    public switchPlayer(): void {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.diceRoll = null;
    }

    public hasAvailableMoves(): boolean {
        return this.getPossibleMoves().length > 0;
    }

    public skipTurn(): void {
        this.diceRoll = null;
    }

    public getGameState() {
        return {
            board: this.getBoard(),
            bar: this.getBar(),
            home: this.getHome(),
            currentPlayer: this.getCurrentPlayer(),
            diceRoll: this.getDiceRoll(),
            moveHistory: this.getMoveHistory()
        };
    }

    public restoreGameState(state: any): void {
        this.board = state.board.map((point: any) => ({
            pieces: point.pieces.map((piece: any) => ({ color: piece.color }))
        }));
        this.bar = {
            white: state.bar.white.map((piece: any) => ({ color: piece.color })),
            black: state.bar.black.map((piece: any) => ({ color: piece.color }))
        };
        this.home = {
            white: state.home.white.map((piece: any) => ({ color: piece.color })),
            black: state.home.black.map((piece: any) => ({ color: piece.color }))
        };
        this.currentPlayer = state.currentPlayer;
        this.diceRoll = state.diceRoll;
        this.moveHistory = state.moveHistory || [];
    }
}