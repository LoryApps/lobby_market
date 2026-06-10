'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function LawBlueprintError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[LawBlueprintError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <PageError title="Blueprint unavailable" description="Something went wrong loading this blueprint." onRetry={reset} />
      </main>
      <BottomNav />
    </div>
  )
}
