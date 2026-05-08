'use client'

import { PageError } from '@/components/ui/PageError'

export default function TranscriptError({
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
      page="Debate Transcript"
      backHref="/debate"
      backLabel="Back to debates"
    />
  )
}
