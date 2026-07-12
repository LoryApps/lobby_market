'use client'

import { PageError } from '@/components/ui/PageError'

export default function HallOfFameError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <PageError
      title="Hall of Fame unavailable"
      message={error.message}
      onRetry={reset}
    />
  )
}
