'use client'

import { Send, SquarePen, Check, CheckCheck, Search, Users, Settings, UserCircle, MessageSquare, Loader2 } from 'lucide-react'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { resendVerification } from '@/lib/auth'
import { useSocket } from '@/context/SocketContext'
import { getUserProfile } from '@/lib/user'
import { getRooms, getMessages, createRoom } from '@/lib/chat'
import { joinRoom, leaveRoom, sendMessage as socketSend, emitTyping, emitStopTyping, markAsSeen } from '@/lib/socket'
import type { Room, ChatMessage } from '@/lib/chat'
import type { UserProfile } from '@/lib/user'

// ─── Clip path constants ──────────────────────────────────────────────────────
const CLIP_SENT     = 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)'
const CLIP_RECEIVED = 'polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px)'
const CLIP_INPUT    = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)'
const CLIP_BTN      = 'polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(d: Date): string {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function groupByDate(messages: ChatMessage[]): { date: string; msgs: ChatMessage[] }[] {
    const groups: { date: string; msgs: ChatMessage[] }[] = []
    for (const msg of messages) {
        const label = formatDate(new Date(msg.createdAt))
        const last = groups[groups.length - 1]
        if (last && last.date === label) last.msgs.push(msg)
        else groups.push({ date: label, msgs: [msg] })
    }
    return groups
}

// Last message preview from a room
function lastMessage(room: Room): string {
    return room.name ?? `${room.members.length} members`
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const DateSeparator = ({ label }: { label: string }) => (
    <div className='flex items-center gap-3 my-3 px-2'>
        <div className='flex-1 h-px bg-[#2e2e2e]' />
        <span className='text-[10px] text-[#555] uppercase tracking-widest whitespace-nowrap'>{label}</span>
        <div className='flex-1 h-px bg-[#2e2e2e]' />
    </div>
)

const MessageBubble = ({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) => (
    <div className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} px-4`}>
        <div className='flex flex-col gap-1 max-w-[65%]'>
            {msg.isDeleted ? (
                <div
                    style={{ clipPath: isMine ? CLIP_SENT : CLIP_RECEIVED }}
                    className='px-4 py-3 text-sm italic text-[#555] bg-[#1e1e1e]'
                >
                    Message deleted
                </div>
            ) : (
                <div
                    style={{ clipPath: isMine ? CLIP_SENT : CLIP_RECEIVED }}
                    className={`px-4 py-3 text-sm leading-relaxed ${isMine ? 'bg-[#ff4d00] text-white' : 'bg-[#2a2a2a] text-[#e0e0e0]'}`}
                >
                    {msg.content}
                </div>
            )}
            <div className={`flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                <span className='text-[10px] text-[#555]'>{formatTime(new Date(msg.createdAt))}</span>
                {isMine && (
                    msg.seenBy.length > 0
                        ? <CheckCheck size={13} className='text-[#ff4d00]' />
                        : <Check size={13} className='text-[#555]' />
                )}
            </div>
        </div>
    </div>
)

const TypingIndicator = () => (
    <div className='flex justify-start px-4'>
        <div style={{ clipPath: CLIP_RECEIVED }} className='bg-[#2a2a2a] px-5 py-4 flex items-center gap-1.5'>
            {[0, 1, 2].map(i => (
                <span key={i} className='w-2 h-2 rounded-full bg-[#888] block'
                    style={{ animation: `typing-dot 1.2s ${i * 0.2}s infinite` }} />
            ))}
        </div>
    </div>
)

// ─── Room list item ───────────────────────────────────────────────────────────
const RoomItem = ({
    room, isActive, currentUserId, onClick, profiles
}: {
    room: Room; isActive: boolean; currentUserId: string; onClick: () => void; profiles: Record<string, UserProfile>
}) => {
    const otherId = room.members.find(m => m.userId !== currentUserId)?.userId
    const otherProfile = otherId ? profiles[otherId] : null
    
    const otherName = room.kind === 'dm'
        ? (otherProfile?.displayName ?? `DM-${otherId?.slice(0, 6) ?? '???'}`)
        : (room.name ?? 'Group')
        
    const avatar = room.kind === 'dm' ? otherProfile?.avatar : room.avatar

    return (
        <div
            onClick={onClick}
            className={`w-full h-24 border-2 cursor-pointer flex items-center p-3 gap-3 transition-colors
                ${isActive ? 'bg-[#ff4d00] border-[#ff4d00]' : 'bg-[#252525] border-[#353535] hover:border-[#ff4d00]'}`}
        >
            <div className='relative flex-shrink-0'>
                {avatar ? (
                    <img src={avatar} alt={otherName} className='h-12 w-12 rounded-full object-cover' />
                ) : (
                    <div className='h-12 w-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm'>
                        {otherName[0]?.toUpperCase()}
                    </div>
                )}
            </div>
            <div className='grow flex flex-col gap-0.5 overflow-hidden'>
                <div className='flex justify-between items-center'>
                    <p className='font-bold text-sm text-white'>{otherName}</p>
                    <p className={`text-[10px] ${isActive ? 'text-white/70' : 'text-[#666]'}`}>
                        {room.updatedAt ? formatTime(new Date(room.updatedAt)) : ''}
                    </p>
                </div>
                <p className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-[#888]'}`}>{lastMessage(room)}</p>
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const ChatInner = () => {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useAuth()
    const { socket } = useSocket()

    const [rooms, setRooms] = useState<Room[]>([])
    const [activeRoom, setActiveRoom] = useState<Room | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)     // remote peer typing
    const [roomsLoading, setRoomsLoading] = useState(true)
    const [msgsLoading, setMsgsLoading] = useState(false)
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)

    const bottomRef    = useRef<HTMLDivElement>(null)
    const textareaRef  = useRef<HTMLTextAreaElement>(null)
    const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prevRoomId   = useRef<string | null>(null)

    // ── Load rooms on mount ───────────────────────────────────────────────────
    useEffect(() => {
        getRooms()
            .then(async data => {
                setRooms(data)
                
                const ids = new Set<string>()
                data.forEach(r => {
                    if (r.kind === 'dm') {
                        const otherId = r.members.find(m => m.userId !== user?.id)?.userId
                        if (otherId) ids.add(otherId)
                    }
                })
                const profs: Record<string, UserProfile> = {}
                await Promise.all(Array.from(ids).map(async id => {
                    try {
                        const p = await getUserProfile(id)
                        profs[id] = p
                    } catch {}
                }))
                setProfiles(profs)

                const targetRoomId = searchParams.get('room')
                if (targetRoomId) {
                    const target = data.find(r => r._id === targetRoomId)
                    if (target) {
                        setActiveRoom(target)
                        return
                    }
                }
                if (data.length > 0) setActiveRoom(data[0])
            })
            .catch(() => toast.error('Could not load conversations'))
            .finally(() => setRoomsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, user?.id])

    // ── On room change: join socket room + load first page of messages ─────
    useEffect(() => {
        if (!activeRoom) return
        const roomId = activeRoom._id

        // Leave previous room
        if (prevRoomId.current && prevRoomId.current !== roomId) {
            leaveRoom(prevRoomId.current)
        }
        prevRoomId.current = roomId

        // Join new room
        joinRoom(roomId)
        setMessages([])
        setPage(1)
        setHasMore(true)
        setMsgsLoading(true)

        getMessages(roomId, 1, 50)
            .then(data => {
                setMessages(data)
                setHasMore(data.length === 50)
            })
            .catch(() => toast.error('Could not load messages'))
            .finally(() => setMsgsLoading(false))
    }, [activeRoom])

    // ── Auto-scroll to bottom when messages change ────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isTyping])

    // ── Socket events ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return

        const onMessage = (msg: ChatMessage) => {
            if (msg.roomId === activeRoom?._id) {
                setMessages(prev => [...prev, msg])
                // Mark as seen if the message is not ours
                if (msg.senderId !== user?.id) {
                    markAsSeen(msg.roomId, msg._id)
                }
            }
            // Bubble room to top of list
            setRooms(prev => {
                const updated = prev.map(r => r._id === msg.roomId ? { ...r, updatedAt: msg.createdAt } : r)
                return [...updated].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            })
        }

        const onTyping = ({ roomId, userId }: { roomId: string; userId: string }) => {
            if (roomId === activeRoom?._id && userId !== user?.id) setIsTyping(true)
        }

        const onStopTyping = ({ roomId, userId }: { roomId: string; userId: string }) => {
            if (roomId === activeRoom?._id && userId !== user?.id) setIsTyping(false)
        }

        const onMessageEdited = (updated: ChatMessage) => {
            setMessages(prev => prev.map(m => m._id === updated._id ? updated : m))
        }

        const onMessageDeleted = ({ messageId }: { messageId: string }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isDeleted: true, content: '' } : m))
        }

        const onSeen = (updated: ChatMessage) => {
            setMessages(prev => prev.map(m => m._id === updated._id ? updated : m))
        }

        socket.on('newMessage', onMessage)
        socket.on('typing', onTyping)
        socket.on('stopTyping', onStopTyping)
        socket.on('messageEdited', onMessageEdited)
        socket.on('messageDeleted', onMessageDeleted)
        socket.on('messageSeen', onSeen)

        return () => {
            socket.off('newMessage', onMessage)
            socket.off('typing', onTyping)
            socket.off('stopTyping', onStopTyping)
            socket.off('messageEdited', onMessageEdited)
            socket.off('messageDeleted', onMessageDeleted)
            socket.off('messageSeen', onSeen)
        }
    }, [socket, activeRoom, user?.id])

    // ── Textarea auto-resize ──────────────────────────────────────────────
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)
        const el = textareaRef.current
        if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }

        if (activeRoom) {
            emitTyping(activeRoom._id)
            if (typingTimer.current) clearTimeout(typingTimer.current)
            typingTimer.current = setTimeout(() => {
                if (activeRoom) emitStopTyping(activeRoom._id)
            }, 1500)
        }
    }

    // ── Send message via socket ───────────────────────────────────────────
    const sendMessageHandler = useCallback(() => {
        const text = input.trim()
        if (!text || !activeRoom) return
        socketSend({ roomId: activeRoom._id, content: text })
        setInput('')
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        if (typingTimer.current) clearTimeout(typingTimer.current)
        emitStopTyping(activeRoom._id)
    }, [input, activeRoom])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessageHandler() }
    }

    // ── Load older messages on scroll to top ──────────────────────────────
    const handleScroll = useCallback(async (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget
        if (el.scrollTop === 0 && hasMore && !msgsLoading && activeRoom) {
            const nextPage = page + 1
            setMsgsLoading(true)
            try {
                const older = await getMessages(activeRoom._id, nextPage, 50)
                setMessages(prev => [...older, ...prev])
                setPage(nextPage)
                setHasMore(older.length === 50)
            } catch {
                toast.error('Could not load older messages')
            } finally {
                setMsgsLoading(false)
            }
        }
    }, [activeRoom, hasMore, msgsLoading, page])

    const grouped = groupByDate(messages)
    const currentUserId = user?.id ?? ''

    const handleResendVerification = async () => {
        try {
            await resendVerification()
            toast.success('Verification email resent!')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Could not resend email')
        }
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {user?.role === 'UNVERIFIED' && (
                <div className="w-full bg-[#ff4d00]/20 border-b-2 border-[#ff4d00] py-2 px-6 flex justify-between items-center flex-shrink-0 z-50">
                    <span className="text-sm text-white/90">Please verify your email address. Some features may be limited.</span>
                    <button onClick={handleResendVerification} className="text-[#ff4d00] text-sm underline font-bold hover:text-white transition-colors">
                        Resend Email
                    </button>
                </div>
            )}
            
            <style>{`
                @keyframes typing-dot {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30%           { transform: translateY(-5px); opacity: 1; }
                }
            `}</style>

            <div className='w-full flex-1 bg-[#131313] flex overflow-hidden'>

                {/* ── Left sidebar – chat list ──────────────────────────────── */}
                <div className='h-full w-[23%] bg-[#252525] flex flex-col flex-shrink-0'>
                    <div className='h-32 border-b-2 border-[#353535] flex flex-col items-center justify-center flex-shrink-0'>
                        <div className='w-full h-[50%] flex items-center justify-between px-6'>
                            <div className='h-full w-[50%] bg-[#ff4d00] flex items-center justify-center text-xs font-bold text-white'>
                                TALKIE
                            </div>
                            <span onClick={() => router.push('/buddies')} title="New Conversation" className='hover:text-[#ff4d00] cursor-pointer transition-colors'>
                                <SquarePen size={20} />
                            </span>
                        </div>
                        <div className='w-full h-[50%] px-4 py-2'>
                            <input type='text' placeholder='Search' className='w-full h-full bg-[#1c1c1c] border-2 border-[#353535] rounded-full px-4 text-[#ff4d00] placeholder-[#555] focus:outline-none focus:border-[#ff4d00] transition-colors text-sm' />
                        </div>
                    </div>

                    <div className='flex-1 overflow-y-auto flex flex-col gap-1 p-2'>
                        {roomsLoading ? (
                            <div className='flex justify-center py-10'><Loader2 size={24} className='animate-spin text-[#ff4d00]' /></div>
                        ) : rooms.length === 0 ? (
                            <p className='text-center text-[#555] text-xs py-10'>No conversations yet</p>
                        ) : rooms.map(room => (
                            <RoomItem
                                key={room._id}
                                room={room}
                                isActive={activeRoom?._id === room._id}
                                currentUserId={currentUserId}
                                onClick={() => setActiveRoom(room)}
                                profiles={profiles}
                            />
                        ))}
                    </div>
                </div>

                {/* ── Chat area ─────────────────────────────────────────────── */}
                <div className='h-full flex-1 bg-[#181818] flex flex-col'>

                    {!activeRoom ? (
                        <div className='flex-1 flex items-center justify-center text-[#444]'>
                            Select a conversation to start chatting
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className='h-20 flex-shrink-0 bg-[#252525] border-b-2 border-[#353535] flex items-center gap-4 px-6'>
                                <div className='relative'>
                                    {(() => {
                                        const otherId = activeRoom.members.find(m => m.userId !== currentUserId)?.userId;
                                        const otherProfile = otherId ? profiles[otherId] : null;
                                        const avatar = activeRoom.kind === 'dm' ? otherProfile?.avatar : activeRoom.avatar;
                                        const title = activeRoom.kind === 'dm' 
                                            ? (otherProfile?.displayName ?? 'Direct Message')
                                            : (activeRoom.name ?? 'Group Chat');

                                        return avatar ? (
                                            <img src={avatar} alt={title} className='h-11 w-11 rounded-full object-cover' />
                                        ) : (
                                            <div className='h-11 w-11 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm'>
                                                {title[0]?.toUpperCase()}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <p className='text-white font-bold text-base'>
                                        {activeRoom.kind === 'dm' 
                                            ? (profiles[activeRoom.members.find(m => m.userId !== currentUserId)?.userId ?? '']?.displayName ?? 'Direct Message')
                                            : (activeRoom.name ?? 'Group Chat')}
                                    </p>
                                    <p className='text-[#666] text-xs'>{activeRoom.members.length} members</p>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className='flex-1 overflow-y-auto py-4 flex flex-col gap-2' onScroll={handleScroll}>
                                {msgsLoading && page === 1 ? (
                                    <div className='flex justify-center py-10'><Loader2 size={24} className='animate-spin text-[#ff4d00]' /></div>
                                ) : (
                                    <>
                                        {msgsLoading && page > 1 && (
                                            <div className='flex justify-center py-2'><Loader2 size={16} className='animate-spin text-[#ff4d00]' /></div>
                                        )}
                                        {grouped.map(group => (
                                            <React.Fragment key={group.date}>
                                                <DateSeparator label={group.date} />
                                                {group.msgs.map(msg => (
                                                    <MessageBubble key={msg._id} msg={msg} isMine={msg.senderId === currentUserId} />
                                                ))}
                                            </React.Fragment>
                                        ))}
                                        {isTyping && <TypingIndicator />}
                                        <div ref={bottomRef} />
                                    </>
                                )}
                            </div>

                            {/* Input bar */}
                            <div className='flex-shrink-0 px-4 py-3 bg-[#1c1c1c] border-t-2 border-[#2a2a2a] flex items-end gap-3'>
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={handleInput}
                                    onKeyDown={handleKeyDown}
                                    placeholder='Type a message… (Enter to send, Shift+Enter for newline)'
                                    rows={1}
                                    className='flex-1 bg-[#252525] text-[#e0e0e0] placeholder-[#555] px-4 py-3 text-sm resize-none focus:outline-none max-h-40 overflow-y-auto leading-relaxed'
                                    style={{ clipPath: CLIP_INPUT, minHeight: '48px', height: 'auto' }}
                                />
                                <button
                                    onClick={sendMessageHandler}
                                    disabled={!input.trim()}
                                    style={{ clipPath: CLIP_BTN }}
                                    className='h-12 w-12 flex-shrink-0 bg-[#ff4d00] flex items-center justify-center text-white transition-opacity disabled:opacity-30 hover:bg-[#e04500] active:scale-95'
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* ── Right sidebar – navigation ─────────────────────────────── */}
                <div className='h-full w-[5%] bg-[#252525] border-l-2 border-[#353535] flex-shrink-0 flex flex-col items-center py-5 gap-2'>
                    {[
                        { href: '/chat',       icon: <MessageSquare size={18} />, title: 'Chats'      },
                        { href: '/search',     icon: <Search        size={18} />, title: 'Search'     },
                        { href: '/buddies',    icon: <Users         size={18} />, title: 'Buddies'    },
                        { href: '/settings',   icon: <Settings      size={18} />, title: 'Settings'   },
                        { href: '/profile/me', icon: <UserCircle    size={18} />, title: 'My Profile' },
                    ].map(({ href, icon, title }) => {
                        const isActive = pathname === href
                        return (
                            <Link
                                key={href}
                                href={href}
                                title={title}
                                className={`w-10 h-10 flex items-center justify-center transition-colors ${
                                    isActive
                                        ? 'bg-[#ff4d00]/15 text-[#ff4d00]'
                                        : 'text-[#555] hover:text-[#ff4d00] hover:bg-[#ff4d00]/10'
                                }`}
                                style={{ clipPath: 'polygon(6px 0%,100% 0%,100% calc(100% - 6px),calc(100% - 6px) 100%,0% 100%,0% 6px)' }}
                            >
                                {icon}
                            </Link>
                        )
                    })}
                </div>

            </div>
        </div>
    )
}

const ChatPage = () => {
    return (
        <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#131313]"><Loader2 size={32} className='animate-spin text-[#ff4d00]' /></div>}>
            <ChatInner />
        </React.Suspense>
    )
}

export default ChatPage