'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function RisingThesesError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-12 pb-28 md:pb-12">
        <PageError
          error={error}
          reset={reset}
          title="Could not load rising theses"
          description="Something went wrong fetching the momentum data. Try again in a moment."
          backHref="/thesis"
          backLabel="All Theses"
        />
      </main>
      <BottomNav />
    </div>
  )
}
