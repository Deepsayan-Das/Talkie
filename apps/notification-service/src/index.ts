import express from 'express';
import env from './config/env';
import { initializeTransporter } from './config/mailer';
import redis from './config/redis';
import { initAuthSubscriber } from './subscribers/auth.subscriber';
import logger from './config/logger';
import { metrics } from './config/metrics';

const bootstrap = async () => {
    // 1. Initialize mailer (creates Ethereal test account + transporter)
    await initializeTransporter();
    logger.info('[Mailer] Initialized');

    // 2. Connect Redis
    await redis.connect();
    logger.info('[Redis] Connected');

    // 3. Start subscriber (listens for auth events)
    await initAuthSubscriber();
    logger.info('[Subscriber] Auth subscriber ready');

    // 4. Start Express
    const app = express();
    app.use(express.json());

    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok', service: 'notification-service' });
    });
    app.get('/metrics', async (req, res) => {
        res.set('Content-Type', metrics.register.contentType);
        res.send(await metrics.register.metrics());
    });
    app.listen(env.port, () => {
        logger.info(`Notification service running on port ${env.port}`);
    });
};

bootstrap().catch((err) => {
    logger.error('Fatal error — notification service failed to start', { error: err.message });
    process.exit(1);
});
