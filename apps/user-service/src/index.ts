import express from 'express'
import env from './config/env'
import db from './db/knex'
import router from './routes/user.routes'
import logger from './config/logger'
import { metrics } from './config/metrics'
import { initBroker } from './config/broker'
import { initChatSubscriber } from './subscribers/chat.subscriber'
const app = express()

app.use(express.json())



// TODO: mount user router
app.use('/api/v1/user', router)
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.send(await metrics.register.metrics());
});

export const TALKIE_BOT_ID = '00000000-0000-0000-0000-000000000001';

const ensureTalkieBotProfile = async () => {
    try {
        const bot = await db('users_profile').where({ user_id: TALKIE_BOT_ID }).first();
        if (!bot) {
            await db('users_profile').insert({
                user_id: TALKIE_BOT_ID,
                username: 'TalkieBot',
                bio: 'Official Talkie AI Assistant. Tag @TalkieBot in group chats or DM me anytime!',
                avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=TalkieBot',
            });
            logger.info('TalkieBot profile seeded successfully');
        }
    } catch (err: any) {
        logger.warn('Failed to seed TalkieBot profile', { error: err.message });
    }
};

const startup = async () => {
    const MAX_RETRIES = 10;
    const RETRY_DELAY_MS = 5000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await db.raw('SELECT 1')
            logger.info('Database connection established')
            await ensureTalkieBotProfile();
            const redis = (await import('./config/redis')).default;
            await redis.connect();
            logger.info('Redis connection established')
            await initBroker();
            await initChatSubscriber();
            app.listen(env.port, () => {
                logger.info(`User service is running on port ${env.port}`)
            })
            return; // success — exit the retry loop
        } catch (err) {
            logger.warn(`Database connection attempt ${attempt}/${MAX_RETRIES} failed`, {
                error: (err as Error).message
            })
            if (attempt === MAX_RETRIES) {
                logger.error('All database connection attempts exhausted, shutting down')
                process.exit(1)
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
        }
    }
}

startup()
