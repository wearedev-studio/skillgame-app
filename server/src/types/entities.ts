export interface IGameRecord {
  _id: string;
  gameName: 'Checkers' | 'Chess' | 'Backgammon' | 'Tic-Tac-Toe' | 'Durak' | 'Domino' | 'Bingo' | 'Dice';
  status: 'WON' | 'LOST' | 'DRAW';
  amountChanged: number;
  opponent: string;
  createdAt: string;
}

export interface ITransaction {
  _id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'WAGER_LOSS' | 'WAGER_WIN';
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
  amount: number;
  createdAt: string;
}