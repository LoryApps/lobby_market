'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function LawAnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 pb-24 md:pb-12">
        <PageError message={error.message} onRetry={reset} />
      </main>
      <BottomNav />
    </div>
  )
}
