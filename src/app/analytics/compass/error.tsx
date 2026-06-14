'use client'

import Link from 'next/link'
import { Compass, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function CivicCompassError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 flex flex-col items-center text-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center">
          <Compass className="h-6 w-6 text-surface-600" />
        </div>
        <h2 className="text-lg font-bold text-white">Compass unavailable</h2>
        <p className="text-sm text-surface-500 max-w-xs">
          Something went wrong loading your Civic Compass. Try again in a moment.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={reset}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
          <Link href="/analytics">
            <Button variant="ghost" size="sm">Back to Analytics</Button>
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
