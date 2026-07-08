'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { ArrowLeft, MessageCircle, UserPlus, UserMinus, Shield, Loader2, BadgeCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { getUserProfile, sendBuddyRequest, blockUser, getAllRelations } from '@/lib/user'
import { createRoom } from '@/lib/chat'
import type { UserProfile } from '@/lib/user'
import { useAuth } from '@/context/AuthContext'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400', '600'] })

const CLIP = 'polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px)'
const AVATAR_COLORS = ['#ff4d00', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

function avatarColor(s: string) {
    let h = 0
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params)   // ← unwrap the async params Promise (Next.js 15+)
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
            toast('User blocked', { icon: '🚫' })
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
        } catch (err: any) {
            toast.error('Failed to start conversation')
        }
    }

    if (loading) {
        return (
            <div className={`min-h-screen w-full bg-[#131313] flex items-center justify-center ${jetbrains.className}`}>
                <Loader2 size={32} className='animate-spin text-[#ff4d00]' />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className={`min-h-screen w-full bg-[#131313] flex flex-col items-center pt-20 ${jetbrains.className}`}>
                <p className='text-[#666] text-lg'>User not found</p>
                <button onClick={() => router.back()} className='mt-4 text-[#ff4d00] text-sm'>← Go back</button>
            </div>
        )
    }

    const isMe = profile.id === me?.id
    const color = avatarColor(profile.username)

    return (
        <div className={`min-h-screen w-full bg-[#131313] flex flex-col items-center pt-10 px-4 pb-12 ${jetbrains.className}`}>

            <button
                onClick={() => router.back()}
                className='self-start ml-4 mb-8 flex items-center gap-2 text-[#666] hover:text-[#ff4d00] transition-colors text-sm'
            >
                <ArrowLeft size={16} />
                <span className={anybody.className}>Back</span>
            </button>

            <div className='w-full max-w-lg flex flex-col gap-6'>

                {/* Avatar + header */}
                <div className='flex flex-col items-center gap-4'>
                    <div className='relative'>
                        {profile.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.avatar} alt={profile.displayName} className='w-24 h-24 rounded-full object-cover' style={{ boxShadow: `0 0 40px ${color}55` }} />
                        ) : (
                            <div
                                className='w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-black'
                                style={{ backgroundColor: color, boxShadow: `0 0 40px ${color}55` }}
                            >
                                {profile.displayName[0].toUpperCase()}
                            </div>
                        )}
                        {profile.isOnline && (
                            <span className='absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-[#131313]' />
                        )}
                    </div>
                    <div className='text-center'>
                        <h1 className='text-2xl font-black text-white flex items-center justify-center gap-2'>
                            {profile.displayName}
                            {me?.id === profile.id && me?.role !== 'UNVERIFIED' && (
                                <BadgeCheck size={20} className='text-blue-500' />
                            )}
                        </h1>
                        <p className='text-[#666] text-sm'>@{profile.username}</p>
                        <p className={`text-[#999] text-xs mt-1 ${anybody.className} font-light`}>
                            {profile.isOnline ? '🟢 Online now' : '⚫ Offline'}
                        </p>
                    </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                    <div className='bg-[#1c1c1c] border-2 border-[#2a2a2a] p-4' style={{ clipPath: CLIP }}>
                        <p className={`text-[10px] uppercase tracking-widest text-[#555] mb-2 ${anybody.className}`}>Bio</p>
                        <p className={`text-[#ccc] text-sm leading-relaxed ${anybody.className} font-light`}>{profile.bio}</p>
                    </div>
                )}

                {/* Actions */}
                {!isMe ? (
                    <div className='flex gap-3'>
                        <button
                            onClick={handleMessage}
                            className='flex-1 h-11 flex items-center justify-center gap-2 bg-[#ff4d00] text-white text-sm font-bold hover:bg-[#e04500] transition-colors active:scale-95'
                            style={{ clipPath: CLIP }}
                        >
                            <MessageCircle size={15} /> Message
                        </button>

                        {isBuddy ? (
                            <button
                                className='flex-1 h-11 flex items-center justify-center gap-2 bg-[#252525] text-green-400 text-sm font-bold hover:bg-[#2e2e2e] transition-colors'
                                style={{ clipPath: CLIP }}
                            >
                                <UserMinus size={15} /> Remove Buddy
                            </button>
                        ) : requested ? (
                            <span
                                className={`flex-1 h-11 flex items-center justify-center gap-2 bg-[#252525] text-[#ff4d00] text-sm font-bold ${anybody.className}`}
                                style={{ clipPath: CLIP }}
                            >
                                Request Sent
                            </span>
                        ) : (
                            <button
                                onClick={handleAddBuddy}
                                className='flex-1 h-11 flex items-center justify-center gap-2 bg-[#252525] text-[#ccc] text-sm font-bold hover:bg-[#2e2e2e] transition-colors'
                                style={{ clipPath: CLIP }}
                            >
                                <UserPlus size={15} /> Add Buddy
                            </button>
                        )}

                        <button
                            title='Block user'
                            onClick={handleBlock}
                            className='w-11 h-11 flex items-center justify-center bg-[#1c1c1c] text-[#555] hover:text-red-400 hover:bg-[#252525] transition-colors'
                            style={{ clipPath: CLIP }}
                        >
                            <Shield size={15} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={logout}
                        className='w-full h-11 flex items-center justify-center gap-2 bg-red-600/10 text-red-500 border-2 border-red-500/50 text-sm font-bold hover:bg-red-500 hover:text-white transition-colors active:scale-95 mt-4'
                        style={{ clipPath: CLIP }}
                    >
                        Log Out
                    </button>
                )}
            </div>
        </div>
    )
}
