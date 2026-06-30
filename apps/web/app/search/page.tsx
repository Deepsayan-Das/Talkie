'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { Search, X, UserPlus, MessageCircle, ArrowLeft } from 'lucide-react'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400', '600'] })

const CLIP_SM = 'polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px)'
const CLIP_LG = 'polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)'

const AVATAR_COLORS = ['#ff4d00', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

const DUMMY_PEOPLE = [
    { id: '1', username: 'alex_dev',     displayName: 'Alex Carter',  bio: 'Full-stack dev. Coffee addict.',      isOnline: true,  isBuddy: false },
    { id: '2', username: 'nova_ui',      displayName: 'Nova Chen',    bio: 'UI/UX designer & pixel pusher.',     isOnline: false, isBuddy: true  },
    { id: '3', username: 'rustacean99', displayName: 'Marcus Webb',   bio: 'Rust evangelist. Fight me.',         isOnline: true,  isBuddy: false },
    { id: '4', username: 'priya.codes', displayName: 'Priya Sharma',  bio: 'ML engineer by day, gamer by night.',isOnline: false, isBuddy: false },
    { id: '5', username: 'the_real_sam',displayName: 'Sam Torres',    bio: 'Open-source contributor. Tea>Coffee.',isOnline: true, isBuddy: true  },
    { id: '6', username: 'lena_rx',     displayName: 'Lena Fischer',  bio: 'React Native dev. Surviving a rewrite.',isOnline: false,isBuddy: false },
]

function avatarColor(s: string) {
    let h = 0
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function SearchPage() {
    const router = useRouter()
    const [query, setQuery] = useState('')

    const results = useMemo(() => {
        const q = query.toLowerCase().trim()
        if (!q) return DUMMY_PEOPLE
        return DUMMY_PEOPLE.filter(p =>
            p.username.toLowerCase().includes(q) ||
            p.displayName.toLowerCase().includes(q) ||
            p.bio.toLowerCase().includes(q)
        )
    }, [query])

    return (
        <div className={`min-h-screen w-full bg-[#131313] flex flex-col items-center pt-12 px-4 pb-10 ${jetbrains.className}`}>

            <button
                onClick={() => router.back()}
                className='self-start ml-4 mb-8 flex items-center gap-2 text-[#666] hover:text-[#ff4d00] transition-colors text-sm'
            >
                <ArrowLeft size={16} />
                <span className={anybody.className}>Back</span>
            </button>

            <div className='w-full max-w-2xl flex flex-col gap-4'>
                <h1 className='text-3xl font-black text-white tracking-tight'>SEARCH</h1>

                <div className='relative' style={{ clipPath: CLIP_LG }}>
                    <Search size={16} className='absolute left-4 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none' />
                    <input
                        autoFocus
                        type='text'
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder='Search by name or username…'
                        className='w-full bg-[#252525] text-white placeholder-[#555] pl-10 pr-10 py-4 text-sm focus:outline-none border-2 border-[#353535] focus:border-[#ff4d00] transition-colors'
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className='absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white'>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className='flex gap-1 border-b-2 border-[#2a2a2a]'>
                    <button className='px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 -mb-0.5 border-[#ff4d00] text-[#ff4d00]'>
                        People
                    </button>
                </div>

                <div className='flex flex-col gap-2'>
                    {results.length === 0 ? (
                        <div className={`text-center py-16 text-[#444] ${anybody.className}`}>
                            <p className='text-lg'>No results for &ldquo;{query}&rdquo;</p>
                            <p className='text-sm mt-1 font-light'>Try a different name or username</p>
                        </div>
                    ) : results.map(person => (
                        <div
                            key={person.id}
                            className='flex items-center gap-4 bg-[#1c1c1c] border-2 border-[#2a2a2a] hover:border-[#353535] p-4 transition-colors cursor-pointer'
                            style={{ clipPath: CLIP_SM }}
                            onClick={() => router.push(`/profile/${person.id}`)}
                        >
                            <div className='relative flex-shrink-0'>
                                <div
                                    className='w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base'
                                    style={{ backgroundColor: avatarColor(person.username) }}
                                >
                                    {person.displayName[0].toUpperCase()}
                                </div>
                                {person.isOnline && (
                                    <span className='absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#1c1c1c]' />
                                )}
                            </div>

                            <div className='flex-1 min-w-0'>
                                <div className='flex items-baseline gap-2'>
                                    <p className='text-white font-bold text-sm'>{person.displayName}</p>
                                    <p className='text-[#555] text-xs'>@{person.username}</p>
                                </div>
                                <p className={`text-[#777] text-xs mt-0.5 truncate ${anybody.className} font-light`}>{person.bio}</p>
                            </div>

                            <div className='flex gap-2 flex-shrink-0' onClick={e => e.stopPropagation()}>
                                <button
                                    title='Send message'
                                    className='w-8 h-8 flex items-center justify-center bg-[#252525] text-[#888] hover:text-[#ff4d00] transition-colors'
                                    style={{ clipPath: CLIP_SM }}
                                >
                                    <MessageCircle size={14} />
                                </button>
                                {!person.isBuddy ? (
                                    <button
                                        title='Add buddy'
                                        className='w-8 h-8 flex items-center justify-center bg-[#ff4d00] text-white hover:bg-[#e04500] transition-colors'
                                        style={{ clipPath: CLIP_SM }}
                                    >
                                        <UserPlus size={14} />
                                    </button>
                                ) : (
                                    <span className={`px-2 h-8 flex items-center text-[10px] font-bold text-green-400 bg-green-400/10 ${anybody.className}`}>
                                        BUDDY
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
