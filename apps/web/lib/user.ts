import { api } from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserProfile {
    id: string
    username: string
    displayName: string
    bio?: string
    avatar?: string
    email: string
    isOnline?: boolean
}

export type RelationStatus = 'pending' | 'accepted' | 'rejected' | 'blocked'

export interface Relation {
    id: string
    requester_id: string
    receiver_id: string
    status: RelationStatus
    updated_at: string
}

// ─── Get my profile ───────────────────────────────────────────────────────────
// GET /user/:id
export async function getUserProfile(userId: string): Promise<UserProfile> {
    const { data } = await api.get(`/user/${userId}`)
    return data.data
}

// ─── Update my profile ────────────────────────────────────────────────────────
// PATCH /user/:id  { displayName?, bio?, avatar? }
export async function updateUserProfile(
    userId: string,
    fields: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'avatar'>>
): Promise<void> {
    await api.patch(`/user/${userId}`, fields)
}

// ─── Search users ─────────────────────────────────────────────────────────────
// GET /user/search?q=<query>
export async function searchUsers(query: string): Promise<UserProfile> {
    const { data } = await api.get('/user/search', { params: { q: query } })
    return data.data
}

// ─── Get all relations ────────────────────────────────────────────────────────
// GET /user/buddies
export async function getAllRelations(): Promise<Relation[]> {
    const { data } = await api.get('/user/buddies')
    return data.data
}

// ─── Send buddy request ───────────────────────────────────────────────────────
// POST /user/:id/buddy-request
export async function sendBuddyRequest(userId: string): Promise<void> {
    await api.post(`/user/${userId}/buddy-request`)
}

// ─── Accept buddy request ─────────────────────────────────────────────────────
// PATCH /user/:id/buddy-request/accept
export async function acceptBuddyRequest(userId: string): Promise<void> {
    await api.patch(`/user/${userId}/buddy-request/accept`)
}

// ─── Reject buddy request ─────────────────────────────────────────────────────
// PATCH /user/:id/buddy-request/reject
export async function rejectBuddyRequest(userId: string): Promise<void> {
    await api.patch(`/user/${userId}/buddy-request/reject`)
}

// ─── Block user ───────────────────────────────────────────────────────────────
// POST /user/:id/block
export async function blockUser(userId: string): Promise<void> {
    await api.post(`/user/${userId}/block`)
}

// ─── Unblock user ─────────────────────────────────────────────────────────────
// DELETE /user/:id/block
export async function unblockUser(userId: string): Promise<void> {
    await api.delete(`/user/${userId}/block`)
}

// ─── Upload avatar ────────────────────────────────────────────────────────────
// POST /file/upload  multipart/form-data  { file }
// → 200 { success, data: { url } }
export async function uploadAvatar(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data.url
}
