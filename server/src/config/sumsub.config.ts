import dotenv from 'dotenv';

dotenv.config();

export const sumsubConfig = {
    appToken: process.env.SUMSUB_APP_TOKEN!,
    secretKey: process.env.SUMSUB_SECRET_KEY!,
    baseUrl: process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com',
    levelName: process.env.SUMSUB_LEVEL_NAME || 'basic-kyc-level',
    webhookSecret: process.env.SUMSUB_WEBHOOK_SECRET!,
    sandboxMode: process.env.SUMSUB_SANDBOX_MODE === 'true'
};

// Validate required config
if (!sumsubConfig.appToken || !sumsubConfig.secretKey) {
    throw new Error('Sumsub configuration is missing required fields. Please check your environment variables.');
}

export default sumsubConfig;