'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function ClashDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ClashDetailError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-900">
      <TopBar />
      <main className="max-w-2xl mx-auto pb-24 md:pb-8">
        <ErrorCard
          title="Couldn't load this clash"
          message="There was a problem fetching the clash details. Please try again."
          digest={error.digest}
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
