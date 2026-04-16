'use client'

import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'

export default function AchievementError() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/20 mx-auto">
          <AlertCircle className="h-7 w-7 text-against-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Achievement not found</h1>
        <p className="text-sm text-surface-500 font-mono">
          This achievement may have been removed or the link is invalid.
        </p>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leaderboard
        </Link>
      </div>
    </div>
  )
}
