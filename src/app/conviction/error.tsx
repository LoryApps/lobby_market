'use client'

import { PageError } from '@/components/ui/PageError'

export default function ConvictionError({
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
      page="conviction"
      backHref="/analytics"
      backLabel="Back to analytics"
    />
  )
}
