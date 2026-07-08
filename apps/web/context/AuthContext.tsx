'use client'

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react'
import { useRouter } from 'next/navigation'
import { login as apiLogin, register as apiRegister, logout as apiLogout, rotateTokens } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthContextValue {
    user: AuthUser | null
    accessToken: string | null
    isLoading: boolean
    login: (email: string, password: string) => Promise<AuthUser>
    register: (email: string, password: string) => Promise<AuthUser>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── JWT decode helper ────────────────────────────────────────────────────────
function decodeUser(token: string): AuthUser | null {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return {
            id: payload.id ?? payload.userId ?? payload.sub,
            email: payload.email ?? '',
            role: payload.role ?? 'USER',
            accessToken: token,
        }
    } catch {
        return null
    }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const [user, setUser]               = useState<AuthUser | null>(null)
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [isLoading, setIsLoading]     = useState(true)
    const refreshTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Helper to store token in the right place
    const setStoredToken = useCallback((token: string, role: string | string[]) => {
        const isUnverified = Array.isArray(role) ? role.includes('UNVERIFIED') : role === 'UNVERIFIED'
        if (isUnverified) {
            sessionStorage.setItem('accessToken', token)
            localStorage.removeItem('accessToken')
        } else {
            localStorage.setItem('accessToken', token)
            sessionStorage.removeItem('accessToken')
        }
    }, [])

    const clearStoredToken = useCallback(() => {
        localStorage.removeItem('accessToken')
        sessionStorage.removeItem('accessToken')
    }, [])

    const getStoredToken = useCallback(() => {
        // Safe check for SSR just in case, though we have 'use client'
        if (typeof window === 'undefined') return null
        return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
    }, [])

    // Silently refresh accessToken every 14 minutes (tokens expire in 15 min)
    const scheduleRefresh = useCallback(() => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(async () => {
            try {
                const newToken = await rotateTokens()
                const decodedUser = decodeUser(newToken)
                if (decodedUser) {
                    setStoredToken(newToken, decodedUser.role)
                    setAccessToken(newToken)
                    setUser(decodedUser)
                    scheduleRefresh()
                } else {
                    throw new Error('Failed to decode token')
                }
            } catch (err: any) {
                const status = err?.response?.status;
                if (status >= 400 && status < 500) {
                    // Refresh failed — user needs to log in again
                    setUser(null)
                    setAccessToken(null)
                    clearStoredToken()
                    router.push('/login')
                }
            }
        }, 14 * 60 * 1000)
    }, [router, setStoredToken, clearStoredToken])

    // On mount — restore session
    useEffect(() => {
        const stored = getStoredToken()
        if (stored) {
            // Optimistically decode stored token to hydrate user immediately
            const decoded = decodeUser(stored)
            setAccessToken(stored)
            setUser(decoded)
            if (decoded) setStoredToken(stored, decoded.role)
            // Then rotate to get a fresh token
            rotateTokens()
                .then(newToken => {
                    const freshUser = decodeUser(newToken)
                    if (freshUser) {
                        setStoredToken(newToken, freshUser.role)
                        setAccessToken(newToken)
                        setUser(freshUser)
                        scheduleRefresh()
                    }
                })
                .catch((err: any) => {
                    const status = err?.response?.status;
                    if (status >= 400 && status < 500) {
                        clearStoredToken()
                        setAccessToken(null)
                        setUser(null)
                    }
                })
                .finally(() => setIsLoading(false))
        } else {
            setIsLoading(false)
        }

        return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }
    }, [scheduleRefresh, getStoredToken, setStoredToken, clearStoredToken])

    const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
        const authUser = await apiLogin(email, password)
        const decodedUser = decodeUser(authUser.accessToken)
        if (!decodedUser) throw new Error('Invalid token received on login')
        setStoredToken(authUser.accessToken, authUser.role)
        setAccessToken(authUser.accessToken)
        setUser(decodedUser)
        scheduleRefresh()
        return decodedUser
    }, [scheduleRefresh, setStoredToken])

    const register = useCallback(async (email: string, password: string): Promise<AuthUser> => {
        const authUser = await apiRegister(email, password)
        const decodedUser = decodeUser(authUser.accessToken)
        if (!decodedUser) throw new Error('Invalid token received on register')
        setStoredToken(authUser.accessToken, authUser.role)
        setAccessToken(authUser.accessToken)
        setUser(decodedUser)
        scheduleRefresh()
        return decodedUser
    }, [scheduleRefresh, setStoredToken])

    const logout = useCallback(async () => {
        try { await apiLogout() } catch { /* swallow */ }
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        setUser(null)
        setAccessToken(null)
        clearStoredToken()
        router.push('/login')
    }, [router, clearStoredToken])

    return (
        <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
    return ctx
}
