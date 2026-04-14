'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function LobbyCreateError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[LobbyCreateError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto pb-24 md:pb-8">
        <ErrorCard
          title="Couldn't open lobby creator"
          message="There was a problem loading the lobby creation form. Please try again."
          digest={error.digest}
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
