'use client'

import { PageError } from '@/components/ui/PageError'

export default function VersusError({
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
      page="Versus"
      backHref="/"
      backLabel="Back to home"
    />
  )
}
