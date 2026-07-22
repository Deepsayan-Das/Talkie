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
import { generatePreKeys, ensureValidDeviceAndIdentity, getOrCreateDeviceId, setCurrentUserId } from '@/lib/crypto/identity'
import { api } from '@/lib/api'
import { secureStore } from '@/lib/storage/secureStore'

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
    const [user, setUser] = useState<AuthUser | null>(null)
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
                // 401 = no cookie at all, 410 = token genuinely expired
                // Only these mean the session is truly dead — force re-login
                if (status === 401 || status === 410) {
                    setUser(null)
                    setAccessToken(null)
                    clearStoredToken()
                    router.push('/login')
                }
                // 404 = token not in DB (e.g. DB was reset) but access token
                // may still be valid — keep the user logged in, do NOT redirect.
                // The 401 interceptor in api.ts will handle it when the access
                // token eventually expires.
            }
        }, 14 * 60 * 1000)
    }, [router, setStoredToken, clearStoredToken])

    // On mount — restore session (run exactly once)
    const didInit = useRef(false)
    useEffect(() => {
        if (didInit.current) return
        didInit.current = true

        const stored = getStoredToken()
        if (!stored) {
            setIsLoading(false)
            return
        }

        // Optimistically hydrate from stored token immediately
        const decoded = decodeUser(stored)
        if (decoded?.id) setCurrentUserId(decoded.id)
        setAccessToken(stored)
        setUser(decoded)
        if (decoded) setStoredToken(stored, decoded.role)

        // Silently try to get a fresh token via the httpOnly cookie.
        // If no cookie exists (e.g. stale localStorage entry), just keep
        // the decoded user — the 401 interceptor will handle expiry later.
        rotateTokens()
            .then(newToken => {
                const freshUser = decodeUser(newToken)
                if (freshUser) {
                    if (freshUser.id) setCurrentUserId(freshUser.id)
                    setStoredToken(newToken, freshUser.role)
                    setAccessToken(newToken)
                    setUser(freshUser)
                    scheduleRefresh()
                }
            })
            .catch((err: any) => {
                const status = err?.response?.status
                // 401 = no cookie, 410 = token expired — these mean the session
                // is truly dead; wipe state so the user gets redirected to login.
                if (status === 401 || status === 410) {
                    clearStoredToken()
                    setAccessToken(null)
                    setUser(null)
                }
                // 404 = refresh token not found in DB (e.g. server was restarted
                // and DB was wiped) but we still have a valid access token in
                // storage — keep the user logged in optimistically.
                // The access token stays valid for its remaining lifetime;
                // once it expires, the 401 interceptor in api.ts will redirect.
            })
            .finally(() => setIsLoading(false))

        return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // intentionally empty — runs once on mount only

    // Ensure cryptographic identity is initialized for the logged-in user
    useEffect(() => {
        if (!user?.id) return;

        const initializeE2EE = async () => {
            try {
                const { deviceId, identityKey } = await ensureValidDeviceAndIdentity(user.id);
                console.log('Identity key initialized');

                let unusedCountResult;
                try {
                    unusedCountResult = await api.get(`/keys/${deviceId}/unused-count`);
                } catch (err) {
                    console.warn('Could not reach key-service, skipping key refresh this session', err);
                    return; // bail out entirely — do NOT prune, do NOT regenerate, just try again next login
                }

                const serverUnusedCount = unusedCountResult.data.count || 0;
                const serverUnusedKeyIds = unusedCountResult.data.keyIds || [];
                
                // Prune local keys that are no longer marked unused on the server
                await secureStore.pruneUsedOneTimePrekeys(serverUnusedKeyIds);
                console.log('Pruned used pre-keys locally');

                const preKeys = await generatePreKeys(deviceId, identityKey.signingPrivateKey, serverUnusedCount);
                console.log('Pre keys generated locally');

                await api.post('/keys/register', {
                    deviceId,
                    identityPublicKey: identityKey.publicKey,
                    signingPublicKey: identityKey.signingPublicKey,
                    signedPrekey: preKeys.signedPrekey,
                    oneTimePrekeys: preKeys.oneTimePreKeys.map((k: any) => ({
                        keyId: k.id,
                        publicKey: k.publicKey
                    }))
                });

                console.log('E2EE Keys successfully registered on server');
            } catch (err) {
                console.error('Failed to initialize E2EE keys:', err);
            }
        };

        initializeE2EE();
    }, [user?.id]);

    const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
        const authUser = await apiLogin(email, password)
        const decodedUser = decodeUser(authUser.accessToken)
        if (!decodedUser) throw new Error('Invalid token received on login')
        setCurrentUserId(decodedUser.id)
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
        setCurrentUserId(decodedUser.id)
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
