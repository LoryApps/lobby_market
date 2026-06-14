'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawReviewsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError message={error.message} onRetry={reset} />
}
