import express from 'express';
import env from './config/env';
import fileRouter from './routes/file.routes';
import logger from './config/logger';
import { metrics } from './config/metrics';
import { initS3 } from './repository/s3.repository';
import db from './db/knex';

const app = express();

const port = env.port;

app.use(express.json());
app.use('/files', fileRouter);
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.send(await metrics.register.metrics());
});

const startServer = async () => {
    try {
        // Run migrations on every boot — idempotent, safe to always run
        await db.migrate.latest();
        logger.info('Database migrations applied');

        await initS3();
        app.listen(port, () => {
            logger.info(`File service is running on port ${port}`);
        });
    } catch (error) {
        logger.error('Failed to start file service:', error);
        process.exit(1);
    }
};

startServer();