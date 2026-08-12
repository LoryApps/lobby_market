'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function CharterError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24 flex items-center justify-center px-4">
        <PageError
          title="Charter Unavailable"
          message="We couldn't load the Civic Charter right now. Please try again."
          onRetry={reset}
        />
      </main>
      <BottomNav />
    </>
  )
}
