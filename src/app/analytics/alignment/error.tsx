'use client'

import { PageError } from '@/components/ui/PageError'

export default function AlignmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Alignment unavailable"
      description={error.message || 'Failed to load alignment data.'}
      onReset={reset}
    />
  )
}
