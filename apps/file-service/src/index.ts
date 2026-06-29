import express from 'express';
import env from './config/env';
import fileRouter from './routes/file.routes';
import logger from './config/logger';
import { metrics } from './config/metrics';

const app = express();

const port = env.port;

app.use(express.json());
app.use('/files', fileRouter);
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.send(await metrics.register.metrics());
});

app.listen(port, () => {
    logger.info(`File service is running on port ${port}`);
});