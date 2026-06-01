'use client'

import { PageError } from '@/components/ui/PageError'

export default function FrictionError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Friction data unavailable"
      description="Could not load the Civic Friction Index. Please try again."
      reset={reset}
    />
  )
}
