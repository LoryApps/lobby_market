'use client'

import { PageError } from '@/components/ui/PageError'

export default function InflectionError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Inflection data unavailable"
      description="Could not load threshold analysis. Please try again."
      reset={reset}
    />
  )
}
