'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function ShiftsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex items-center justify-center p-6">
        <ErrorCard
          title="Could not load opinion shifts"
          message={error.message}
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
