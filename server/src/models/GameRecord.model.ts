import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IGameRecord extends Document {
    user: Types.ObjectId;
    gameName: 'Checkers' | 'Chess' | 'Backgammon' | 'Tic-Tac-Toe' | 'Durak' | 'Domino' | 'Bingo' | 'Dice';
    status: 'WON' | 'LOST' | 'DRAW';
    amountChanged: number;
    opponent: string;
}

const gameRecordSchema = new Schema<IGameRecord>({
    user: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        index: true,
    },
    gameName: {
        type: String,
        required: true,
        enum: ['Checkers', 'Chess', 'Backgammon', 'Tic-Tac-Toe', 'Durak', 'Domino', 'Bingo', 'Dice'],
    },
    status: {
        type: String,
        required: true,
        enum: ['WON', 'LOST', 'DRAW'],
    },
    amountChanged: {
        type: Number,
        required: true,
    },
    opponent: {
        type: String,
        required: true,
        default: 'Bot',
    },
}, {
    timestamps: true,
});

const GameRecord = mongoose.model<IGameRecord>('GameRecord', gameRecordSchema);

export default GameRecord;