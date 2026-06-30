'use client'

import { Send, SquarePen, Check, CheckCheck, Search, Users, Settings, UserCircle, MessageSquare } from 'lucide-react'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ─── Clip path constants ──────────────────────────────────────────────────────
const CLIP_SENT = 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)'
const CLIP_RECEIVED = 'polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px)'
const CLIP_INPUT = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)'
const CLIP_BTN = 'polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)'

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
    id: number
    text: string
    sent: boolean          // true = mine, false = theirs
    timestamp: Date
    seen: boolean
}

// ─── Dummy conversation data ──────────────────────────────────────────────────
const INITIAL_MESSAGES: Message[] = [
    { id: 1, text: 'Hey, what\'s up?', sent: false, timestamp: new Date('2024-06-28T09:10:00'), seen: true },
    { id: 2, text: 'Not much, just hacking away 🔥', sent: true, timestamp: new Date('2024-06-28T09:11:00'), seen: true },
    { id: 3, text: 'Nice, working on anything cool?', sent: false, timestamp: new Date('2024-06-28T09:12:00'), seen: true },
    { id: 4, text: 'Yeah — a real-time chat app with Next.js!', sent: true, timestamp: new Date('2024-06-28T09:13:00'), seen: true },
    { id: 5, text: 'Sounds awesome, send me the link when it\'s live', sent: false, timestamp: new Date('2024-06-30T14:30:00'), seen: true },
    { id: 6, text: 'Will do 👍', sent: true, timestamp: new Date('2024-06-30T14:31:00'), seen: false },
]

const UNREACHABLE_REPLIES = [
    "I'm a bit busy right now, catch you later!",
    "Server's not connected yet — just a dummy reply 😅",
    "Can't talk right now, try again soon!",
    "Echo: message received but backend is offline 🤖",
    "This is an automated response — no server attached yet.",
]

const chat_list = [
    { name: 'John Doe', last_message: 'Will do 👍', timestamp: '14:31', is_online: true },
    { name: 'Jane Smith', last_message: 'See you later', timestamp: 'Yesterday', is_online: false },
]

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

function groupByDate(messages: Message[]): { date: string; msgs: Message[] }[] {
    const groups: { date: string; msgs: Message[] }[] = []
    for (const msg of messages) {
        const label = formatDate(msg.timestamp)
        const last = groups[groups.length - 1]
        if (last && last.date === label) last.msgs.push(msg)
        else groups.push({ date: label, msgs: [msg] })
    }
    return groups
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const ChatComp = ({
    item,
    isActive,
    onClick,
}: {
    item: typeof chat_list[number]
    isActive?: boolean
    onClick?: () => void
}) => (
    <div
        onClick={onClick}
        className={`w-full h-24 border-2 cursor-pointer flex items-center p-3 gap-3 transition-colors
            ${isActive
                ? 'bg-[#ff4d00] border-[#ff4d00]'
                : 'bg-[#252525] border-[#353535] hover:border-[#ff4d00]'
            }`}
    >
        <div className='relative flex-shrink-0'>
            <div className='h-12 w-12 bg-blue-500 rounded-full' />
            {item.is_online && (
                <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${isActive ? 'bg-green-300 border-[#ff4d00]' : 'bg-green-400 border-[#252525]'}`} />
            )}
        </div>
        <div className='grow flex flex-col gap-0.5 overflow-hidden'>
            <div className='flex justify-between items-center'>
                <p className={`font-bold text-sm ${isActive ? 'text-white' : 'text-white'}`}>{item.name}</p>
                <p className={`text-[10px] ${isActive ? 'text-white/70' : 'text-[#666]'}`}>{item.timestamp}</p>
            </div>
            <p className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-[#888]'}`}>{item.last_message}</p>
        </div>
    </div>
)

const DateSeparator = ({ label }: { label: string }) => (
    <div className='flex items-center gap-3 my-3 px-2'>
        <div className='flex-1 h-px bg-[#2e2e2e]' />
        <span className='text-[10px] text-[#555] uppercase tracking-widest whitespace-nowrap'>{label}</span>
        <div className='flex-1 h-px bg-[#2e2e2e]' />
    </div>
)

const MessageBubble = ({ msg }: { msg: Message }) => {
    const isSent = msg.sent
    return (
        <div className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'} px-4`}>
            <div className='flex flex-col gap-1 max-w-[65%]'>
                <div
                    style={{ clipPath: isSent ? CLIP_SENT : CLIP_RECEIVED }}
                    className={`px-4 py-3 text-sm leading-relaxed ${isSent
                        ? 'bg-[#ff4d00] text-white'
                        : 'bg-[#2a2a2a] text-[#e0e0e0]'
                        }`}
                >
                    {msg.text}
                </div>
                <div className={`flex items-center gap-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
                    <span className='text-[10px] text-[#555]'>{formatTime(msg.timestamp)}</span>
                    {isSent && (
                        msg.seen
                            ? <CheckCheck size={13} className='text-[#ff4d00]' />
                            : <Check size={13} className='text-[#555]' />
                    )}
                </div>
            </div>
        </div>
    )
}

const TypingIndicator = () => (
    <div className='flex justify-start px-4'>
        <div
            style={{ clipPath: CLIP_RECEIVED }}
            className='bg-[#2a2a2a] px-5 py-4 flex items-center gap-1.5'
        >
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className='w-2 h-2 rounded-full bg-[#888] block'
                    style={{ animation: `typing-dot 1.2s ${i * 0.2}s infinite` }}
                />
            ))}
        </div>
    </div>
)

// ─── Main page ────────────────────────────────────────────────────────────────
const page = () => {
    const pathname = usePathname()
    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [activeChat, setActiveChat] = useState<number>(0)
    const bottomRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const nextId = useRef(INITIAL_MESSAGES.length + 1)

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isTyping])

    // Auto-resize textarea
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)
        const el = textareaRef.current
        if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
    }

    const sendMessage = useCallback(() => {
        const text = input.trim()
        if (!text) return

        const sent: Message = { id: nextId.current++, text, sent: true, timestamp: new Date(), seen: false }
        setMessages(prev => [...prev, sent])
        setInput('')
        if (textareaRef.current) { textareaRef.current.style.height = 'auto' }

        // Simulate "typing…" then unreachable reply
        setIsTyping(true)
        const delay = 1200 + Math.random() * 800
        setTimeout(() => {
            setIsTyping(false)
            const reply = UNREACHABLE_REPLIES[Math.floor(Math.random() * UNREACHABLE_REPLIES.length)]
            const received: Message = { id: nextId.current++, text: reply, sent: false, timestamp: new Date(), seen: true }
            setMessages(prev => [...prev, received])
        }, delay)
    }, [input])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    }

    const grouped = groupByDate(messages)

    return (
        <>
            {/* Typing dot animation */}
            <style>{`
                @keyframes typing-dot {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30%           { transform: translateY(-5px); opacity: 1; }
                }
            `}</style>

            <div className='w-full h-screen bg-[#131313] flex'>

                {/* ── Left sidebar – chat list ─────────────────────── */}
                <div className='h-full w-[23%] bg-[#252525] flex flex-col flex-shrink-0'>
                    <div className='h-32 border-b-2 border-[#353535] flex flex-col items-center justify-center flex-shrink-0'>
                        <div className='w-full h-[50%] flex items-center justify-between px-6'>
                            <div className='h-full w-[50%] bg-[#ff4d00] flex items-center justify-center text-xs font-bold text-white'>logo_area</div>
                            <span className='hover:text-[#ff4d00] cursor-pointer transition-colors'>
                                <SquarePen size={20} />
                            </span>
                        </div>
                        <div className='w-full h-[50%] px-4 py-2'>
                            <input type='text' placeholder='Search' className='w-full h-full bg-[#1c1c1c] border-2 border-[#353535] rounded-full px-4 text-[#ff4d00] placeholder-[#555] focus:outline-none focus:border-[#ff4d00] transition-colors text-sm' />
                        </div>
                    </div>
                    <div className='flex-1 overflow-y-auto flex flex-col gap-1 p-2'>
                        {chat_list.map((item, index) => (
                            <ChatComp
                                key={index}
                                item={item}
                                isActive={activeChat === index}
                                onClick={() => setActiveChat(index)}
                            />
                        ))}
                    </div>
                </div>

                {/* ── Chat area ───────────────────────────────────── */}
                <div className='h-full flex-1 bg-[#181818] flex flex-col'>

                    {/* Header */}
                    <div className='h-20 flex-shrink-0 bg-[#252525] border-b-2 border-[#353535] flex items-center gap-4 px-6'>
                        <div className='relative'>
                            <div className='h-11 w-11 bg-blue-500 rounded-full' />
                            <span className='absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border-2 border-[#252525]' />
                        </div>
                        <div>
                            <p className='text-white font-bold text-base'>John Doe</p>
                            <p className='text-green-400 text-xs font-medium'>Online</p>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className='flex-1 overflow-y-auto py-4 flex flex-col gap-2'>
                        {grouped.map(group => (
                            <React.Fragment key={group.date}>
                                <DateSeparator label={group.date} />
                                {group.msgs.map(msg => (
                                    <MessageBubble key={msg.id} msg={msg} />
                                ))}
                            </React.Fragment>
                        ))}

                        {isTyping && <TypingIndicator />}
                        <div ref={bottomRef} />
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
                            onClick={sendMessage}
                            disabled={!input.trim()}
                            style={{ clipPath: CLIP_BTN }}
                            className='h-12 w-12 flex-shrink-0 bg-[#ff4d00] flex items-center justify-center text-white transition-opacity disabled:opacity-30 hover:bg-[#e04500] active:scale-95'
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Right sidebar – navigation ─────────────────────────────── */}
                <div className='h-full w-[5%] bg-[#252525] border-l-2 border-[#353535] flex-shrink-0 flex flex-col items-center py-5 gap-2'>
                    {[
                        { href: '/chat',     icon: <MessageSquare size={18} />, title: 'Chats'    },
                        { href: '/search',   icon: <Search        size={18} />, title: 'Search'   },
                        { href: '/buddies',  icon: <Users         size={18} />, title: 'Buddies'  },
                        { href: '/settings', icon: <Settings      size={18} />, title: 'Settings' },
                        { href: '/profile/me', icon: <UserCircle  size={18} />, title: 'My Profile' },
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
        </>
    )
}

export default page