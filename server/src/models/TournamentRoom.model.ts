import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITournamentRoomPlayer {
    _id: string;
    username: string;
    isBot: boolean;
    socketId?: string;
}

export interface ITournamentRoom extends Document {
    _id: Types.ObjectId;
    tournamentId: Types.ObjectId;
    matchId: string;
    gameType: 'tic-tac-toe' | 'checkers' | 'chess' | 'backgammon' | 'durak' | 'domino' | 'dice' | 'bingo';
    players: ITournamentRoomPlayer[];
    gameState: any;
    status: 'WAITING' | 'ACTIVE' | 'FINISHED';
    winner?: ITournamentRoomPlayer;
    replayCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const tournamentRoomPlayerSchema = new Schema({
    _id: { type: String, required: true },
    username: { type: String, required: true },
    isBot: { type: Boolean, default: false },
    socketId: { type: String }
}, { _id: false });

const tournamentRoomSchema = new Schema<ITournamentRoom>({
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    matchId: { type: String, required: true, unique: true },
    gameType: {
        type: String,
        required: true,
        enum: ['tic-tac-toe', 'checkers', 'chess', 'backgammon', 'durak', 'domino', 'dice', 'bingo']
    },
    players: [tournamentRoomPlayerSchema],
    gameState: { type: Schema.Types.Mixed },
    status: {
        type: String,
        enum: ['WAITING', 'ACTIVE', 'FINISHED'],
        default: 'WAITING'
    },
    winner: tournamentRoomPlayerSchema,
    replayCount: { type: Number, default: 0 }
}, {
    timestamps: true
});

tournamentRoomSchema.index({ tournamentId: 1 });
tournamentRoomSchema.index({ status: 1 });

const TournamentRoom = mongoose.model<ITournamentRoom>('TournamentRoom', tournamentRoomSchema);

export default TournamentRoom;