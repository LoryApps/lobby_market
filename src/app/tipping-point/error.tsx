'use client'

import { Target } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function TippingPointError({
  reset,
}: {
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <PageError
          icon={<Target className="h-8 w-8 text-surface-600" />}
          title="Tipping Point unavailable"
          description="Could not load tipping-point debate data. Please try again."
          onRetry={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
