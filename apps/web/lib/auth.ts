import { api } from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
    id: string
    email: string
    role: 'UNVERIFIED' | 'USER' | 'ADMIN'
    accessToken: string
    refreshToken?: string
}

// ─── Register ─────────────────────────────────────────────────────────────────
// POST /auth/register  { email, password }
// → 201 { success, data: AuthUser }
export async function register(email: string, password: string): Promise<AuthUser> {
    const { data } = await api.post('/auth/register', { email, password })
    return data.data
}

// ─── Login ────────────────────────────────────────────────────────────────────
// POST /auth/login  { email, password }
// → 200 { success, data: AuthUser }  (refreshToken set as httpOnly cookie for verified users)
export async function login(email: string, password: string): Promise<AuthUser> {
    const { data } = await api.post('/auth/login', { email, password })
    return data.data
}

// ─── Verify email ─────────────────────────────────────────────────────────────
// GET /auth/verify/:token
// → 200 { success, data: { accessToken } }  (refreshToken set as httpOnly cookie)
export async function verifyEmail(token: string): Promise<string> {
    const { data } = await api.get(`/auth/verify/${token}`)
    return data.data.accessToken
}

// ─── Resend verification mail ─────────────────────────────────────────────────
// POST /auth/resend-verification  (requires accessToken in Authorization header)
export async function resendVerification(): Promise<void> {
    await api.post('/auth/resend-verification')
}

// ─── Logout ───────────────────────────────────────────────────────────────────
// POST /auth/logout  (requires accessToken in Authorization header)
export async function logout(): Promise<void> {
    await api.post('/auth/logout')
    localStorage.removeItem('accessToken')
}

// ─── Rotate tokens ────────────────────────────────────────────────────────────
// POST /auth/rotate-tokens  (sends httpOnly cookie automatically)
// → 200 { success, data: { accessToken } }
export async function rotateTokens(): Promise<string> {
    const { data } = await api.post('/auth/rotate-tokens')
    return data.data.accessToken
}
