'use client'

import Link from 'next/link'

export default function Error() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-surface-500 text-sm mb-4">Profile not found</p>
      <Link
        href="/"
        className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
      >
        Explore Lobby Market
      </Link>
    </div>
  )
}
