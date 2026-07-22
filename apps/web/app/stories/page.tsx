'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Play, MessageSquare, Search, Users, Settings, UserCircle, Plus, X, Loader2, Image as ImageIcon, Type, Trash2, Camera, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { getStoryFeed, createStory, deleteStory, StoryFeedEntry, Story } from '@/lib/stories'
import { uploadFile, getUserProfile, UserProfile } from '@/lib/user'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'

const StoryUploadModal = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) => {
    const [type, setType] = useState<'text' | 'photo' | 'video'>('photo')
    const [content, setContent] = useState('')
    const [bg, setBg] = useState('#121212')
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        setFile(f)
        const url = URL.createObjectURL(f)
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url)
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            let mediaUrl = undefined
            if (file) {
                const res = await uploadFile(file)
                mediaUrl = res.url
            }
            if (type === 'text' && !content.trim()) throw new Error("Text content required")
            if (type !== 'text' && !mediaUrl) throw new Error("Media file required")
            
            await createStory({
                type,
                content: type === 'text' ? content : undefined,
                mediaUrl,
                backgroundColor: type === 'text' ? bg : undefined
            })
            toast.success("Story posted!")
            onSuccess()
            onClose()
        } catch (err: any) {
            toast.error(err.message || "Failed to post story")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal isOpen={true} onClose={onClose} title="Create Story" maxWidth="lg">
            <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="flex flex-col gap-4 w-full text-left">
                    <div className="flex bg-[#18181b] border border-[#27272a] p-1 rounded-sm">
                        {(['photo', 'video', 'text'] as const).map(t => (
                            <button 
                                key={t} 
                                onClick={() => { setType(t); setFile(null); setPreviewUrl(null); }}
                                className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors rounded-xs cursor-pointer ${type === t ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {type === 'text' && (
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-medium text-neutral-300">Background Shading</label>
                            <div className="flex gap-2">
                                {['#121212', '#18181b', '#27272a', '#3f3f46', '#000000'].map(c => (
                                    <button 
                                        key={c} onClick={() => setBg(c)} 
                                        className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer ${bg === c ? 'border-white scale-110' : 'border-transparent'}`} 
                                        style={{ backgroundColor: c }} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {(type === 'photo' || type === 'video') && (
                        <div className="flex flex-col gap-2">
                            <input type="file" ref={fileRef} accept={type === 'photo' ? 'image/*' : 'video/*'} className="hidden" onChange={handleFile} />
                            <Button 
                                variant="secondary"
                                size="md"
                                onClick={() => fileRef.current?.click()}
                                leftIcon={<Camera size={16} />}
                            >
                                Choose {type} File
                            </Button>
                        </div>
                    )}

                    <Button 
                        variant="primary"
                        size="lg"
                        onClick={handleSubmit} 
                        isLoading={loading}
                        disabled={(type === 'text' && !content) || (type !== 'text' && !file)}
                        className="mt-4"
                    >
                        POST STORY
                    </Button>
                </div>

                {/* Preview Box */}
                <div className="w-56 h-96 bg-[#121212] rounded-sm border border-[#27272a] overflow-hidden flex flex-col items-center justify-center relative shadow-xl shrink-0">
                    {type === 'text' ? (
                        <div className="w-full h-full flex items-center justify-center p-4 text-center transition-colors" style={{ backgroundColor: bg }}>
                            <textarea 
                                value={content} 
                                onChange={e => setContent(e.target.value)} 
                                placeholder="Type text..." 
                                className="bg-transparent text-white text-lg font-semibold text-center outline-none resize-none w-full h-full pt-[35%] placeholder-neutral-600" 
                            />
                        </div>
                    ) : previewUrl ? (
                        type === 'photo' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <video src={previewUrl} className="w-full h-full object-cover" autoPlay loop muted />
                        )
                    ) : (
                        <div className="text-neutral-500 flex flex-col items-center gap-2 font-mono text-xs">
                            {type === 'photo' ? <ImageIcon size={32} /> : <Type size={32} />}
                            <span>PREVIEW</span>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}

const StoryViewer = ({ feed, initialUserIdx, profiles, onClose, onDelete, currentUserId }: { feed: StoryFeedEntry[], initialUserIdx: number, profiles: Record<string, UserProfile>, onClose: () => void, onDelete: (id: string) => void, currentUserId: string }) => {
    const [userIdx, setUserIdx] = useState(initialUserIdx)
    const [storyIdx, setStoryIdx] = useState(0)
    const [progress, setProgress] = useState(0)
    
    const activeUser = feed[userIdx]
    const activeStory = activeUser.stories[storyIdx]
    const isMine = activeUser._id === currentUserId
    const profile = profiles[activeUser._id]

    useEffect(() => {
        if (!isMine) {
            import('@/lib/stories').then(m => m.getStory(activeStory._id).catch(console.error));
        }
    }, [activeStory._id, isMine])

    useEffect(() => {
        setProgress(0)
        let frame: number
        let start = performance.now()
        const duration = 5000 
        
        const tick = (now: number) => {
            const elap = now - start
            if (elap >= duration) {
                if (storyIdx < activeUser.stories.length - 1) {
                    setStoryIdx(s => s + 1)
                } else if (userIdx < feed.length - 1) {
                    setUserIdx(u => u + 1)
                    setStoryIdx(0)
                } else {
                    onClose()
                }
            } else {
                setProgress((elap / duration) * 100)
                frame = requestAnimationFrame(tick)
            }
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [userIdx, storyIdx, activeUser, feed.length, onClose])

    const handleNext = () => {
        if (storyIdx < activeUser.stories.length - 1) setStoryIdx(s => s + 1)
        else if (userIdx < feed.length - 1) { setUserIdx(u => u + 1); setStoryIdx(0) }
        else onClose()
    }
    const handlePrev = () => {
        if (storyIdx > 0) setStoryIdx(s => s - 1)
        else if (userIdx > 0) { setUserIdx(u => u - 1); setStoryIdx(feed[userIdx - 1].stories.length - 1) }
    }

    return (
        <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center">
            <div className="absolute top-0 left-0 w-full h-full" onClick={handleNext}></div>
            <div className="absolute top-0 left-0 w-[30%] h-full z-10" onClick={(e) => { e.stopPropagation(); handlePrev(); }}></div>
            <div className="absolute top-0 right-0 w-[30%] h-full z-10" onClick={(e) => { e.stopPropagation(); handleNext(); }}></div>

            <div className="w-full max-w-sm h-[90vh] bg-[#121212] border border-[#27272a] rounded-sm relative overflow-hidden flex flex-col items-center justify-center shadow-2xl z-20">
                {/* Progress bars */}
                <div className="absolute top-4 left-4 right-4 flex gap-1 z-30">
                    {activeUser.stories.map((s, i) => (
                        <div key={s._id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-white transition-all ease-linear" 
                                style={{ width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%' }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div className="absolute top-8 left-4 right-4 flex justify-between items-center z-30">
                    <div className="flex items-center gap-2.5">
                        {profile?.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-white" />
                        ) : (
                            <div className="w-8 h-8 bg-neutral-800 text-white font-bold text-xs flex items-center justify-center rounded-full">
                                {profile?.displayName?.[0]?.toUpperCase()}
                            </div>
                        )}
                        <div className="flex flex-col text-left">
                            <span className="text-white text-xs font-bold">{isMine ? 'Your Story' : (profile?.displayName || 'User')}</span>
                            <span className="font-mono text-[9px] text-neutral-400">
                                {new Date(activeStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isMine && (
                            <button onClick={(e) => { e.stopPropagation(); onDelete(activeStory._id); }} className="p-1.5 bg-black/60 hover:bg-red-500 rounded-sm text-white transition-colors cursor-pointer">
                                <Trash2 size={16} />
                            </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1.5 bg-black/60 hover:bg-white hover:text-black rounded-sm text-white transition-colors cursor-pointer">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="w-full h-full relative bg-black">
                    {activeStory.type === 'text' && (
                        <div className="w-full h-full flex items-center justify-center p-8 text-center" style={{ backgroundColor: activeStory.backgroundColor || '#121212' }}>
                            <p className="text-white text-2xl font-bold">{activeStory.content}</p>
                        </div>
                    )}
                    {activeStory.type === 'photo' && activeStory.mediaUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={activeStory.mediaUrl} alt="story" className="w-full h-full object-cover" />
                    )}
                    {activeStory.type === 'video' && activeStory.mediaUrl && (
                        <video src={activeStory.mediaUrl} className="w-full h-full object-cover" autoPlay />
                    )}
                </div>
            </div>
        </div>
    )
}

export default function StoriesPage() {
    const pathname = usePathname()
    const { user } = useAuth()
    const currentUserId = user?.id ?? ''
    const [feed, setFeed] = useState<StoryFeedEntry[]>([])
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
    const [loading, setLoading] = useState(true)
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [activeViewerIdx, setActiveViewerIdx] = useState<number | null>(null)

    const fetchStories = async () => {
        try {
            const data = await getStoryFeed()
            setFeed(data)
            const profs: Record<string, UserProfile> = { ...profiles }
            for (const entry of data) {
                if (!profs[entry._id]) {
                    try {
                        profs[entry._id] = await getUserProfile(entry._id)
                    } catch { }
                }
            }
            setProfiles(profs)
        } catch {
            toast.error("Failed to load stories")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (currentUserId) fetchStories()
    }, [currentUserId])

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this story?")) return
        try {
            await deleteStory(id)
            fetchStories()
            setActiveViewerIdx(null)
            toast.success("Story deleted")
        } catch {
            toast.error("Failed to delete story")
        }
    }

    const hasAnyUnseenStory = feed.some(entry => 
        entry.stories.some(s => !(s.viewedBy && s.viewedBy[currentUserId]))
    )

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-[#080808] md:flex-row">
            {/* Sidebar Navigation */}
            <div className="hidden md:flex h-full w-64 bg-[#121212] border-r border-[#27272a] flex-col shrink-0 p-6">
                <div className="flex items-center gap-2 mb-6 border-b border-[#27272a] pb-4">
                    <div className="w-6 h-6 bg-white text-black font-bold text-xs flex items-center justify-center rounded-xs">
                        T
                    </div>
                    <span className="font-bold text-sm text-neutral-100 tracking-tight">
                        STORIES
                    </span>
                </div>

                <Button 
                    variant="primary" 
                    size="md" 
                    onClick={() => setIsUploadOpen(true)}
                    leftIcon={<Plus size={16} />}
                >
                    ADD TO STORY
                </Button>
            </div>

            {/* Main Grid */}
            <div className="h-full flex-1 bg-[#080808] flex flex-col overflow-y-auto p-6 sm:p-8">
                <div className="flex items-center justify-between border-b border-[#27272a] pb-4 mb-6">
                    <h1 className="text-xl font-bold text-neutral-100">
                        Stories Directory
                    </h1>
                    <Button variant="secondary" size="sm" onClick={() => setIsUploadOpen(true)} leftIcon={<Plus size={14} />}>
                        NEW STORY
                    </Button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-20">
                        <Loader2 size={24} className="animate-spin text-neutral-400" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {/* Feed Cards */}
                        {feed.map((entry, idx) => {
                            const prof = profiles[entry._id]
                            const isMe = entry._id === currentUserId
                            const hasUnseen = !isMe && entry.stories.some(s => !(s.viewedBy && s.viewedBy[currentUserId]))
                            const latestStory = entry.stories[entry.stories.length - 1]
                            
                            return (
                                <div 
                                    key={entry._id}
                                    onClick={() => setActiveViewerIdx(idx)}
                                    className={`relative aspect-[9/16] bg-[#121212] border rounded-sm overflow-hidden cursor-pointer hover:border-white transition-all shadow-lg group ${hasUnseen ? 'border-emerald-500' : 'border-[#27272a]'}`}
                                >
                                    {latestStory.type === 'text' ? (
                                        <div className="w-full h-full flex items-center justify-center p-3 text-center" style={{ backgroundColor: latestStory.backgroundColor || '#121212' }}>
                                            <span className="text-white text-xs font-semibold truncate max-w-full">{latestStory.content}</span>
                                        </div>
                                    ) : latestStory.type === 'photo' && latestStory.mediaUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={latestStory.mediaUrl} alt="story" className="w-full h-full object-cover" />
                                    ) : latestStory.type === 'video' && latestStory.mediaUrl ? (
                                        <video src={latestStory.mediaUrl} className="w-full h-full object-cover" muted />
                                    ) : null}
                                    
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                                    
                                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-2">
                                        {prof?.avatar ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={prof.avatar} className="w-6 h-6 rounded-full object-cover border border-white" alt="avatar" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-neutral-800 text-white font-bold text-[10px] flex items-center justify-center">
                                                {prof?.displayName?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-white text-xs font-medium truncate">{isMe ? 'You' : prof?.displayName || 'User'}</span>
                                    </div>
                                    
                                    {hasUnseen && (
                                        <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full" />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Right Navigation */}
            <div className="h-14 w-full md:h-full md:w-14 bg-[#121212] border-t md:border-l md:border-t-0 border-[#27272a] flex-shrink-0 flex flex-row md:flex-col items-center justify-around md:justify-start py-0 md:py-4 gap-3 order-last">
                {[
                    { href: '/chat', icon: <MessageSquare size={18} />, title: 'Chats' },
                    { href: '/stories', icon: <Play size={18} />, title: 'Stories', dot: hasAnyUnseenStory },
                    { href: '/search', icon: <Search size={18} />, title: 'Search' },
                    { href: '/buddies', icon: <Users size={18} />, title: 'Buddies' },
                    { href: '/settings', icon: <Settings size={18} />, title: 'Settings' },
                    { href: '/profile/me', icon: <UserCircle size={18} />, title: 'My Profile' },
                ].map(({ href, icon, title, dot }) => {
                    const isActive = pathname === href
                    return (
                        <Link
                            key={href}
                            href={href}
                            title={title}
                            className={`w-9 h-9 flex items-center justify-center rounded-sm transition-all relative ${
                                isActive
                                    ? 'bg-white text-black font-bold'
                                    : 'text-neutral-500 hover:text-neutral-200 hover:bg-[#18181b]'
                            }`}
                        >
                            {icon}
                            {dot && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full" />
                            )}
                        </Link>
                    )
                })}
            </div>

            <AnimatePresence>
                {isUploadOpen && <StoryUploadModal onClose={() => setIsUploadOpen(false)} onSuccess={fetchStories} />}
                {activeViewerIdx !== null && (
                    <StoryViewer 
                        feed={feed} 
                        initialUserIdx={activeViewerIdx} 
                        profiles={profiles} 
                        onClose={() => { setActiveViewerIdx(null); fetchStories(); }} 
                        onDelete={handleDelete}
                        currentUserId={currentUserId}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
