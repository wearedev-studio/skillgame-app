import axios from 'axios';
import crypto from 'crypto';

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

class G2PayService {
    private config: G2PayConfig;

    constructor() {
        this.config = {
            apiKey: process.env.G2PAY_API_KEY || 'OdqNd5El16J8PtUMKJ8BwsvnzSrgNeFT',
            signingKey: process.env.G2PAY_SIGNING_KEY || 'XEQ9nZoD0Snl',
            baseUrl: process.env.G2PAY_BASE_URL || 'https://api.g2pay.com',
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

    private async makeRequest(endpoint: string, method: 'GET' | 'POST', data?: any) {
        const url = `${this.config.baseUrl}${endpoint}`;
        const timestamp = Date.now().toString();
        
        const requestData = {
            ...data,
            timestamp,
            apiKey: this.config.apiKey
        };

        const signature = this.generateSignature(requestData);

        try {
            const response = await axios({
                method,
                url,
                data: method === 'POST' ? requestData : undefined,
                params: method === 'GET' ? requestData : undefined,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Signature': signature,
                    'X-API-Key': this.config.apiKey
                },
                timeout: 30000
            });

            return response.data;
        } catch (error: any) {
            console.error('[G2Pay] API Error:', {
                endpoint,
                method,
                error: error.response?.data || error.message,
                status: error.response?.status
            });
            
            throw new Error(
                error.response?.data?.message || 
                error.response?.data?.error || 
                'Payment gateway error'
            );
        }
    }

    async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
        console.log('[G2Pay] Creating payment:', request);
        
        const response = await this.makeRequest('/payments', 'POST', {
            amount: request.amount,
            currency: request.currency,
            order_id: request.orderId,
            description: request.description,
            return_url: request.returnUrl,
            webhook_url: request.webhookUrl,
            customer_email: request.customerEmail
        });

        return {
            paymentId: response.payment_id,
            paymentUrl: response.payment_url,
            status: response.status,
            amount: response.amount,
            currency: response.currency,
            orderId: response.order_id
        };
    }

    async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
        console.log('[G2Pay] Getting payment status:', paymentId);
        
        const response = await this.makeRequest(`/payments/${paymentId}`, 'GET');

        return {
            paymentId: response.payment_id,
            status: response.status,
            amount: response.amount,
            currency: response.currency,
            orderId: response.order_id,
            transactionId: response.transaction_id
        };
    }

    async createWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResponse> {
        console.log('[G2Pay] Creating withdrawal:', request);
        
        const response = await this.makeRequest('/withdrawals', 'POST', {
            amount: request.amount,
            currency: request.currency,
            order_id: request.orderId,
            description: request.description,
            recipient_details: {
                card_number: request.recipientDetails.cardNumber,
                bank_account: request.recipientDetails.bankAccount,
                wallet_address: request.recipientDetails.walletAddress,
                method: request.recipientDetails.method
            }
        });

        return {
            withdrawalId: response.withdrawal_id,
            status: response.status,
            amount: response.amount,
            currency: response.currency,
            orderId: response.order_id
        };
    }

    async getWithdrawalStatus(withdrawalId: string): Promise<PaymentStatus> {
        console.log('[G2Pay] Getting withdrawal status:', withdrawalId);
        
        const response = await this.makeRequest(`/withdrawals/${withdrawalId}`, 'GET');

        return {
            paymentId: response.withdrawal_id,
            status: response.status,
            amount: response.amount,
            currency: response.currency,
            orderId: response.order_id,
            transactionId: response.transaction_id
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
}

export const g2payService = new G2PayService();
export { CreatePaymentRequest, CreatePaymentResponse, PaymentStatus, WithdrawalRequest, WithdrawalResponse };