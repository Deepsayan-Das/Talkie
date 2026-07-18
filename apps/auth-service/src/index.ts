import express from 'express';
import env from './config/env';
import db from './db/knex';
import authRouter from './routes/auth.routes'
import cookieParser from 'cookie-parser';
import logger from './config/logger';
import { metrics } from './config/metrics';

const app = express();


app.use(express.json());
app.use(cookieParser());
app.use('/api/v1/auth', authRouter);
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.send(await metrics.register.metrics());
});

const startup = async () => {
    const MAX_RETRIES = 10;
    const RETRY_DELAY_MS = 5000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await db.raw('SELECT 1');
            logger.info('Database connection established');
            
            const { initBroker } = await import('./config/broker');
            // Broker failure is non-fatal — auth.service.ts has a Redis fallback
            await initBroker().catch((err: Error) => {
                logger.warn('Message broker unavailable, falling back to Redis pub/sub', { error: err.message });
            });

            app.listen(env.port, () => {
                logger.info(`Auth service is running on port ${env.port}`);
            });
            return; // success — exit the retry loop
        } catch (err) {
            logger.warn(`Database connection attempt ${attempt}/${MAX_RETRIES} failed`, {
                error: (err as Error).message
            });
            if (attempt === MAX_RETRIES) {
                logger.error('All database connection attempts exhausted, shutting down');
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
};

startup();