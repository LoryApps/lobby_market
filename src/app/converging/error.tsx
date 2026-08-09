'use client'

import Link from 'next/link'
import { ArrowLeft, GitMerge } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function ConvergingError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald/10 border border-emerald/30 mb-4">
        <GitMerge className="h-5 w-5 text-emerald" />
      </div>
      <h1 className="font-mono text-xl font-bold text-white mb-2">Something went wrong</h1>
      <p className="text-sm font-mono text-surface-500 mb-6">
        Couldn&apos;t load the convergence data.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={reset} variant="for" size="sm">
          Try again
        </Button>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to feed
        </Link>
      </div>
    </div>
  )
}
