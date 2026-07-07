'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { ArrowLeft, MessageCircle, X, Check, UserMinus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import {
    getAllRelations,
    acceptBuddyRequest,
    rejectBuddyRequest,
    unblockUser,
    getUserProfile,
} from '@/lib/user'
import { createRoom } from '@/lib/chat'
import type { UserProfile, Relation } from '@/lib/user'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400', '600'] })

const CLIP = 'polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px)'
const AVATAR_COLORS = ['#ff4d00', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

function avatarColor(s: string) {
    let h = 0
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

type Tab = 'friends' | 'pending' | 'requests' | 'blocked'
const TABS: Tab[] = ['friends', 'pending', 'requests', 'blocked']
const LABELS: Record<Tab, string> = {
    friends: 'Friends', pending: 'Sent', requests: 'Incoming', blocked: 'Blocked',
}

interface EnrichedUser extends UserProfile {
    relationId: string
}

export default function BuddiesPage() {
    const router = useRouter()
    const { user } = useAuth()
    const [tab, setTab] = useState<Tab>('friends')
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<Record<Tab, EnrichedUser[]>>({
        friends: [], pending: [], requests: [], blocked: [],
    })

    // Fetch relations then enrich each with user profile
    useEffect(() => {
        if (!user) return
        setLoading(true)
        getAllRelations()
            .then(async (relations: Relation[]) => {
                const groups: Record<Tab, EnrichedUser[]> = { friends: [], pending: [], requests: [], blocked: [] }

                await Promise.all(relations.map(async (rel) => {
                    const iAmRequester = rel.requester_id === user.id
                    const otherId = iAmRequester ? rel.receiver_id : rel.requester_id

                    let profile: UserProfile
                    try {
                        profile = await getUserProfile(otherId)
                    } catch {
                        return
                    }

                    const enriched: EnrichedUser = { ...profile, relationId: rel.id }

                    if (rel.status === 'accepted') {
                        groups.friends.push(enriched)
                    } else if (rel.status === 'pending') {
                        if (iAmRequester) groups.pending.push(enriched)
                        else groups.requests.push(enriched)
                    } else if (rel.status === 'blocked') {
                        groups.blocked.push(enriched)
                    }
                }))

                setData(groups)
            })
            .catch(() => toast.error('Failed to load relations'))
            .finally(() => setLoading(false))
    }, [user])

    const removeLocal = (id: string) =>
        setData(prev => ({ ...prev, [tab]: prev[tab].filter(u => u.id !== id) }))

    const handleAccept = async (userId: string) => {
        try {
            await acceptBuddyRequest(userId)
            try {
                await createRoom({ kind: 'dm', members: [userId] })
            } catch (err) {
                console.error('Failed to auto-create room', err)
            }
            const accepted = data.requests.find(u => u.id === userId)
            if (accepted) {
                setData(prev => ({
                    ...prev,
                    friends: [...prev.friends, accepted],
                    requests: prev.requests.filter(u => u.id !== userId),
                }))
            }
            toast.success('Buddy request accepted!')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Failed to accept request')
        }
    }

    const handleMessage = async (userId: string) => {
        try {
            const room = await createRoom({ kind: 'dm', members: [userId] })
            router.push(`/chat?room=${room._id}`)
        } catch (err: any) {
            toast.error('Failed to start conversation')
        }
    }

    const handleReject = async (userId: string) => {
        try {
            await rejectBuddyRequest(userId)
            removeLocal(userId)
            toast('Request declined', { icon: '🚫' })
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Failed to reject request')
        }
    }

    const handleUnblock = async (userId: string) => {
        try {
            await unblockUser(userId)
            removeLocal(userId)
            toast.success('User unblocked')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Failed to unblock')
        }
    }

    const users = data[tab]

    return (
        <div className={`min-h-screen w-full bg-[#131313] flex flex-col items-center pt-10 px-4 pb-12 ${jetbrains.className}`}>

            <button
                onClick={() => router.back()}
                className='self-start ml-4 mb-8 flex items-center gap-2 text-[#666] hover:text-[#ff4d00] transition-colors text-sm'
            >
                <ArrowLeft size={16} />
                <span className={anybody.className}>Back</span>
            </button>

            <div className='w-full max-w-2xl flex flex-col gap-5'>
                <h1 className='text-3xl font-black text-white tracking-tight'>BUDDIES</h1>

                {/* Tabs */}
                <div className='flex border-b-2 border-[#2a2a2a]'>
                    {TABS.map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 -mb-0.5 transition-colors ${
                                tab === t
                                    ? 'border-[#ff4d00] text-[#ff4d00]'
                                    : 'border-transparent text-[#555] hover:text-[#888]'
                            }`}
                        >
                            {LABELS[t]}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${tab === t ? 'bg-[#ff4d00]/20 text-[#ff4d00]' : 'bg-[#2a2a2a] text-[#555]'}`}>
                                {data[t].length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* List */}
                {loading ? (
                    <div className='flex justify-center py-20'>
                        <Loader2 size={28} className='animate-spin text-[#ff4d00]' />
                    </div>
                ) : (
                    <div className='flex flex-col gap-2'>
                        {users.length === 0 ? (
                            <div className={`text-center py-16 text-[#444] ${anybody.className}`}>
                                <p className='text-base'>Nothing here yet</p>
                            </div>
                        ) : users.map(user => (
                            <div
                                key={user.id}
                                className='flex items-center gap-4 bg-[#1c1c1c] border-2 border-[#2a2a2a] p-4'
                                style={{ clipPath: CLIP }}
                            >
                                {/* Avatar */}
                                <div className='relative flex-shrink-0'>
                                    {user.avatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={user.avatar} alt={user.displayName} className='w-11 h-11 rounded-full object-cover' />
                                    ) : (
                                        <div
                                            className='w-11 h-11 rounded-full flex items-center justify-center text-white font-bold'
                                            style={{ backgroundColor: avatarColor(user.username) }}
                                        >
                                            {user.displayName[0].toUpperCase()}
                                        </div>
                                    )}
                                    {tab === 'friends' && user.isOnline && (
                                        <span className='absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#1c1c1c]' />
                                    )}
                                </div>

                                {/* Info */}
                                <div className='flex-1 min-w-0' onClick={() => router.push(`/profile/${user.id}`)} role='button'>
                                    <p className='text-white font-bold text-sm cursor-pointer hover:text-[#ff4d00] transition-colors'>{user.displayName}</p>
                                    <p className='text-[#555] text-xs'>@{user.username}</p>
                                    {user.bio && <p className={`text-[#666] text-xs mt-0.5 truncate ${anybody.className} font-light`}>{user.bio}</p>}
                                </div>

                                {/* Actions */}
                                <div className='flex gap-2 flex-shrink-0'>
                                    {tab === 'friends' && (
                                        <>
                                            <button onClick={() => handleMessage(user.id)} className='w-8 h-8 flex items-center justify-center bg-[#252525] text-[#888] hover:text-[#ff4d00] transition-colors' style={{ clipPath: CLIP }}>
                                                <MessageCircle size={14} />
                                            </button>
                                            <button onClick={() => handleReject(user.id)} className='w-8 h-8 flex items-center justify-center bg-[#252525] text-[#888] hover:text-red-400 transition-colors' style={{ clipPath: CLIP }}>
                                                <UserMinus size={14} />
                                            </button>
                                        </>
                                    )}
                                    {tab === 'pending' && (
                                        <button onClick={() => handleReject(user.id)} className='h-8 px-3 flex items-center gap-1.5 bg-[#252525] text-[#888] hover:text-red-400 text-xs font-bold transition-colors' style={{ clipPath: CLIP }}>
                                            <X size={12} /> Cancel
                                        </button>
                                    )}
                                    {tab === 'requests' && (
                                        <>
                                            <button onClick={() => handleAccept(user.id)} className='w-8 h-8 flex items-center justify-center bg-[#ff4d00] text-white hover:bg-[#e04500] transition-colors' style={{ clipPath: CLIP }}>
                                                <Check size={14} />
                                            </button>
                                            <button onClick={() => handleReject(user.id)} className='w-8 h-8 flex items-center justify-center bg-[#252525] text-[#888] hover:text-red-400 transition-colors' style={{ clipPath: CLIP }}>
                                                <X size={14} />
                                            </button>
                                        </>
                                    )}
                                    {tab === 'blocked' && (
                                        <button onClick={() => handleUnblock(user.id)} className='h-8 px-3 flex items-center gap-1.5 bg-[#252525] text-[#888] hover:text-green-400 text-xs font-bold transition-colors' style={{ clipPath: CLIP }}>
                                            Unblock
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
