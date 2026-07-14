'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function LawWatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[law-watch]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-white mb-2">Law Watch unavailable</h1>
        <p className="text-sm text-surface-400 mb-6">
          Could not load the legislative tracker. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} variant="secondary">Retry</Button>
          <Link
            href="/topics?status=voting"
            className="text-sm text-for-400 hover:text-for-300 transition-colors"
          >
            Browse voting topics instead
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
