'use client'

import { PageError } from '@/components/ui/PageError'

export default function CoalitionNetworkError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Network unavailable"
      message="Could not load the coalition alliance network."
      error={error}
      reset={reset}
    />
  )
}
