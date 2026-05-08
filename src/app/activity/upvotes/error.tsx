'use client'

import { PageError } from '@/components/ui/PageError'

export default function UpvotesError({
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
      page="Upvotes"
      backHref="/activity"
      backLabel="Back to activity"
    />
  )
}
