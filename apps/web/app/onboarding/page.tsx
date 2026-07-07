'use client'
import React, { useState, useRef, useCallback } from 'react'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { updateUserProfile, uploadAvatar } from '@/lib/user'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['100', '200', '300', '400', '500', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['100', '200', '300', '400', '500', '600', '700', '800'] })

const clipPath = '[clip-path:polygon(20px_0%,100%_0%,100%_calc(100%-20px),calc(100%-20px)_100%,0%_100%,0%_20px)]'
const smallClip = '[clip-path:polygon(10px_0%,100%_0%,100%_calc(100%-10px),calc(100%-10px)_100%,0%_100%,0%_10px)]'

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/ // letters, numbers, underscore, dot, hyphen only
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const AVATAR_COLORS = ['#ff4d00', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

function colorFromString(str: string) {
    let hash = 0
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

type FormValues = {
    username: string
    bio: string
}

const Page: React.FC = () => {
    const router = useRouter()
    const { accessToken, user } = useAuth()
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<FormValues>({ mode: 'onTouched' })

    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [fileError, setFileError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const dragCounter = useRef(0)

    const username = watch('username')

    const validateAndSetFile = useCallback((f: File | undefined) => {
        if (!f) return
        if (!ACCEPTED_TYPES.includes(f.type)) {
            setFileError('Only JPEG, JPG, PNG, WEBP or GIF files are allowed')
            return
        }
        if (f.size > MAX_FILE_SIZE) {
            setFileError('File must be under 5MB')
            return
        }
        setFileError(null)
        setFile(f)
        const reader = new FileReader()
        reader.onload = () => setPreview(reader.result as string)
        reader.readAsDataURL(f)
    }, [])

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current += 1
        if (e.dataTransfer.items?.length) setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current -= 1
        if (dragCounter.current === 0) setIsDragging(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current = 0
        setIsDragging(false)
        const dropped = e.dataTransfer.files?.[0]
        validateAndSetFile(dropped)
    }

    const removeFile = (e: React.MouseEvent) => {
        e.stopPropagation()
        setFile(null)
        setPreview(null)
        setFileError(null)
        if (inputRef.current) inputRef.current.value = ''
    }

    const onSubmit = async (data: FormValues) => {
        const userId = user?.id
        if (!userId) { toast.error('Not authenticated'); return }
        setIsSubmitting(true)
        try {
            let avatarUrl: string | undefined
            if (file) {
                try {
                    avatarUrl = await uploadAvatar(file)
                } catch {
                    toast.error('Avatar upload failed — saving profile without it')
                }
            }
            await updateUserProfile(userId, {
                displayName: data.username,
                bio: data.bio || undefined,
                avatar: avatarUrl,
            })
            toast.success('Profile saved! Let\'s go 🚀')
            router.push('/chat')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Could not save profile')
        } finally {
            setIsSubmitting(false)
        }
    }

    const fallbackLetter = username?.trim()?.[0]?.toUpperCase() || '?'
    const fallbackColor = colorFromString(username || 'default')

    return (
        <div className={`min-h-screen w-full relative flex items-center justify-center bg-[#1c1c1c] ${jetbrains.className} font-extrabold py-10`}>
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-[35%] min-w-[380px] bg-[#252525] flex flex-col p-8 gap-5"
            >
                <div>
                    <h1 className="text-5xl font-black">TELL US ABOUT YOURSELF</h1>
                    <p className={`text-[#888] font-light mt-2 ${anybody.className}`}>
                        Just a few details and you&apos;re set.
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                    {/* Username */}
                    <div className="flex flex-col">
                        <label className={`text-sm text-[#aaa] mb-1 ${anybody.className} font-light`}>
                            Username <span className="text-[#ff4d00]">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. john_doe-99"
                            {...register('username', {
                                required: 'Username is required',
                                minLength: { value: 3, message: 'At least 3 characters' },
                                maxLength: { value: 20, message: 'No more than 20 characters' },
                                pattern: {
                                    value: USERNAME_REGEX,
                                    message: 'Only letters, numbers, _ . and - are allowed',
                                },
                            })}
                            className={`w-full h-12 bg-[#353535] outline-none border-b-4 ${errors.username ? 'border-b-red-500' : 'border-b-[#525252]'
                                } px-4 focus:border-b-[#ff4d00] transition-colors`}
                        />
                        {errors.username ? (
                            <span className={`text-red-500 text-xs mt-1 ${anybody.className} font-light`}>
                                {errors.username.message}
                            </span>
                        ) : (
                            <span className={`text-[#666] text-xs mt-1 ${anybody.className} font-light`}>
                                Allowed: letters, numbers, underscore ( _ ), dot ( . ), hyphen ( - )
                            </span>
                        )}
                    </div>

                    {/* File uploader */}
                    <div className="flex flex-col">
                        <label className={`text-sm text-[#aaa] mb-1 ${anybody.className} font-light`}>
                            Profile picture <span className="text-[#666]">(optional)</span>
                        </label>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => validateAndSetFile(e.target.files?.[0])}
                        />

                        <div
                            onClick={() => inputRef.current?.click()}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={`relative w-full h-40 cursor-pointer flex items-center justify-center
                                border-2 border-dashed transition-colors duration-200
                                ${isDragging ? 'border-[#ff4d00] bg-[#2f2a24]' : 'border-[#525252] bg-[#353535]'}
                            `}
                        >
                            <AnimatePresence mode="wait">
                                {preview ? (
                                    <motion.div
                                        key="preview"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="relative w-full h-full flex items-center justify-center"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={preview} alt="Preview" className="h-28 w-28 object-cover rounded-full" />
                                        <button
                                            type="button"
                                            onClick={removeFile}
                                            className={`absolute top-2 right-2 bg-[#1c1c1c] text-white w-7 h-7 flex items-center justify-center text-sm hover:bg-[#ff4d00] transition-colors ${smallClip}`}
                                        >
                                            ✕
                                        </button>
                                        <span className={`absolute bottom-2 text-xs text-[#888] ${anybody.className}`}>
                                            {file?.name}
                                        </span>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="empty"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex flex-col items-center gap-2 pointer-events-none"
                                    >
                                        <svg
                                            width="32"
                                            height="32"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke={isDragging ? '#ff4d00' : '#888'}
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        <span className={`text-sm ${isDragging ? 'text-[#ff4d00]' : 'text-[#888]'} ${anybody.className} font-light text-center px-4`}>
                                            {isDragging ? 'Drop it here' : 'Drag & drop an image, or click to browse'}
                                        </span>
                                        <span className={`text-[10px] text-[#555] ${anybody.className}`}>JPEG, PNG, WEBP or GIF · up to 5MB</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {fileError && <span className={`text-red-500 text-xs mt-1 ${anybody.className} font-light`}>{fileError}</span>}

                        {!file && (
                            <div className={`flex items-center gap-2 mt-2 text-[#666] text-xs ${anybody.className} font-light`}>
                                <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                                    style={{ backgroundColor: fallbackColor }}
                                >
                                    {fallbackLetter}
                                </div>
                                No image yet — we&apos;ll generate this avatar from your username
                            </div>
                        )}
                    </div>

                    {/* Bio */}
                    <div className="flex flex-col">
                        <label className={`text-sm text-[#aaa] mb-1 ${anybody.className} font-light`}>
                            Bio <span className="text-[#666]">(optional)</span>
                        </label>
                        <textarea
                            placeholder="A short line about yourself..."
                            rows={3}
                            {...register('bio', {
                                maxLength: { value: 160, message: 'Keep it under 160 characters' },
                            })}
                            className={`w-full bg-[#353535] outline-none border-b-4 ${errors.bio ? 'border-b-red-500' : 'border-b-[#525252]'
                                } px-4 py-3 focus:border-b-[#ff4d00] transition-colors resize-none ${anybody.className} font-light`}
                        />
                        {errors.bio && <span className={`text-red-500 text-xs mt-1 ${anybody.className} font-light`}>{errors.bio.message}</span>}
                    </div>

                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full h-12 bg-[#ff4d00] text-2xl mt-2 ${clipPath} disabled:opacity-60`}
                    >
                        {isSubmitting ? 'SAVING...' : 'CONTINUE'}
                    </motion.button>
                </form>
            </motion.div>
        </div>
    )
}

export default Page