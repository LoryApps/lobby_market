'use client'

import { PageError } from '@/components/ui/PageError'

export default function TagStatsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      error={error}
      reset={reset}
      page="Tag Stats"
      backHref="/"
      backLabel="Back to home"
    />
  )
}
