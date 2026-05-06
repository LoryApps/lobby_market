'use client'

import { ErrorCard } from '@/components/ui/ErrorCard'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MemoriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-0">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28">
        <ErrorCard
          title="Couldn't load memories"
          message="Something went wrong loading your civic memories. Please try again."
          digest={error.digest}
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
