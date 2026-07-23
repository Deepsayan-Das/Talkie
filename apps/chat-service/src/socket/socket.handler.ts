import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
import * as ChatService from "../services/chat.service";
import { processTalkieBotMessage } from "../services/talkiebot.service";
import logger from "../config/logger";
import redis from "../config/redis";
import { broker } from "../config/broker";

// Minimal WebRTC types for the signaling server
interface RTCSessionDescriptionInit {
    type: "offer" | "answer" | "pranswer" | "rollback";
    sdp?: string;
}

interface RTCIceCandidateInit {
    candidate?: string;
    sdpMLineIndex?: number | null;
    sdpMid?: string | null;
    usernameFragment?: string | null;
}

export const initSocketHandler = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }
    });

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token?.split(' ')[1];
            const deviceId = socket.handshake.auth.deviceId;

            if (!token) {
                logger.warn('Socket connection rejected — no token provided', { socketId: socket.id });
                return next(new Error("Unauthorized"));
            }
            if (!deviceId) {
                logger.warn('Socket connection rejected — no deviceId provided', { socketId: socket.id });
                return next(new Error("Unauthorized: Missing deviceId"));
            }

            const payload = jwt.verify(token, process.env.JWT_SECRET!);
            socket.data.userId = (payload as JwtPayload).userId || (payload as JwtPayload).id;
            socket.data.deviceId = deviceId;
            next();
        } catch {
            logger.warn('Socket connection rejected — invalid or expired token', { socketId: socket.id });
            next(new Error("Unauthorized"));
        }
    });

    io.on('connection', async (socket: Socket) => {
        socket.join(`user:${socket.data.userId}`);

        const presenceKey = `presence:${socket.data.userId}`;
        const deviceSocketsKey = `device-sockets:${socket.data.userId}:${socket.data.deviceId}`;

        await redis.sadd(presenceKey, socket.data.deviceId);
        await redis.sadd(deviceSocketsKey, socket.id);

        // TTL safety net: if the server crashes without running disconnect
        // handlers, these keys self-expire instead of permanently showing online
        await redis.expire(presenceKey, 86400);        // 24 hours
        await redis.expire(deviceSocketsKey, 86400);

        logger.info('Socket connection established', { socketId: socket.id, userId: socket.data.userId, deviceId: socket.data.deviceId });

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
            content?: string;
            deviceCiphertexts?: Record<string, any>;
            attachments?: { url: string; contentType: string; fileSize: number }[];
            replyTo?: string;
            forwardedFrom?: { originalSenderId: string; originalRoomId: string; originalMessageId: string; originalTimestamp: Date };
        }) => {
            try {
                logger.info('Sending message', { userId: socket.data.userId, roomId: data.roomId });
                const message = await ChatService.sendMessage(
                    data.roomId,
                    socket.data.userId,
                    socket.data.deviceId,
                    data.content,
                    data.deviceCiphertexts,
                    data.attachments,
                    data.replyTo,
                    data.forwardedFrom
                );
                io.to(data.roomId).emit('newMessage', message);
                logger.info('Message sent successfully', { userId: socket.data.userId, roomId: data.roomId, messageId: message.id });

                // Asynchronously trigger TalkieBot processing
                (async () => {
                    try {
                        const room = await ChatService.getRoomById(data.roomId);
                        await processTalkieBotMessage(io, message, room);
                    } catch (botErr: any) {
                        logger.error('Error invoking TalkieBot processor', { error: botErr.message });
                    }
                })();
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
                if (data.messageId.startsWith('sys-') || data.messageId.startsWith('local-')) return;
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

        // ── messageDelivered ─────────────────────────────────────────────────────
        socket.on('messageDelivered', async (data: {
            roomId: string;
            messageId: string;
        }) => {
            try {
                if (data.messageId.startsWith('sys-') || data.messageId.startsWith('local-')) return;
                const updated = await ChatService.messageDelivered(
                    data.roomId,
                    data.messageId,
                    socket.data.userId,
                    socket.data.deviceId
                );
                if (updated) {
                    io.to(data.roomId).emit('messageStatusUpdated', updated);
                    logger.info('Message delivered successfully', { userId: socket.data.userId, messageId: data.messageId, deviceId: socket.data.deviceId });
                }
            } catch (err: any) {
                logger.error('messageDelivered failed', { userId: socket.data.userId, messageId: data.messageId, error: err.message });
                socket.emit('error', { event: 'messageDelivered', message: err.message });
            }
        });

        // ── reactToMessage ───────────────────────────────────────────────────────
        const emitSystemMessage = (roomId: string, content: string) => {
            const systemMsg = {
                _id: 'sys-' + Date.now() + Math.floor(Math.random() * 1000),
                roomId,
                senderId: 'system',
                content,
                seenBy: [],
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            io.to(roomId).emit('newMessage', systemMsg);
        };

        socket.on('reactToMessage', async (data: {
            roomId: string;
            messageId: string;
            reaction: string;
        }) => {
            try {
                logger.info('Reacting to message', { userId: socket.data.userId, roomId: data.roomId, messageId: data.messageId, reaction: data.reaction });
                const updated = await ChatService.reactToMessage(
                    data.roomId,
                    data.messageId,
                    socket.data.userId,
                    data.reaction
                );
                io.to(data.roomId).emit('messageReacted', updated);
                logger.info('Message reacted successfully', { userId: socket.data.userId, messageId: data.messageId });
            } catch (err: any) {
                logger.error('reactToMessage failed', { userId: socket.data.userId, messageId: data.messageId, error: err.message });
                socket.emit('error', { event: 'reactToMessage', message: err.message });
            }
        });

        // ── Slash Commands ─────────────────────────────────────────────────────────
        socket.on('voteOnPoll', async (data: { roomId: string; messageId: string; optionId: string }) => {
            try {
                const updated = await ChatService.voteOnPoll(data.roomId, data.messageId, socket.data.userId, data.optionId);
                io.to(data.roomId).emit('pollVoteUpdated', updated);
            } catch (err: any) {
                socket.emit('error', { event: 'voteOnPoll', message: err.message });
            }
        });

        socket.on('muteMember', async (data: { roomId: string; memberId: string; durationMs: number }) => {
            try {
                const updated = await ChatService.muteMember(data.roomId, socket.data.userId, data.memberId, data.durationMs);
                io.to(data.roomId).emit('roomUpdated', updated);
                const mins = Math.round(data.durationMs / 60000);
                emitSystemMessage(data.roomId, `An admin muted a member for ${mins} minutes.`);
            } catch (err: any) {
                socket.emit('error', { event: 'muteMember', message: err.message });
            }
        });

        socket.on('unmuteMember', async (data: { roomId: string; memberId: string }) => {
            try {
                const updated = await ChatService.unmuteMember(data.roomId, socket.data.userId, data.memberId);
                io.to(data.roomId).emit('roomUpdated', updated);
                emitSystemMessage(data.roomId, `An admin unmuted a member.`);
            } catch (err: any) {
                socket.emit('error', { event: 'unmuteMember', message: err.message });
            }
        });

        socket.on('broadcastSystemMessage', (data: { roomId: string; content: string }) => {
            try {
                // Anyone in the room can broadcast a system message (used for slash commands)
                emitSystemMessage(data.roomId, data.content);
            } catch (err: any) {
                socket.emit('error', { event: 'broadcastSystemMessage', message: err.message });
            }
        });

        socket.on('createRequest', async (data: { roomId: string; type: string; targetUserId: string; reason: string }) => {
            try {
                const updated = await ChatService.createRequest(data.roomId, socket.data.userId, data.type, data.targetUserId, data.reason);
                io.to(data.roomId).emit('roomUpdated', updated);
                emitSystemMessage(data.roomId, `A new ${data.type} request was created.`);
            } catch (err: any) {
                socket.emit('error', { event: 'createRequest', message: err.message });
            }
        });

        socket.on('approveRequest', async (data: { roomId: string; requestId: string }) => {
            try {
                const updated = await ChatService.approveRequest(data.roomId, socket.data.userId, data.requestId);
                io.to(data.roomId).emit('roomUpdated', updated);
            } catch (err: any) {
                socket.emit('error', { event: 'approveRequest', message: err.message });
            }
        });

        socket.on('denyRequest', async (data: { roomId: string; requestId: string }) => {
            try {
                const updated = await ChatService.denyRequest(data.roomId, socket.data.userId, data.requestId);
                io.to(data.roomId).emit('roomUpdated', updated);
            } catch (err: any) {
                socket.emit('error', { event: 'denyRequest', message: err.message });
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
        // ── WebRTC Mesh Signaling ───────────────────────────────────────────────
        socket.on('callUser', (data: { roomId: string; targetUserId: string; offer: RTCSessionDescriptionInit }) => {
            io.to(`user:${data.targetUserId}`).emit('incomingCall', {
                offer: data.offer, callerId: socket.data.userId, roomId: data.roomId
            });
        });

        socket.on('callAnswered', (data: { targetUserId: string; answer: RTCSessionDescriptionInit }) => {
            io.to(`user:${data.targetUserId}`).emit('callAnswered', { answer: data.answer, answererId: socket.data.userId });
        });

        socket.on('iceCandidate', (data: { targetUserId: string; candidate: RTCIceCandidateInit }) => {
            io.to(`user:${data.targetUserId}`).emit('iceCandidate', { candidate: data.candidate, fromUserId: socket.data.userId });
        });

        socket.on('joinCall', (data: { roomId: string }, callback?: (err?: string) => void) => {
            const roomName = `call:${data.roomId}`;
            const room = io.sockets.adapter.rooms.get(roomName);
            const userIds = new Set([...(room ?? [])].map(id => io.sockets.sockets.get(id)?.data.userId));
            
            if (!userIds.has(socket.data.userId) && userIds.size >= 4) {
                if (callback) callback('Call is full (max 4 participants)');
                return;
            }

            socket.join(roomName);
            socket.to(roomName).emit('newParticipant', { userId: socket.data.userId });
            if (callback) callback();
        });

        socket.on('leaveCall', (data: { roomId: string }) => {
            socket.leave(`call:${data.roomId}`);
            socket.to(`call:${data.roomId}`).emit('participantLeft', { userId: socket.data.userId });
        });

        socket.on('getExistingParticipants', (data: { roomId: string }, callback: (userIds: string[]) => void) => {
            const roomName = `call:${data.roomId}`;
            const room = io.sockets.adapter.rooms.get(roomName);
            const userIds = [...(room ?? [])]
                .map(id => io.sockets.sockets.get(id)?.data.userId)
                .filter(id => id && id !== socket.data.userId);
            
            // Deduplicate userIds in case of multiple connections from the same user
            callback(Array.from(new Set(userIds)));
        });

        socket.on('disconnect', async () => {
            const deviceSocketsKey = `device-sockets:${socket.data.userId}:${socket.data.deviceId}`;

            // 1. Remove THIS socket from the device-sockets tracking set
            await redis.srem(deviceSocketsKey, socket.id);

            // 2. Check how many sockets remain for this device
            const socketsRemaining = await redis.scard(deviceSocketsKey);

            if (socketsRemaining === 0) {
                // No more sockets for this device — remove it from presence
                await redis.srem(`presence:${socket.data.userId}`, socket.data.deviceId);
                await redis.del(deviceSocketsKey);
                await redis.srem(`active-rooms:${socket.data.userId}`, socket.data.roomId);

                // Check if the user has ANY devices left online
                const devicesRemaining = await redis.scard(`presence:${socket.data.userId}`);
                if (devicesRemaining === 0 && broker) {
                    await broker.publish('chat.user.offline', { userId: socket.data.userId, timestamp: new Date() });
                }
            }

            logger.info('Socket connection terminated', {
                socketId: socket.id,
                userId: socket.data.userId,
                deviceId: socket.data.deviceId,
                socketsRemaining,
            });
        });
    });
};