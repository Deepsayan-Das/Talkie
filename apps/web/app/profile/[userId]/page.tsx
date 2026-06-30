'use client'

import { useRouter } from 'next/navigation'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { ArrowLeft, MessageCircle, UserPlus, UserMinus, Shield } from 'lucide-react'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400', '600'] })

const CLIP = 'polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px)'
const AVATAR_COLORS = ['#ff4d00', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

const DUMMY_USERS: Record<string, {
    id: string; username: string; displayName: string;
    bio: string; isOnline: boolean; isBuddy: boolean;
    mutualFriends: number; joinedDate: string;
}> = {
    '1': { id: '1', username: 'alex_dev',    displayName: 'Alex Carter', bio: 'Full-stack dev. Coffee addict. Building things that matter.', isOnline: true,  isBuddy: false, mutualFriends: 3, joinedDate: 'Jan 2024' },
    '2': { id: '2', username: 'nova_ui',     displayName: 'Nova Chen',   bio: 'UI/UX designer & part-time pixel pusher. Obsessed with motion design.', isOnline: false, isBuddy: true,  mutualFriends: 7, joinedDate: 'Mar 2023' },
    '3': { id: '3', username: 'rustacean99', displayName: 'Marcus Webb', bio: 'Rust evangelist. Fight me in a borrow checker. Also writes TypeScript when no one is looking.', isOnline: true,  isBuddy: false, mutualFriends: 1, joinedDate: 'Jun 2023' },
    '4': { id: '4', username: 'priya.codes', displayName: 'Priya Sharma',bio: 'ML engineer by day, gamer by night. Currently fine-tuning LLMs.', isOnline: false, isBuddy: false, mutualFriends: 0, joinedDate: 'Sep 2024' },
    '5': { id: '5', username: 'the_real_sam',displayName: 'Sam Torres',  bio: 'Open-source contributor. Tea > Coffee. Maintaining 3 npm packages nobody uses.', isOnline: true,  isBuddy: true,  mutualFriends: 5, joinedDate: 'Feb 2023' },
}

function avatarColor(s: string) {
    let h = 0
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function ProfilePage({ params }: { params: { userId: string } }) {
    const router = useRouter()
    const user = DUMMY_USERS[params.userId] ?? {
        id: params.userId, username: 'unknown', displayName: 'Unknown User',
        bio: 'This user could not be found.', isOnline: false, isBuddy: false,
        mutualFriends: 0, joinedDate: '—',
    }
    const color = avatarColor(user.username)

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
                        <div
                            className='w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-black'
                            style={{ backgroundColor: color, boxShadow: `0 0 40px ${color}55` }}
                        >
                            {user.displayName[0].toUpperCase()}
                        </div>
                        {user.isOnline && (
                            <span className='absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-[#131313]' />
                        )}
                    </div>
                    <div className='text-center'>
                        <h1 className='text-2xl font-black text-white'>{user.displayName}</h1>
                        <p className='text-[#666] text-sm'>@{user.username}</p>
                        <p className={`text-[#999] text-xs mt-1 ${anybody.className} font-light`}>
                            {user.isOnline ? '🟢 Online now' : '⚫ Offline'}
                        </p>
                    </div>
                </div>

                {/* Stats bar */}
                <div className='flex items-stretch bg-[#1c1c1c] border-2 border-[#2a2a2a]' style={{ clipPath: CLIP }}>
                    {[
                        { label: 'Mutual Friends', value: user.mutualFriends },
                        { label: 'Member Since', value: user.joinedDate },
                    ].map((stat, i) => (
                        <div key={i} className={`flex-1 py-4 text-center ${i === 0 ? 'border-r-2 border-[#2a2a2a]' : ''}`}>
                            <p className='text-white font-bold text-lg'>{stat.value}</p>
                            <p className={`text-[#555] text-[10px] uppercase tracking-widest mt-0.5 ${anybody.className}`}>{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Bio */}
                <div className='bg-[#1c1c1c] border-2 border-[#2a2a2a] p-4' style={{ clipPath: CLIP }}>
                    <p className={`text-[10px] uppercase tracking-widest text-[#555] mb-2 ${anybody.className}`}>Bio</p>
                    <p className={`text-[#ccc] text-sm leading-relaxed ${anybody.className} font-light`}>{user.bio}</p>
                </div>

                {/* Actions */}
                <div className='flex gap-3'>
                    <button
                        className='flex-1 h-11 flex items-center justify-center gap-2 bg-[#ff4d00] text-white text-sm font-bold hover:bg-[#e04500] transition-colors active:scale-95'
                        style={{ clipPath: CLIP }}
                    >
                        <MessageCircle size={15} /> Message
                    </button>

                    {!user.isBuddy ? (
                        <button
                            className='flex-1 h-11 flex items-center justify-center gap-2 bg-[#252525] text-[#ccc] text-sm font-bold hover:bg-[#2e2e2e] transition-colors'
                            style={{ clipPath: CLIP }}
                        >
                            <UserPlus size={15} /> Add Buddy
                        </button>
                    ) : (
                        <button
                            className='flex-1 h-11 flex items-center justify-center gap-2 bg-[#252525] text-green-400 text-sm font-bold hover:bg-[#2e2e2e] transition-colors'
                            style={{ clipPath: CLIP }}
                        >
                            <UserMinus size={15} /> Remove Buddy
                        </button>
                    )}

                    <button
                        title='Block user'
                        className='w-11 h-11 flex items-center justify-center bg-[#1c1c1c] text-[#555] hover:text-red-400 hover:bg-[#252525] transition-colors'
                        style={{ clipPath: CLIP }}
                    >
                        <Shield size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}
