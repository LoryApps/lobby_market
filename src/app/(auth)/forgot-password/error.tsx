'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[ForgotPasswordError]', error) }, [error])

  return (
    <div className="text-center py-8">
      <div className="flex items-center justify-center h-12 w-12 rounded-2xl mx-auto mb-4 bg-against-500/10 border border-against-500/20">
        <AlertTriangle className="h-5 w-5 text-against-400" aria-hidden="true" />
      </div>
      <h1 className="font-mono text-lg font-bold text-white mb-2">Page unavailable</h1>
      <p className="text-sm text-surface-500 font-mono mb-6">
        Something went wrong. Please try again or return to the login page.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold bg-for-600/20 border border-for-600/30 text-for-400 hover:bg-for-600/40 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-400 hover:bg-surface-300 hover:text-white transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  )
}
