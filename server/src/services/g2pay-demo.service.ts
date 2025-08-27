import crypto from 'crypto';
import axios from 'axios';
import Payment from '../models/Payment.model';
import User from '../models/User.model';
import Transaction from '../models/Transaction.model';
import { getIO } from '../socket';

interface G2PayConfig {
    apiKey: string;
    signingKey: string;
    baseUrl: string;
    webhookUrl: string;
    clientUrl: string;
}

interface CreatePaymentRequest {
    amount: number;
    currency: string;
    orderId: string;
    description: string;
    returnUrl: string;
    webhookUrl: string;
    customerEmail?: string;
}

interface CreatePaymentResponse {
    paymentId: string;
    paymentUrl: string;
    status: string;
    amount: number;
    currency: string;
    orderId: string;
}

interface PaymentStatus {
    paymentId: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    amount: number;
    currency: string;
    orderId: string;
    transactionId?: string;
}

interface WithdrawalRequest {
    amount: number;
    currency: string;
    orderId: string;
    description: string;
    recipientDetails: {
        cardNumber?: string;
        bankAccount?: string;
        walletAddress?: string;
        method: 'card' | 'bank' | 'wallet';
    };
}

interface WithdrawalResponse {
    withdrawalId: string;
    status: string;
    amount: number;
    currency: string;
    orderId: string;
}

class G2PayDemoService {
    private config: G2PayConfig;
    private payments: Map<string, any> = new Map();
    private withdrawals: Map<string, any> = new Map();

    constructor() {
        this.config = {
            apiKey: process.env.G2PAY_API_KEY || 'OdqNd5El16J8PtUMKJ8BwsvnzSrgNeFT',
            signingKey: process.env.G2PAY_SIGNING_KEY || 'XEQ9nZoD0Snl',
            baseUrl: process.env.G2PAY_BASE_URL || 'https://demo.g2pay.com',
            webhookUrl: process.env.G2PAY_WEBHOOK_URL || 'http://sklgmsapi.koltech.dev/api/payments/webhook',
            clientUrl: process.env.CLIENT_URL || 'https://platform.skillgame.pro'
        };
    }

    private generateSignature(data: any): string {
        const sortedKeys = Object.keys(data).sort();
        const signatureString = sortedKeys
            .map(key => `${key}=${data[key]}`)
            .join('&');
        
        return crypto
            .createHmac('sha256', this.config.signingKey)
            .update(signatureString)
            .digest('hex');
    }

    async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
        console.log('[G2Pay Demo] Creating payment:', request);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const paymentId = `demo_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const paymentUrl = `${this.config.clientUrl}/demo-payment?paymentId=${paymentId}&amount=${request.amount}&orderId=${request.orderId}`;
        
        const payment = {
            paymentId,
            paymentUrl,
            status: 'pending',
            amount: request.amount,
            currency: request.currency,
            orderId: request.orderId,
            description: request.description,
            returnUrl: request.returnUrl,
            webhookUrl: request.webhookUrl,
            customerEmail: request.customerEmail,
            createdAt: new Date().toISOString()
        };
        
        this.payments.set(paymentId, payment);
        
        // Simulate automatic completion after 10 seconds for demo
        setTimeout(() => {
            this.simulatePaymentCompletion(paymentId);
        }, 10000);

        return {
            paymentId,
            paymentUrl,
            status: 'pending',
            amount: request.amount,
            currency: request.currency,
            orderId: request.orderId
        };
    }

    async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
        console.log('[G2Pay Demo] Getting payment status:', paymentId);
        
        const payment = this.payments.get(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        return {
            paymentId: payment.paymentId,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            orderId: payment.orderId,
            transactionId: payment.transactionId
        };
    }

    async createWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResponse> {
        console.log('[G2Pay Demo] Creating withdrawal:', request);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const withdrawalId = `demo_withdrawal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const withdrawal = {
            withdrawalId,
            status: 'pending',
            amount: request.amount,
            currency: request.currency,
            orderId: request.orderId,
            description: request.description,
            recipientDetails: request.recipientDetails,
            createdAt: new Date().toISOString()
        };
        
        this.withdrawals.set(withdrawalId, withdrawal);

        return {
            withdrawalId,
            status: 'pending',
            amount: request.amount,
            currency: request.currency,
            orderId: request.orderId
        };
    }

    async getWithdrawalStatus(withdrawalId: string): Promise<PaymentStatus> {
        console.log('[G2Pay Demo] Getting withdrawal status:', withdrawalId);
        
        const withdrawal = this.withdrawals.get(withdrawalId);
        if (!withdrawal) {
            throw new Error('Withdrawal not found');
        }

        return {
            paymentId: withdrawal.withdrawalId,
            status: withdrawal.status,
            amount: withdrawal.amount,
            currency: withdrawal.currency,
            orderId: withdrawal.orderId,
            transactionId: withdrawal.transactionId
        };
    }

    verifyWebhookSignature(payload: string, signature: string): boolean {
        const expectedSignature = crypto
            .createHmac('sha256', this.config.signingKey)
            .update(payload)
            .digest('hex');
        
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

    private async simulatePaymentCompletion(paymentId: string) {
        const payment = this.payments.get(paymentId);
        if (!payment) return;

        // Simulate 90% success rate
        const isSuccess = Math.random() > 0.1;
        
        payment.status = isSuccess ? 'completed' : 'failed';
        payment.transactionId = `demo_tx_${Date.now()}`;
        payment.completedAt = new Date().toISOString();
        
        this.payments.set(paymentId, payment);
        
        console.log(`[G2Pay Demo] Payment ${paymentId} ${payment.status}`);
        
        // Direct balance update for demo mode
        if (isSuccess) {
            await this.updateUserBalanceDirectly(payment);
        }
        
        // Also simulate webhook call
        this.simulateWebhook(payment);
    }

    private async simulateWebhook(payment: any) {
        try {
            const webhookData = {
                event: 'payment.completed',
                payment_id: payment.paymentId,
                order_id: payment.orderId,
                status: 'completed', // Всегда отправляем 'completed' для успешных платежей
                amount: payment.amount,
                currency: payment.currency,
                transaction_id: payment.transactionId,
                timestamp: Date.now()
            };

            const signature = this.generateSignature(webhookData);
            
            console.log('[G2Pay Demo] Simulating webhook:', webhookData);
            
            // Actually call the webhook endpoint to update balance
            try {
                await axios.post(payment.webhookUrl, webhookData, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Signature': signature
                    }
                });
                console.log('[G2Pay Demo] Webhook sent successfully');
            } catch (webhookError: any) {
                console.error('[G2Pay Demo] Webhook call failed:', webhookError.message);
            }
            
        } catch (error) {
            console.error('[G2Pay Demo] Webhook simulation error:', error);
        }
    }

    // Demo method to manually complete a payment (for testing)
    async completePayment(paymentId: string, success: boolean = true) {
        const payment = this.payments.get(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        payment.status = success ? 'completed' : 'failed';
        payment.transactionId = `demo_tx_${Date.now()}`;
        payment.completedAt = new Date().toISOString();
        
        this.payments.set(paymentId, payment);
        
        // Simulate webhook
        this.simulateWebhook(payment);
        
        return payment;
    }

    // Direct balance update method for demo mode
    private async updateUserBalanceDirectly(payment: any) {
        try {
            console.log('[G2Pay Demo] Updating user balance directly:', {
                orderId: payment.orderId,
                amount: payment.amount
            });

            // Find payment record in database
            const paymentRecord = await Payment.findOne({ orderId: payment.orderId }).populate('user');
            if (!paymentRecord) {
                console.error('[G2Pay Demo] Payment record not found:', payment.orderId);
                return;
            }

            const user = paymentRecord.user as any;
            if (!user) {
                console.error('[G2Pay Demo] User not found for payment:', payment.orderId);
                return;
            }

            console.log('[G2Pay Demo] Current user balance:', user.balance);

            // Update payment status
            paymentRecord.status = 'COMPLETED';
            paymentRecord.transactionId = payment.transactionId;
            paymentRecord.completedAt = new Date();
            await paymentRecord.save();

            // Update user balance
            user.balance += paymentRecord.amount;
            await user.save();

            console.log('[G2Pay Demo] New user balance:', user.balance);

            // Create transaction record
            await Transaction.create({
                user: user._id,
                type: 'DEPOSIT',
                amount: paymentRecord.amount,
                status: 'COMPLETED'
            });

            console.log('[G2Pay Demo] Transaction record created');

            // Emit socket event
            const io = getIO();
            if (io) {
                const balanceUpdateData = {
                    userId: user._id.toString(),
                    newBalance: user.balance,
                    transaction: {
                        type: 'DEPOSIT',
                        amount: paymentRecord.amount,
                        status: 'COMPLETED',
                        createdAt: new Date()
                    }
                };
                
                console.log('[G2Pay Demo] Emitting balance update:', balanceUpdateData);
                io.emit('balanceUpdated', balanceUpdateData);
            } else {
                console.error('[G2Pay Demo] Socket.IO not available');
            }

            console.log('[G2Pay Demo] Balance update completed successfully');

        } catch (error) {
            console.error('[G2Pay Demo] Error updating user balance:', error);
        }
    }
}

export const g2payDemoService = new G2PayDemoService();
export { CreatePaymentRequest, CreatePaymentResponse, PaymentStatus, WithdrawalRequest, WithdrawalResponse };