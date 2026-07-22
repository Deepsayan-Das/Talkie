'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Camera, Save, X, Loader2, User, ShieldCheck, Key } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { getUserProfile, updateUserProfile, uploadAvatar } from '@/lib/user'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

const NAV_LINKS = [
    { href: '/settings', label: 'Profile' },
    { href: '/settings/account', label: 'Account & Security' },
]

export default function SettingsPage() {
    const { user: authUser } = useAuth()

    const [displayName, setDisplayName] = useState('')
    const [username, setUsername] = useState('')
    const [bio, setBio] = useState('')
    const [existingAvatar, setExistingAvatar] = useState<string | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const dragCounter = useRef(0)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!authUser?.id) return
        getUserProfile(authUser.id)
            .then(profile => {
                setDisplayName(profile.displayName ?? profile.username ?? '')
                setUsername(profile.username ?? '')
                setBio(profile.bio ?? '')
                setExistingAvatar(profile.avatar ?? null)
            })
            .catch(() => toast.error('Failed to load profile'))
            .finally(() => setIsLoading(false))
    }, [authUser?.id])

    const setFile = useCallback((f: File | undefined) => {
        if (!f || !f.type.startsWith('image/')) return
        setAvatarFile(f)
        const reader = new FileReader()
        reader.onload = () => setPreview(reader.result as string)
        reader.readAsDataURL(f)
    }, [])

    const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; setIsDragging(true) }
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); if (--dragCounter.current === 0) setIsDragging(false) }
    const onDragOver = (e: React.DragEvent) => e.preventDefault()
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        dragCounter.current = 0
        setIsDragging(false)
        setFile(e.dataTransfer.files?.[0])
    }

    const onSave = async () => {
        if (!authUser?.id) return
        setIsSaving(true)
        try {
            let avatarUrl: string | undefined
            if (avatarFile) {
                avatarUrl = await uploadAvatar(avatarFile)
            }
            await updateUserProfile(authUser.id, {
                displayName: displayName || undefined,
                bio: bio || undefined,
                avatar: avatarUrl,
            })
            if (avatarUrl) setExistingAvatar(avatarUrl)
            setPreview(null)
            setAvatarFile(null)
            toast.success('PROFILE UPDATED')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Failed to save profile')
        } finally {
            setIsSaving(false)
        }
    }

    const currentAvatar = preview ?? existingAvatar

    return (
        <div className="min-h-screen w-full bg-[#080808] text-neutral-100 flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-[#121212] border-r border-[#27272a] flex flex-col p-6 gap-2 shrink-0">
                <div className="flex items-center gap-2 mb-4 border-b border-[#27272a] pb-4">
                    <div className="w-6 h-6 bg-white text-black font-bold text-xs flex items-center justify-center rounded-xs">
                        T
                    </div>
                    <span className="font-bold text-sm tracking-tight text-neutral-100">
                        SETTINGS
                    </span>
                </div>

                <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest px-2 mb-1">
                        PREFERENCES
                    </span>
                    {NAV_LINKS.map(link => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`px-3 py-2 text-xs font-mono rounded-xs transition-colors text-left ${
                                link.href === '/settings'
                                    ? 'bg-white text-black font-bold'
                                    : 'text-neutral-400 hover:text-white hover:bg-[#18181b]'
                            }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </aside>

            {/* Main Editor */}
            <main className="flex-1 p-6 sm:p-12 flex justify-center overflow-y-auto">
                <div className="w-full max-w-lg flex flex-col gap-8 text-left">
                    <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
                        <div className="flex flex-col gap-1">
                            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                                [SETTINGS // PROFILE]
                            </span>
                            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                                Personal Details
                            </h1>
                        </div>
                        <Badge variant="mono" dot>LIVE</Badge>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-neutral-400" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {/* Avatar section */}
                            <div className="flex flex-col items-center gap-3 bg-[#121212] border border-[#27272a] p-6 rounded-sm">
                                <div
                                    className={`relative w-24 h-24 rounded-xs cursor-pointer overflow-hidden border transition-all ${
                                        isDragging ? 'border-white bg-[#18181b]' : 'border-[#27272a] hover:border-neutral-500'
                                    }`}
                                    onClick={() => inputRef.current?.click()}
                                    onDragEnter={onDragEnter}
                                    onDragLeave={onDragLeave}
                                    onDragOver={onDragOver}
                                    onDrop={onDrop}
                                >
                                    {currentAvatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={currentAvatar} alt="avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-[#18181b] flex items-center justify-center text-white font-mono text-2xl font-bold">
                                            {(displayName[0] ?? username[0])?.toUpperCase() ?? '?'}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <Camera size={18} className="text-white" />
                                    </div>
                                </div>

                                {preview && (
                                    <button
                                        onClick={() => { setPreview(null); setAvatarFile(null) }}
                                        className="flex items-center gap-1 font-mono text-[11px] text-red-400 hover:underline cursor-pointer"
                                    >
                                        <X size={12} /> Remove custom image
                                    </button>
                                )}

                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => setFile(e.target.files?.[0])}
                                />
                                <span className="font-mono text-[10px] text-neutral-500">
                                    Click or drag image · JPEG, PNG, WEBP · up to 5MB
                                </span>
                            </div>

                            {/* Inputs */}
                            <Input
                                label="Display Name"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                maxLength={40}
                                leftElement={<User className="w-4 h-4 text-neutral-500" />}
                            />

                            <Input
                                label="Username (System Handle)"
                                value={username}
                                readOnly
                                disabled
                                hint="Handles cannot be modified after registration."
                            />

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <label className="font-medium text-neutral-300">Bio</label>
                                    <span className="font-mono text-[10px] text-neutral-500">{bio.length}/160</span>
                                </div>
                                <textarea
                                    value={bio}
                                    onChange={e => setBio(e.target.value)}
                                    maxLength={160}
                                    rows={3}
                                    className="w-full bg-[#121212] text-neutral-100 text-sm border border-[#27272a] rounded-sm p-3 focus:outline-none focus:border-neutral-400 transition-all resize-none"
                                />
                            </div>

                            <Button
                                onClick={onSave}
                                isLoading={isSaving}
                                variant="primary"
                                size="lg"
                                className="w-full mt-2"
                                leftIcon={<Save className="w-4 h-4" />}
                            >
                                SAVE CHANGES
                            </Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
