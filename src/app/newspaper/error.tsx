'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function NewspaperError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-12">
        <ErrorCard
          title="Dispatch Unavailable"
          message="The Lobby Dispatch couldn't be loaded right now. Try again in a moment."
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
