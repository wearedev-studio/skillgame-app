import { Room } from "../socket";

export type GameMove = any;
export type GameState = any;

export interface IGameLogic {
  createInitialState(players: Room['players']): GameState;

  processMove(
    gameState: GameState, 
    move: GameMove, 
    playerId: string,
    players: Room['players']
  ): { 
      newState: GameState; 
      error?: string; 
      turnShouldSwitch: boolean;
  };

  checkGameEnd(
    gameState: GameState,
    players: Room['players']
  ): { isGameOver: boolean; winnerId?: string; isDraw: boolean };
  
  makeBotMove(
      gameState: GameState, 
      playerIndex: 0 | 1
  ): GameMove;
}
