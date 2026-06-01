'use client'

import { PageError } from '@/components/ui/PageError'

export default function CivicWeatherError({
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
      page="Civic Weather"
      backHref="/"
    />
  )
}
