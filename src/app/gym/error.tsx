'use client'

import { PageError } from '@/components/ui/PageError'

export default function GymError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Gym unavailable" message={error.message} onRetry={reset} />
}
