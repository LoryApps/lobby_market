'use client'

import { PageError } from '@/components/ui/PageError'

export default function PodiumError({
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
      page="Podium"
      backHref="/"
      backLabel="Back to feed"
    />
  )
}
