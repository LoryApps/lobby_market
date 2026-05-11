'use client'

import { PageError } from '@/components/ui/PageError'

export default function ArgumentDiscussionsError({
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
      page="Discussions"
      backHref="/arguments"
      backLabel="Back to arguments"
    />
  )
}
