'use client'

import { PageError } from '@/components/ui/PageError'

export default function TagError({
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
      page="Tag"
      backHref="/"
      backLabel="Back to home"
    />
  )
}
