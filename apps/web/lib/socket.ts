import { io, Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:5003'

let socket: Socket | null = null

// ─── Get or create a socket connected with the given accessToken ──────────────
export function getSocket(accessToken: string): Socket {
    if (socket) {
        socket.auth = { token: `Bearer ${accessToken}` };
        return socket;
    }

    socket = io(SOCKET_URL, {
        auth: { token: `Bearer ${accessToken}` },
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

export function leaveRoom(roomId: string): void {
    socket?.emit('leaveRoom', roomId)
}

export function sendMessage(payload: {
    roomId: string
    content: string
    attachments?: { url: string; contentType: string; fileSize: number }[]
}): void {
    socket?.emit('sendMessage', payload)
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
