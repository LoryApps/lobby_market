'use client'

import { PageError } from '@/components/ui/PageError'

export default function ShiftingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Could not load Shifting Tides"
      description={error.message ?? 'An unexpected error occurred. Please try again.'}
      onRetry={reset}
    />
  )
}
