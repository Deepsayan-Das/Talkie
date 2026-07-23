'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { Search, X, UserPlus, MessageCircle, ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { searchUsers } from '@/lib/user'
import { sendBuddyRequest } from '@/lib/user'
import type { UserProfile } from '@/lib/user'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400', '600'] })

const CLIP_SM = 'polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px)'
const CLIP_LG = 'polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)'

const AVATAR_COLORS = ['#ff4d00', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

function avatarColor(s: string) {
    let h = 0
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function SearchPage() {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(false)
    const [requested, setRequested] = useState<Set<string>>(new Set())
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) { setResults([]); return }
        setLoading(true)
        try {
            const data = await searchUsers(q)
            // API may return a single object or array — normalise
            setResults(Array.isArray(data) ? data : [data])
        } catch {
            setResults([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => doSearch(query), 400)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }, [query, doSearch])

    const handleAdd = async (userId: string) => {
        try {
            await sendBuddyRequest(userId)
            setRequested(prev => new Set(prev).add(userId))
            toast.success('Buddy request sent!')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Could not send request')
        }
    }

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
                    {loading ? (
                        <div className='flex justify-center py-16'>
                            <Loader2 size={24} className='animate-spin text-[#ff4d00]' />
                        </div>
                    ) : !query.trim() ? (
                        <div className='flex flex-col gap-4 mt-2'>
                            <div className='flex items-center justify-between border-b border-[#2a2a2a] pb-2'>
                                <span className={`text-xs font-bold uppercase tracking-wider text-[#ff4d00] ${anybody.className}`}>
                                    FEATURED AI ASSISTANT 🤖
                                </span>
                            </div>
                            <div
                                className='flex items-center gap-4 bg-[#1c1c1c] border-2 border-[#ff4d00]/40 hover:border-[#ff4d00] p-4 transition-colors cursor-pointer shadow-lg shadow-[#ff4d00]/5'
                                style={{ clipPath: CLIP_SM }}
                                onClick={() => router.push(`/profile/00000000-0000-0000-0000-000000000001`)}
                            >
                                <div className='relative flex-shrink-0'>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src='https://api.dicebear.com/7.x/bottts/svg?seed=TalkieBot' alt='TalkieBot' className='w-12 h-12 rounded-full object-cover border-2 border-[#ff4d00]' />
                                    <span className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-[#1c1c1c]' />
                                </div>

                                <div className='flex-1 min-w-0'>
                                    <div className='flex items-center gap-2'>
                                        <p className='text-white font-black text-sm'>TalkieBot</p>
                                        <span className='px-1.5 py-0.5 bg-[#ff4d00]/20 border border-[#ff4d00]/60 text-[#ff4d00] text-[10px] font-bold rounded uppercase tracking-wider'>AI BOT</span>
                                        <p className='text-[#666] text-xs'>@TalkieBot</p>
                                    </div>
                                    <p className={`text-[#aaa] text-xs mt-1 line-clamp-2 ${anybody.className} font-light`}>
                                        Official Talkie AI Assistant. Tag @TalkieBot in group chats or send a direct message anytime!
                                    </p>
                                </div>

                                <div className='flex gap-2 flex-shrink-0' onClick={e => e.stopPropagation()}>
                                    {requested.has('00000000-0000-0000-0000-000000000001') ? (
                                        <span className={`px-3 h-8 flex items-center text-[10px] font-bold text-[#ff4d00] bg-[#ff4d00]/10 ${anybody.className}`}>
                                            ADDED
                                        </span>
                                    ) : (
                                        <button
                                            title='Add TalkieBot as Buddy'
                                            onClick={() => handleAdd('00000000-0000-0000-0000-000000000001')}
                                            className='px-3 h-8 flex items-center gap-1.5 bg-[#ff4d00] text-white hover:bg-[#e04500] transition-colors text-xs font-bold'
                                            style={{ clipPath: CLIP_SM }}
                                        >
                                            <UserPlus size={14} />
                                            <span>ADD</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : results.length === 0 ? (
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
                                {person.avatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={person.avatar} alt={person.displayName} className='w-12 h-12 rounded-full object-cover' />
                                ) : (
                                    <div
                                        className='w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base'
                                        style={{ backgroundColor: avatarColor(person.username) }}
                                    >
                                        {person.displayName[0].toUpperCase()}
                                    </div>
                                )}
                                {person.isOnline && (
                                    <span className='absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#1c1c1c]' />
                                )}
                            </div>

                            <div className='flex-1 min-w-0'>
                                <div className='flex items-baseline gap-2'>
                                    <p className='text-white font-bold text-sm'>{person.displayName}</p>
                                    <p className='text-[#555] text-xs'>@{person.username}</p>
                                </div>
                                {person.bio && <p className={`text-[#777] text-xs mt-0.5 truncate ${anybody.className} font-light`}>{person.bio}</p>}
                            </div>

                            <div className='flex gap-2 flex-shrink-0' onClick={e => e.stopPropagation()}>
                                <button
                                    title='Send message'
                                    className='w-8 h-8 flex items-center justify-center bg-[#252525] text-[#888] hover:text-[#ff4d00] transition-colors'
                                    style={{ clipPath: CLIP_SM }}
                                >
                                    <MessageCircle size={14} />
                                </button>
                                {requested.has(person.id) ? (
                                    <span className={`px-2 h-8 flex items-center text-[10px] font-bold text-[#ff4d00] bg-[#ff4d00]/10 ${anybody.className}`}>
                                        SENT
                                    </span>
                                ) : (
                                    <button
                                        title='Add buddy'
                                        onClick={() => handleAdd(person.id)}
                                        className='w-8 h-8 flex items-center justify-center bg-[#ff4d00] text-white hover:bg-[#e04500] transition-colors'
                                        style={{ clipPath: CLIP_SM }}
                                    >
                                        <UserPlus size={14} />
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
