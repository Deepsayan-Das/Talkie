'use client'

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useRef,
} from 'react'
import { useAuth } from './AuthContext'
import { getSocket, disconnectSocket } from '@/lib/socket'
import type { Socket } from 'socket.io-client'

// ─── Types ────────────────────────────────────────────────────────────────────
type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface SocketContextValue {
    socket: Socket | null
    status: SocketStatus
}

const SocketContext = createContext<SocketContextValue>({ socket: null, status: 'disconnected' })

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { accessToken } = useAuth()
    const [socket, setSocket]   = useState<Socket | null>(null)
    const [status, setStatus]   = useState<SocketStatus>('disconnected')
    const tokenRef              = useRef<string | null>(null)

    useEffect(() => {
        if (!accessToken) {
            disconnectSocket()
            setSocket(null)
            setStatus('disconnected')
            return
        }

        // Don't reconnect if the token hasn't changed and we already have a socket
        if (tokenRef.current === accessToken && socket?.connected) return
        tokenRef.current = accessToken

        const s = getSocket(accessToken)
        setSocket(s)
        setStatus(s.connected ? 'connected' : 'connecting')

        // Use named references so cleanup only removes OUR handlers,
        // not socket.io-client's internal listeners
        const onConnect    = () => setStatus('connected')
        const onDisconnect = () => setStatus('disconnected')
        const onError      = () => setStatus('error')

        s.on('connect',       onConnect)
        s.on('disconnect',    onDisconnect)
        s.on('connect_error', onError)

        if (!s.connected) s.connect()

        return () => {
            s.off('connect',       onConnect)
            s.off('disconnect',    onDisconnect)
            s.off('connect_error', onError)
        }
    }, [accessToken])  // re-run whenever token changes (after rotation)

    return (
        <SocketContext.Provider value={{ socket, status }}>
            {children}
        </SocketContext.Provider>
    )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSocket(): SocketContextValue {
    return useContext(SocketContext)
}
