'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function BulletinError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4 pb-24 md:pb-8">
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white mb-2">Bulletin Unavailable</h2>
          <p className="text-sm text-surface-500 mb-6">
            Couldn&apos;t load the civic bulletin. The Lobby is still running — try refreshing.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={reset} size="sm" variant="secondary">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Try Again
            </Button>
            <Link
              href="/"
              className="text-sm text-surface-500 hover:text-white transition-colors"
            >
              Back to Feed
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
