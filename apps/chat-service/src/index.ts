import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { initSocketHandler } from './socket/socket.handler';
import { env } from './config/env';
import chatRouter from './routes/chat.routes';
import storyRouter from './routes/story.routes';
import logger from './config/logger';
import { metrics } from './config/metrics';
import { initBroker } from './config/broker';
const app = express();

app.use(express.json());
app.use('/chat', chatRouter)
app.use('/stories', storyRouter)
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.send(await metrics.register.metrics());
});

const httpServer = createServer(app);
initSocketHandler(httpServer);

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

const startup = async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose.connect(env.mongoUri);
            logger.info('Connected to MongoDB');
            const redis = (await import('./config/redis')).default;
            await redis.connect();
            logger.info('Connected to Redis');
            await initBroker();
            httpServer.listen(env.port, () => {
                logger.info(`Chat service is running on port ${env.port}`);
            });
            return;
        } catch (err: any) {
            logger.warn(`MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed`, { error: err.message });
            if (attempt === MAX_RETRIES) {
                logger.error('All MongoDB connection attempts exhausted, shutting down');
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
};

startup();