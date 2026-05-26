'use client'

import { PageError } from '@/components/ui/PageError'

export default function CanaryError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Canary offline"
      message="Unable to compute early-warning signals right now."
      reset={reset}
    />
  )
}
