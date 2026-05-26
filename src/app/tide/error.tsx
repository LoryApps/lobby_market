'use client'

import { PageError } from '@/components/ui/PageError'

export default function TideError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Civic Tide unavailable"
      message="Unable to load sentiment trends right now. Try again in a moment."
      reset={reset}
    />
  )
}
