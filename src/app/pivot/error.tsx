'use client'

import { PageError } from '@/components/ui/PageError'

export default function PivotError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Could not load The Civic Pivot"
      description={error.message ?? 'An unexpected error occurred. Please try again.'}
      onRetry={reset}
    />
  )
}
