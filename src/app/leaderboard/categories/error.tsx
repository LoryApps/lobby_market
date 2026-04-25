'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function CategoryLeaderboardError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-16 pb-24 md:pb-12">
        <ErrorCard
          title="Category Rankings Unavailable"
          message="Could not load category power rankings. Please try again."
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
