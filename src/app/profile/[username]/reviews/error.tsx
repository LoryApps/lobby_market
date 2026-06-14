'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function ReviewsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ProfileReviewsError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <ErrorCard
          title="Couldn't load law reviews"
          message="This profile may not exist or there was a network error."
          digest={error.digest}
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
