'use client'

import { ErrorCard } from '@/components/ui/ErrorCard'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function RadarError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <ErrorCard
          title="Radar unavailable"
          message="Could not load the civic radar. Please try again."
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
