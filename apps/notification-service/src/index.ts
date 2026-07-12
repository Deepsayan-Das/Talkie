import express from 'express';
import env from './config/env';
import { initializeTransporter } from './config/mailer';
import redis from './config/redis';
import { initAuthSubscriber } from './subscribers/auth.subscriber';
import logger from './config/logger';
import { metrics } from './config/metrics';

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

const bootstrap = async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // 1. Initialize mailer (creates Ethereal test account + transporter)
            await initializeTransporter();
            logger.info('[Mailer] Initialized');

            // 2. Connect Redis
            await redis.connect();
            logger.info('[Redis] Connected');

            // 2.5 Initialize Broker
            const { initBroker } = await import('./config/broker');
            await initBroker();

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
            return; // success
        } catch (err: any) {
            logger.warn(`Startup attempt ${attempt}/${MAX_RETRIES} failed`, { error: err.message });
            // Disconnect Redis if it partially connected so we can retry clean
            try { await redis.disconnect(); } catch {}
            if (attempt === MAX_RETRIES) {
                logger.error('All startup attempts exhausted, shutting down');
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
};

bootstrap();
