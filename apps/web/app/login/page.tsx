'use client'
import React, { useState } from 'react'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { resendVerification } from '@/lib/auth'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['100', '200', '300', '400', '500', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['100', '200', '300', '400', '500', '600', '700', '800'] })

const clipPath = '[clip-path:polygon(20px_0%,100%_0%,100%_calc(100%-20px),calc(100%-20px)_100%,0%_100%,0%_20px)]'

// ---------- Eye / EyeOff icons (inline, no extra deps) ----------
const EyeIcon = ({ open }: { open: boolean }) =>
    open ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61" />
            <path d="M1 1l22 22" />
        </svg>
    )

// ---------- Reusable password input with show/hide toggle ----------
type PasswordFieldProps = {
    placeholder: string
    // UseFormRegisterReturn from react-hook-form spread onto <input>
    register: ReturnType<import('react-hook-form').UseFormRegister<Record<string, string>>>
    error?: string
}
const PasswordField: React.FC<PasswordFieldProps> = ({ placeholder, register, error }) => {
    const [visible, setVisible] = useState(false)
    return (
        <div className="w-[90%] flex flex-col">
            <div className="relative w-full">
                <input
                    type={visible ? 'text' : 'password'}
                    placeholder={placeholder}
                    {...register}
                    className={`w-full h-12 bg-[#353535] outline-none border-b-4 ${error ? 'border-b-red-500' : 'border-b-[#525252]'} px-4 pr-12 focus:border-b-[#ff4d00] transition-colors`}
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#ff4d00] transition-colors"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                >
                    <EyeIcon open={visible} />
                </button>
            </div>
            {error && <span className={`text-red-500 text-xs mt-1 ${anybody.className} font-light`}>{error}</span>}
        </div>
    )
}

// ---------- Login form ----------
type LoginValues = { email: string; password: string }

const LoginForm: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
    const router = useRouter()
    const { login } = useAuth()
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<LoginValues>({ mode: 'onTouched' })

    const onSubmit = async (data: LoginValues) => {
        try {
            const user = await login(data.email, data.password)
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
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full h-full flex flex-col items-center justify-center gap-4"
        >
            <h1 className="w-[60%] text-7xl font-black self-start ml-6">WELCOME BACK</h1>

            <div className="w-[90%] flex flex-col">
                <input
                    type="text"
                    placeholder="Email (eg. johnDoe@example.com)"
                    {...register('email', {
                        required: 'Email is required',
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                    })}
                    className={`w-full h-12 bg-[#353535] outline-none border-b-4 ${errors.email ? 'border-b-red-500' : 'border-b-[#525252]'} px-4 focus:border-b-[#ff4d00] transition-colors`}
                />
                {errors.email && <span className={`text-red-500 text-xs mt-1 ${anybody.className} font-light`}>{errors.email.message}</span>}
            </div>

            <PasswordField
                placeholder="Password"
                register={register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Must be at least 6 characters' },
                })}
                error={errors.password?.message as string}
            />

            <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isSubmitting}
                className={`w-[90%] h-15 bg-[#ff4d00] text-3xl ${clipPath} disabled:opacity-60`}
            >
                {isSubmitting ? '...' : 'LOGIN'}
            </motion.button>

            <span className={`font-light ${anybody.className} self-end mr-[10%]`}>
                No account ?{' '}
                <span className="text-[#ff4d00] cursor-pointer" onClick={onSwitch}>
                    create one
                </span>
            </span>
        </motion.form>
    )
}

// ---------- Signup form ----------
type SignupValues = { email: string; password: string; confirmPassword: string }

const SignupForm: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
    const router = useRouter()
    const { register: registerUser } = useAuth()
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<SignupValues>({ mode: 'onTouched' })

    const password = watch('password')
    const [unverifiedToken, setUnverifiedToken] = useState<string | null>(null)

    const onSubmit = async (data: SignupValues) => {
        try {
            const user = await registerUser(data.email, data.password)
            toast('Account created! Check your inbox for the verification email.', { icon: '📧', duration: 6000 })
            reset()
            router.push('/onboarding')
        } catch (err: any) {
            const msg = err.response?.data?.message ?? 'Registration failed'
            if (msg === 'User already exists') toast.error('That email is already registered.')
            else toast.error(msg)
        }
    }

    const handleResend = async () => {
        try {
            await resendVerification()
            toast.success('Verification email resent!')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Could not resend email')
        }
    }

    return (
        <motion.form
            key="signup"
            onSubmit={handleSubmit(onSubmit)}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full h-full flex flex-col items-center justify-center gap-4"
        >
            <h1 className="w-[60%] text-7xl font-black self-start ml-6">JOIN NOW</h1>

            <div className="w-[90%] flex flex-col">
                <input
                    type="text"
                    placeholder="Email (eg. johnDoe@example.com)"
                    {...register('email', {
                        required: 'Email is required',
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                    })}
                    className={`w-full h-12 bg-[#353535] outline-none border-b-4 ${errors.email ? 'border-b-red-500' : 'border-b-[#525252]'} px-4 focus:border-b-[#ff4d00] transition-colors`}
                />
                {errors.email && <span className={`text-red-500 text-xs mt-1 ${anybody.className} font-light`}>{errors.email.message}</span>}
            </div>

            <PasswordField
                placeholder="Password"
                register={register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Must be at least 6 characters' },
                })}
                error={errors.password?.message as string}
            />

            <PasswordField
                placeholder="Confirm Password"
                register={register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) => value === password || 'Passwords do not match',
                })}
                error={errors.confirmPassword?.message as string}
            />

            <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isSubmitting}
                className={`w-[90%] h-15 bg-[#ff4d00] text-3xl ${clipPath} disabled:opacity-60`}
            >
                {isSubmitting ? '...' : 'SIGNUP'}
            </motion.button>

            <span className={`font-light ${anybody.className} self-end mr-[10%]`}>
                Already have an account ?{' '}
                <span className="text-[#ff4d00] cursor-pointer" onClick={onSwitch}>
                    login
                </span>
            </span>
        </motion.form>
    )
}

// ---------- Page ----------
const Page: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')

    return (
        <div className={`h-screen w-full relative flex items-center justify-center bg-[#1c1c1c] ${jetbrains.className} font-extrabold`}>
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="h-[80%] w-[35%] relative flex flex-col"
            >
                <div className={`relative w-full h-[15%] bg-[#202020] flex items-center p-2 ${clipPath}`}>
                    {/* Sliding Background */}
                    <motion.div
                        animate={{ left: activeTab === 'login' ? '0.5rem' : 'calc(50% + 0.25rem)' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className={`absolute top-2 bottom-2 w-[calc(50%-8px)] bg-[#ff4d00] ${clipPath}`}
                    />

                    <button
                        onClick={() => setActiveTab('login')}
                        className="relative z-10 w-1/2 text-white text-2xl font-bold"
                    >
                        LOGIN
                    </button>

                    <button
                        onClick={() => setActiveTab('signup')}
                        className="relative z-10 w-1/2 text-white text-2xl font-bold"
                    >
                        SIGNUP
                    </button>
                </div>

                <div className="h-[85%] bg-[#252525] flex justify-center items-center overflow-hidden">
                    <AnimatePresence mode="wait">
                        {activeTab === 'login' ? (
                            <LoginForm key="login" onSwitch={() => setActiveTab('signup')} />
                        ) : (
                            <SignupForm key="signup" onSwitch={() => setActiveTab('login')} />
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
}

export default Page