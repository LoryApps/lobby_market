'use client'

import { PageError } from '@/components/ui/PageError'

export default function CoalitionsAnalyticsError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <PageError
      title="Failed to load coalition analytics"
      description="Something went wrong loading your coalition data. Try again."
      onRetry={reset}
    />
  )
}
