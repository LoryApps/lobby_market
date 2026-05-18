'use client'

import { PageError } from '@/components/ui/PageError'

export default function AnthologyError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError title="Anthology unavailable" message={error.message} onRetry={reset} />
}
