'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function CitizensError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[/citizens]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-10">
        <ErrorCard
          title="Could not load citizen directory"
          description="An error occurred while loading citizens. Please try again."
          onRetry={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
