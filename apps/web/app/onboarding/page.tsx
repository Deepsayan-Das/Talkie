'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { updateUserProfile, uploadAvatar } from '@/lib/user'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Upload, X, User, ArrowRight, Sparkles } from 'lucide-react'

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

type FormValues = {
    username: string
    bio: string
}

const Page: React.FC = () => {
    const router = useRouter()
    const { user } = useAuth()
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
            setFileError('Only JPEG, JPG, PNG, WEBP or GIF files allowed')
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
            toast.success('PROFILE SAVED')
            router.push('/chat')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Could not save profile')
        } finally {
            setIsSubmitting(false)
        }
    }

    const fallbackLetter = username?.trim()?.[0]?.toUpperCase() || '?'

    return (
        <div className="min-h-screen w-full relative flex items-center justify-center bg-[#080808] bg-grid-pattern p-4 sm:p-6 overflow-hidden">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-lg bg-[#121212] border border-[#27272a] shadow-2xl rounded-sm p-6 sm:p-8 flex flex-col gap-6"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
                    <div className="flex flex-col gap-1 text-left">
                        <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                            [03.0 // IDENTITY SETUP]
                        </span>
                        <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">
                            Personalize Account
                        </h1>
                    </div>
                    <Badge variant="mono">[STEP 1 OF 1]</Badge>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 text-left">
                    {/* Username */}
                    <Input
                        label="Public Handle / Display Name"
                        type="text"
                        placeholder="e.g. john_doe"
                        leftElement={<User className="w-4 h-4 text-neutral-500" />}
                        error={errors.username?.message}
                        hint="Allowed: letters, numbers, underscore (_), dot (.), hyphen (-)"
                        {...register('username', {
                            required: 'Username is required',
                            minLength: { value: 3, message: 'At least 3 characters' },
                            maxLength: { value: 20, message: 'No more than 20 characters' },
                            pattern: {
                                value: USERNAME_REGEX,
                                message: 'Only letters, numbers, _ . and - allowed',
                            },
                        })}
                    />

                    {/* Avatar Uploader */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <label className="font-medium text-neutral-300">
                                Profile Avatar
                            </label>
                            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                                IMG.AVATAR (OPTIONAL)
                            </span>
                        </div>

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
                            className={`relative w-full h-36 cursor-pointer flex items-center justify-center border border-dashed rounded-sm transition-all ${
                                isDragging
                                    ? 'border-white bg-[#1a1a1e]'
                                    : 'border-[#27272a] bg-[#161616] hover:border-neutral-500'
                            }`}
                        >
                            <AnimatePresence mode="wait">
                                {preview ? (
                                    <motion.div
                                        key="preview"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="relative w-full h-full flex items-center justify-center p-2"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={preview}
                                            alt="Preview"
                                            className="h-24 w-24 object-cover rounded-xs border border-neutral-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeFile}
                                            className="absolute top-2 right-2 bg-black/80 text-white w-6 h-6 flex items-center justify-center rounded-xs hover:bg-white hover:text-black transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="absolute bottom-2 text-[10px] font-mono text-neutral-400 bg-black/60 px-2 py-0.5 rounded-xs">
                                            {file?.name}
                                        </span>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="empty"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex flex-col items-center gap-2 pointer-events-none p-4 text-center"
                                    >
                                        <Upload className={`w-6 h-6 ${isDragging ? 'text-white' : 'text-neutral-500'}`} />
                                        <span className="text-xs text-neutral-300">
                                            {isDragging ? 'Drop file to upload' : 'Drag & drop image here, or click to browse'}
                                        </span>
                                        <span className="font-mono text-[10px] text-neutral-500">
                                            JPEG, PNG, WEBP · MAX 5MB
                                        </span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {fileError && (
                            <span className="text-[11px] font-mono text-red-400">
                                [!] {fileError}
                            </span>
                        )}

                        {!file && (
                            <div className="flex items-center gap-2.5 mt-1 p-2 bg-[#161616] border border-[#27272a] rounded-sm text-xs text-neutral-400">
                                <div className="w-6 h-6 bg-white text-black font-mono font-bold flex items-center justify-center rounded-xs shrink-0 text-xs">
                                    {fallbackLetter}
                                </div>
                                <span className="font-mono text-[11px]">
                                    Default monochrome avatar will be assigned based on handle.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Bio */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <label className="font-medium text-neutral-300">
                                Status / Bio
                            </label>
                            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                                OPTIONAL
                            </span>
                        </div>
                        <textarea
                            placeholder="A concise line about your key identity..."
                            rows={3}
                            {...register('bio', {
                                maxLength: { value: 160, message: 'Keep under 160 characters' },
                            })}
                            className="w-full bg-[#121212] text-neutral-100 placeholder:text-neutral-600 text-sm border border-[#27272a] rounded-sm p-3 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400/20 resize-none font-sans"
                        />
                        {errors.bio && (
                            <span className="text-[11px] font-mono text-red-400">
                                [!] {errors.bio.message}
                            </span>
                        )}
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        isLoading={isSubmitting}
                        className="w-full mt-2"
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                        ENTER WORKSPACE
                    </Button>
                </form>
            </motion.div>
        </div>
    )
}

export default Page