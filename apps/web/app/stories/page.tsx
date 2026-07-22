'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { Play, MessageSquare, Search, Users, Settings, UserCircle, Plus, X, Loader2, Image as ImageIcon, Type, Trash2, Camera, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { getStoryFeed, createStory, deleteStory, StoryFeedEntry, Story } from '@/lib/stories'
import { uploadFile, getUserProfile, UserProfile } from '@/lib/user'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['100', '400', '600', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400', '600', '800'] })

const StoryUploadModal = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) => {
    const [type, setType] = useState<'text' | 'photo' | 'video'>('photo')
    const [content, setContent] = useState('')
    const [bg, setBg] = useState('#ff4d00')
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        setFile(f)
        const url = URL.createObjectURL(f)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col">
            <div className="p-6 flex justify-between items-center">
                <h2 className={`text-2xl font-black text-white ${anybody.className}`}>NEW STORY</h2>
                <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                    <X size={24} />
                </button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row p-6 gap-8 overflow-y-auto items-center justify-center">
                <div className="flex flex-col gap-4 w-full max-w-sm">
                    <div className="flex bg-[#252525] p-1 rounded-xl">
                        {(['photo', 'video', 'text'] as const).map(t => (
                            <button 
                                key={t} 
                                onClick={() => { setType(t); setFile(null); setPreviewUrl(null); }}
                                className={`flex-1 py-3 text-sm font-bold capitalize transition-colors rounded-lg ${type === t ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-[#888] hover:text-white'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {type === 'text' && (
                        <div className="flex flex-col gap-4 mt-4">
                            <label className="text-[#888] font-bold text-xs uppercase tracking-widest">Background Color</label>
                            <div className="flex gap-3">
                                {['#ff4d00', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000'].map(c => (
                                    <button 
                                        key={c} onClick={() => setBg(c)} 
                                        className={`w-10 h-10 rounded-full border-4 transition-transform ${bg === c ? 'border-white scale-110' : 'border-transparent'}`} 
                                        style={{ backgroundColor: c }} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {(type === 'photo' || type === 'video') && (
                        <div className="flex flex-col gap-4 mt-4">
                            <input type="file" ref={fileRef} accept={type === 'photo' ? 'image/*' : 'video/*'} className="hidden" onChange={handleFile} />
                            <button 
                                onClick={() => fileRef.current?.click()}
                                className="w-full bg-[#353535] hover:bg-[#454545] text-white py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Camera size={20} /> Select {type}
                            </button>
                        </div>
                    )}

                    <motion.button 
                        whileTap={{ scale: 0.95 }} 
                        onClick={handleSubmit} 
                        disabled={loading || (type === 'text' && !content) || (type !== 'text' && !file)}
                        className="w-full mt-auto md:mt-8 bg-[#ff4d00] text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-[#ff4d00]/30 disabled:opacity-50 disabled:shadow-none transition-all"
                    >
                        {loading ? <Loader2 size={24} className="animate-spin mx-auto" /> : 'POST TO STORY'}
                    </motion.button>
                </div>

                {/* Preview */}
                <div className="w-[300px] h-[533px] bg-[#1c1c1c] rounded-[2rem] border-8 border-[#353535] overflow-hidden flex flex-col items-center justify-center relative shadow-2xl flex-shrink-0">
                    {type === 'text' ? (
                        <div className="w-full h-full flex items-center justify-center p-6 text-center transition-colors duration-500" style={{ backgroundColor: bg }}>
                            <textarea 
                                value={content} 
                                onChange={e => setContent(e.target.value)} 
                                placeholder="Type something..." 
                                className={`bg-transparent text-white text-3xl font-bold text-center outline-none resize-none w-full h-full pt-[40%] ${anybody.className} placeholder-white/30`} 
                            />
                        </div>
                    ) : previewUrl ? (
                        type === 'photo' ? (
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <video src={previewUrl} className="w-full h-full object-cover" autoPlay loop muted />
                        )
                    ) : (
                        <div className="text-[#555] flex flex-col items-center gap-2">
                            {type === 'photo' ? <ImageIcon size={48} /> : <Type size={48} />}
                            <span className="font-bold">Preview</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
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
    
    const [showViewers, setShowViewers] = useState(false)
    const [viewers, setViewers] = useState<{ userId: string, viewedAt: string }[]>([])
    const [viewersLoading, setViewersLoading] = useState(false)

    useEffect(() => {
        if (!isMine) {
            import('@/lib/stories').then(m => m.getStory(activeStory._id).catch(console.error));
        }
    }, [activeStory._id, isMine])

    useEffect(() => {
        setProgress(0)
        let frame: number
        let start = performance.now()
        // 5 seconds per story
        const duration = 5000 
        
        const tick = (now: number) => {
            const elap = now - start
            if (elap >= duration) {
                // next story
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

    const handleViewersClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowViewers(true);
        setViewersLoading(true);
        try {
            const m = await import('@/lib/stories');
            const data = await m.getStoryViewers(activeStory._id);
            setViewers(data);
            
            const { getUserProfile } = await import('@/lib/user');
            for (const v of data) {
                if (!profiles[v.userId]) {
                    try { profiles[v.userId] = await getUserProfile(v.userId); } catch {}
                }
            }
        } catch (err) {
            import('react-hot-toast').then(m => m.default.error("Failed to load viewers"));
        } finally {
            setViewersLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center">
            <div className="absolute top-0 left-0 w-full h-full" onClick={handleNext}></div>
            <div className="absolute top-0 left-0 w-[30%] h-full z-10" onClick={(e) => { e.stopPropagation(); handlePrev(); }}></div>
            <div className="absolute top-0 right-0 w-[30%] h-full z-10" onClick={(e) => { e.stopPropagation(); handleNext(); }}></div>

            <div className="w-full max-w-[400px] h-[100dvh] md:h-[80vh] md:rounded-[2rem] bg-[#1c1c1c] relative overflow-hidden flex flex-col items-center justify-center shadow-2xl z-20">
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
                    <div className="flex items-center gap-3">
                        <img src={profile?.avatar || 'https://via.placeholder.com/40'} alt="avatar" className="w-10 h-10 rounded-full object-cover border-2 border-white" />
                        <div className="flex flex-col drop-shadow-md">
                            <span className="text-white font-bold">{isMine ? 'Your Story' : (profile?.displayName || 'Unknown')}</span>
                            <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">
                                {new Date(activeStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isMine && (
                            <button onClick={(e) => { e.stopPropagation(); onDelete(activeStory._id); }} className="p-2 bg-black/40 hover:bg-red-500 rounded-full text-white transition-colors">
                                <Trash2 size={18} />
                            </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="w-full h-full relative bg-black">
                    {activeStory.type === 'text' && (
                        <div className="w-full h-full flex items-center justify-center p-8 text-center" style={{ backgroundColor: activeStory.backgroundColor || '#ff4d00' }}>
                            <p className={`text-white text-3xl font-bold ${anybody.className}`}>{activeStory.content}</p>
                        </div>
                    )}
                    {activeStory.type === 'photo' && activeStory.mediaUrl && (
                        <img src={activeStory.mediaUrl} alt="story" className="w-full h-full object-cover" />
                    )}
                    {activeStory.type === 'video' && activeStory.mediaUrl && (
                        <video src={activeStory.mediaUrl} className="w-full h-full object-cover" autoPlay />
                    )}
                </div>

                {/* Viewers (if mine) */}
                {isMine && !showViewers && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full backdrop-blur-md z-30 cursor-pointer hover:bg-black/80 transition-colors" onClick={handleViewersClick}>
                        <Users size={16} className="text-white" />
                        <span className="text-white text-xs font-bold">{Object.keys(activeStory.viewedBy || {}).length} views</span>
                    </div>
                )}

                {/* Viewers List Modal */}
                {showViewers && (
                    <div className="absolute inset-0 bg-black/90 z-40 flex flex-col p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`text-xl font-bold text-white ${anybody.className}`}>Viewers</h3>
                            <button onClick={() => setShowViewers(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {viewersLoading ? (
                            <div className="flex-1 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-[#ff4d00]" /></div>
                        ) : viewers.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-[#888]">No viewers yet</div>
                        ) : (
                            <div className="flex-1 overflow-y-auto flex flex-col gap-4">
                                {viewers.map(v => {
                                    const p = profiles[v.userId]
                                    return (
                                        <div key={v.userId} className="flex items-center gap-4 bg-[#252525] p-3 rounded-xl border border-[#353535]">
                                            <img src={p?.avatar || 'https://via.placeholder.com/40'} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold">{p?.displayName || 'Unknown'}</span>
                                                <span className="text-[#888] text-xs">@{p?.username || v.userId} • {new Date(v.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
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
        } catch (err) {
            toast.error("Failed to load stories")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (currentUserId) fetchStories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserId])

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this story?")) return
        try {
            await deleteStory(id)
            fetchStories()
            setActiveViewerIdx(null)
            toast.success("Story deleted")
        } catch (err) {
            toast.error("Failed to delete story")
        }
    }

    const hasAnyUnseenStory = feed.some(entry => 
        entry.stories.some(s => !(s.viewedBy && s.viewedBy[currentUserId]))
    )

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-[#131313] md:flex-row">
            {/* ── Left sidebar navigation for desktop ──────────────────────────────── */}
            <div className='hidden md:flex h-full w-[23%] bg-[#252525] flex-col flex-shrink-0'>
                <div className='h-32 border-b-2 border-[#353535] flex items-center px-8'>
                    <h1 className={`text-3xl text-white font-black ${anybody.className}`}>STORIES</h1>
                </div>
                <div className="flex flex-col p-4 gap-2">
                    <p className={`text-xs text-[#888] font-bold uppercase tracking-widest mb-4 ${anybody.className}`}>Your Activity</p>
                    <button 
                        onClick={() => setIsUploadOpen(true)}
                        className="flex items-center gap-4 bg-[#ff4d00]/10 hover:bg-[#ff4d00]/20 border-2 border-[#ff4d00] p-4 text-[#ff4d00] font-bold transition-all shadow-lg shadow-[#ff4d00]/10"
                        style={{ clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)' }}
                    >
                        <div className="w-10 h-10 rounded-full bg-[#ff4d00] flex items-center justify-center text-white">
                            <Plus size={20} />
                        </div>
                        Add to Story
                    </button>
                </div>
            </div>

            {/* ── Main content area ─────────────────────────────────────────────── */}
            <div className='h-full flex-1 bg-[#181818] flex flex-col overflow-y-auto pb-20 md:pb-0'>
                
                <div className="md:hidden p-6 pb-2">
                    <h1 className={`text-3xl text-white font-black ${anybody.className}`}>STORIES</h1>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#ff4d00]" /></div>
                ) : (
                    <div className="p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            
                            {/* Create Story Card */}
                            <div 
                                onClick={() => setIsUploadOpen(true)}
                                className="relative aspect-[9/16] bg-[#252525] rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform border-2 border-[#353535] shadow-lg group flex flex-col"
                            >
                                <div className="flex-1 bg-[#1c1c1c] flex items-center justify-center group-hover:bg-[#ff4d00]/20 transition-colors">
                                    <div className="w-12 h-12 rounded-full bg-[#ff4d00] flex items-center justify-center text-white shadow-lg shadow-[#ff4d00]/40">
                                        <Plus size={24} />
                                    </div>
                                </div>
                                <div className="h-12 bg-[#2a2a2a] flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">Add Story</span>
                                </div>
                            </div>

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
                                        className={`relative aspect-[9/16] bg-[#252525] rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform border-2 shadow-lg group ${hasUnseen ? 'border-[#ff4d00]' : 'border-[#353535]'}`}
                                    >
                                        {latestStory.type === 'text' ? (
                                            <div className="w-full h-full flex items-center justify-center p-4 text-center opacity-80 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: latestStory.backgroundColor || '#ff4d00' }}>
                                                <span className="text-white text-sm font-bold truncate max-w-full">{latestStory.content}</span>
                                            </div>
                                        ) : latestStory.type === 'photo' && latestStory.mediaUrl ? (
                                            <img src={latestStory.mediaUrl} alt="story" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        ) : latestStory.type === 'video' && latestStory.mediaUrl ? (
                                            <video src={latestStory.mediaUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" muted />
                                        ) : null}
                                        
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                                        
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                                            <img src={prof?.avatar || 'https://via.placeholder.com/32'} className={`w-8 h-8 rounded-full object-cover border-2 ${hasUnseen ? 'border-[#ff4d00]' : 'border-white'}`} />
                                            <span className="text-white text-xs font-bold truncate drop-shadow-md">{isMe ? 'You' : prof?.displayName || 'Unknown'}</span>
                                        </div>
                                        
                                        {hasUnseen && (
                                            <div className="absolute top-2 right-2 w-3 h-3 bg-[#ff4d00] rounded-full border-2 border-[#252525]" />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Right sidebar – navigation ─────────────────────────────── */}
            <div className='h-14 w-full md:h-full md:w-[5%] bg-[#252525] border-t-2 md:border-l-2 md:border-t-0 border-[#353535] flex-shrink-0 flex flex-row md:flex-col items-center justify-around md:justify-start py-0 md:py-5 gap-2 order-last md:order-last z-[150] fixed bottom-0 md:static'>
                {[
                    { href: '/chat',       icon: <MessageSquare size={18} />, title: 'Chats'      },
                    { href: '/stories',    icon: <Play          size={18} />, title: 'Stories',   dot: hasAnyUnseenStory },
                    { href: '/search',     icon: <Search        size={18} />, title: 'Search'     },
                    { href: '/buddies',    icon: <Users         size={18} />, title: 'Buddies'    },
                    { href: '/settings',   icon: <Settings      size={18} />, title: 'Settings'   },
                    { href: '/profile/me', icon: <UserCircle    size={18} />, title: 'My Profile' },
                ].map(({ href, icon, title, dot }) => {
                    const isActive = pathname === href
                    return (
                        <Link
                            key={href}
                            href={href}
                            title={title}
                            className={`w-10 h-10 flex items-center justify-center transition-colors relative ${
                                isActive
                                    ? 'bg-[#ff4d00]/15 text-[#ff4d00]'
                                    : 'text-[#555] hover:text-[#ff4d00] hover:bg-[#ff4d00]/10'
                            }`}
                            style={{ clipPath: 'polygon(6px 0%,100% 0%,100% calc(100% - 6px),calc(100% - 6px) 100%,0% 100%,0% 6px)' }}
                        >
                            {icon}
                            {dot && (
                                <span className='absolute top-1 right-1 w-2.5 h-2.5 bg-[#ff4d00] rounded-full border-2 border-[#252525]' />
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
