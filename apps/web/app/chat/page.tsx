'use client'

import { Send, SquarePen, Check, CheckCheck, Search, Users, Settings, UserCircle, MessageSquare, Loader2, Smile, Paperclip, ArrowLeft, Play, FileText, Reply, X } from 'lucide-react'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import toast from 'react-hot-toast'
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react'
import { useAuth } from '@/context/AuthContext'
import { resendVerification } from '@/lib/auth'
import { useSocket } from '@/context/SocketContext'
import { getUserProfile, getAllRelations, uploadFile } from '@/lib/user'
import { getRooms, getMessages, createRoom, updateGroupInfo, removeMember, promoteMember, demoteMember } from '@/lib/chat'
import { joinRoom, leaveRoom, sendMessage as socketSend, emitTyping, emitStopTyping, markAsSeen, reactToMessage, messageDelivered } from '@/lib/socket'
import { decryptIncomingMessage } from '@/lib/crypto/messaging'
import type { Room, ChatMessage } from '@/lib/chat'
import type { UserProfile } from '@/lib/user'

// ─── Clip path constants ──────────────────────────────────────────────────────
const CLIP_SENT     = 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)'
const CLIP_RECEIVED = 'polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px)'
const CLIP_INPUT    = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)'
const CLIP_BTN      = 'polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['100', '200', '300', '400', '500', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['100', '200', '300', '400', '500', '600', '700', '800'] })

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
    if (room.lastMessageRecord) {
        return room.lastMessageRecord.content;
    }
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

const MessageBubble = ({ msg, isMine, currentUserId, onReply, replyTarget, replyTargetName, onReact, onReplyClick }: { msg: ChatMessage; isMine: boolean; currentUserId: string; onReply: () => void; replyTarget?: ChatMessage; replyTargetName?: string; onReact: (emoji: string | null) => void; onReplyClick?: (msgId: string) => void }) => {
    const [showReactions, setShowReactions] = useState(false);
    const reactionsRef = useRef<HTMLDivElement>(null);
    const reactions = msg.reactions || {};
    const reactionCounts: Record<string, number> = {};
    const myReaction = reactions[currentUserId];
    let hasReactions = false;

    Object.values(reactions).forEach(emoji => {
        hasReactions = true;
        reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
    });

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (reactionsRef.current && !reactionsRef.current.contains(e.target as Node)) {
                setShowReactions(false);
            }
        };
        if (showReactions) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showReactions]);

    return (
        <div id={`message-${msg._id}`} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} px-4 py-1 group transition-colors duration-500`}>
            <div className={`flex flex-col gap-1 max-w-[65%] relative ${isMine ? 'items-end' : 'items-start'}`}>
                <div className={`absolute top-2 ${isMine ? '-left-20' : '-right-20'} opacity-0 group-hover:opacity-100 ${showReactions ? 'opacity-100' : ''} transition-opacity z-10 flex gap-1 bg-[#252525] p-1 rounded-full shadow-lg border border-[#353535]`}>
                    <button onClick={onReply} className="p-1.5 text-[#888] hover:text-white rounded-full hover:bg-[#ff4d00]" title="Reply">
                        <Reply size={14} />
                    </button>
                    <div className="flex gap-1 relative" ref={reactionsRef}>
                        <button onClick={() => setShowReactions(!showReactions)} className={`p-1.5 rounded-full hover:bg-[#ff4d00] ${showReactions ? 'text-white bg-[#ff4d00]' : 'text-[#888] hover:text-white'}`} title="React">
                            <Smile size={14} />
                        </button>
                        {showReactions && (
                            <div className="flex absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#252525] p-1.5 rounded-full shadow-xl border border-[#353535] gap-1.5 z-[100]">
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                    <button key={emoji} onClick={() => { onReact(myReaction === emoji ? null : emoji); setShowReactions(false); }} className="hover:scale-125 transition-transform text-lg px-1.5">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
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
                        className={`px-4 py-3 text-sm leading-relaxed flex flex-col gap-2 ${isMine ? 'bg-[#ff4d00] text-white' : 'bg-[#2a2a2a] text-[#e0e0e0]'}`}
                    >
                        {replyTarget && (
                            <div 
                                onClick={() => onReplyClick && onReplyClick(replyTarget._id)}
                                className={`flex flex-col border-l-4 pl-3 py-1 mb-2 rounded-r cursor-pointer transition-colors ${
                                    isMine 
                                        ? 'border-white/70 bg-black/20 hover:bg-black/30' 
                                        : 'border-[#ff4d00] bg-black/20 hover:bg-black/30'
                                }`}
                            >
                                <span className={`font-bold text-xs mb-0.5 ${isMine ? 'text-white/90' : 'text-[#ff4d00]'}`}>
                                    Replying to {replyTargetName || 'someone'}
                                </span>
                                <span className={`text-xs truncate w-full ${isMine ? 'text-white/80' : 'text-[#aaa]'}`}>
                                    {replyTarget.content || 'Attachment'}
                                </span>
                            </div>
                        )}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-col gap-2">
                                {msg.attachments.map((att, i) => (
                                    att.contentType.startsWith('image/') ? (
                                        <img key={i} src={att.url} alt="attachment" className="max-w-full rounded bg-black/20" />
                                    ) : (
                                        <a key={i} href={att.url} target="_blank" rel="noreferrer" className="underline text-sm break-all font-bold">
                                            📄 Download File
                                        </a>
                                    )
                                ))}
                            </div>
                        )}
                        {msg.content && <span>{msg.content}</span>}
                    </div>
                )}
                
                {hasReactions && (
                    <div className={`flex flex-wrap gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(reactionCounts).map(([emoji, count]) => (
                            <button
                                key={emoji}
                                onClick={() => onReact(myReaction === emoji ? null : emoji)}
                                className={`text-[11px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${myReaction === emoji ? 'bg-[#ff4d00]/20 border-[#ff4d00]/50 text-[#ff4d00]' : 'bg-[#1c1c1c] border-[#353535] text-[#888] hover:bg-[#252525]'}`}
                            >
                                <span>{emoji}</span>
                                {count > 1 && <span>{count}</span>}
                            </button>
                        ))}
                    </div>
                )}

                <div className={`flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <span className='text-[10px] text-[#555]'>{formatTime(new Date(msg.createdAt))}</span>
                    {isMine && (
                        msg.seenBy.length > 0
                            ? <CheckCheck size={13} className='text-[#34b7f1]' />
                            : (msg.delivery?.deliveredAt 
                                ? <CheckCheck size={13} className='text-[#888]' />
                                : <Check size={13} className='text-[#888]' />)
                    )}
                </div>
            </div>
        </div>
    )
}

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

// ─── Create Group Modal ───────────────────────────────────────────────────────
const CreateGroupModal = ({
    onClose,
    onCreate
}: {
    onClose: () => void,
    onCreate: (name: string, members: string[], avatar?: string) => void
}) => {
    const [name, setName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [buddies, setBuddies] = useState<{ id: string, name: string }[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    useEffect(() => {
        getAllRelations().then(async relations => {
            const accepted = relations.filter(r => r.status === 'accepted')
            const buddyIds = accepted.map(r => r.requester_id === user?.id ? r.receiver_id : r.requester_id)
            const profs = await Promise.all(buddyIds.map(id => getUserProfile(id).catch(() => null)))
            setBuddies(profs.filter(Boolean).map(p => ({ id: p!.id, name: p!.displayName })))
            setLoading(false)
        }).catch(() => {
            toast.error("Failed to load buddies")
            setLoading(false)
        })
    }, [user?.id])

    const handleUpload = async (file: File) => {
        setUploadingAvatar(true)
        try {
            const res = await uploadFile(file)
            setAvatarUrl(res.url)
            toast.success("Avatar uploaded")
        } catch {
            toast.error("Failed to upload avatar")
        } finally {
            setUploadingAvatar(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleUpload(file)
    }

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleUpload(file)
    }

    const toggleBuddy = (id: string) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelected(next)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return toast.error("Group name is required")
        if (selected.size === 0) return toast.error("Select at least one member")
        onCreate(name.trim(), Array.from(selected), avatarUrl)
    }

    return (
        <div className="fixed inset-0 bg-[#131313] z-[100] flex flex-col items-center pt-0 md:pt-10 overflow-y-auto pb-20">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className={`w-full max-w-2xl bg-[#252525] flex flex-col min-h-screen md:min-h-0 p-8 shadow-2xl ${jetbrains.className}`}
            >
                <div className="flex justify-between items-center mb-8">
                    <button onClick={onClose} className="text-[#888] hover:text-white transition-colors flex items-center gap-2">
                        <ArrowLeft size={24} /> <span className="font-bold">BACK</span>
                    </button>
                    <h2 className="text-2xl md:text-3xl font-black text-white">NEW GROUP</h2>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-8 flex-1">
                    <div 
                        className={`flex flex-col items-center justify-center p-8 border-4 border-dashed rounded-xl transition-colors cursor-pointer ${dragActive ? 'border-[#ff4d00] bg-[#ff4d00]/10' : 'border-[#353535] hover:border-[#ff4d00]/50'}`}
                        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                        
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Preview" className="w-32 h-32 rounded-full object-cover border-4 border-[#ff4d00] shadow-xl" />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-[#1c1c1c] flex items-center justify-center text-[#ff4d00]">
                                {uploadingAvatar ? <Loader2 size={40} className="animate-spin" /> : <UserCircle size={64} />}
                            </div>
                        )}
                        <p className={`mt-4 text-[#888] font-bold text-center ${anybody.className}`}>
                            {uploadingAvatar ? 'Uploading...' : 'Drag & Drop an avatar here, or click to select'}
                        </p>
                    </div>

                    <div className="flex flex-col">
                        <label className={`text-sm text-[#aaa] mb-2 font-light ${anybody.className}`}>
                            Group Name <span className="text-[#ff4d00]">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. The Squad"
                            className={`w-full h-14 bg-[#353535] outline-none border-b-4 border-b-[#525252] focus:border-b-[#ff4d00] transition-colors px-6 text-white font-bold text-lg ${anybody.className}`}
                        />
                    </div>

                    <div className="flex flex-col flex-1">
                        <label className={`text-sm text-[#aaa] mb-2 font-light ${anybody.className}`}>
                            Select Members ({selected.size}) <span className="text-[#ff4d00]">*</span>
                        </label>
                        <div className="flex-1 overflow-y-auto flex flex-col gap-2 bg-[#1c1c1c] p-4 border-2 border-[#353535] min-h-[250px] max-h-[350px]">
                            {loading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#ff4d00]" size={32} /></div>
                            ) : buddies.length === 0 ? (
                                <p className={`text-center text-[#555] py-10 ${anybody.className}`}>No buddies available to add</p>
                            ) : (
                                buddies.map(b => (
                                    <div
                                        key={b.id}
                                        onClick={() => toggleBuddy(b.id)}
                                        className={`p-4 flex items-center justify-between cursor-pointer border-2 transition-all ${
                                            selected.has(b.id) ? 'bg-[#ff4d00]/20 border-[#ff4d00] translate-x-2' : 'bg-[#252525] border-[#353535] hover:border-[#ff4d00]/50'
                                        }`}
                                    >
                                        <span className={`text-base text-white font-bold ${anybody.className}`}>{b.name}</span>
                                        {selected.has(b.id) && <Check size={20} className="text-[#ff4d00]" />}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        disabled={uploadingAvatar}
                        className={`w-full h-14 bg-[#ff4d00] text-xl font-extrabold text-white mt-4 disabled:opacity-50 [clip-path:polygon(16px_0%,100%_0%,100%_calc(100%-16px),calc(100%-16px)_100%,0%_100%,0%_16px)]`}
                    >
                        CREATE GROUP
                    </motion.button>
                </form>
            </motion.div>
        </div>
    )
}

// ─── Group Info Modal ────────────────────────────────────────────────────────
const GroupInfoModal = ({
    room,
    onClose,
    profiles,
    currentUserId,
    onRoomUpdated,
    onLeave
}: {
    room: Room,
    onClose: () => void,
    profiles: Record<string, UserProfile>,
    currentUserId: string,
    onRoomUpdated: (room: Room) => void,
    onLeave: () => void
}) => {
    const [name, setName] = useState(room.name || '')
    const [avatarUrl, setAvatarUrl] = useState(room.avatar || '')
    const [isEditing, setIsEditing] = useState(false)
    const [loading, setLoading] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const myRole = room.members.find(m => m.userId === currentUserId)?.role || 'member'
    const isAdmin = myRole === 'admin' || myRole === 'owner'

    const handleUpload = async (file: File) => {
        setUploadingAvatar(true)
        try {
            const res = await uploadFile(file)
            setAvatarUrl(res.url)
            toast.success("Avatar uploaded")
        } catch {
            toast.error("Failed to upload avatar")
        } finally {
            setUploadingAvatar(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(false)
        if (!isEditing) return
        const file = e.dataTransfer.files?.[0]
        if (file) handleUpload(file)
    }

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleUpload(file)
    }

    const handleUpdate = async () => {
        if (!name.trim()) return toast.error("Name required")
        setLoading(true)
        try {
            const updated = await updateGroupInfo(room._id, { name: name.trim(), avatar: avatarUrl })
            onRoomUpdated(updated)
            setIsEditing(false)
            toast.success("Group updated")
        } catch {
            toast.error("Failed to update group")
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (action: 'promote' | 'demote' | 'remove', memberId: string) => {
        try {
            let updated: Room;
            if (action === 'promote') updated = await promoteMember(room._id, memberId)
            else if (action === 'demote') updated = await demoteMember(room._id, memberId)
            else updated = await removeMember(room._id, memberId)
            onRoomUpdated(updated)
            toast.success(`Member ${action}d`)
        } catch {
            toast.error(`Failed to ${action} member`)
        }
    }

    const handleLeave = async () => {
        if (!window.confirm("Are you sure you want to leave this group?")) return
        try {
            await removeMember(room._id, currentUserId)
            onLeave()
            toast.success("You left the group")
        } catch {
            toast.error("Failed to leave group")
        }
    }

    return (
        <div className="fixed inset-0 bg-[#131313] z-[100] flex flex-col items-center pt-0 md:pt-10 overflow-y-auto pb-20">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className={`w-full max-w-2xl bg-[#252525] flex flex-col min-h-screen md:min-h-0 p-8 shadow-2xl ${jetbrains.className}`}
            >
                <div className="flex justify-between items-center mb-8">
                    <button onClick={onClose} className="text-[#888] hover:text-white transition-colors flex items-center gap-2">
                        <ArrowLeft size={24} /> <span className="font-bold">BACK</span>
                    </button>
                    <h2 className="text-2xl md:text-3xl font-black text-white">GROUP INFO</h2>
                </div>

                {isEditing ? (
                    <div className="flex flex-col gap-8">
                        <div 
                            className={`flex flex-col items-center justify-center p-8 border-4 border-dashed rounded-xl transition-colors cursor-pointer ${dragActive ? 'border-[#ff4d00] bg-[#ff4d00]/10' : 'border-[#353535] hover:border-[#ff4d00]/50'}`}
                            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={handleDrop}
                            onClick={() => avatarInputRef.current?.click()}
                        >
                            <input type="file" ref={avatarInputRef} className="hidden" onChange={handleAvatarChange} accept="image/*" />
                            
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Group Avatar" className="w-32 h-32 rounded-full object-cover border-4 border-[#ff4d00] shadow-xl" />
                            ) : (
                                <div className="w-32 h-32 rounded-full bg-[#1c1c1c] flex items-center justify-center text-[#ff4d00]">
                                    {uploadingAvatar ? <Loader2 size={40} className="animate-spin" /> : <UserCircle size={64} />}
                                </div>
                            )}
                            <p className={`mt-4 text-[#888] font-bold text-center ${anybody.className}`}>
                                {uploadingAvatar ? 'Uploading...' : 'Drag & Drop to change avatar, or click'}
                            </p>
                        </div>

                        <div className="flex flex-col">
                            <label className={`text-sm text-[#aaa] mb-2 font-light ${anybody.className}`}>
                                Group Name <span className="text-[#ff4d00]">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className={`w-full h-14 bg-[#353535] outline-none border-b-4 border-b-[#525252] focus:border-b-[#ff4d00] transition-colors px-6 text-white font-bold text-lg ${anybody.className}`}
                            />
                        </div>
                        <div className="flex gap-4">
                            <button onClick={handleUpdate} disabled={loading || uploadingAvatar} className="flex-1 bg-[#ff4d00] text-white py-3 text-lg font-bold disabled:opacity-50">Save Changes</button>
                            <button onClick={() => setIsEditing(false)} className="flex-1 bg-[#353535] text-white py-3 text-lg font-bold">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-6">
                        {room.avatar ? (
                            <img src={room.avatar} alt="Group Avatar" className="w-32 h-32 rounded-full object-cover border-4 border-[#ff4d00] shadow-xl" />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-[#ff4d00] flex items-center justify-center text-white text-5xl font-black shadow-xl">
                                {room.name?.[0]?.toUpperCase() || 'G'}
                            </div>
                        )}
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-4">
                                <span className={`text-3xl text-white font-black ${anybody.className}`}>{room.name || 'Group Chat'}</span>
                                {isAdmin && (
                                    <button onClick={() => setIsEditing(true)} className="text-[#ff4d00] hover:text-white text-sm underline font-bold bg-[#ff4d00]/20 px-3 py-1 rounded-full">Edit</button>
                                )}
                            </div>
                            <span className="text-sm text-[#888] bg-[#1c1c1c] px-4 py-1 rounded-full font-bold">{room.members.length} members</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4 mt-8 flex-1">
                    <label className={`text-lg text-[#aaa] font-bold ${anybody.className}`}>Members ({room.members.length})</label>
                    <div className="flex flex-col gap-3 overflow-y-auto pr-2">
                        {room.members.map(m => {
                            const isMe = m.userId === currentUserId
                            const prof = profiles[m.userId]
                            return (
                                <div key={m.userId} className="flex items-center justify-between bg-[#1c1c1c] p-4 border-l-4 border-[#353535] hover:border-[#ff4d00] transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-[#ff4d00] flex items-center justify-center text-white text-sm font-bold shadow-md">
                                            {prof?.avatar ? <img src={prof.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" /> : (prof?.displayName?.[0]?.toUpperCase() || '?')}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-base text-white font-bold ${anybody.className}`}>{prof?.displayName || 'Unknown'} {isMe && <span className="text-[#ff4d00]">(You)</span>}</span>
                                            <span className="text-[10px] text-[#888] uppercase tracking-wider font-black">{m.role}</span>
                                        </div>
                                    </div>
                                    
                                    {!isMe && isAdmin && m.role !== 'owner' && (
                                        <div className="flex gap-3">
                                            {m.role === 'member' && myRole === 'owner' && (
                                                <button onClick={() => handleAction('promote', m.userId)} className="text-xs text-green-500 hover:text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-full transition-colors">Promote</button>
                                            )}
                                            {m.role === 'admin' && myRole === 'owner' && (
                                                <button onClick={() => handleAction('demote', m.userId)} className="text-xs text-orange-500 hover:text-orange-400 font-bold bg-orange-500/10 px-3 py-1 rounded-full transition-colors">Demote</button>
                                            )}
                                            {((myRole === 'owner') || (myRole === 'admin' && m.role === 'member')) && (
                                                <button onClick={() => handleAction('remove', m.userId)} className="text-xs text-red-500 hover:text-red-400 font-bold bg-red-500/10 px-3 py-1 rounded-full transition-colors">Remove</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleLeave}
                    className={`w-full h-14 bg-red-600/10 text-red-500 text-lg font-extrabold mt-8 border-2 border-red-500/50 hover:bg-red-500 hover:text-white transition-colors [clip-path:polygon(16px_0%,100%_0%,100%_calc(100%-16px),calc(100%-16px)_100%,0%_100%,0%_16px)]`}
                >
                    LEAVE GROUP
                </motion.button>
            </motion.div>
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
    const currentUserId = user?.id ?? ''

    const [rooms, setRooms] = useState<Room[]>([])
    const [activeRoom, setActiveRoom] = useState<Room | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [isTyping, setIsTyping] = useState(false)     // remote peer typing
    const [roomsLoading, setRoomsLoading] = useState(true)
    const [msgsLoading, setMsgsLoading] = useState(false)
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
    const [showGroupInfo, setShowGroupInfo] = useState(false)
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)

    const bottomRef    = useRef<HTMLDivElement>(null)
    const textareaRef  = useRef<HTMLTextAreaElement>(null)
    const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prevRoomId   = useRef<string | null>(null)
    const emojiPickerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploadingFile, setUploadingFile] = useState(false)
    const [hasPendingRequests, setHasPendingRequests] = useState(false)

    // ── Click outside emoji picker ────────────────────────────────────────────
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false)
            }
        }
        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showEmojiPicker])

    // ── Check for pending buddy requests ───────────────────────────────────────
    useEffect(() => {
        if (!user) return
        getAllRelations()
            .then(relations => {
                const incoming = relations.filter(
                    r => r.status === 'pending' && r.receiver_id === user.id
                )
                setHasPendingRequests(incoming.length > 0)
            })
            .catch(() => { /* silently ignore */ })
    }, [user])

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
        setReplyingTo(null)

        getMessages(roomId, 1, 50)
            .then(async data => {
                const decrypted = await Promise.all(data.map(m => decryptIncomingMessage(m)))
                setMessages(decrypted.reverse())
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

        const onMessage = async (msg: ChatMessage) => {
            if (msg.roomId === activeRoom?._id) {
                const decryptedMsg = await decryptIncomingMessage(msg)
                setMessages(prev => [...prev, decryptedMsg])
                // Mark as seen if the message is not ours
                if (msg.senderId !== user?.id) {
                    markAsSeen(msg.roomId, msg._id)
                }
            }
            
            // Deliver the message if it's not ours
            if (msg.senderId !== user?.id) {
                messageDelivered(msg.roomId, msg._id)
            }

            // Bubble room to top of list
            setRooms(prev => {
                const updated = prev.map(r => r._id === msg.roomId ? { ...r, updatedAt: msg.createdAt, lastMessageRecord: msg } : r)
                return [...updated].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            })
        }

        const onTyping = ({ userId }: { userId: string }) => {
            if (userId !== user?.id) setIsTyping(true)
        }

        const onStopTyping = ({ userId }: { userId: string }) => {
            if (userId !== user?.id) setIsTyping(false)
        }

        const onMessageEdited = (updated: ChatMessage) => {
            setMessages(prev => prev.map(m => m._id === updated._id ? updated : m))
        }

        const onMessageDeleted = ({ messageId }: { messageId: string }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isDeleted: true, content: '' } : m))
        }

        const onSeen = (data: { messageId: string, userId: string, seenAt: string }) => {
            setMessages(prev => prev.map(m => {
                if (m._id === data.messageId) {
                    return { ...m, seenBy: [...m.seenBy.filter(s => s.userId !== data.userId), { userId: data.userId, seenAt: data.seenAt }] }
                }
                return m
            }))
        }

        const onMessageReacted = (updated: ChatMessage) => {
            setMessages(prev => prev.map(m => m._id === updated._id ? updated : m))
        }

        const onMessageStatusUpdated = (updated: ChatMessage) => {
            setMessages(prev => prev.map(m => m._id === updated._id ? updated : m))
        }

        const onError = (error: { event: string, message: string }) => {
            toast.error(`Error: ${error.message}`);
        }

        socket.on('newMessage', onMessage)
        socket.on('userTyping', onTyping)
        socket.on('userStoppedTyping', onStopTyping)
        socket.on('messageEdited', onMessageEdited)
        socket.on('messageDeleted', onMessageDeleted)
        socket.on('messageReacted', onMessageReacted)
        socket.on('messageStatusUpdated', onMessageStatusUpdated)
        socket.on('messageSeen', onSeen)
        socket.on('error', onError)

        return () => {
            socket.off('newMessage', onMessage)
            socket.off('userTyping', onTyping)
            socket.off('userStoppedTyping', onStopTyping)
            socket.off('messageEdited', onMessageEdited)
            socket.off('messageDeleted', onMessageDeleted)
            socket.off('messageReacted', onMessageReacted)
            socket.off('messageStatusUpdated', onMessageStatusUpdated)
            socket.off('messageSeen', onSeen)
            socket.off('error', onError)
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
        const recipientUserId = activeRoom.members.find(m => m.userId !== currentUserId)?.userId
        if (!recipientUserId) {
            toast.error("Cannot send E2EE message: recipient not found")
            return
        }
        socketSend({ recipientUserId, senderUserId: currentUserId, roomId: activeRoom._id, content: text, replyTo: replyingTo?._id })
        setInput('')
        setShowEmojiPicker(false)
        setReplyingTo(null)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        if (typingTimer.current) clearTimeout(typingTimer.current)
        emitStopTyping(activeRoom._id)
    }, [input, activeRoom, replyingTo, currentUserId])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessageHandler() }
    }

    // ── Handle File Upload ────────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !activeRoom) return
        const recipientUserId = activeRoom.members.find(m => m.userId !== currentUserId)?.userId
        if (!recipientUserId) {
            toast.error("Cannot upload: recipient not found")
            return
        }
        
        setUploadingFile(true)
        try {
            const res = await uploadFile(file)
            socketSend({
                recipientUserId,
                senderUserId: currentUserId,
                roomId: activeRoom._id,
                content: '',
                attachments: [{ url: res.url, contentType: file.type, fileSize: file.size }],
                replyTo: replyingTo?._id
            })
            setReplyingTo(null)
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || "Unknown error";
            toast.error("Failed to upload file: " + msg)
        } finally {
            setUploadingFile(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // ── Load older messages on scroll to top ──────────────────────────────
    const handleScroll = useCallback(async (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget
        if (el.scrollTop === 0 && hasMore && !msgsLoading && activeRoom) {
            const nextPage = page + 1
            setMsgsLoading(true)
            try {
                const older = await getMessages(activeRoom._id, nextPage, 50)
                const decryptedOlder = await Promise.all(older.map(m => decryptIncomingMessage(m)))
                setMessages(prev => [...decryptedOlder.reverse(), ...prev])
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

    const handleResendVerification = async () => {
        try {
            await resendVerification()
            toast.success('Verification email resent!')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Could not resend email')
        }
    }

    const handleReplyClick = useCallback((msgId: string) => {
        const el = document.getElementById(`message-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('bg-[#ff4d00]/20');
            setTimeout(() => el.classList.remove('bg-[#ff4d00]/20'), 1500);
        } else {
            toast.error("Message not found (might be too old)");
        }
    }, []);

    const handleCreateGroupSubmit = async (groupName: string, members: string[]) => {
        try {
            const room = await createRoom({ kind: 'group', members, name: groupName })
            setRooms(prev => [room, ...prev])
            setActiveRoom(room)
            setIsCreateGroupOpen(false)
            toast.success("Group created!")
        } catch {
            toast.error("Failed to create group")
        }
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <AnimatePresence>
                {isCreateGroupOpen && (
                    <CreateGroupModal
                        onClose={() => setIsCreateGroupOpen(false)}
                        onCreate={handleCreateGroupSubmit}
                    />
                )}
                {showGroupInfo && activeRoom && activeRoom.kind === 'group' && (
                    <GroupInfoModal
                        room={activeRoom}
                        onClose={() => setShowGroupInfo(false)}
                        profiles={profiles}
                        currentUserId={currentUserId}
                        onRoomUpdated={(updatedRoom) => {
                            setRooms(prev => prev.map(r => r._id === updatedRoom._id ? { ...updatedRoom, lastMessageRecord: r.lastMessageRecord } : r))
                            setActiveRoom(prev => prev?._id === updatedRoom._id ? { ...updatedRoom, lastMessageRecord: prev.lastMessageRecord } : prev)
                        }}
                        onLeave={() => {
                            setRooms(prev => prev.filter(r => r._id !== activeRoom._id))
                            setActiveRoom(null)
                            setShowGroupInfo(false)
                        }}
                    />
                )}
            </AnimatePresence>

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

            <div className='w-full flex-1 bg-[#131313] flex flex-col md:flex-row overflow-hidden'>

                {/* ── Left sidebar – chat list ──────────────────────────────── */}
                <div className={`h-full w-full md:w-[23%] bg-[#252525] flex-col flex-shrink-0 ${activeRoom ? 'hidden md:flex' : 'flex'}`}>
                    <div className='h-32 border-b-2 border-[#353535] flex flex-col items-center justify-center flex-shrink-0'>
                        <div className='w-full h-[50%] flex items-center justify-between px-6'>
                            <div className='h-full w-[50%] bg-[#ff4d00] flex items-center justify-center text-xs font-bold text-white'>
                                TALKIE
                            </div>
                            <div className='flex items-center gap-2'>
                                <span onClick={() => setIsCreateGroupOpen(true)} title="Create Group" className='hover:text-[#ff4d00] cursor-pointer transition-colors'>
                                    <Users size={18} />
                                </span>
                                <span onClick={() => router.push('/buddies')} title="Buddies" className='relative hover:text-[#ff4d00] cursor-pointer transition-colors'>
                                    <SquarePen size={18} />
                                    {hasPendingRequests && (
                                        <span className='absolute -top-1.5 -right-1.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-[#252525] animate-pulse' />
                                    )}
                                </span>
                            </div>
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
                <div className={`h-full flex-1 bg-[#181818] flex-col ${!activeRoom ? 'hidden md:flex' : 'flex'}`}>

                    {!activeRoom ? (
                        <div className='flex-1 flex items-center justify-center text-[#444]'>
                            Select a conversation to start chatting
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className='h-20 flex-shrink-0 bg-[#252525] border-b-2 border-[#353535] flex items-center gap-4 px-4 md:px-6'>
                                <button onClick={() => setActiveRoom(null)} className="md:hidden text-[#888] hover:text-white">
                                    <ArrowLeft size={24} />
                                </button>
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
                                <div 
                                    className={`flex flex-col ${activeRoom.kind === 'group' ? 'cursor-pointer hover:opacity-80' : ''}`}
                                    onClick={() => activeRoom.kind === 'group' && setShowGroupInfo(true)}
                                >
                                    <p className={`text-white font-bold text-base ${activeRoom.kind === 'group' ? 'underline decoration-[#ff4d00]/50 underline-offset-2' : ''}`}>
                                        {activeRoom.kind === 'dm' 
                                            ? (profiles[activeRoom.members.find(m => m.userId !== currentUserId)?.userId ?? '']?.displayName ?? 'Direct Message')
                                            : (activeRoom.name ?? 'Group Chat')}
                                    </p>
                                    {activeRoom.kind === 'dm' ? (
                                        <p className='text-[#666] text-xs mt-0.5'>
                                            {(() => {
                                                const otherId = activeRoom.members.find(m => m.userId !== currentUserId)?.userId;
                                                const otherProfile = otherId ? profiles[otherId] : null;
                                                if (!otherProfile) return 'Loading...';
                                                if (otherProfile.isOnline) return <span className="text-[#34b7f1] font-bold">Online</span>;
                                                if (otherProfile.last_seen) {
                                                    return `last seen ${new Date(otherProfile.last_seen).toLocaleString(undefined, {
                                                        hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric'
                                                    })}`;
                                                }
                                                return 'Offline';
                                            })()}
                                        </p>
                                    ) : (
                                        <p className='text-[#666] text-xs mt-0.5'>{activeRoom.members.length} members</p>
                                    )}
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
                                                {group.msgs.map(msg => {
                                                    let targetMsg = msg.replyTo ? messages.find(m => m._id === msg.replyTo) : undefined;
                                                    if (msg.replyTo && !targetMsg) {
                                                        targetMsg = { _id: msg.replyTo, content: "Original message...", senderId: "" } as any;
                                                    }
                                                    const targetName = targetMsg ? (targetMsg.senderId === currentUserId ? 'yourself' : (targetMsg.senderId ? profiles[targetMsg.senderId]?.displayName || 'someone' : 'someone')) : undefined;
                                                    return (
                                                    <MessageBubble 
                                                        key={msg._id} 
                                                        msg={msg} 
                                                        isMine={msg.senderId === currentUserId} 
                                                        currentUserId={currentUserId}
                                                        onReply={() => setReplyingTo(msg)}
                                                        replyTarget={targetMsg}
                                                        replyTargetName={targetName}
                                                        onReact={(emoji) => {
                                                            if (activeRoom) reactToMessage(activeRoom._id, msg._id, emoji)
                                                        }}
                                                        onReplyClick={handleReplyClick}
                                                    />
                                                )})}
                                            </React.Fragment>
                                        ))}
                                        {isTyping && <TypingIndicator />}
                                        <div ref={bottomRef} />
                                    </>
                                )}
                            </div>

                            {/* Input bar */}
                            {replyingTo && (
                                <div className="flex-shrink-0 bg-[#1c1c1c] border-t-2 border-[#2a2a2a] px-4 pt-3 pb-0 flex items-center justify-between">
                                    <div className="flex flex-col border-l-4 border-[#ff4d00] pl-3 text-sm flex-1 mr-4 overflow-hidden">
                                        <span className="text-[#ff4d00] font-bold text-xs mb-0.5">Replying to {replyingTo.senderId === currentUserId ? 'yourself' : profiles[replyingTo.senderId]?.displayName || 'someone'}</span>
                                        <span className="text-[#888] truncate w-full">{replyingTo.content || 'Attachment'}</span>
                                    </div>
                                    <button onClick={() => setReplyingTo(null)} className="text-[#888] hover:text-[#ff4d00] bg-[#252525] rounded-full p-1 transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                            <div className={`flex-shrink-0 px-4 py-3 bg-[#1c1c1c] ${replyingTo ? '' : 'border-t-2 border-[#2a2a2a]'} flex items-end gap-3 relative`} ref={emojiPickerRef}>
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full left-4 mb-2 z-50 shadow-2xl">
                                        <EmojiPicker 
                                            theme={Theme.DARK} 
                                            onEmojiClick={(emojiData: EmojiClickData) => {
                                                setInput(prev => prev + emojiData.emoji)
                                            }} 
                                        />
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowEmojiPicker(prev => !prev)}
                                    className='h-12 w-12 flex-shrink-0 bg-[#252525] flex items-center justify-center text-[#888] hover:text-[#ff4d00] transition-colors'
                                    style={{ clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)' }}
                                >
                                    <Smile size={20} />
                                </button>
                                
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileUpload} 
                                    className="hidden" 
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingFile}
                                    className='h-12 w-12 flex-shrink-0 bg-[#252525] flex items-center justify-center text-[#888] hover:text-[#ff4d00] transition-colors disabled:opacity-50'
                                    style={{ clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)' }}
                                >
                                    {uploadingFile ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                                </button>
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
                <div className='h-14 w-full md:h-full md:w-[5%] bg-[#252525] border-t-2 md:border-l-2 md:border-t-0 border-[#353535] flex-shrink-0 flex flex-row md:flex-col items-center justify-around md:justify-start py-0 md:py-5 gap-2 order-last md:order-last'>
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