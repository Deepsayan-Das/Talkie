'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Eye, EyeOff, ShieldCheck, ArrowRight, Lock, Mail } from 'lucide-react'

type LoginValues = { email: string; password: string }
type SignupValues = { email: string; password: string; confirmPassword: string }

// ─── LoginForm Component ──────────────────────────────────────────────────
const LoginForm: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
    const router = useRouter()
    const { login } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<LoginValues>({ mode: 'onTouched' })

    const onSubmit = async (data: LoginValues) => {
        try {
            await login(data.email, data.password)
            toast.success('Welcome back!')
            reset()
            router.push('/chat')
        } catch (err: any) {
            const msg = err.response?.data?.message ?? 'Login failed'
            if (msg === 'INVALID CREDENTIALS') toast.error('Wrong email or password.')
            else toast.error(msg)
        }
    }

    return (
        <motion.form
            key="login"
            onSubmit={handleSubmit(onSubmit)}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col gap-5 text-left"
        >
            <div className="flex flex-col gap-1 border-b border-[#27272a] pb-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">
                        Welcome back
                    </h2>
                    <Badge variant="active" dot>Encrypted</Badge>
                </div>
                <p className="text-xs text-neutral-400">
                    Sign in to access your secure conversations.
                </p>
            </div>

            <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                leftElement={<Mail className="w-4 h-4 text-neutral-500" />}
                error={errors.email?.message}
                {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                })}
            />

            <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                leftElement={<Lock className="w-4 h-4 text-neutral-500" />}
                rightElement={
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-neutral-500 hover:text-neutral-200 transition-colors p-1 cursor-pointer"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                }
                error={errors.password?.message}
                {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Must be at least 6 characters' },
                })}
            />

            <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-neutral-500">
                    Don't have an account?
                </span>
                <button
                    type="button"
                    onClick={onSwitch}
                    className="text-neutral-200 hover:text-white underline underline-offset-4 cursor-pointer font-medium"
                >
                    Create account →
                </button>
            </div>

            <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" />}
            >
                LOG IN
            </Button>
        </motion.form>
    )
}

// ─── SignupForm Component ─────────────────────────────────────────────────
const SignupForm: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
    const router = useRouter()
    const { register: registerUser } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<SignupValues>({ mode: 'onTouched' })

    const password = watch('password')

    const onSubmit = async (data: SignupValues) => {
        try {
            await registerUser(data.email, data.password)
            toast.success('Account created! Check inbox for verification.', { duration: 6000 })
            reset()
            router.push('/onboarding')
        } catch (err: any) {
            const msg = err.response?.data?.message ?? 'Registration failed'
            if (msg === 'User already exists') toast.error('Email is already registered.')
            else toast.error(msg)
        }
    }

    return (
        <motion.form
            key="signup"
            onSubmit={handleSubmit(onSubmit)}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col gap-4 text-left"
        >
            <div className="flex flex-col gap-1 border-b border-[#27272a] pb-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">
                        Create Account
                    </h2>
                    <Badge variant="mono">Join Talkie</Badge>
                </div>
                <p className="text-xs text-neutral-400">
                    Get started with end-to-end encrypted messaging.
                </p>
            </div>

            <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                leftElement={<Mail className="w-4 h-4 text-neutral-500" />}
                error={errors.email?.message}
                {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                })}
            />

            <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                leftElement={<Lock className="w-4 h-4 text-neutral-500" />}
                rightElement={
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-neutral-500 hover:text-neutral-200 transition-colors p-1 cursor-pointer"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                }
                error={errors.password?.message}
                {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Must be at least 6 characters' },
                })}
            />

            <Input
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                leftElement={<Lock className="w-4 h-4 text-neutral-500" />}
                error={errors.confirmPassword?.message}
                {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) => value === password || 'Passwords do not match',
                })}
            />

            <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-neutral-500">
                    Already have an account?
                </span>
                <button
                    type="button"
                    onClick={onSwitch}
                    className="text-neutral-200 hover:text-white underline underline-offset-4 cursor-pointer font-medium"
                >
                    Log in instead →
                </button>
            </div>

            <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" />}
            >
                CREATE ACCOUNT
            </Button>
        </motion.form>
    )
}

// ─── Main Page ─────────────────────────────────────────────────────────────
const Page: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')

    return (
        <div className="min-h-screen w-full relative flex items-center justify-center bg-[#080808] bg-grid-pattern p-4 sm:p-6 overflow-hidden">
            <div className="absolute w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-md bg-[#121212] border border-[#27272a] shadow-2xl rounded-sm p-6 sm:p-8 flex flex-col gap-6"
            >
                {/* Brand Header */}
                <div className="flex items-center justify-between border-b border-[#27272a] pb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold text-sm rounded-xs">
                            T
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="font-bold text-base text-neutral-100 tracking-tight">
                                TALKIE
                            </span>
                            <span className="text-[11px] text-neutral-500">
                                End-to-End Encrypted Messenger
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tab Controls */}
                <div className="grid grid-cols-2 p-1 bg-[#18181b] border border-[#27272a] rounded-sm text-xs relative">
                    <button
                        onClick={() => setActiveTab('login')}
                        className={`py-2 px-3 transition-colors cursor-pointer text-center relative z-10 font-semibold ${
                            activeTab === 'login' ? 'text-black' : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                        LOGIN
                    </button>
                    <button
                        onClick={() => setActiveTab('signup')}
                        className={`py-2 px-3 transition-colors cursor-pointer text-center relative z-10 font-semibold ${
                            activeTab === 'signup' ? 'text-black' : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                        SIGNUP
                    </button>

                    <motion.div
                        layout
                        animate={{ x: activeTab === 'login' ? '0%' : '100%' }}
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] bg-white rounded-xs z-0"
                    />
                </div>

                {/* Form Switcher */}
                <div className="overflow-hidden">
                    <AnimatePresence mode="wait">
                        {activeTab === 'login' ? (
                            <LoginForm key="login" onSwitch={() => setActiveTab('signup')} />
                        ) : (
                            <SignupForm key="signup" onSwitch={() => setActiveTab('login')} />
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Security Notice */}
                <div className="flex items-center justify-between pt-4 border-t border-[#27272a] text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-neutral-400" />
                        <span>Zero-Knowledge E2EE</span>
                    </span>
                    <span>Talkie v1.1</span>
                </div>
            </motion.div>
        </div>
    )
}

export default Page