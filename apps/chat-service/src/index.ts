import express from 'express';
import { createServer } from 'http';
import { initSocketHandler } from './socket/socket.handler';
import { env } from './config/env';
import chatRouter from './routes/chat.routes';
const app = express();

app.use(express.json());
app.use('/chat', chatRouter)

const httpServer = createServer(app);
initSocketHandler(httpServer);
httpServer.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`);
})