'use client'

import { useEffect } from 'react'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function ModerationTrainingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ModerationTrainingError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <ErrorCard
        title="Training unavailable"
        message="The moderation training module couldn't be loaded. Please try again."
        digest={error.digest}
        onReset={reset}
      />
    </div>
  )
}
