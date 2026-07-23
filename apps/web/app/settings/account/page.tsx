'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Mail, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const NAV_LINKS = [
    { href: '/settings', label: 'Profile' },
    { href: '/settings/account', label: 'Account & Security' },
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
        <div className="min-h-screen w-full bg-[#080808] text-neutral-100 flex flex-col md:flex-row">
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
                                link.href === '/settings/account'
                                    ? 'bg-white text-black font-bold'
                                    : 'text-neutral-400 hover:text-white hover:bg-[#18181b]'
                            }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </aside>

            <main className="flex-1 p-6 sm:p-12 flex justify-center overflow-y-auto">
                <div className="w-full max-w-lg flex flex-col gap-8 text-left">
                    <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                                Account & Security
                            </h1>
                        </div>
                    </div>

                    {/* Email section */}
                    <section className="flex flex-col gap-3">
                        <Input
                            label="Registered Email Address"
                            type="email"
                            value={user?.email ?? ''}
                            readOnly
                            disabled
                            leftElement={<Mail className="w-4 h-4 text-neutral-500" />}
                            hint="Email is registered to your identity key."
                        />
                    </section>

                    {/* Password section */}
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <Lock size={14} className="text-neutral-400" />
                            <h2 className="text-xs font-semibold text-neutral-300">Change Password</h2>
                        </div>

                        <div className="flex items-start gap-3 bg-[#121212] border border-[#27272a] p-4 rounded-sm">
                            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-neutral-400 leading-relaxed">
                                Password updates are managed via zero-knowledge tokens.
                            </p>
                        </div>
                    </section>

                    {/* Danger zone */}
                    <section className="flex flex-col gap-3 border-t border-[#27272a] pt-8">
                        <h2 className="text-xs font-semibold text-red-400">Danger Zone</h2>
                        <div className="bg-[#121212] border border-red-900/40 p-4 rounded-sm flex flex-col gap-4">
                            <div>
                                <p className="text-red-400 text-sm font-bold">Delete Account</p>
                                <p className="text-xs text-neutral-400 mt-0.5">Permanently remove your identity and E2EE keys.</p>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <label className="text-xs text-neutral-300">Type <strong className="text-red-400">delete my account</strong> to confirm:</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="text" 
                                        value={deleteConfirm}
                                        onChange={(e) => setDeleteConfirm(e.target.value)}
                                        placeholder="delete my account"
                                        className="flex-1 h-10 bg-[#18181b] border border-[#27272a] text-white px-3 text-sm rounded-sm outline-none focus:border-red-500 transition-colors"
                                    />
                                    <Button
                                        disabled={deleteConfirm !== 'delete my account'}
                                        onClick={handleDeleteAccount}
                                        variant="danger"
                                        size="md"
                                    >
                                        DELETE
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}
