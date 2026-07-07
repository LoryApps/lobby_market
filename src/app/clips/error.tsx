'use client'

import { PageError } from '@/components/ui/PageError'

export default function ClipsError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Clips unavailable"
      description="We couldn't load the civic clips right now."
      reset={reset}
    />
  )
}
