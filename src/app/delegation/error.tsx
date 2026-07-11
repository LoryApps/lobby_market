'use client'

import { useEffect } from 'react'
import { PageError } from '@/components/ui/PageError'

export default function DelegationError({
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
      <PageError
        title="Failed to load delegations"
        description="Something went wrong loading your vote delegations. Please try again."
        onRetry={reset}
      />
    </div>
  )
}
