'use client'

import { PageError } from '@/components/ui/PageError'

export default function TopicStatsError({
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
      page="Topic Stats"
      backHref="/"
      backLabel="Back to home"
    />
  )
}
