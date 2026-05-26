'use client'

import { PageError } from '@/components/ui/PageError'

export default function SeismicError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Seismic monitor offline"
      message="Unable to detect anomalies right now. Try again in a moment."
      reset={reset}
    />
  )
}
