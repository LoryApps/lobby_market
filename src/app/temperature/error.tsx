'use client'

import { PageError } from '@/components/ui/PageError'

export default function TemperatureError({
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
      title="Temperature unavailable"
      description="Could not load civic temperature data. Please try again."
    />
  )
}
