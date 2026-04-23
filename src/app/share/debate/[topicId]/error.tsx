'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function DebateSnapshotError() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mx-auto">
          <AlertCircle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="text-xl font-mono font-bold text-white">Something went wrong</h1>
        <p className="text-sm text-surface-500 font-mono">Could not load this debate snapshot.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
        >
          Back to Lobby
        </Link>
      </div>
    </div>
  )
}
