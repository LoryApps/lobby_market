'use client'

import { PageError } from '@/components/ui/PageError'

export default function Error({
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
      page="Predictions"
      backHref="/"
      backLabel="Back to topic"
    />
  )
}
