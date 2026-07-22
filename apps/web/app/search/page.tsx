'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, UserPlus, MessageCircle, ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { searchUsers, sendBuddyRequest } from '@/lib/user'
import { createRoom } from '@/lib/chat'
import type { UserProfile } from '@/lib/user'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

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

    const handleMessage = async (userId: string) => {
        try {
            const room = await createRoom({ kind: 'dm', members: [userId] })
            router.push(`/chat?room=${room._id}`)
        } catch {
            toast.error('Failed to start conversation')
        }
    }

    return (
        <div className="min-h-screen w-full bg-[#080808] text-neutral-100 flex flex-col items-center pt-8 px-4 pb-12">
            <div className="w-full max-w-2xl flex flex-col gap-6">
                <button
                    onClick={() => router.back()}
                    className="self-start flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </button>

                <div className="flex flex-col gap-1 border-b border-[#27272a] pb-4 text-left">
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                        Search Directory
                    </h1>
                    <p className="text-xs text-neutral-400">
                        Find people by name or username.
                    </p>
                </div>

                <div className="relative">
                    <Input
                        autoFocus
                        placeholder="Search by name or @username..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        leftElement={<Search className="w-4 h-4 text-neutral-500" />}
                        rightElement={
                            query ? (
                                <button onClick={() => setQuery('')} className="text-neutral-500 hover:text-white cursor-pointer p-1">
                                    <X size={14} />
                                </button>
                            ) : undefined
                        }
                    />
                </div>

                <div className="flex flex-col gap-2 text-left">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-neutral-400" />
                        </div>
                    ) : !query.trim() ? (
                        <div className="text-center py-16 text-neutral-500 font-mono text-xs border border-dashed border-[#27272a] rounded-sm">
                            <p>Type a handle or name to start searching</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center py-16 text-neutral-500 font-mono text-xs border border-dashed border-[#27272a] rounded-sm">
                            <p>No matches found for "{query}"</p>
                        </div>
                    ) : results.map(person => (
                        <div
                            key={person.id}
                            className="flex items-center justify-between bg-[#121212] border border-[#27272a] p-4 rounded-sm hover:border-neutral-700 transition-colors"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/profile/${person.id}`)}>
                                {person.avatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={person.avatar} alt={person.displayName} className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-neutral-800 text-white font-bold text-sm flex items-center justify-center border border-neutral-700 shrink-0">
                                        {person.displayName[0]?.toUpperCase()}
                                    </div>
                                )}

                                <div className="flex flex-col text-left truncate">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-neutral-100 hover:underline">{person.displayName}</span>
                                        {person.isOnline && <Badge variant="active" dot>Online</Badge>}
                                    </div>
                                    <span className="font-mono text-xs text-neutral-500">@{person.username}</span>
                                    {person.bio && <p className="text-xs text-neutral-400 truncate mt-0.5">{person.bio}</p>}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                <Button variant="secondary" size="sm" onClick={() => handleMessage(person.id)} leftIcon={<MessageCircle size={14} />}>
                                    CHAT
                                </Button>
                                {requested.has(person.id) ? (
                                    <Badge variant="mono">REQUEST SENT</Badge>
                                ) : (
                                    <Button variant="primary" size="sm" onClick={() => handleAdd(person.id)} leftIcon={<UserPlus size={14} />}>
                                        ADD
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
