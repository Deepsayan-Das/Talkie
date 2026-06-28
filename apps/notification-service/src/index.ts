import express from 'express';
import env from './config/env';
import { initializeTransporter } from './config/mailer';
import redis from './config/redis';
import { initAuthSubscriber } from './subscribers/auth.subscriber';

const bootstrap = async () => {
    // 1. Initialize mailer (creates Ethereal test account + transporter)
    await initializeTransporter();
    console.log('[Mailer] Initialized');

    // 2. Connect Redis
    await redis.connect();
    console.log('[Redis] Connected');

    // 3. Start subscriber (listens for auth events)
    await initAuthSubscriber();
    console.log('[Subscriber] Auth subscriber ready');

    // 4. Start Express
    const app = express();
    app.use(express.json());

    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok', service: 'notification-service' });
    });

    app.listen(env.port, () => {
        console.log(`[Server] Notification service running on port ${env.port}`);
    });
};

bootstrap().catch((err) => {
    console.error('[Fatal] Failed to start notification service:', err);
    process.exit(1);
});
