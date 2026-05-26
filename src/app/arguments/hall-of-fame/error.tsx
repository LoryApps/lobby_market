'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function HallOfFameError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[hall-of-fame] page error:', error)
  }, [error])

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex items-center justify-center pb-24">
        <PageError
          title="Hall of Fame unavailable"
          description="We couldn't load the arguments. Please try again."
          onRetry={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
