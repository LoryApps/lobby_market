'use client'

import { PageError } from '@/components/ui/PageError'

export default function CorrelationsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <PageError
      title="Couldn't load correlations"
      description={error.message}
      onRetry={reset}
    />
  )
}
