'use client'

import { PageError } from '@/components/ui/PageError'

export default function MeridianError({
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
      page="Meridian"
      backHref="/"
      backLabel="Back to feed"
    />
  )
}
