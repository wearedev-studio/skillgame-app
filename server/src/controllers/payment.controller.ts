import { Request, Response } from 'express';
import { g2payService } from '../services/g2pay.service';
import { g2payDemoService } from '../services/g2pay-demo.service';
import Payment from '../models/Payment.model';
import Transaction from '../models/Transaction.model';
import User from '../models/User.model';
import { getIO } from '../socket';

// Use demo service for development/testing
const paymentService = process.env.NODE_ENV === 'production' ? g2payService : g2payDemoService;

export const createDeposit = async (req: Request, res: Response) => {
    try {
        const { amount } = req.body;
        const user = req.user!;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount provided' });
        }

        const orderId = `deposit_${user._id}_${Date.now()}`;
        const description = `Deposit $${amount} to gaming account`;

        // Create payment record in database
        const payment = await Payment.create({
            user: user._id,
            orderId,
            type: 'DEPOSIT',
            amount,
            currency: 'USD',
            status: 'PENDING',
            description
        });

        // Create payment with G2Pay
        const g2payPayment = await paymentService.createPayment({
            amount,
            currency: 'USD',
            orderId,
            description,
            returnUrl: `${process.env.CLIENT_URL || 'https://platform.skillgame.pro'}/profile?payment=success`,
            webhookUrl: `${process.env.G2PAY_WEBHOOK_URL || 'https://sklgmsapi.koltech.dev/api/payments/webhook'}`,
            customerEmail: user.email
        });

        // Update payment record with G2Pay data
        payment.paymentId = g2payPayment.paymentId;
        payment.paymentUrl = g2payPayment.paymentUrl;
        await payment.save();

        res.json({
            success: true,
            paymentId: g2payPayment.paymentId,
            paymentUrl: g2payPayment.paymentUrl,
            orderId,
            amount,
            currency: 'USD'
        });

    } catch (error: any) {
        console.error('[Payment] Create deposit error:', error);
        res.status(500).json({ 
            message: 'Failed to create deposit',
            error: error.message 
        });
    }
};

export const createWithdrawal = async (req: Request, res: Response) => {
    try {
        const { amount, recipientDetails } = req.body;
        const user = req.user!;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount provided' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ message: 'Insufficient funds for withdrawal' });
        }

        if (user.kycStatus !== 'APPROVED') {
            return res.status(400).json({ message: 'KYC verification required for withdrawals' });
        }

        if (!recipientDetails || !recipientDetails.method) {
            return res.status(400).json({ message: 'Recipient details are required' });
        }

        const orderId = `withdrawal_${user._id}_${Date.now()}`;
        const description = `Withdrawal $${amount} from gaming account`;

        // Create payment record in database
        const payment = await Payment.create({
            user: user._id,
            orderId,
            type: 'WITHDRAWAL',
            amount,
            currency: 'USD',
            status: 'PENDING',
            description,
            recipientDetails
        });

        // Create withdrawal with G2Pay
        const g2payWithdrawal = await paymentService.createWithdrawal({
            amount,
            currency: 'USD',
            orderId,
            description,
            recipientDetails
        });

        // Update payment record with G2Pay data
        payment.withdrawalId = g2payWithdrawal.withdrawalId;
        await payment.save();

        // Temporarily hold the funds (deduct from balance)
        user.balance -= amount;
        await user.save();

        // Create pending transaction
        await Transaction.create({
            user: user._id,
            type: 'WITHDRAWAL',
            amount,
            status: 'PENDING'
        });

        const io = getIO();
        if (io) {
            io.emit('balanceUpdated', {
                userId: (user._id as any).toString(),
                newBalance: user.balance,
                transaction: {
                    type: 'WITHDRAWAL',
                    amount,
                    status: 'PENDING',
                    createdAt: new Date()
                }
            });
        }

        res.json({
            success: true,
            withdrawalId: g2payWithdrawal.withdrawalId,
            orderId,
            amount,
            currency: 'USD',
            status: 'PENDING'
        });

    } catch (error: any) {
        console.error('[Payment] Create withdrawal error:', error);
        res.status(500).json({ 
            message: 'Failed to create withdrawal',
            error: error.message 
        });
    }
};

export const getPaymentStatus = async (req: Request, res: Response) => {
    try {
        const { paymentId } = req.params;
        const user = req.user!;

        const payment = await Payment.findOne({
            $or: [
                { paymentId },
                { withdrawalId: paymentId }
            ],
            user: user._id
        });

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Get status from G2Pay
        let g2payStatus;
        if (payment.type === 'DEPOSIT' && payment.paymentId) {
            g2payStatus = await paymentService.getPaymentStatus(payment.paymentId);
        } else if (payment.type === 'WITHDRAWAL' && payment.withdrawalId) {
            g2payStatus = await paymentService.getWithdrawalStatus(payment.withdrawalId);
        }

        if (g2payStatus && g2payStatus.status.toUpperCase() !== payment.status) {
            // Update payment status if changed
            payment.status = g2payStatus.status.toUpperCase() as any;
            payment.transactionId = g2payStatus.transactionId;
            
            if (g2payStatus.status === 'completed') {
                payment.completedAt = new Date();
            }
            
            await payment.save();
        }

        res.json({
            orderId: payment.orderId,
            paymentId: payment.paymentId || payment.withdrawalId,
            type: payment.type,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            createdAt: (payment as any).createdAt,
            completedAt: payment.completedAt
        });

    } catch (error: any) {
        console.error('[Payment] Get status error:', error);
        res.status(500).json({ 
            message: 'Failed to get payment status',
            error: error.message 
        });
    }
};

export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const signature = req.headers['x-signature'] as string;
        const payload = JSON.stringify(req.body);

        console.log('[Payment] Webhook received:', {
            headers: req.headers,
            body: req.body,
            signature,
            payload
        });

        // Verify webhook signature (skip for demo mode if no signature)
        if (signature && !paymentService.verifyWebhookSignature(payload, signature)) {
            console.error('[Payment] Invalid webhook signature');
            return res.status(401).json({ message: 'Invalid signature' });
        }

        const { order_id, payment_id, withdrawal_id, status, transaction_id } = req.body;

        console.log('[Payment] Processing webhook:', {
            orderId: order_id,
            paymentId: payment_id,
            withdrawalId: withdrawal_id,
            status,
            transactionId: transaction_id
        });

        // Find payment record
        const payment = await Payment.findOne({
            orderId: order_id
        }).populate('user');

        if (!payment) {
            console.error('[Payment] Payment not found for webhook:', order_id);
            return res.status(404).json({ message: 'Payment not found' });
        }

        const user = payment.user as any;

        // Update payment status
        payment.status = status.toUpperCase();
        payment.transactionId = transaction_id;
        payment.webhookData = req.body;

        if (status === 'completed') {
            payment.completedAt = new Date();

            if (payment.type === 'DEPOSIT') {
                console.log('[Payment] Processing deposit completion:', {
                    userId: user._id,
                    currentBalance: user.balance,
                    depositAmount: payment.amount,
                    newBalance: user.balance + payment.amount
                });

                // Add funds to user balance
                user.balance += payment.amount;
                await user.save();

                console.log('[Payment] User balance updated:', {
                    userId: user._id,
                    newBalance: user.balance
                });

                // Create completed transaction
                await Transaction.create({
                    user: user._id,
                    type: 'DEPOSIT',
                    amount: payment.amount,
                    status: 'COMPLETED'
                });

                console.log('[Payment] Transaction created');

                const io = getIO();
                if (io) {
                    const balanceUpdateData = {
                        userId: user._id.toString(),
                        newBalance: user.balance,
                        transaction: {
                            type: 'DEPOSIT',
                            amount: payment.amount,
                            status: 'COMPLETED',
                            createdAt: new Date()
                        }
                    };
                    
                    console.log('[Payment] Emitting balance update:', balanceUpdateData);
                    io.emit('balanceUpdated', balanceUpdateData);
                } else {
                    console.error('[Payment] Socket.IO not available');
                }
            } else if (payment.type === 'WITHDRAWAL') {
                // Update transaction status to completed
                await Transaction.updateOne(
                    { 
                        user: user._id,
                        type: 'WITHDRAWAL',
                        amount: payment.amount,
                        status: 'PENDING'
                    },
                    { status: 'COMPLETED' }
                );
            }
        } else if (status === 'failed' || status === 'cancelled') {
            if (payment.type === 'WITHDRAWAL') {
                // Return funds to user balance
                user.balance += payment.amount;
                await user.save();

                // Update transaction status
                await Transaction.updateOne(
                    { 
                        user: user._id,
                        type: 'WITHDRAWAL',
                        amount: payment.amount,
                        status: 'PENDING'
                    },
                    { status: 'CANCELLED' }
                );

                const io = getIO();
                if (io) {
                    io.emit('balanceUpdated', {
                        userId: user._id.toString(),
                        newBalance: user.balance,
                        transaction: {
                            type: 'WITHDRAWAL',
                            amount: payment.amount,
                            status: 'CANCELLED',
                            createdAt: new Date()
                        }
                    });
                }
            }
        }

        await payment.save();

        res.json({ success: true });

    } catch (error: any) {
        console.error('[Payment] Webhook error:', error);
        res.status(500).json({ 
            message: 'Webhook processing failed',
            error: error.message 
        });
    }
};

export const getUserPayments = async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const { page = 1, limit = 20, type } = req.query;

        const query: any = { user: user._id };
        if (type && ['DEPOSIT', 'WITHDRAWAL'].includes(type as string)) {
            query.type = type;
        }

        const payments = await Payment.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await Payment.countDocuments(query);

        res.json({
            payments: payments.map(payment => ({
                orderId: payment.orderId,
                paymentId: payment.paymentId || payment.withdrawalId,
                type: payment.type,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                description: payment.description,
                createdAt: (payment as any).createdAt,
                completedAt: payment.completedAt
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });

    } catch (error: any) {
        console.error('[Payment] Get user payments error:', error);
        res.status(500).json({ 
            message: 'Failed to get payments',
            error: error.message 
        });
    }
};