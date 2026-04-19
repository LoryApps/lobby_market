'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function MomentumError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-24 flex items-center justify-center">
        <ErrorCard
          title="Could not load momentum"
          message={error.message}
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
