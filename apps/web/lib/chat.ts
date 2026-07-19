import { api } from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Attachment {
    url: string
    contentType: string
    fileSize: number
}

export interface SeenBy {
    userId: string
    seenAt: string
}

export interface ChatMessage {
    _id: string
    roomId: string
    senderId: string
    senderDeviceId?: string
    content: string
    deviceCiphertexts?: Record<string, {
        ciphertext: string;
        nonce: string;
        messageIndex: number;
        myRatchetPub: string;
        x3dhInit?: any;
    }>
    attachments?: Attachment[]
    replyTo?: string
    seenBy: SeenBy[]
    isDeleted: boolean
    reactions?: Record<string, string>
    forwardedFrom?: {
        originalSenderId: string
        originalRoomId: string
        originalMessageId: string
        originalTimestamp: string
    }
    delivery?: {
        targetDevices: string[]
        deliveredDevices: string[]
        deliveredAt: string | null
    }
    createdAt: string
    updatedAt: string
}

export interface RoomMember {
    userId: string
    joinedAt: string
    role: 'member' | 'admin' | 'owner'
}

export interface Room {
    _id: string
    kind: 'dm' | 'group'
    members: RoomMember[]
    name?: string
    description?: string
    avatar?: string
    pinnedMessages?: string[]
    createdBy?: string
    createdAt: string
    updatedAt: string
    lastMessageRecord?: ChatMessage
}

// ─── Rooms ────────────────────────────────────────────────────────────────────
// GET /chat/room  → all rooms for current user
export async function getRooms(): Promise<Room[]> {
    const { data } = await api.get('/chat/room')
    return data.data
}

// GET /chat/room/:roomId
export async function getRoomById(roomId: string): Promise<Room> {
    const { data } = await api.get(`/chat/room/${roomId}`)
    return data.data
}

// POST /chat/room  { kind, members: string[], name?, description? }
export async function createRoom(payload: {
    kind: 'dm' | 'group'
    members: string[]
    name?: string
    description?: string
    avatar?: string
}): Promise<Room> {
    const { data } = await api.post('/chat/room', payload)
    return data.data
}

// DELETE /chat/room/:roomId
export async function deleteRoom(roomId: string): Promise<void> {
    await api.delete(`/chat/room/${roomId}`)
}

// PATCH /chat/room/:roomId
export async function updateGroupInfo(roomId: string, payload: { name?: string, description?: string, avatar?: string }): Promise<Room> {
    const { data } = await api.patch(`/chat/room/${roomId}`, payload)
    return data.data
}

// POST /chat/room/:roomId/member
export async function addMember(roomId: string, memberId: string): Promise<Room> {
    const { data } = await api.post(`/chat/room/${roomId}/member`, { memberId })
    return data.data
}

// DELETE /chat/room/:roomId/member
export async function removeMember(roomId: string, memberId: string): Promise<Room> {
    const { data } = await api.delete(`/chat/room/${roomId}/member`, { data: { memberId } })
    return data.data
}

// PATCH /chat/room/:roomId/member/:memberId/promote
export async function promoteMember(roomId: string, memberId: string): Promise<Room> {
    const { data } = await api.patch(`/chat/room/${roomId}/member/${memberId}/promote`)
    return data.data
}

// PATCH /chat/room/:roomId/member/:memberId/demote
export async function demoteMember(roomId: string, memberId: string): Promise<Room> {
    const { data } = await api.patch(`/chat/room/${roomId}/member/${memberId}/demote`)
    return data.data
}

// ─── Messages ─────────────────────────────────────────────────────────────────
// GET /chat/room/:roomId/messages?page=1&limit=50
export async function getMessages(
    roomId: string,
    page = 1,
    limit = 50
): Promise<ChatMessage[]> {
    const { data } = await api.get(`/chat/room/${roomId}/messages`, {
        params: { page, limit },
    })
    return data.data
}
