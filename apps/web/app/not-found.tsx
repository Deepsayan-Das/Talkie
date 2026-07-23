import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen w-full bg-[#080808] text-neutral-100 flex flex-col items-center justify-center gap-6 p-4">
            <div className="flex flex-col items-center gap-2">
                <span className="font-mono text-7xl font-bold text-neutral-300 tracking-widest">
                    404
                </span>
                <h1 className="text-xl font-bold text-neutral-100">
                    Page Not Found
                </h1>
                <p className="text-xs text-neutral-400 max-w-sm text-center">
                    The requested path does not exist or has been moved.
                </p>
            </div>

            <Link
                href="/chat"
                className="px-6 py-2.5 bg-white text-black font-semibold text-xs rounded-sm hover:bg-neutral-200 transition-colors"
            >
                RETURN TO CHAT
            </Link>
        </div>
    )
}
