'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawMomentumError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Momentum unavailable"
      message={error.message ?? 'Failed to load law momentum data. Please try again.'}
      onRetry={reset}
    />
  )
}
