'use client'

import { PageError } from '@/components/ui/PageError'

export default function BroadcastError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <PageError
      title="Broadcast unavailable"
      description="Could not load the civic broadcast. The feed will recover shortly."
      onRetry={reset}
    />
  )
}
