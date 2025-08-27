import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPayment extends Document {
    user: Types.ObjectId;
    orderId: string;
    paymentId?: string;
    withdrawalId?: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
    amount: number;
    currency: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    paymentUrl?: string;
    transactionId?: string;
    description: string;
    recipientDetails?: {
        cardNumber?: string;
        bankAccount?: string;
        walletAddress?: string;
        method?: 'card' | 'bank' | 'wallet';
    };
    webhookData?: any;
    errorMessage?: string;
    completedAt?: Date;
}

const paymentSchema = new Schema<IPayment>({
    user: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        index: true,
    },
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    paymentId: {
        type: String,
        sparse: true,
        index: true,
    },
    withdrawalId: {
        type: String,
        sparse: true,
        index: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['DEPOSIT', 'WITHDRAWAL'],
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        required: true,
        default: 'USD',
    },
    status: {
        type: String,
        required: true,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
        default: 'PENDING',
    },
    paymentUrl: {
        type: String,
    },
    transactionId: {
        type: String,
    },
    description: {
        type: String,
        required: true,
    },
    recipientDetails: {
        cardNumber: String,
        bankAccount: String,
        walletAddress: String,
        method: {
            type: String,
            enum: ['card', 'bank', 'wallet'],
        },
    },
    webhookData: {
        type: Schema.Types.Mixed,
    },
    errorMessage: {
        type: String,
    },
    completedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

// Indexes for better performance
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ type: 1, status: 1 });

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;