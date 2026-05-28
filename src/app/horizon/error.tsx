'use client'

import { PageError } from '@/components/ui/PageError'

export default function HorizonError({
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
      page="Horizon"
      backHref="/"
      backLabel="Back to feed"
    />
  )
}
