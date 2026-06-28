'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function AssemblyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Assembly error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-3xl mb-4">⚖️</p>
        <h1 className="text-lg font-mono font-bold text-white mb-2">Assembly unavailable</h1>
        <p className="text-sm text-surface-600 mb-6">
          The assembly chamber is temporarily out of order. Try again shortly.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} size="sm">Retry</Button>
          <Link href="/" className="text-sm text-surface-500 hover:text-white transition-colors">
            Back to feed
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
