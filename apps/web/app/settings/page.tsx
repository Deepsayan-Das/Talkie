'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { Camera, Save, X } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400', '600'] })

const CLIP = 'polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px)'
const CLIP_BTN = 'polygon(10px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 10px)'

const NAV_LINKS = [
    { href: '/settings',         label: 'Profile' },
    { href: '/settings/account', label: 'Account' },
]

export default function SettingsPage() {
    const [displayName, setDisplayName] = useState('John Doe')
    const [bio, setBio]               = useState('Just vibing and shipping code. 🚀')
    const [preview, setPreview]       = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const dragCounter                 = useRef(0)
    const inputRef                    = useRef<HTMLInputElement>(null)

    const setFile = useCallback((f: File | undefined) => {
        if (!f || !f.type.startsWith('image/')) return
        const reader = new FileReader()
        reader.onload = () => setPreview(reader.result as string)
        reader.readAsDataURL(f)
    }, [])

    const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; setIsDragging(true) }
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); if (--dragCounter.current === 0) setIsDragging(false) }
    const onDragOver  = (e: React.DragEvent) => e.preventDefault()
    const onDrop      = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current = 0; setIsDragging(false); setFile(e.dataTransfer.files?.[0]) }

    const onSave = () => {
        // TODO: connect to user-service
        toast.success('Profile updated!')
    }

    return (
        <div className={`min-h-screen w-full bg-[#131313] flex ${jetbrains.className}`}>
            <Toaster position='top-center' toastOptions={{ style: { background: '#252525', color: '#fff', border: '1px solid #ff4d00' } }} />

            {/* Sidebar nav */}
            <aside className='w-52 flex-shrink-0 bg-[#1c1c1c] border-r-2 border-[#2a2a2a] flex flex-col pt-12 px-4 gap-1'>
                <p className={`text-[10px] uppercase tracking-widest text-[#444] mb-3 ${anybody.className}`}>Settings</p>
                {NAV_LINKS.map(link => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`w-full px-3 py-2.5 text-sm font-bold transition-colors text-left ${
                            link.href === '/settings'
                                ? 'text-[#ff4d00] bg-[#ff4d00]/10'
                                : 'text-[#666] hover:text-white'
                        }`}
                        style={{ clipPath: CLIP_BTN }}
                    >
                        {link.label}
                    </Link>
                ))}
            </aside>

            {/* Main content */}
            <main className='flex-1 flex flex-col items-center pt-12 px-6 pb-12'>
                <div className='w-full max-w-lg flex flex-col gap-6'>
                    <h1 className='text-2xl font-black text-white'>EDIT PROFILE</h1>

                    {/* Avatar upload */}
                    <div className='flex flex-col items-center gap-3'>
                        <div
                            className={`relative w-28 h-28 rounded-full cursor-pointer overflow-hidden border-2 transition-colors ${isDragging ? 'border-[#ff4d00]' : 'border-[#353535]'}`}
                            onClick={() => inputRef.current?.click()}
                            onDragEnter={onDragEnter}
                            onDragLeave={onDragLeave}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                        >
                            {preview ? (
                                <img src={preview} alt='avatar' className='w-full h-full object-cover' />
                            ) : (
                                <div className='w-full h-full bg-[#ff4d00] flex items-center justify-center text-white text-4xl font-black'>
                                    {displayName[0]?.toUpperCase() ?? '?'}
                                </div>
                            )}
                            <div className='absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity'>
                                <Camera size={20} className='text-white' />
                            </div>
                        </div>
                        {preview && (
                            <button onClick={() => setPreview(null)} className='flex items-center gap-1 text-[#666] text-xs hover:text-red-400 transition-colors'>
                                <X size={12} /> Remove photo
                            </button>
                        )}
                        <input ref={inputRef} type='file' accept='image/*' className='hidden' onChange={e => setFile(e.target.files?.[0])} />
                        <p className={`text-[#555] text-xs ${anybody.className} font-light`}>Click or drag & drop · JPEG, PNG, WEBP · up to 5MB</p>
                    </div>

                    {/* Form */}
                    <div className='flex flex-col gap-4'>
                        {/* Display name */}
                        <div className='flex flex-col gap-1'>
                            <label className={`text-xs text-[#888] uppercase tracking-widest ${anybody.className}`}>Display Name</label>
                            <input
                                type='text'
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                maxLength={40}
                                className='bg-[#252525] border-b-2 border-[#353535] focus:border-[#ff4d00] text-white px-4 py-3 text-sm outline-none transition-colors'
                                style={{ clipPath: CLIP }}
                            />
                        </div>

                        {/* Username — readonly */}
                        <div className='flex flex-col gap-1'>
                            <label className={`text-xs text-[#888] uppercase tracking-widest ${anybody.className}`}>
                                Username <span className='text-[#555] normal-case tracking-normal'>(cannot be changed)</span>
                            </label>
                            <input
                                type='text'
                                value='john_doe'
                                readOnly
                                className='bg-[#1c1c1c] border-b-2 border-[#2a2a2a] text-[#555] px-4 py-3 text-sm outline-none cursor-not-allowed'
                                style={{ clipPath: CLIP }}
                            />
                        </div>

                        {/* Bio */}
                        <div className='flex flex-col gap-1'>
                            <label className={`text-xs text-[#888] uppercase tracking-widest ${anybody.className}`}>
                                Bio <span className='text-[#555] normal-case tracking-normal'>(optional · max 160 chars)</span>
                            </label>
                            <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                maxLength={160}
                                rows={3}
                                className='bg-[#252525] border-b-2 border-[#353535] focus:border-[#ff4d00] text-white px-4 py-3 text-sm outline-none resize-none transition-colors'
                                style={{ clipPath: CLIP }}
                            />
                            <p className={`text-[#444] text-[10px] self-end ${anybody.className}`}>{bio.length}/160</p>
                        </div>

                        <button
                            onClick={onSave}
                            className='h-12 flex items-center justify-center gap-2 bg-[#ff4d00] text-white font-bold text-sm hover:bg-[#e04500] transition-colors active:scale-95 mt-2'
                            style={{ clipPath: CLIP }}
                        >
                            <Save size={15} /> SAVE CHANGES
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}
