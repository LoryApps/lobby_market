'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function MonthlyLawError() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-against-400" aria-hidden="true" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-white">Failed to load digest</h1>
        <p className="text-sm text-surface-500">
          The monthly law digest could not be loaded. Try refreshing the page.
        </p>
        <Link
          href="/law"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-sm font-medium transition-colors"
        >
          Back to Law Codex
        </Link>
      </div>
    </div>
  )
}
