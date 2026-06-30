'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { ArrowLeft, MessageCircle, X, Check, UserMinus } from 'lucide-react'

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

const DUMMY: Record<Tab, { id: string; username: string; displayName: string; isOnline?: boolean; bio?: string }[]> = {
    friends: [
        { id: '2', username: 'nova_ui',      displayName: 'Nova Chen',    isOnline: false, bio: 'UI/UX designer.' },
        { id: '5', username: 'the_real_sam', displayName: 'Sam Torres',   isOnline: true,  bio: 'Open-source contributor.' },
        { id: '7', username: 'kai.build',    displayName: 'Kai Müller',   isOnline: true,  bio: 'Backend dev, Go enthusiast.' },
    ],
    pending: [
        { id: '1', username: 'alex_dev',     displayName: 'Alex Carter',  bio: 'Full-stack dev.' },
        { id: '6', username: 'lena_rx',      displayName: 'Lena Fischer', bio: 'React Native dev.' },
    ],
    requests: [
        { id: '3', username: 'rustacean99', displayName: 'Marcus Webb',   bio: 'Rust evangelist.' },
    ],
    blocked: [
        { id: '4', username: 'priya.codes', displayName: 'Priya Sharma',  bio: 'ML engineer.' },
    ],
}

const LABELS: Record<Tab, string> = {
    friends: 'Friends', pending: 'Pending', requests: 'Requests', blocked: 'Blocked',
}

export default function BuddiesPage() {
    const router = useRouter()
    const [tab, setTab] = useState<Tab>('friends')
    const [data, setData] = useState(DUMMY)

    const remove = (id: string) =>
        setData(prev => ({ ...prev, [tab]: prev[tab].filter(u => u.id !== id) }))

    const accept = (id: string) => {
        const user = data.requests.find(u => u.id === id)
        if (!user) return
        setData(prev => ({
            ...prev,
            friends: [...prev.friends, { ...user, isOnline: false }],
            requests: prev.requests.filter(u => u.id !== id),
        }))
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
                                <div
                                    className='w-11 h-11 rounded-full flex items-center justify-center text-white font-bold'
                                    style={{ backgroundColor: avatarColor(user.username) }}
                                >
                                    {user.displayName[0].toUpperCase()}
                                </div>
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
                                        <button className='w-8 h-8 flex items-center justify-center bg-[#252525] text-[#888] hover:text-[#ff4d00] transition-colors' style={{ clipPath: CLIP }}>
                                            <MessageCircle size={14} />
                                        </button>
                                        <button onClick={() => remove(user.id)} className='w-8 h-8 flex items-center justify-center bg-[#252525] text-[#888] hover:text-red-400 transition-colors' style={{ clipPath: CLIP }}>
                                            <UserMinus size={14} />
                                        </button>
                                    </>
                                )}
                                {tab === 'pending' && (
                                    <button onClick={() => remove(user.id)} className='h-8 px-3 flex items-center gap-1.5 bg-[#252525] text-[#888] hover:text-red-400 text-xs font-bold transition-colors' style={{ clipPath: CLIP }}>
                                        <X size={12} /> Cancel
                                    </button>
                                )}
                                {tab === 'requests' && (
                                    <>
                                        <button onClick={() => accept(user.id)} className='w-8 h-8 flex items-center justify-center bg-[#ff4d00] text-white hover:bg-[#e04500] transition-colors' style={{ clipPath: CLIP }}>
                                            <Check size={14} />
                                        </button>
                                        <button onClick={() => remove(user.id)} className='w-8 h-8 flex items-center justify-center bg-[#252525] text-[#888] hover:text-red-400 transition-colors' style={{ clipPath: CLIP }}>
                                            <X size={14} />
                                        </button>
                                    </>
                                )}
                                {tab === 'blocked' && (
                                    <button onClick={() => remove(user.id)} className='h-8 px-3 flex items-center gap-1.5 bg-[#252525] text-[#888] hover:text-green-400 text-xs font-bold transition-colors' style={{ clipPath: CLIP }}>
                                        Unblock
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
