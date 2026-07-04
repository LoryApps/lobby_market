'use client'

import { PageError } from '@/components/ui/PageError'

export default function ArgumentRepliesError({
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
      page="Replies"
      backHref="/arguments/mine"
      backLabel="Back to my arguments"
    />
  )
}
