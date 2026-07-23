'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageCircle, X, Check, UserMinus, Loader2, Users } from 'lucide-react'
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
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

type Tab = 'friends' | 'pending' | 'requests' | 'blocked'
const TABS: Tab[] = ['friends', 'pending', 'requests', 'blocked']
const LABELS: Record<Tab, string> = {
    friends: 'Friends', pending: 'Sent Requests', requests: 'Incoming Requests', blocked: 'Blocked Users',
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
        } catch {
            toast.error('Failed to start conversation')
        }
    }

    const handleReject = async (userId: string) => {
        try {
            await rejectBuddyRequest(userId)
            removeLocal(userId)
            toast.success('Request updated')
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
        <div className="min-h-screen w-full bg-[#080808] text-neutral-100 flex flex-col items-center pt-8 px-4 pb-12">
            <div className="w-full max-w-2xl flex flex-col gap-6">
                <button
                    onClick={() => router.back()}
                    className="self-start flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    <span>Back to workspace</span>
                </button>

                <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
                    <div className="flex items-center gap-3">
                        <Users className="w-6 h-6 text-neutral-300" />
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                            Buddies & Network
                        </h1>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-[#27272a] gap-2">
                    {TABS.map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                                tab === t
                                    ? 'border-white text-white font-bold'
                                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                            }`}
                        >
                            <span>{LABELS[t]}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-xs bg-[#18181b] border border-[#27272a]">
                                {data[t].length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Directory List */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 size={24} className="animate-spin text-neutral-400" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {users.length === 0 ? (
                            <div className="text-center py-16 text-neutral-500 font-mono text-xs border border-dashed border-[#27272a] rounded-sm">
                                <p>No users listed in this category</p>
                            </div>
                        ) : users.map(u => (
                            <div
                                key={u.id}
                                className="flex items-center justify-between bg-[#121212] border border-[#27272a] p-4 rounded-sm hover:border-neutral-700 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {u.avatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={u.avatar} alt={u.displayName} className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-neutral-800 text-white font-bold text-sm flex items-center justify-center border border-neutral-700 shrink-0">
                                            {u.displayName[0]?.toUpperCase()}
                                        </div>
                                    )}

                                    <div className="flex flex-col text-left truncate cursor-pointer" onClick={() => router.push(`/profile/${u.id}`)}>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-neutral-100 hover:underline">{u.displayName}</span>
                                            {u.isOnline && <Badge variant="active" dot>Online</Badge>}
                                        </div>
                                        <span className="font-mono text-xs text-neutral-500">@{u.username}</span>
                                        {u.bio && <p className="text-xs text-neutral-400 truncate mt-0.5">{u.bio}</p>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {tab === 'friends' && (
                                        <>
                                            <Button variant="secondary" size="sm" onClick={() => handleMessage(u.id)} leftIcon={<MessageCircle size={14} />}>
                                                CHAT
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleReject(u.id)}>
                                                <UserMinus size={14} />
                                            </Button>
                                        </>
                                    )}
                                    {tab === 'pending' && (
                                        <Button variant="outline" size="sm" onClick={() => handleReject(u.id)}>
                                            CANCEL REQUEST
                                        </Button>
                                    )}
                                    {tab === 'requests' && (
                                        <>
                                            <Button variant="primary" size="sm" onClick={() => handleAccept(u.id)} leftIcon={<Check size={14} />}>
                                                ACCEPT
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleReject(u.id)}>
                                                DECLINE
                                            </Button>
                                        </>
                                    )}
                                    {tab === 'blocked' && (
                                        <Button variant="outline" size="sm" onClick={() => handleUnblock(u.id)}>
                                            UNBLOCK
                                        </Button>
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
