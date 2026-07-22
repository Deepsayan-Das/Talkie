'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageCircle, UserPlus, UserMinus, Shield, Loader2, BadgeCheck, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { getUserProfile, sendBuddyRequest, blockUser, getAllRelations } from '@/lib/user'
import { createRoom } from '@/lib/chat'
import type { UserProfile } from '@/lib/user'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params)
    const router = useRouter()
    const { user: me, logout } = useAuth()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [isBuddy, setIsBuddy] = useState(false)
    const [requested, setRequested] = useState(false)

    useEffect(() => {
        const resolvedId = userId === 'me' ? me?.id : userId
        if (!resolvedId) return

        Promise.all([
            getUserProfile(resolvedId),
            getAllRelations(),
        ])
            .then(([prof, relations]) => {
                setProfile(prof)
                const rel = relations.find(r =>
                    (r.requester_id === resolvedId || r.receiver_id === resolvedId) && r.status === 'accepted'
                )
                setIsBuddy(!!rel)
                const pending = relations.find(r =>
                    (r.requester_id === me?.id && r.receiver_id === resolvedId) && r.status === 'pending'
                )
                setRequested(!!pending)
            })
            .catch(() => toast.error('Could not load profile'))
            .finally(() => setLoading(false))
    }, [userId, me?.id])

    const handleAddBuddy = async () => {
        if (!profile) return
        try {
            await sendBuddyRequest(profile.id)
            setRequested(true)
            toast.success('Buddy request sent!')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Could not send request')
        }
    }

    const handleBlock = async () => {
        if (!profile) return
        try {
            await blockUser(profile.id)
            toast.success('User blocked')
            router.back()
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Could not block user')
        }
    }

    const handleMessage = async () => {
        if (!profile) return
        try {
            const room = await createRoom({ kind: 'dm', members: [profile.id] })
            router.push(`/chat?room=${room._id}`)
        } catch {
            toast.error('Failed to start conversation')
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-[#080808] flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-neutral-400" />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="min-h-screen w-full bg-[#080808] flex flex-col items-center justify-center p-6 text-neutral-400">
                <p className="text-sm">User profile not found</p>
                <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">
                    Return Back
                </Button>
            </div>
        )
    }

    const isMe = profile.id === me?.id

    return (
        <div className="min-h-screen w-full bg-[#080808] text-neutral-100 flex flex-col items-center pt-8 px-4 pb-12">
            <div className="w-full max-w-lg flex flex-col gap-6">
                <button
                    onClick={() => router.back()}
                    className="self-start flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </button>

                {/* Profile Card */}
                <div className="bg-[#121212] border border-[#27272a] rounded-sm p-6 sm:p-8 flex flex-col items-center text-center gap-4">
                    <div className="relative">
                        {profile.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.avatar} alt={profile.displayName} className="w-24 h-24 rounded-full object-cover border border-neutral-700" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-neutral-800 text-white text-3xl font-bold flex items-center justify-center border border-neutral-700">
                                {profile.displayName[0]?.toUpperCase()}
                            </div>
                        )}
                        {profile.isOnline && (
                            <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#121212]" />
                        )}
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                            <h1 className="text-xl font-bold text-neutral-100">{profile.displayName}</h1>
                            {me?.id === profile.id && (
                                <BadgeCheck size={18} className="text-neutral-400" />
                            )}
                        </div>
                        <span className="font-mono text-xs text-neutral-500">@{profile.username}</span>
                        <div className="mt-2">
                            <Badge variant={profile.isOnline ? "active" : "subtle"} dot>
                                {profile.isOnline ? 'Online' : 'Offline'}
                            </Badge>
                        </div>
                    </div>

                    {profile.bio && (
                        <div className="w-full bg-[#18181b] border border-[#27272a] p-4 rounded-sm text-left mt-2">
                            <span className="text-[11px] font-medium text-neutral-400 block mb-1">About</span>
                            <p className="text-xs text-neutral-200 leading-relaxed">{profile.bio}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="w-full flex gap-3 mt-4">
                        {!isMe ? (
                            <>
                                <Button variant="primary" size="md" onClick={handleMessage} className="flex-1" leftIcon={<MessageCircle size={15} />}>
                                    MESSAGE
                                </Button>
                                {isBuddy ? (
                                    <Button variant="secondary" size="md" className="flex-1" leftIcon={<UserMinus size={15} />}>
                                        BUDDY
                                    </Button>
                                ) : requested ? (
                                    <Badge variant="mono" className="py-2.5 px-4">SENT</Badge>
                                ) : (
                                    <Button variant="secondary" size="md" onClick={handleAddBuddy} className="flex-1" leftIcon={<UserPlus size={15} />}>
                                        ADD BUDDY
                                    </Button>
                                )}
                                <Button variant="ghost" size="md" onClick={handleBlock} title="Block User">
                                    <Shield size={15} />
                                </Button>
                            </>
                        ) : (
                            <Button variant="danger" size="lg" onClick={logout} className="w-full" leftIcon={<LogOut size={16} />}>
                                LOG OUT
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
