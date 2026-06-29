import express from 'express';
import env from './config/env';
import fileRouter from './routes/file.routes';
import logger from './config/logger';

const app = express();

const port = env.port;

app.use(express.json());
app.use('/files', fileRouter);

app.listen(port, () => {
    logger.info(`File service is running on port ${port}`);
});