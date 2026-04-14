'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function DebateArchiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[DebateArchiveError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto pb-24 md:pb-8">
        <ErrorCard
          title="Archive unavailable"
          message="The debate archive couldn't be loaded. Please try again in a moment."
          digest={error.digest}
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
