'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import toast from 'react-hot-toast'
import { verifyEmail } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'

const HEX_64_REGEX = /^[a-f0-9]{64}$/i

function VerifyEmailInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { login: _ } = useAuth() // ensure context is available

    useEffect(() => {
        const token = searchParams.get('token')

        if (!token || !HEX_64_REGEX.test(token)) {
            toast.error('Invalid or missing verification token.')
            router.replace('/')
            return
        }

        verifyEmail(token)
            .then(accessToken => {
                localStorage.setItem('accessToken', accessToken)
                toast.success('Email verified! Welcome to Talkie')
                router.replace('/onboarding')
            })
            .catch((err: { response?: { data?: { message?: string } } }) => {
                const msg = err.response?.data?.message ?? 'Verification failed.'
                if (msg === 'VERIFICATION TOKEN ALREADY USED') {
                    toast.success('Email already verified — please log in.')
                    router.replace('/login')
                } else if (msg === 'VERIFICATION TOKEN EXPIRED') {
                    toast.error('Verification link expired. Request a new one.')
                    router.replace('/login')
                } else {
                    toast.error(msg)
                    router.replace('/')
                }
            })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return null
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={null}>
            <VerifyEmailInner />
        </Suspense>
    )
}