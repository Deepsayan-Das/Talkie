import { Server, Socket } from "socket.io";
import { createServer, Server as HttpServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
import * as ChatService from "../services/chat.service";
;

export const initSocketHandler = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }
    });
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token?.split(' ')[1];
            if (!token) return next(new Error("Unauthorized"));
            const payload = jwt.verify(token, process.env.JWT_SECRET!);
            socket.data.userId = (payload as JwtPayload).id;
            next();
        } catch {
            next(new Error("Unauthorized"));
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log(`Connection established at ${new Date()} socketId : ${socket.id}`);
        console.log('User connected : ' + socket.data.userId);

        socket.on('joinRoom', async (roomId: string) => {
            socket.join(roomId);  // joins the Socket.IO room channel
        });

        socket.on('leaveRoom', async (roomId: string) => {
            socket.leave(roomId);
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
                const message = await ChatService.sendMessage(
                    data.roomId,
                    socket.data.userId,
                    data.content,
                    data.attachments
                );
                io.to(data.roomId).emit('newMessage', message);
            } catch (err: any) {
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
                const updated = await ChatService.updateMessage(
                    data.roomId,
                    data.messageId,
                    socket.data.userId,
                    data.content
                );
                io.to(data.roomId).emit('messageEdited', updated);
            } catch (err: any) {
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
                await ChatService.deleteMessage(
                    data.roomId,
                    data.messageId,
                    socket.data.userId
                );
                io.to(data.roomId).emit('messageDeleted', { messageId: data.messageId });
            } catch (err: any) {
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
            } catch (err: any) {
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
            console.log(`Connection terminated at ${new Date()} socketId : ${socket.id}`);
            console.log('User disconnected : ' + socket.data.userId);
        });
    });
};