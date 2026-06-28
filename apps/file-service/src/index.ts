import express from 'express';
import env from './config/env';
import fileRouter from './routes/file.routes';

const app = express();

const port = env.port;

app.use(express.json());
app.use('/files', fileRouter);

app.listen(port, () => {
    console.log(`File service is running on port ${port}`);
});