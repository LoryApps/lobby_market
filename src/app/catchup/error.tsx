'use client'

import { useEffect } from 'react'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function CatchupError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <ErrorCard
        title="Catch-up unavailable"
        message="We couldn't load your catch-up briefing. Please try again."
        onReset={reset}
      />
    </div>
  )
}
