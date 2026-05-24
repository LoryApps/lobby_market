'use client'

import { PageError } from '@/components/ui/PageError'

export default function QualityTrendError({
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
      page="Quality Trend"
      backHref="/analytics"
      backLabel="Back to Analytics"
    />
  )
}
