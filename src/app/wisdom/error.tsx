'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function WisdomError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <ErrorCard
          title="Couldn't load wisdom feed"
          message="Something went wrong fetching the wisdom feed. Please try again."
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
