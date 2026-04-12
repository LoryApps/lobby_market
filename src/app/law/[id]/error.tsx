'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function LawError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[LawError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto pb-24 md:pb-8">
        <ErrorCard
          title="Couldn't load law"
          message="This law entry may not exist or there was a network error."
          digest={error.digest}
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
