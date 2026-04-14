'use client'

import { useEffect } from 'react'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function CoalitionsCreateError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[CoalitionsCreateError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <ErrorCard
        title="Couldn't open coalition creator"
        message="There was a problem loading the coalition builder. Please try again."
        digest={error.digest}
        onReset={reset}
      />
    </div>
  )
}
