'use client'

import { useState } from 'react'
import Link from 'next/link'
import { JetBrains_Mono, Anybody } from 'next/font/google'
import { Lock, Mail, AlertTriangle } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400', '600'] })

const CLIP = 'polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px)'
const CLIP_BTN = 'polygon(10px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 10px)'

const NAV_LINKS = [
    { href: '/settings',         label: 'Profile' },
    { href: '/settings/account', label: 'Account' },
]

export default function AccountSettingsPage() {
    const { user } = useAuth()
    const [deleteConfirm, setDeleteConfirm] = useState('')

    const handleDeleteAccount = () => {
        if (deleteConfirm === 'delete my account') {
            toast.error('Backend deletion not yet implemented.')
            setDeleteConfirm('')
        }
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
                            link.href === '/settings/account'
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
                <div className='w-full max-w-lg flex flex-col gap-8'>
                    <h1 className='text-2xl font-black text-white'>ACCOUNT</h1>

                    {/* Email section */}
                    <section className='flex flex-col gap-3'>
                        <div className='flex items-center gap-2'>
                            <Mail size={14} className='text-[#ff4d00]' />
                            <h2 className={`text-xs font-bold uppercase tracking-widest text-[#888] ${anybody.className}`}>Email Address</h2>
                        </div>
                        <input
                            type='email'
                            value={user?.email ?? ''}
                            readOnly
                            className='bg-[#1c1c1c] border-b-2 border-[#2a2a2a] text-[#555] px-4 py-3 text-sm outline-none cursor-not-allowed'
                            style={{ clipPath: CLIP }}
                        />
                        <p className={`text-[#444] text-xs ${anybody.className} font-light`}>
                            Email is set at registration and cannot be changed.
                        </p>
                    </section>

                    {/* Password section — disabled */}
                    <section className='flex flex-col gap-3'>
                        <div className='flex items-center gap-2'>
                            <Lock size={14} className='text-[#555]' />
                            <h2 className={`text-xs font-bold uppercase tracking-widest text-[#555] ${anybody.className}`}>Change Password</h2>
                        </div>

                        {/* Backend note banner */}
                        <div className='flex items-start gap-3 bg-[#1c1c1c] border-2 border-[#2a2a2a] px-4 py-3' style={{ clipPath: CLIP }}>
                            <AlertTriangle size={14} className='text-yellow-500 flex-shrink-0 mt-0.5' />
                            <p className={`text-yellow-500/80 text-xs leading-relaxed ${anybody.className} font-light`}>
                                Password change is <span className='font-bold'>not yet supported</span> by the auth-service backend.
                                This section will be enabled once the corresponding API endpoint is implemented.
                            </p>
                        </div>

                        <div className='flex flex-col gap-3 opacity-40 pointer-events-none select-none'>
                            {['Current password', 'New password', 'Confirm new password'].map(label => (
                                <div key={label} className='flex flex-col gap-1'>
                                    <label className={`text-xs text-[#888] uppercase tracking-widest ${anybody.className}`}>{label}</label>
                                    <input
                                        type='password'
                                        disabled
                                        placeholder='••••••••'
                                        className='bg-[#252525] border-b-2 border-[#353535] text-[#555] px-4 py-3 text-sm outline-none'
                                        style={{ clipPath: CLIP }}
                                    />
                                </div>
                            ))}
                            <button
                                disabled
                                className='h-12 flex items-center justify-center gap-2 bg-[#ff4d00]/50 text-white font-bold text-sm cursor-not-allowed mt-2'
                                style={{ clipPath: CLIP }}
                            >
                                <Lock size={14} /> UPDATE PASSWORD
                            </button>
                        </div>
                    </section>

                    {/* Danger zone */}
                    <section className='flex flex-col gap-3 border-t-2 border-[#2a2a2a] pt-8'>
                        <h2 className={`text-xs font-bold uppercase tracking-widest text-red-500/60 ${anybody.className}`}>Danger Zone</h2>
                        <div className='bg-[#1c1c1c] border-2 border-red-900/30 p-4 flex flex-col gap-4' style={{ clipPath: CLIP }}>
                            <div>
                                <p className='text-red-400 text-sm font-bold'>Delete Account</p>
                                <p className={`text-[#555] text-xs mt-0.5 ${anybody.className} font-light`}>Permanently delete your account and all data. Cannot be undone.</p>
                            </div>
                            
                            <div className='flex flex-col gap-2'>
                                <label className={`text-xs text-[#888] ${anybody.className}`}>Type <strong className='text-red-400'>delete my account</strong> below to confirm:</label>
                                <div className='flex gap-2 items-stretch'>
                                    <input 
                                        type='text' 
                                        value={deleteConfirm}
                                        onChange={(e) => setDeleteConfirm(e.target.value)}
                                        placeholder='delete my account'
                                        className='flex-1 bg-[#252525] border-b-2 border-[#353535] text-white px-4 py-2 text-sm outline-none focus:border-red-500 transition-colors'
                                        style={{ clipPath: CLIP }}
                                    />
                                    <button
                                        disabled={deleteConfirm !== 'delete my account'}
                                        onClick={handleDeleteAccount}
                                        className={`px-6 text-xs font-bold transition-all ${
                                            deleteConfirm === 'delete my account' 
                                            ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95' 
                                            : 'text-red-400/30 bg-red-900/10 border-2 border-red-900/20 cursor-not-allowed'
                                        }`}
                                        style={{ clipPath: CLIP_BTN }}
                                    >
                                        DELETE
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}
