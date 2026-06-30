import Link from 'next/link'
import { JetBrains_Mono, Anybody } from 'next/font/google'

const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '700', '800'] })
const anybody = Anybody({ subsets: ['latin'], weight: ['300', '400', '600'] })

const CLIP = 'polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)'

export default function NotFound() {
    return (
        <div className={`min-h-screen w-full bg-[#131313] flex flex-col items-center justify-center gap-8 ${jetbrains.className}`}>

            {/* Glowing 404 */}
            <div className='relative select-none'>
                <span
                    className='text-[160px] font-black leading-none text-[#ff4d00]'
                    style={{ textShadow: '0 0 80px rgba(255,77,0,0.35), 0 0 20px rgba(255,77,0,0.2)' }}
                >
                    404
                </span>
                <span className='absolute inset-0 text-[160px] font-black leading-none text-[#1c1c1c] blur-sm opacity-60 pointer-events-none'>
                    404
                </span>
            </div>

            {/* Decorative line */}
            <div className='flex items-center gap-4 w-64'>
                <div className='flex-1 h-px bg-[#353535]' />
                <div className='w-2 h-2 bg-[#ff4d00] rotate-45' />
                <div className='flex-1 h-px bg-[#353535]' />
            </div>

            <div className={`text-center ${anybody.className}`}>
                <p className='text-white text-xl font-semibold'>Page not found</p>
                <p className='text-[#666] text-sm mt-2 font-light'>
                    The page you&apos;re looking for doesn&apos;t exist or was moved.
                </p>
            </div>

            <Link
                href='/'
                style={{ clipPath: CLIP }}
                className='px-8 py-3 bg-[#ff4d00] text-white font-bold text-sm hover:bg-[#e04500] transition-colors active:scale-95'
            >
                BACK TO HOME
            </Link>
        </div>
    )
}
