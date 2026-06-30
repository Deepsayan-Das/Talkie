'use client'

import { JetBrains_Mono, Anybody } from 'next/font/google'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '700'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400'] })

export default function SocketConnecting() {
    return (
        <div className={`fixed inset-0 z-50 bg-[#131313] flex flex-col items-center justify-center gap-6 ${jetbrains.className}`}>

            {/* Animated logo mark */}
            <div className='relative w-16 h-16'>
                {/* Outer ring */}
                <span
                    className='absolute inset-0 rounded-full border-2 border-[#ff4d00] opacity-20'
                    style={{ animation: 'ping-slow 2s ease-out infinite' }}
                />
                <span
                    className='absolute inset-2 rounded-full border-2 border-[#ff4d00] opacity-40'
                    style={{ animation: 'ping-slow 2s 0.4s ease-out infinite' }}
                />
                {/* Center dot */}
                <span className='absolute inset-[22px] rounded-full bg-[#ff4d00]' />
            </div>

            <div className={`text-center ${anybody.className}`}>
                <p className='text-white text-base font-semibold tracking-wide'>Connecting to server</p>
                <p className='text-[#555] text-xs font-light mt-1'>Establishing Socket.IO connection…</p>
            </div>

            {/* Bouncing dots */}
            <div className='flex items-center gap-2'>
                {[0, 1, 2, 3].map(i => (
                    <span
                        key={i}
                        className='w-1.5 h-1.5 rounded-full bg-[#ff4d00]'
                        style={{ animation: `connecting-dot 1.4s ${i * 0.18}s ease-in-out infinite` }}
                    />
                ))}
            </div>

            <style>{`
                @keyframes ping-slow {
                    0%   { transform: scale(1);   opacity: 0.4; }
                    70%  { transform: scale(1.6); opacity: 0; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                @keyframes connecting-dot {
                    0%, 80%, 100% { transform: translateY(0);    opacity: 0.3; }
                    40%           { transform: translateY(-8px); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
