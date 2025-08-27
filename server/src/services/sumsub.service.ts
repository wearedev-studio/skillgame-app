import crypto from 'crypto';
import axios from 'axios';
import sumsubConfig from '../config/sumsub.config';

export interface SumsubApplicant {
    id: string;
    externalUserId: string;
    inspectionId: string;
    email?: string;
    phone?: string;
    review?: {
        reviewStatus: 'init' | 'pending' | 'prechecked' | 'queued' | 'completed' | 'onHold';
        reviewResult?: {
            reviewAnswer: 'GREEN' | 'RED' | 'YELLOW';
        };
    };
    createdAt: string;
    updatedAt: string;
}

export interface SumsubAccessToken {
    token: string;
    userId: string;
}

export class SumsubService {
    private readonly baseUrl: string;
    private readonly appToken: string;
    private readonly secretKey: string;
    private readonly levelName: string;
    private readonly mockMode: boolean;

    constructor() {
        this.baseUrl = sumsubConfig.baseUrl;
        this.appToken = sumsubConfig.appToken;
        this.secretKey = sumsubConfig.secretKey;
        this.levelName = sumsubConfig.levelName;
        this.mockMode = process.env.SUMSUB_MOCK_MODE === 'true' || process.env.NODE_ENV === 'development';
        
        if (this.mockMode) {
            console.log('🧪 [SUMSUB] Running in MOCK mode for development');
        }
    }

    /**
     * Генерирует mock данные для локального тестирования
     */
    private generateMockApplicant(userId: string): SumsubApplicant {
        const mockId = `mock_${userId}_${Date.now()}`;
        return {
            id: mockId,
            externalUserId: userId,
            inspectionId: `insp_${mockId}`,
            email: 'test@example.com',
            phone: '+1234567890',
            review: {
                reviewStatus: 'init' as const,
                reviewResult: {
                    reviewAnswer: 'GREEN' as const
                }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Генерирует mock access token
     */
    private generateMockAccessToken(userId: string): SumsubAccessToken {
        return {
            token: `mock_token_${userId}_${Date.now()}`,
            userId: `mock_${userId}_${Date.now()}`
        };
    }

    /**
     * Создает подпись для запроса к Sumsub API
     */
    private createSignature(method: string, url: string, timestamp: number, body?: string): string {
        const requestData = timestamp + method.toUpperCase() + url + (body || '');
        return crypto
            .createHmac('sha256', this.secretKey)
            .update(requestData)
            .digest('hex');
    }

    /**
     * Создает заголовки для запроса к Sumsub API
     */
    private createHeaders(method: string, url: string, body?: string) {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = this.createSignature(method, url, timestamp, body);

        return {
            'X-App-Token': this.appToken,
            'X-App-Access-Ts': timestamp.toString(),
            'X-App-Access-Sig': signature,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Выполняет запрос к Sumsub API
     */
    private async makeRequest<T>(
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
        endpoint: string,
        data?: any
    ): Promise<T> {
        const url = endpoint;
        const body = data ? JSON.stringify(data) : undefined;
        const headers = this.createHeaders(method, url, body);

        try {
            const response = await axios({
                method,
                url: `${this.baseUrl}${url}`,
                headers,
                data: body
            });

            return response.data as T;
        } catch (error: any) {
            console.error('Sumsub API Error:', error.response?.data || error.message);
            throw new Error(`Sumsub API Error: ${error.response?.data?.description || error.message}`);
        }
    }

    /**
     * Создает нового аппликанта в Sumsub
     */
    async createApplicant(userId: string, userInfo: {
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
    }): Promise<SumsubApplicant> {
        if (this.mockMode) {
            console.log(`🧪 [SUMSUB MOCK] Creating applicant for user: ${userId}`);
            return this.generateMockApplicant(userId);
        }

        const applicantData = {
            externalUserId: userId,
            info: {
                firstName: userInfo.firstName || '',
                lastName: userInfo.lastName || '',
                ...(userInfo.email && { email: userInfo.email }),
                ...(userInfo.phone && { phone: userInfo.phone })
            }
        };

        return await this.makeRequest<SumsubApplicant>('POST', '/resources/applicants', applicantData);
    }

    /**
     * Получает информацию об аппликанте
     */
    async getApplicant(applicantId: string): Promise<SumsubApplicant> {
        if (this.mockMode) {
            console.log(`🧪 [SUMSUB MOCK] Getting applicant: ${applicantId}`);
            return this.generateMockApplicant(applicantId);
        }

        return await this.makeRequest<SumsubApplicant>('GET', `/resources/applicants/${applicantId}`);
    }

    /**
     * Получает аппликанта по внешнему ID пользователя
     */
    async getApplicantByExternalUserId(externalUserId: string): Promise<SumsubApplicant | null> {
        if (this.mockMode) {
            console.log(`🧪 [SUMSUB MOCK] Getting applicant by external user ID: ${externalUserId}`);
            return this.generateMockApplicant(externalUserId);
        }

        try {
            const response = await this.makeRequest<{ items: SumsubApplicant[] }>(
                'GET',
                `/resources/applicants?externalUserId=${externalUserId}`
            );
            return response.items.length > 0 ? response.items[0] : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Генерирует access token для WebSDK
     */
    async generateAccessToken(userId: string, levelName?: string): Promise<SumsubAccessToken> {
        if (this.mockMode) {
            console.log(`🧪 [SUMSUB MOCK] Generating access token for user: ${userId}`);
            return this.generateMockAccessToken(userId);
        }

        // Сначала пытаемся найти существующего аппликанта
        let applicant = await this.getApplicantByExternalUserId(userId);
        
        // Если не найден, создаем нового
        if (!applicant) {
            applicant = await this.createApplicant(userId, {});
        }

        const tokenData = {
            userId: applicant.id,
            levelName: levelName || this.levelName,
            ttlInSecs: 3600 // 1 час
        };

        const response = await this.makeRequest<{ token: string }>(
            'POST',
            '/resources/accessTokens',
            tokenData
        );

        return {
            token: response.token,
            userId: applicant.id
        };
    }

    /**
     * Получает статус верификации аппликанта
     */
    async getVerificationStatus(applicantId: string): Promise<{
        status: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
        reviewResult?: string;
        reviewRejectType?: string;
        moderationComment?: string;
    }> {
        if (this.mockMode) {
            console.log(`🧪 [SUMSUB MOCK] Getting verification status for: ${applicantId}`);
            return {
                status: 'APPROVED',
                reviewResult: 'GREEN'
            };
        }

        try {
            const applicant = await this.getApplicant(applicantId);
            
            if (!applicant.review) {
                return { status: 'NOT_STARTED' };
            }

            const { reviewStatus, reviewResult } = applicant.review;

            // Маппинг статусов Sumsub на наши статусы
            switch (reviewStatus) {
                case 'init':
                case 'pending':
                case 'prechecked':
                case 'queued':
                    return { status: 'PENDING' };
                case 'completed':
                    if (reviewResult?.reviewAnswer === 'GREEN') {
                        return { status: 'APPROVED' };
                    } else {
                        return {
                            status: 'REJECTED',
                            reviewResult: reviewResult?.reviewAnswer
                        };
                    }
                case 'onHold':
                    return { status: 'PENDING' };
                default:
                    return { status: 'NOT_STARTED' };
            }
        } catch (error) {
            console.error('Error getting verification status:', error);
            return { status: 'NOT_STARTED' };
        }
    }

    /**
     * Проверяет подпись вебхука от Sumsub
     */
    verifyWebhookSignature(payload: string, signature: string): boolean {
        try {
            const expectedSignature = crypto
                .createHmac('sha256', sumsubConfig.webhookSecret)
                .update(payload)
                .digest('hex');
            
            // Ensure both signatures are the same length
            if (signature.length !== expectedSignature.length) {
                return false;
            }
            
            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            console.error('Error verifying webhook signature:', error);
            return false;
        }
    }

    /**
     * Обрабатывает вебхук от Sumsub
     */
    async processWebhook(payload: any): Promise<{
        userId: string;
        status: string;
        reviewResult?: string;
        applicantId: string;
    }> {
        const { type, applicantId, externalUserId, reviewResult, reviewStatus } = payload;

        // Обрабатываем только события изменения статуса верификации
        if (type !== 'applicantReviewed' && type !== 'applicantPending') {
            throw new Error(`Unhandled webhook type: ${type}`);
        }

        let status = 'PENDING';
        
        if (type === 'applicantReviewed') {
            switch (reviewResult?.reviewAnswer) {
                case 'GREEN':
                    status = 'APPROVED';
                    break;
                case 'RED':
                    status = 'REJECTED';
                    break;
                default:
                    status = 'PENDING';
            }
        }

        return {
            userId: externalUserId,
            status,
            reviewResult: reviewResult?.reviewAnswer,
            applicantId
        };
    }
}

export const sumsubService = new SumsubService();