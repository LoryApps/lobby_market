'use client'

import { PageError } from '@/components/ui/PageError'

export default function OppositionError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Opposition Unavailable"
      message="The Opposition page failed to load. Please try again."
      reset={reset}
    />
  )
}
