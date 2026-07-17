'use client'

import Link from 'next/link'

export default function Error() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50 items-center justify-center gap-4 text-center px-4">
      <p className="text-surface-600 text-sm">Could not load Market Pulse.</p>
      <Link href="/exchange" className="text-xs text-for-400 hover:underline">
        ← Back to Exchange
      </Link>
    </div>
  )
}
