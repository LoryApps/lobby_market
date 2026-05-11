'use client'

import { PageError } from '@/components/ui/PageError'

export default function TopicEvidenceError({
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
      page="Evidence Board"
      backHref="/evidence"
      backLabel="Back to evidence library"
    />
  )
}
