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
    recipientUserId: string,
    senderUserId: string,
    roomId: string,
    content: string,
    attachments?: { url: string; contentType: string; fileSize: number }[],
    replyTo?: string
}): Promise<void> {
    const myDeviceId = getOrCreateDeviceId();

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
    })
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
