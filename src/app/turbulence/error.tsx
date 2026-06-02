'use client'

import { PageError } from '@/components/ui/PageError'

export default function TurbulenceError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Turbulence data unavailable"
      description="Could not load the Civic Turbulence Index. Please try again."
      reset={reset}
    />
  )
}
