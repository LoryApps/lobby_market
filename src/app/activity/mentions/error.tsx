'use client'

import { PageError } from '@/components/ui/PageError'

export default function MentionsError({
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
      page="Mentions"
      backHref="/activity"
      backLabel="Back to activity"
    />
  )
}
