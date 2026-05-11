'use client'

import { PageError } from '@/components/ui/PageError'

export default function TopicSynthesisError({
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
      page="Argument Synthesis"
      backHref="/"
      backLabel="Back to feed"
    />
  )
}
