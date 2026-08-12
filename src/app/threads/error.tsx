'use client'

import { PageError } from '@/components/ui/PageError'

export default function ThreadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Threads unavailable" message={error.message} onRetry={reset} />
}
