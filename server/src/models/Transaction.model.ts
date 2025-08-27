import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITransaction extends Document {
    user: Types.ObjectId;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'WAGER_LOSS' | 'WAGER_WIN' | 'TOURNAMENT_FEE' | 'TOURNAMENT_WINNINGS';
    status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
    amount: number;
}

const transactionSchema = new Schema<ITransaction>({
    user: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        index: true,
    },
    type: {
        type: String,
        required: true,
        enum: [
        'DEPOSIT', 
        'WITHDRAWAL', 
        'WAGER_LOSS', 
        'WAGER_WIN', 
        'TOURNAMENT_FEE',
        'TOURNAMENT_WINNINGS'
    ],
    },
    status: {
        type: String,
        required: true,
        enum: ['COMPLETED', 'PENDING', 'CANCELLED'],
        default: 'COMPLETED',
    },
    amount: {
        type: Number,
        required: true,
    },
}, {
    timestamps: true,
});

const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;