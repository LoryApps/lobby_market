'use client'

import Link from 'next/link'

export default function LawWikiRecentError() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-8 text-center">
      <div>
        <p className="text-white font-semibold mb-2">Something went wrong</p>
        <p className="text-surface-400 text-sm mb-4">Failed to load recent law wiki edits.</p>
        <Link
          href="/law"
          className="inline-flex items-center px-4 py-2 rounded-xl bg-gold/20 text-gold border border-gold/30 text-sm font-medium hover:bg-gold/30 transition-colors"
        >
          Back to Laws
        </Link>
      </div>
    </div>
  )
}
