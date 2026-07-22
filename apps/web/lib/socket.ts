import { io, Socket } from 'socket.io-client'
import { getOrCreateDeviceId } from './crypto/identity'
import { sendEncryptedMessage } from './crypto/messaging';
import { api } from './api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:5003'

let socket: Socket | null = null

// ─── Get or create a socket connected with the given accessToken ──────────────
export function getSocket(accessToken: string): Socket {
    const deviceId = getOrCreateDeviceId();

    if (socket) {
        socket.auth = { token: `Bearer ${accessToken}`, deviceId };
        return socket;
    }

    socket = io(SOCKET_URL, {
        auth: { token: `Bearer ${accessToken}`, deviceId },
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    })

    return socket
}

// ─── Disconnect and clear ─────────────────────────────────────────────────────
export function disconnectSocket(): void {
    socket?.disconnect()
    socket = null
}

// ─── Emit helpers ─────────────────────────────────────────────────────────────
export function joinRoom(roomId: string): void {
    socket?.emit('joinRoom', roomId)
}

// ─── Leave room ───────────────────────────────────────────────────────────────
export function leaveRoom(roomId: string): void {
    socket?.emit('leaveRoom', roomId)
}

export async function sendMessage(payload: {
    recipientUserId?: string,
    senderUserId: string,
    roomId: string,
    content: string,
    isGroupChat?: boolean,
    attachments?: { url: string; contentType: string; fileSize: number }[],
    replyTo?: string,
    forwardedFrom?: { originalSenderId: string; originalRoomId: string; originalMessageId: string; originalTimestamp: Date }
}): Promise<void> {
    if (payload.isGroupChat) {
        socket?.emit('sendMessage', {
            roomId: payload.roomId,
            content: payload.content,
            attachments: payload.attachments,
            replyTo: payload.replyTo,
            forwardedFrom: payload.forwardedFrom,
        });
        return;
    }

    const myDeviceId = getOrCreateDeviceId();

    if (!payload.recipientUserId) throw new Error("recipientUserId is required for E2EE DMs");

    // 1. Fetch all registered devices for the recipient and the sender
    const [recipientRes, senderRes] = await Promise.all([
        api.get(`/keys/${payload.recipientUserId}/devices`),
        api.get(`/keys/${payload.senderUserId}/devices`)
    ]);

    const recipientDevices: string[] = recipientRes.data.devices || [];
    const senderDevices: string[] = senderRes.data.devices || [];

    const deviceCiphertexts: Record<string, any> = {};

    // 2. Encrypt separately for each recipient device
    for (const deviceId of recipientDevices) {
        const encrypted = await sendEncryptedMessage(
            payload.recipientUserId,
            deviceId,
            myDeviceId,
            payload.content
        );
        deviceCiphertexts[deviceId] = encrypted;
    }

    // 3. Encrypt separately for each of the sender's own devices (excluding current device is optional, but encrypting for all ensures we can decrypt history)
    for (const deviceId of senderDevices) {
        if (deviceCiphertexts[deviceId]) continue; // Avoid double encryption
        const encrypted = await sendEncryptedMessage(
            payload.senderUserId,
            deviceId,
            myDeviceId,
            payload.content
        );
        deviceCiphertexts[deviceId] = encrypted;
    }

    // 4. Emit message with multi-device ciphertext payload
    socket?.emit('sendMessage', {
        roomId: payload.roomId,
        deviceCiphertexts,
        attachments: payload.attachments,
        replyTo: payload.replyTo,
        forwardedFrom: payload.forwardedFrom,
    })
}

// ─── Audio message helper ─────────────────────────────────────────────────────
// The audio blob is encrypted client-side via encryptBlob. The symmetric key
// is embedded in the E2EE-encrypted content field so it travels through the
// existing ratchet, maintaining E2EE for the audio data.
export async function sendAudioMessage(payload: {
    recipientUserId?: string,
    senderUserId: string,
    roomId: string,
    encryptedBlobUrl: string,
    blobKeyB64: string,
    blobNonceB64: string,
    fileSize: number,
    durationMs: number,
    isGroupChat?: boolean,
}): Promise<void> {
    // The content field carries the decryption metadata as JSON.
    // This content is itself encrypted by the ratchet (E2EE).
    const contentPayload = JSON.stringify({
        type: 'audio',
        blobKey: payload.blobKeyB64,
        blobNonce: payload.blobNonceB64,
        durationMs: payload.durationMs,
    });

    await sendMessage({
        recipientUserId: payload.recipientUserId,
        senderUserId: payload.senderUserId,
        roomId: payload.roomId,
        content: contentPayload,
        isGroupChat: payload.isGroupChat,
        attachments: [{
            url: payload.encryptedBlobUrl,
            contentType: 'audio/webm',
            fileSize: payload.fileSize,
        }],
    });
}

// ─── Forward message helper ───────────────────────────────────────────────────
export async function forwardMessage(payload: {
    recipientUserId?: string,
    senderUserId: string,
    targetRoomId: string,
    isGroupChat?: boolean,
    originalMessage: {
        _id: string,
        senderId: string,
        roomId: string,
        content: string,
        createdAt: string,
        attachments?: { url: string; contentType: string; fileSize: number }[],
    }
}): Promise<void> {
    await sendMessage({
        recipientUserId: payload.recipientUserId,
        senderUserId: payload.senderUserId,
        roomId: payload.targetRoomId,
        content: payload.originalMessage.content,
        isGroupChat: payload.isGroupChat,
        attachments: payload.originalMessage.attachments,
        forwardedFrom: {
            originalSenderId: payload.originalMessage.senderId,
            originalRoomId: payload.originalMessage.roomId,
            originalMessageId: payload.originalMessage._id,
            originalTimestamp: new Date(payload.originalMessage.createdAt),
        },
    });
}

export function emitTyping(roomId: string): void {
    socket?.emit('typing', { roomId })
}

export function emitStopTyping(roomId: string): void {
    socket?.emit('stopTyping', { roomId })
}

export function markAsSeen(roomId: string, messageId: string): void {
    socket?.emit('markAsSeen', { roomId, messageId })
}

export function reactToMessage(roomId: string, messageId: string, reaction: string | null): void {
    socket?.emit('reactToMessage', { roomId, messageId, reaction })
}

export function messageDelivered(roomId: string, messageId: string): void {
    socket?.emit('messageDelivered', { roomId, messageId })
}
