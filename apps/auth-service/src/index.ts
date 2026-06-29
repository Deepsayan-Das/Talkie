import express from 'express';
import env from './config/env';
import db from './db/knex';
import authRouter from './routes/auth.routes'
import cookieParser from 'cookie-parser';
import logger from './config/logger';

const app = express();


app.use(express.json());
app.use(cookieParser());
app.use('/api/v1/auth', authRouter);

const startup = async () => {
    try {
        await db.raw('SELECT 1')
        logger.info('Database connection established');
        app.listen(env.port, () => {
            logger.info(`Auth service is running on port ${env.port}`);
        })
    } catch (err) {
        logger.error('Database connection failed', { error: (err as Error).message });
        process.exit(1);
    }



}

startup();