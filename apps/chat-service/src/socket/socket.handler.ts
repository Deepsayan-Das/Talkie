import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
import * as ChatService from "../services/chat.service";
import logger from "../config/logger";

export const initSocketHandler = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }
    });

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token?.split(' ')[1];
            if (!token) {
                logger.warn('Socket connection rejected — no token provided', { socketId: socket.id });
                return next(new Error("Unauthorized"));
            }
            const payload = jwt.verify(token, process.env.JWT_SECRET!);
            socket.data.userId = (payload as JwtPayload).id;
            next();
        } catch {
            logger.warn('Socket connection rejected — invalid or expired token', { socketId: socket.id });
            next(new Error("Unauthorized"));
        }
    });

    io.on('connection', (socket: Socket) => {
        logger.info('Socket connection established', { socketId: socket.id, userId: socket.data.userId });

        socket.on('joinRoom', async (roomId: string) => {
            socket.join(roomId);  // joins the Socket.IO room channel
            logger.info('User joined room', { socketId: socket.id, userId: socket.data.userId, roomId });
        });

        socket.on('leaveRoom', async (roomId: string) => {
            socket.leave(roomId);
            logger.info('User left room', { socketId: socket.id, userId: socket.data.userId, roomId });
        });

        // ── sendMessage ──────────────────────────────────────────────────────────
        // Client emits : { roomId, content, attachments? }
        // Server emits : 'newMessage' → entire room
        socket.on('sendMessage', async (data: {
            roomId: string;
            content: string;
            attachments?: { url: string; contentType: string; fileSize: number }[];
        }) => {
            try {
                logger.info('Sending message', { userId: socket.data.userId, roomId: data.roomId });
                const message = await ChatService.sendMessage(
                    data.roomId,
                    socket.data.userId,
                    data.content,
                    data.attachments
                );
                io.to(data.roomId).emit('newMessage', message);
                logger.info('Message sent successfully', { userId: socket.data.userId, roomId: data.roomId, messageId: message.id });
            } catch (err: any) {
                logger.error('sendMessage failed', { userId: socket.data.userId, roomId: data.roomId, error: err.message });
                socket.emit('error', { event: 'sendMessage', message: err.message });
            }
        });

        // ── editMessage ──────────────────────────────────────────────────────────
        // Client emits : { roomId, messageId, content }
        // Server emits : 'messageEdited' → entire room
        socket.on('editMessage', async (data: {
            roomId: string;
            messageId: string;
            content: string;
        }) => {
            try {
                logger.info('Editing message', { userId: socket.data.userId, roomId: data.roomId, messageId: data.messageId });
                const updated = await ChatService.updateMessage(
                    data.roomId,
                    data.messageId,
                    socket.data.userId,
                    data.content
                );
                io.to(data.roomId).emit('messageEdited', updated);
                logger.info('Message edited successfully', { userId: socket.data.userId, messageId: data.messageId });
            } catch (err: any) {
                logger.error('editMessage failed', { userId: socket.data.userId, messageId: data.messageId, error: err.message });
                socket.emit('error', { event: 'editMessage', message: err.message });
            }
        });

        // ── deleteMessage ────────────────────────────────────────────────────────
        // Client emits : { roomId, messageId }
        // Server emits : 'messageDeleted' → entire room  (soft-delete; isDeleted: true)
        socket.on('deleteMessage', async (data: {
            roomId: string;
            messageId: string;
        }) => {
            try {
                logger.info('Deleting message', { userId: socket.data.userId, roomId: data.roomId, messageId: data.messageId });
                await ChatService.deleteMessage(
                    data.roomId,
                    data.messageId,
                    socket.data.userId
                );
                io.to(data.roomId).emit('messageDeleted', { messageId: data.messageId });
                logger.info('Message deleted successfully', { userId: socket.data.userId, messageId: data.messageId });
            } catch (err: any) {
                logger.error('deleteMessage failed', { userId: socket.data.userId, messageId: data.messageId, error: err.message });
                socket.emit('error', { event: 'deleteMessage', message: err.message });
            }
        });

        // ── markAsSeen ───────────────────────────────────────────────────────────
        // Client emits : { roomId, messageId }
        // Server emits : 'messageSeen' → entire room  (so sender's UI can update read-receipts too)
        socket.on('markAsSeen', async (data: {
            roomId: string;
            messageId: string;
        }) => {
            try {
                await ChatService.markMessageAsSeen(
                    data.roomId,
                    data.messageId,
                    socket.data.userId
                );
                io.to(data.roomId).emit('messageSeen', {
                    messageId: data.messageId,
                    userId: socket.data.userId,
                    seenAt: new Date()
                });
                logger.info('Message marked as seen', { userId: socket.data.userId, messageId: data.messageId, roomId: data.roomId });
            } catch (err: any) {
                logger.error('markAsSeen failed', { userId: socket.data.userId, messageId: data.messageId, error: err.message });
                socket.emit('error', { event: 'markAsSeen', message: err.message });
            }
        });

        // ── typing ───────────────────────────────────────────────────────────────
        // Client emits : { roomId }
        // Server emits : 'userTyping' → everyone in room EXCEPT the sender
        socket.on('typing', (data: { roomId: string }) => {
            socket.to(data.roomId).emit('userTyping', { userId: socket.data.userId });
        });

        // ── stopTyping ───────────────────────────────────────────────────────────
        // Client emits : { roomId }
        // Server emits : 'userStoppedTyping' → everyone in room EXCEPT the sender
        socket.on('stopTyping', (data: { roomId: string }) => {
            socket.to(data.roomId).emit('userStoppedTyping', { userId: socket.data.userId });
        });

        socket.on('disconnect', () => {
            logger.info('Socket connection terminated', { socketId: socket.id, userId: socket.data.userId });
        });
    });
};